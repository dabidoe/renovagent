import { readFile, writeFile, mkdtemp, rm, mkdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';
import { runMuse } from './muse-provider.js';
import { z } from 'zod';
import {
  httpsSourceUrl,
  type PhotoReview,
  validatePropertyResearch,
  photoPlanningSchema,
} from '@renovagent/contracts';
import {
  applyPhotoReview,
  photoInspectionPrompt,
  validateInspectionBatch,
  validateResearchForJob,
} from '@renovagent/core';
import { museResultFromEvents } from './muse-property-research.js';
const manifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    baseResearch: z.unknown().optional(),
    address: z.string().min(3).max(300),
    jobId: z.string().min(1).max(300),
    goal: z.string().min(1).max(4000),
    photos: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            sourceId: z.string().min(1).max(100),
            pageUrl: httpsSourceUrl,
            imageUrl: httpsSourceUrl,
            locator: z.string().min(1).max(300),
          })
          .strict(),
      )
      .min(1)
      .max(48),
  })
  .strict();
const strings = {
  type: 'array',
  items: { type: 'string', minLength: 1, maxLength: 300 },
  maxItems: 4,
};
export const photoOutputSchema = {
  type: 'object',
  properties: {
    photos: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['reviewed', 'unreadable'] },
          roomType: {
            type: 'string',
            enum: [
              'kitchen',
              'bathroom',
              'basement',
              'utility',
              'circulation',
              'exterior',
              'living',
              'dining',
              'bedroom',
              'other',
              'uncertain',
            ],
          },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          observations: strings,
          uncertainties: strings,
          questions: { ...strings, maxItems: 3 },
          nextSteps: { ...strings, maxItems: 3 },
        },
        required: [
          'id',
          'status',
          'roomType',
          'confidence',
          'observations',
          'uncertainties',
          'questions',
          'nextSteps',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['photos'],
  additionalProperties: false,
};
export function photoOutputSchemaForIds(ids: string[]) {
  if (!ids.length || ids.length > 8 || new Set(ids).size !== ids.length)
    throw Error('Invalid photo batch identities');
  const photo = photoOutputSchema.properties.photos.items;
  const concise = {
    type: 'array',
    items: { type: 'string', minLength: 1, maxLength: 180 },
    maxItems: 2,
  };
  return {
    ...photoOutputSchema,
    properties: {
      photos: {
        ...photoOutputSchema.properties.photos,
        minItems: ids.length,
        maxItems: ids.length,
        items: {
          ...photo,
          properties: {
            ...photo.properties,
            id: { type: 'string', enum: ids },
            observations: concise,
            uncertainties: concise,
            questions: concise,
            nextSteps: concise,
          },
        },
      },
    },
  };
}
export function publicPhotoHost(address: string) {
  const value = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (value === 'localhost' || value.endsWith('.localhost') || value.endsWith('.local'))
    return false;
  if (isIP(value) === 4) {
    const [a, b] = value.split('.').map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0 || b === 2)) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) ||
      (a === 203 && b === 0) ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (isIP(value) === 6) return /^[23]/.test(value) && !value.startsWith('2001:db8:');
  return true;
}
export async function imageBytes(url: string) {
  const parsed = new URL(httpsSourceUrl.parse(url));
  if (
    parsed.username ||
    parsed.password ||
    !publicPhotoHost(parsed.hostname) ||
    (parsed.port && parsed.port !== '443')
  )
    throw Error('Photo URL must be a public HTTPS image');
  const addresses = await lookup(parsed.hostname, { all: true });
  if (!addresses.length || addresses.some((a) => !publicPhotoHost(a.address)))
    throw Error('Photo host resolves to a non-public address');
  // Pin the already-validated DNS address into the TLS request. A second DNS lookup
  // must not be able to redirect an authorized public URL into the private network.
  const response = await new Promise<import('node:http').IncomingMessage>((resolve, reject) => {
    const pinned = addresses[0];
    const request = httpsRequest(
      parsed,
      {
        lookup: (_host, options, callback) => {
          if (options.all) callback(null, [pinned] as never);
          else callback(null, pinned.address, pinned.family);
        },
        signal: AbortSignal.timeout(30000),
        headers: { Accept: 'image/jpeg,image/png,image/webp' },
      },
      resolve,
    );
    request.on('error', reject);
    request.end();
  });
  if (
    response.statusCode !== 200 ||
    !/^image\/(jpeg|png|webp)(;|$)/i.test(String(response.headers['content-type'] || ''))
  ) {
    response.destroy();
    throw Error('Source did not return a supported image; no visual claim made');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of response) {
    size += chunk.length;
    if (size > 5 * 1024 * 1024) {
      response.destroy();
      throw Error('Photo exceeds 5 MB');
    }
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
    png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    webp =
      bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (!jpeg && !png && !webp) throw Error('Image signature is unsupported');
  return {
    bytes,
    extension: jpeg ? 'jpg' : png ? 'png' : 'webp',
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}
const museBatch = (args: string[]) => runMuse(args);
export function planningOutputSchema(ids: string[]) {
  const entry = {
    type: 'object',
    properties: {
      photoIds: { type: 'array', items: { type: 'string', enum: ids }, minItems: 1, maxItems: 12 },
      text: { type: 'string', minLength: 1, maxLength: 300, pattern: '\\?$' },
    },
    required: ['photoIds', 'text'],
    additionalProperties: false,
  };
  const step = {
    ...entry,
    properties: {
      ...entry.properties,
      text: { type: 'string', minLength: 1, maxLength: 300, pattern: '[.!?]$' },
      kind: { type: 'string', enum: ['user-choice', 'site-measurement', 'qualified-review'] },
    },
    required: ['photoIds', 'text', 'kind'],
  };
  return {
    type: 'object',
    properties: {
      questions: { type: 'array', items: entry, minItems: 3, maxItems: 6 },
      nextSteps: { type: 'array', items: step, minItems: 4, maxItems: 8 },
    },
    required: ['questions', 'nextSteps'],
    additionalProperties: false,
  };
}
async function finishPhotoPlanning(
  research: ReturnType<typeof validatePropertyResearch>,
  temp: string,
  evidence: string,
  goal: string,
) {
  const review = research.photoReview!;
  const photos = review.photos.filter((photo) => photo.status === 'reviewed');
  const prompt = `Use ONLY Muse's attached-image observations below, not external research, earlier human labels or source-audit notes. These observations are unreviewed visual proposals, not verified site facts. For the project goal, propose 3–6 non-redundant decisions/questions and 4–8 ordered next steps, grounded in specific photo IDs. Cover relevant kitchen, existing bathroom, basement/service-access and circulation decisions when present. Keep sentences short, complete and under 35 words. Questions end with ?, next steps end with a period. Never estimate dimensions, infer hidden services, diagnose hazards or release construction. Separate user choices, site measurements and qualified review. Do not add room labels or facts; use only this model-generated evidence.\n${JSON.stringify({ goal, photos: photos.map(({ id, roomType, confidence, observations, uncertainties }) => ({ id, roomType, confidence, observations, uncertainties })) })}`;
  const promptFile = join(temp, 'planning-prompt.txt'),
    schema = join(temp, 'planning.schema.json');
  await writeFile(promptFile, prompt);
  await writeFile(schema, JSON.stringify(planningOutputSchema(photos.map((photo) => photo.id))));
  const events = await museBatch([
    'exec',
    '--provider',
    'meta',
    '--preset',
    'empty',
    '--workspace',
    temp,
    '--json',
    '--prompt-file',
    promptFile,
    '--output-schema',
    schema,
    '--disable-shell',
    '--disable-write',
    '--disable-web-tools',
    '--disable-reminders',
    '--disable-request-user-input',
    '--no-session-log',
    '--no-foreign-personal-context',
    '--max-model-steps',
    '2',
  ]);
  const raw = museResultFromEvents(events),
    records = events
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  const terminal = [...records]
      .reverse()
      .find((record) => record.payload_type === 'run.terminal.completed'),
    usage = [...records].reverse().find((record) => record.payload_type === 'run.usage');
  const runId = terminal?.payload?.run_stream?.id,
    model = usage?.payload?.models?.[0]?.model;
  if (typeof runId !== 'string' || typeof model !== 'string')
    throw Error('Missing planning-run provenance');
  await writeFile(
    join(evidence, 'planning.json'),
    JSON.stringify({ prompt, runId, model, result: raw }, null, 2),
    { flag: 'wx' },
  );
  const planning = photoPlanningSchema.parse({ ...raw, runId, model, goal });
  if (
    planning.questions.some((question) => !question.text.trim().endsWith('?')) ||
    planning.nextSteps.some((step) => !/[.!?]$/.test(step.text.trim()))
  )
    throw Error('Incomplete planning prose; no result imported');
  return applyPhotoReview(research, { ...review, planning }, goal);
}
export async function refineExistingPhotoReview(file: string, output: string, scopeGoal?: string) {
  const base = validatePropertyResearch(JSON.parse(await readFile(file, 'utf8')));
  if (!base.photoReview) throw Error('No attached-image review to refine');
  const evidence = output + '.evidence';
  await mkdir(evidence);
  const temp = await mkdtemp(join(tmpdir(), 'renovagent-photo-planning-'));
  try {
    const goal = scopeGoal || base.photoReview.planning?.goal || base.photoReview.goal;
    if (!goal) throw Error('Provide --goal for a review without a saved project scope.');
    const result = await finishPhotoPlanning(base, temp, evidence, goal);
    await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    console.log(
      `Saved Muse-generated planning questions and next steps to ${output}. No room labels were edited.`,
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
export async function runPhotoReview(
  jobFile: string,
  baseFile: string | undefined,
  outputFile: string,
  resumeEvidence?: string,
  loadImage: typeof imageBytes = imageBytes,
) {
  const job = manifestSchema.parse(JSON.parse(await readFile(jobFile, 'utf8'))),
    base = validateResearchForJob(
      baseFile ? JSON.parse(await readFile(baseFile, 'utf8')) : job.baseResearch,
      job.address,
      job.jobId,
    );
  if (
    new Set(job.photos.map((p) => p.id)).size !== job.photos.length ||
    new Set(job.photos.map((p) => p.imageUrl)).size !== job.photos.length ||
    job.photos.some((p) => !base.sources.some((s) => s.id === p.sourceId))
  )
    throw Error('Photo manifest has duplicate identities or missing sources');
  try {
    await access(outputFile);
    throw Error('Output exists; choose a new file to preserve history');
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  const evidence = outputFile + '.evidence';
  await mkdir(evidence); // exclusive directory: never mix runs
  const temp = await mkdtemp(join(tmpdir(), 'renovagent-photo-inputs-'));
  const review: PhotoReview = {
    method: 'muse-attached-images',
    reviewedAt: new Date().toISOString(),
    manifestHash: createHash('sha256').update(JSON.stringify(job)).digest('hex'),
    batches: [],
    photos: [],
  };
  try {
    const schema = join(temp, 'output.schema.json');
    await writeFile(schema, JSON.stringify(photoOutputSchema));
    for (let offset = 0; offset < job.photos.length; offset += 7) {
      const batch = job.photos.slice(offset, offset + 7),
        number = Math.floor(offset / 7) + 1;
      console.log(`Attaching photo batch ${number}: ${batch.map((p) => p.id).join(', ')}`);
      const attachments: {
        photo: z.infer<typeof manifestSchema>['photos'][number];
        path: string;
        sha256: string;
      }[] = [];
      for (const [index, photo] of batch.entries()) {
        const image = await loadImage(photo.imageUrl),
          path = join(temp, `attachment-${index + 1}.${image.extension}`);
        await writeFile(path, image.bytes);
        attachments.push({ photo, path, sha256: image.sha256 });
      }
      if (resumeEvidence) {
        let saved: any;
        try {
          saved = JSON.parse(await readFile(join(resumeEvidence, `batch-${number}.json`), 'utf8'));
        } catch (error) {
          if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
        }
        if (saved) {
          try {
            const ids = batch.map((p) => p.id),
              inspected = validateInspectionBatch(saved.result, ids);
            if (
              typeof saved.runId !== 'string' ||
              typeof saved.model !== 'string' ||
              !saved.prompt?.includes(JSON.stringify({ goal: job.goal, attachmentOrder: ids })) ||
              saved.attachments.length !== attachments.length ||
              attachments.some(
                (a) =>
                  !saved.attachments.some(
                    (old: any) =>
                      old.id === a.photo.id &&
                      old.imageUrl === a.photo.imageUrl &&
                      old.sourceId === a.photo.sourceId &&
                      old.pageUrl === a.photo.pageUrl &&
                      old.sha256 === a.sha256,
                  ),
              )
            )
              throw Error('Resume receipt does not match goal, attachment identities and bytes');
            review.batches.push({ runId: saved.runId, model: saved.model, photoIds: ids });
            review.photos.push(
              ...inspected.map((result) => {
                const input = attachments.find((a) => a.photo.id === result.id)!;
                return { ...result, ...input.photo, sha256: input.sha256 };
              }),
            );
            await writeFile(
              join(evidence, `batch-${number}.json`),
              JSON.stringify(saved, null, 2),
              { flag: 'wx' },
            );
            await Promise.all(attachments.map((a) => rm(a.path, { force: true })));
            console.log(
              `Reused validated photo batch ${number}; source bytes match the prior receipt`,
            );
            continue;
          } catch (error) {
            await writeFile(
              join(evidence, `rejected-prior-batch-${number}.json`),
              JSON.stringify(
                { reason: error instanceof Error ? error.message : String(error), prior: saved },
                null,
                2,
              ),
              { flag: 'wx' },
            );
            console.log(
              `Re-inspecting rejected photo batch ${number}; no labels are repaired manually`,
            );
          }
        }
      }
      await writeFile(
        schema,
        JSON.stringify(photoOutputSchemaForIds(batch.map((photo) => photo.id))),
      );
      const prompt = photoInspectionPrompt(
          job.goal,
          batch.map((p) => p.id),
        ),
        promptFile = join(temp, 'prompt.txt');
      await writeFile(promptFile, prompt);
      const events = await museBatch([
        'exec',
        '--provider',
        'meta',
        '--preset',
        'empty',
        '--workspace',
        temp,
        '--json',
        '--prompt-file',
        promptFile,
        '--output-schema',
        schema,
        ...attachments.flatMap((a) => ['--image', a.path]),
        '--disable-shell',
        '--disable-write',
        '--disable-web-tools',
        '--disable-reminders',
        '--disable-request-user-input',
        '--no-session-log',
        '--no-foreign-personal-context',
        '--max-model-steps',
        '2',
      ]);
      const raw = museResultFromEvents(events);
      const records = events
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line)),
        terminal = [...records].reverse().find((r) => r.payload_type === 'run.terminal.completed'),
        usage = [...records].reverse().find((r) => r.payload_type === 'run.usage');
      const runId = terminal?.payload?.run_stream?.id,
        model = usage?.payload?.models?.[0]?.model;
      if (typeof runId !== 'string' || typeof model !== 'string')
        throw Error('Muse did not provide run/model provenance');
      await writeFile(
        join(evidence, `batch-${number}.json`),
        JSON.stringify(
          {
            prompt,
            attachments: attachments.map(({ photo, sha256 }) => ({ ...photo, sha256 })),
            runId,
            model,
            result: raw,
          },
          null,
          2,
        ),
        { flag: 'wx' },
      );
      const inspected = validateInspectionBatch(
        raw,
        batch.map((p) => p.id),
      );
      review.batches.push({ runId, model, photoIds: batch.map((p) => p.id) });
      review.photos.push(
        ...inspected.map((result) => {
          const input = attachments.find((a) => a.photo.id === result.id)!;
          return { ...result, ...input.photo, sha256: input.sha256 };
        }),
      );
      await Promise.all(attachments.map((a) => rm(a.path, { force: true })));
      console.log(
        `Completed photo batch ${number}: ${inspected.filter((p) => p.status === 'reviewed').length}/${batch.length} readable`,
      );
    }
    review.reviewedAt = new Date().toISOString();
    const visualResult = applyPhotoReview(base, review, job.goal);
    const result = await finishPhotoPlanning(visualResult, temp, evidence, job.goal);
    await writeFile(outputFile, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    await writeFile(join(evidence, 'manifest.json'), JSON.stringify(job, null, 2), { flag: 'wx' });
    console.log(
      `Saved ${review.photos.length} photo inspections and ${result.images.length} selected planning references. Import ${outputFile}; nothing changed in the app automatically.`,
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2),
    value = (key: string) => (args.includes(key) ? args[args.indexOf(key) + 1] : undefined);
  const refinement = value('--refine');
  const job = value('--job'),
    base = value('--base'),
    output = value('--output');
  if (refinement && output)
    await refineExistingPhotoReview(resolve(refinement), resolve(output), value('--goal')).catch(
      (error) => {
        console.error(error.message);
        process.exitCode = 1;
      },
    );
  else if (!job || !output) {
    console.error(
      'Usage: npm run muse:photos -- --job photos.json --output reviewed.json [--base research.json]',
    );
    process.exitCode = 1;
  } else
    await runPhotoReview(
      resolve(job),
      base ? resolve(base) : undefined,
      resolve(output),
      value('--resume-evidence'),
    ).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
