// Node-only boundary. Never import this module into the web app.
import { AsyncLocalStorage } from 'node:async_hooks';
const execution = new AsyncLocalStorage<{ signal: AbortSignal; remaining: number }>();
export const withMuseBudget = <T>(signal: AbortSignal, calls: number, fn: () => Promise<T>) =>
  execution.run({ signal, remaining: calls }, fn);
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { projectEnvFiles } from '../apps/api/src/database-config.js';
// The environment, else the project settings (see projectEnvFiles: this
// checkout, or a worktree's main checkout), resolved from this file's repo.
export async function configuredMuseKey() {
  if (process.env.MUSE_API_KEY?.trim()) return process.env.MUSE_API_KEY.trim();
  const { vars } = await projectEnvFiles({}, fileURLToPath(new URL('..', import.meta.url)));
  return vars.MUSE_API_KEY?.trim() || undefined;
}
// Counts one provider call against the surrounding job's budget, if any.
function spendMuseCall() {
  const scope = execution.getStore();
  scope?.signal.throwIfAborted();
  if (scope && --scope.remaining < 0) throw Error('Muse call budget exhausted');
  return scope;
}
export async function runMuse(args: string[], timeoutMs = 180000) {
  const scope = spendMuseCall();
  const key = await configuredMuseKey();
  scope?.signal.throwIfAborted();
  return new Promise<string>((resolve, reject) => {
    const child = spawn('muse', key ? [...args, '--api-key-stdin'] : args, {
      stdio: [key ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      env: { ...process.env, MUSE_NO_AUTO_UPDATE: '1' },
    });
    if (key) {
      child.stdin?.on('error', () => {});
      child.stdin?.end(key + '\n');
    }
    let output = '',
      errorOutput = '',
      failure: Error | undefined;
    const redact = (value: string) => (key ? value.split(key).join('[REDACTED]') : value);
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      if (killTimer) return;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => child.kill('SIGKILL'), 3000);
    };
    const abort = () => {
      failure = Error('Muse analysis cancelled');
      stop();
    };
    scope?.signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => {
      failure = Error('Muse job timed out; no result imported');
      stop();
    }, timeoutMs);
    child.stdout!.on('data', (data) => {
      output += data.toString();
      if (output.length > 8 * 1024 * 1024) {
        failure = Error('Muse output exceeded limit');
        stop();
      }
    });
    child.stderr!.on('data', (data) => {
      errorOutput = (errorOutput + redact(data.toString())).slice(-4000);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      scope?.signal.removeEventListener('abort', abort);
      reject(Error(redact(error.message)));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      scope?.signal.removeEventListener('abort', abort);
      if (failure || code !== 0) reject(failure || Error(`Muse exited ${code}: ${errorOutput}`));
      else resolve(redact(output));
    });
  });
}

// Meta Model API: the same models the CLI reached with --provider meta, called
// directly so the server needs no local CLI. One request per call, no tools.
const META_API = 'https://api.meta.ai/v1';
export const MUSE_VISION_MODEL = 'muse-spark-1.3';
export const MUSE_IMAGE_MODEL = 'muse-image-1.0';
export const SAM_MODEL = 'sam-3.1';

// Deployment diagnostics: authenticated catalog reads only, never inference.
// Follows the relay when set so the boot line reflects the real path.
export async function museModelAvailability() {
  const relay = metaRelayConfig();
  const key = relay ? undefined : await configuredMuseKey();
  if (!relay && !key) return { configured: false, models: [] };
  const headers: Record<string, string> = relay
    ? { 'X-Renovagent-Token': relay.token }
    : { Authorization: `Bearer ${key}` };
  const models = await Promise.all(
    [MUSE_VISION_MODEL, MUSE_IMAGE_MODEL, SAM_MODEL].map(async (model) => {
      try {
        const response = await fetch(
          relay ? `${relay.base}/relay/models/${model}` : `${META_API}/models/${model}`,
          { headers, signal: AbortSignal.timeout(15000) },
        );
        await response.body?.cancel();
        return { model, status: response.status, available: response.ok };
      } catch {
        return { model, status: null, available: false };
      }
    }),
  );
  return { configured: true, models };
}

