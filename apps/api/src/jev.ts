// Node-only boundary for TypeSafe's Jev (System One) model. Server-side only:
// the key never reaches the browser. Jev returns typed judgments (yes/no
// probability, choice, score, image box), never free text, so answers are
// consumed by code. Its output is interpretation: it ranks or flags evidence
// the code already holds and never becomes a source itself.
//
// Docs: https://docs.typesafe.ai/api/system-one.md, /images.md
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

const BASE = process.env.TYPESAFE_BASE_URL ?? 'https://api.typesafe.ai';

export async function configuredJevKey() {
  if (process.env.TYPESAFE_API_KEY?.trim()) return process.env.TYPESAFE_API_KEY.trim();
  for (const relative of ['../../../.env', '../../../server/.env']) {
    try {
      const vars = parseEnv(
        await readFile(fileURLToPath(new URL(relative, import.meta.url)), 'utf8'),
      );
      if (vars.TYPESAFE_API_KEY?.trim()) return vars.TYPESAFE_API_KEY.trim();
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }
  return undefined;
}

type Question =
  | { type: 'noul'; instructions: string; criteria?: { true: string; false: string } }
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'score'; instructions: string; criteria: string[] }
  | { type: 'box'; instructions: string };
export type JevAnswer =
  | { type: 'noul'; noul: number }
  | { type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number> }
  | { type: 'score'; score: number; confidence: number }
  | {
      type: 'box';
      box: { top: number; bottom: number; left: number; right: number } | null;
      confidence: number | null;
    };
export type JevImage = { format: 'png' | 'jpg' | 'jpeg'; bytes: Uint8Array };

export class JevError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function askJev(
  state: unknown,
  questions: Record<string, Question>,
  options: {
    images?: Record<string, JevImage>;
    key?: string;
    fetch?: typeof fetch;
    retries?: number;
    backoffMs?: number;
  } = {},
) {
  const key = options.key ?? (await configuredJevKey());
  if (!key) throw new JevError(0, 'TYPESAFE_API_KEY is not configured');
  const images = options.images ?? {};
  const body = {
    model: 'jev-latest',
    state,
    questions,
    ...(Object.keys(images).length
      ? {
          assets: Object.fromEntries(
            Object.entries(images).map(([ref, img]) => [
              ref,
              {
                type: 'image',
                format: img.format,
                data_base64: Buffer.from(img.bytes).toString('base64'),
              },
            ]),
          ),
        }
      : {}),
  };
  const send = () =>
    (options.fetch ?? fetch)(`${BASE}/v1/systemone`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(Object.keys(images).length || Object.values(questions).some((q) => q.type === 'box')
          ? { 'TypeSafe-Danger-Zone-Images': 'true' }
          : {}),
      },
      body: JSON.stringify(body),
    });
  // Rate limits (429) and overload (529) are retried with backoff, as the API
  // docs advise; a bounded number of attempts so nothing retries forever.
  let res = await send();
  for (
    let attempt = 0;
    attempt < (options.retries ?? 4) && [429, 529].includes(res.status);
    attempt++
  ) {
    await new Promise((r) => setTimeout(r, (options.backoffMs ?? 1500) * 2 ** attempt));
    res = await send();
  }
  const text = await res.text();
  if (!res.ok)
    throw new JevError(
      res.status,
      `Jev ${res.status}: ${text.split(key).join('[key]').slice(0, 300)}`,
    );
  const json = JSON.parse(text) as {
    model: string;
    answers: Record<string, JevAnswer>;
    usage: { input_tokens: number };
  };
  return { model: json.model, answers: json.answers, inputTokens: json.usage?.input_tokens ?? 0 };
}

