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
  const key = await configuredMuseKey();
  if (!key) throw Error('MUSE_API_KEY is not configured for the Meta Model API');
  const signals = [AbortSignal.timeout(timeoutMs), ...(scope ? [scope.signal] : [])];
  let response: Response;
  try {
    response = await fetch(META_API + path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.any(signals),
    });
  } catch (error) {
    if (scope?.signal.aborted) throw Error('Muse analysis cancelled');
    if (error instanceof Error && error.name === 'TimeoutError')
      throw Error('Muse job timed out; no result imported');
    throw Error('Meta Model API unreachable');
  }
  const text = await response.text();
  if (!response.ok) {
    let detail = '';
    try {
      detail = JSON.parse(text)?.error?.message ?? '';
    } catch {}
    throw Error(
      `Meta Model API ${response.status}${detail ? `: ${detail.split(key).join('[REDACTED]').slice(0, 300)}` : ''}`,
    );
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
  timeoutMs = 240000,
}: {
  image: MuseImage;
  prompt: string;
  timeoutMs?: number;
}) {
  const body = (await metaRequest(
    '/images/edits',
    { model: MUSE_IMAGE_MODEL, prompt, images: [{ image_url: dataUrl(image) }], n: 1 },
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