export const museKeyFingerprint = (key: string) => {
  // Keep only key-alphabet characters so a hostile value cannot inject log lines.
  const clean = key.replace(/[^A-Za-z0-9_+\/=.-]/g, '');
  return clean.length <= 8 ? 'short-key' : `${clean.slice(0, 4)}…${clean.slice(-4)}`;
};

export async function museKeySource(): Promise<'environment' | 'project file' | 'none'> {
  if (process.env.MUSE_API_KEY?.trim()) return 'environment';
  const { vars } = await projectEnvFiles({}, fileURLToPath(new URL('..', import.meta.url)));
  return vars.MUSE_API_KEY?.trim() ? 'project file' : 'none';
}

export type MetaRelayConfig = { base: string; token: string };
// The Modal relay (modal/meta_relay.py): same Meta calls, clean egress. When
// set, the Meta key stays in Modal and this process authenticates to the relay
// only. Relay wins over a local key so it can be verified anywhere.
export function metaRelayConfig(env: NodeJS.ProcessEnv = process.env): MetaRelayConfig | null {
  const base = env.RENOVAGENT_META_BASE_URL?.trim().replace(/\/+$/, '');
  const token = env.RENOVAGENT_META_TOKEN?.trim();
  return base && token ? { base, token } : null;
}

export type MetaAccessMode = 'direct' | 'relay' | 'none';
export async function metaAccessMode(): Promise<MetaAccessMode> {
  if (metaRelayConfig()) return 'relay';
  return (await configuredMuseKey()) ? 'direct' : 'none';
}

export type MuseAvailability = {
  configured: boolean;
  models: { model: string; status: number | null; available: boolean }[];
};

// Restyle needs the vision read and the image edit; SAM only feeds outlines.
// 401/403/404 prove misconfiguration and never heal on retry. Anything else
// (network, 5xx) is transient: warn.
export function assessMuseAvailability(result: MuseAvailability): {
  blocking: string | null;
  warnings: string[];
} {
  if (!result.configured) return { blocking: null, warnings: [] };
  const blocking: string[] = [];
  const warnings: string[] = [];
  for (const m of result.models) {
    if (m.available) continue;
    const restyleCritical = m.model === MUSE_VISION_MODEL || m.model === MUSE_IMAGE_MODEL;
    if (m.status === 401 || m.status === 403 || m.status === 404) {
      (restyleCritical ? blocking : warnings).push(
        `${m.model} is not usable with this key (catalog ${m.status})`,
      );
    } else {
      warnings.push(`${m.model} could not be confirmed (catalog ${m.status ?? 'unreachable'})`);
    }
  }
  return { blocking: blocking.length ? blocking.join('; ') : null, warnings };
}

// Startup check for the API server: log the resolved provider config (key
// redacted) and report model availability. Warn-only by default so a provider
// problem can never take the whole site down; REQUIRE_MUSE_MODELS=1 restores
// fail-fast for deploys that must prove provider health before serving.
export async function checkMuseModels(): Promise<void> {
  const relay = metaRelayConfig();
  const key = relay ? undefined : await configuredMuseKey();
  if (!relay && !key) {
    console.log('[muse] no API key configured; studio provider calls will report service configuration');
    return;
  }
  if (relay) {
    console.log(
      `[muse] restyle via relay POST ${relay.base}/relay/responses model=${MUSE_VISION_MODEL}, ` +
        `POST ${relay.base}/relay/images/edits model=${MUSE_IMAGE_MODEL}, ` +
        `outlines via relay POST ${relay.base}/relay/responses model=${SAM_MODEL}; ` +
        `relay-token=${museKeyFingerprint(relay.token)} (environment); commit=${process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown'}`,
    );
  } else {
    const source = await museKeySource();
    console.log(
      `[muse] restyle via POST ${META_API}/responses model=${MUSE_VISION_MODEL}, ` +
        `POST ${META_API}/images/edits model=${MUSE_IMAGE_MODEL}, ` +
        `outlines via POST ${META_API}/responses model=${SAM_MODEL}; ` +
        `key=${museKeyFingerprint(key!)} (${source}); commit=${process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown'}`,
    );
  }
  const { blocking, warnings } = assessMuseAvailability(await museModelAvailability());
  for (const w of warnings) console.warn(`[muse] warning: ${w}`);
  if (blocking) {
    const message = `[muse] provider misconfigured: ${blocking}`;
    if (process.env.REQUIRE_MUSE_MODELS === '1') throw new Error(message);
    console.error(`${message} (continuing: set REQUIRE_MUSE_MODELS=1 to fail boot instead)`);
  }
}