// Which candidate sections apply to this project's work? One yes/no per
// candidate in a single request (they run in parallel and cannot see each
// other). Candidates come from code (the digest and keyword shortlist); Jev
// only orders them.
export async function rankSections(
  work: { request: string; packages: string[]; facts: string[] },
  candidates: { key: string; code: string; id: string; title: string; excerpt: string }[],
  options: Parameters<typeof askJev>[2] = {},
) {
  const questions = Object.fromEntries(
    candidates.map((c, i) => [
      `s${i}`,
      {
        type: 'noul' as const,
        instructions: `Would a contractor need to check ${c.code} ${c.id} ("${c.title}") for the work described in \`project\`? The section says: "${c.excerpt}"`,
        criteria: {
          true: 'The section governs part of this planned work or a condition it creates.',
          false: 'The section concerns work, rooms or systems this project does not touch.',
        },
      },
    ]),
  );
  const { answers, model, inputTokens } = await askJev({ project: work }, questions, options);
  return {
    model,
    inputTokens,
    ranked: candidates
      .map((c, i) => ({ ...c, probability: (answers[`s${i}`] as { noul: number }).noul }))
      .sort((a, b) => b.probability - a.probability),
  };
}

// Photo checks for a room: is each item visible, and where (for pins on the
// owner's own photo). Observations, never verification: a fan in a photo does
// not show it is ducted outdoors.
export async function photoChecks(
  image: JevImage,
  items: { key: string; present: string; locate?: string }[],
  options: Parameters<typeof askJev>[2] = {},
) {
  const ref = 'room-photo-7f3c2a91';
  const questions: Record<string, Question> = {};
  for (const item of items) {
    questions[`${item.key}_present`] = {
      type: 'noul',
      instructions: `Looking at the photo ${ref}: ${item.present}`,
    };
    if (item.locate)
      questions[`${item.key}_box`] = { type: 'box', instructions: `${item.locate} in ${ref}` };
  }
  const { answers, model, inputTokens } = await askJev(
    { photo: ref, note: 'Homeowner photo of the room to be renovated.' },
    questions,
    { ...options, images: { [ref]: image } },
  );
  return {
    model,
    inputTokens,
    items: items.map((item) => ({
      key: item.key,
      probability: (answers[`${item.key}_present`] as { noul: number }).noul,
      box: item.locate ? ((answers[`${item.key}_box`] as { box: unknown })?.box ?? null) : null,
    })),
  };
}

// Order a review's code findings by how likely Jev judges each provision to
// apply to this project. Findings are only annotated and sorted; nothing is
// added, removed or re-worded, and the probability is labelled interpretation.
export async function rankReviewFindings<
  F extends {
    id: string;
    citations: { kind: string; title: string; locator: string | null; excerpt: string }[];
  },
>(
  findings: F[],
  work: { request: string; packages: string[]; facts: string[] },
  options: Parameters<typeof askJev>[2] = {},
) {
  // Each cited provision is judged on its own (up to six per finding); a
  // finding takes its most relevant citation, so a permit question citing
  // both the general rule and its exemptions is not judged by the first alone.
  const candidates = findings.flatMap((f) =>
    f.citations
      .filter((c) => c.kind === 'code-provision')
      .slice(0, 6)
      .map((c, i) => ({
        key: `${f.id}#${i}`,
        code: c.title.split(' ')[0] ?? '',
        id: c.locator?.replace(/^Section /, '') ?? '',
        title: c.title,
        excerpt: c.excerpt.slice(0, 400),
      })),
  );
  if (!candidates.length)
    return { model: null, findings: findings.map((f) => ({ ...f, relevance: null })) };
  const { model, ranked } = await rankSections(work, candidates, options);
  const p = new Map<string, number>();
  for (const r of ranked) {
    const id = r.key.slice(0, r.key.lastIndexOf('#'));
    p.set(id, Math.max(p.get(id) ?? 0, r.probability));
  }
  return {
    model,
    findings: findings
      .map((f) => ({ ...f, relevance: p.get(f.id) ?? null }))
      .sort((a, b) => (b.relevance ?? 2) - (a.relevance ?? 2)),
  };
}