// Only documented machine codes may reach logs; never log upstream message text.
const META_ERROR_CODES = new Set([
  'invalid_api_key',
  'model_not_found',
  'file_not_found',
  'rate_limit_exceeded',
  'server_shutting_down',
  'service_overloaded',
  'backend_unavailable',
  'payload_too_large',
  'gateway_timeout',
  'content_policy_violation',
  'billing_not_configured',
]);

export type MuseImage = { bytes: Uint8Array; mediaType: string };
const dataUrl = ({ bytes, mediaType }: MuseImage) =>
  `data:${mediaType};base64,${Buffer.from(bytes).toString('base64')}`;
export function imageMediaType(bytes: Uint8Array) {
  const b = Buffer.from(bytes.subarray(0, 12));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP')
    return 'image/webp';
  throw Error('Image signature is unsupported');
}

async function metaRequest(path: string, body: unknown, timeoutMs: number) {
  const scope = spendMuseCall();
  const relay = metaRelayConfig();
  const key = relay ? undefined : await configuredMuseKey();
  if (!relay && !key)
    throw Error(
      'MUSE_API_KEY is not configured for the Meta Model API (or set RENOVAGENT_META_BASE_URL + RENOVAGENT_META_TOKEN for the relay)',
    );
  const url = relay ? `${relay.base}/relay${path}` : META_API + path;
  const headers: Record<string, string> = relay
    ? { 'X-Renovagent-Token': relay.token, 'Content-Type': 'application/json' }
    : { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const signals = [AbortSignal.timeout(timeoutMs), ...(scope ? [scope.signal] : [])];
  const payload = JSON.stringify(body);
  const attemptFetch = () =>
    fetch(url, {
      method: 'POST',
      headers,
      body: payload,
      signal: AbortSignal.any(signals),
    });
  const readErrorCode = async (response: Response): Promise<string | undefined> => {
    try {
      const code = JSON.parse(await response.text())?.error?.code;
      return META_ERROR_CODES.has(code) ? code : undefined;
    } catch {
      return undefined;
    }
  };
  let response: Response;
  try {
    response = await attemptFetch();
    // The relayed catalog flaps by region (8 vs 9 models); one retry on a
    // relayed model_not_found is cheap. Direct calls never retry a 404.
    if (relay && !response.ok) {
      const code = await readErrorCode(response.clone()).catch(() => undefined);
      if (code === 'model_not_found') {
        console.warn(`[muse] relay model_not_found, retrying once: POST ${path}`);
        response = await attemptFetch();
      }
    }
  } catch (error) {
    if (scope?.signal.aborted) throw Error('Muse analysis cancelled');
    if (error instanceof Error && error.name === 'TimeoutError')
      throw Error('Muse job timed out; no result imported');
    const failure = Error('Meta Model API unreachable');
    // Machine codes only (ENOTFOUND, ECONNREFUSED, ...): safe to log, unlike messages.
    const code =
      (error as { cause?: { code?: unknown } } | null)?.cause?.code ??
      (error as { code?: unknown } | null)?.code;
    if (typeof code === 'string' && code) (failure as unknown as { code: string }).code = code;
    throw failure;
  }
  const text = await response.text();
  if (!response.ok) {
    let detail = '';
    let providerCode: string | undefined;
    try {
      const upstream = JSON.parse(text)?.error;
      detail = typeof upstream?.message === 'string' ? upstream.message : '';
      if (META_ERROR_CODES.has(upstream?.code)) providerCode = upstream.code;
    } catch {}
    // Relay mode never sends the Meta key upstream, so only scrub it when present.
    const scrubbed = key ? detail.split(key).join('[REDACTED]') : detail;
    const failure = Error(
      `Meta Model API ${response.status}${detail ? `: ${scrubbed.slice(0, 300)}` : ''}`,
    );
    // The HTTP status carries no response content, so the server may log it.
    // The credential fingerprint proves which credential each failing request
    // used; it is server-log-only and must never reach the client.
    Object.assign(failure, {
      status: response.status,
      endpoint: path,
      providerCode,
      keyFingerprint: museKeyFingerprint(relay ? relay.token : key!),
      model: [MUSE_VISION_MODEL, MUSE_IMAGE_MODEL, SAM_MODEL].includes(
        (body as { model: string }).model,
      )
        ? (body as { model: string }).model
        : undefined,
    });
    throw failure;
  }
  return JSON.parse(text) as Record<string, unknown>;
}

type ResponseBody = {
  id?: string;
  model?: string;
  status?: string;
  output?: { type?: string; content?: { type?: string; text?: string }[] }[];
};
const outputText = (body: ResponseBody) =>
  (body.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === 'output_text')
    .map((part) => part.text ?? '')
    .join('');

// One structured answer from attached images, validated by the caller. The
// response id and model are the run provenance saved with the result.
export async function museJson({
  prompt,
  schema,
  images = [],
  model = MUSE_VISION_MODEL,
  timeoutMs = 180000,
}: {
  prompt: string;
  schema: object;
  images?: MuseImage[];
  model?: string;
  timeoutMs?: number;
}) {
  const body = (await metaRequest(
    '/responses',
    {
      model,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            ...images.map((image) => ({ type: 'input_image', image_url: dataUrl(image) })),
          ],
        },
      ],
      text: { format: { type: 'json_schema', name: 'result', schema, strict: true } },
    },
    timeoutMs,
  )) as ResponseBody;
  const text = outputText(body);
  if (body.status !== 'completed' || !text || typeof body.id !== 'string' || !body.model)
    throw Error(`Muse did not complete this job: ${body.status ?? 'no status'}`);
  return { result: JSON.parse(text), runId: body.id, model: body.model };
}

// Muse Image edit of one source photo; returns the generated image bytes.
export async function museEditImage({
  image,
  prompt,
  references = [],
  timeoutMs = 240000,
}: {
  image: MuseImage;
  prompt: string;
  // Further images the prompt refers to (for example a finish swatch); the
  // photo being edited is always the first image.
  references?: MuseImage[];
  timeoutMs?: number;
}) {
  const body = (await metaRequest(
    '/images/edits',
    {
      model: MUSE_IMAGE_MODEL,
      prompt,
      images: [image, ...references].map((i) => ({ image_url: dataUrl(i) })),
      n: 1,
    },
    timeoutMs,
  )) as { data?: { b64_json?: string }[] };
  const encoded = body.data?.[0]?.b64_json;
  if (!encoded) throw Error('Muse returned no preview image');
  return { bytes: new Uint8Array(Buffer.from(encoded, 'base64')), model: MUSE_IMAGE_MODEL };
}

// SAM 3.1 concept segmentation: the raw special-token text for one image. The
// caller parses it (apps/api/src/segmentation.ts).
export async function samSegmentText({
  image,
  phrase,
  timeoutMs = 60000,
}: {
  image: MuseImage;
  phrase: string;
  timeoutMs?: number;
}) {
  const body = (await metaRequest(
    '/responses',
    {
      model: SAM_MODEL,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: phrase },
            { type: 'input_image', image_url: dataUrl(image) },
          ],
        },
      ],
      metadata: { include_confidence: 'true' },
    },
    timeoutMs,
  )) as ResponseBody;
  if (body.status !== 'completed' || typeof body.id !== 'string')
    throw Error(`SAM did not complete: ${body.status ?? 'no status'}`);
  return { text: outputText(body), runId: body.id, model: body.model ?? SAM_MODEL };
}
