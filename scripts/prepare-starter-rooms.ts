// Owner-authorized, one-time preparation. No accounts, database or production writes.
// Resume uses source-hash checked checkpoints and never regenerates completed assets.
//   node --import tsx scripts/prepare-starter-rooms.ts --run
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { z } from 'zod';
import { imageSize } from 'image-size';
import { FLOOR_STYLES } from '@renovagent/core';
import { studioDesignSchema } from '@renovagent/contracts';
import { projectEnvFiles } from '../apps/api/src/database-config.js';
import { parseSegmentation } from '../apps/api/src/segmentation.js';
import {
  ceilingFrom,
  ceilingNote,
  ceilingPrompt,
  ceilingSchema,
  floorPrompt,
  layFloor,
  readPrompt,
  readSchema,
  roomSizeEstimate,
} from '../apps/api/src/studio.js';
import {
  imageMediaType,
  metaAccessMode,
  museEditImage,
  museJson,
  samSegmentText,
  withMuseBudget,
} from './muse-provider.js';
import { parseSampleRooms } from '../apps/web/src/features/project-start/sample-rooms.js';
import {
  PRESET_COLORS,
  type HouseProject,
  type Masks,
} from '../apps/web/src/features/house-example/paint-floor.js';

if (!process.argv.includes('--run'))
  throw Error('Use --run only with current owner approval for model spend.');
const { vars } = await projectEnvFiles();
for (const key of ['MUSE_API_KEY', 'RENOVAGENT_META_BASE_URL', 'RENOVAGENT_META_TOKEN'])
  if (!process.env[key]?.trim() && vars[key]) process.env[key] = vars[key];
console.log(
  `Preparing approved public sample photos (${await metaAccessMode()}); no database access.`,
);
const root = new URL('../public/', import.meta.url);
const samples = parseSampleRooms(
  JSON.parse(await readFile(new URL('starter-rooms/manifest.json', root), 'utf8')),
);
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['read', 'ceiling'],
  properties: { read: readSchema, ceiling: ceilingSchema },
};
const resultSchema = z.object({
  read: z.object({
    photos: z
      .array(
        z.object({
          index: z.number().int(),
          floor: z.enum(['carpet', 'vinyl plank', 'hardwood', 'tile', 'concrete', 'other']),
          approxWidthFt: z.number().finite(),
          approxLengthFt: z.number().finite(),
        }),
      )
      .min(1),
  }),
  ceiling: z.unknown(),
});
type State = {
  sourceSha256: string;
  analysis?: { result: unknown; model: string; runId: string; prompt: string };
  walls?: Masks & { model: string; runId: string; imageSha256: string };
  floors: Record<
    string,
    {
      file: string;
      sha256: string;
      model: string;
      prompt: string;
      walls?: Masks & { model: string; runId: string; imageSha256: string };
    }
  >;
};
const errors: string[] = [];
const cleanMasks = (value: Masks & { imageSha256: string }) => {
  const { imageSha256: _receipt, ...masks } = value;
  return masks;
};
await withMuseBudget(AbortSignal.timeout(30 * 60_000), 64, async () => {
  const queue = [...samples];
  await Promise.all(
    [0, 1].map(async () => {
      for (let sample; (sample = queue.shift()); ) {
        try {
          const bytes = new Uint8Array(
            await readFile(new URL(`starter-rooms/${sample.file}`, root)),
          );
          const sourceSha256 = hash(bytes);
          const folder = new URL(`examples/starter-${sample.id}/`, root);
          await mkdir(folder, { recursive: true });
          const stateFile = new URL('preparation.json', folder);
          let state: State;
          try {
            state = JSON.parse(await readFile(stateFile, 'utf8'));
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            state = { sourceSha256, floors: {} };
          }
          if (state.sourceSha256 !== sourceSha256)
            throw Error('Source changed; use a new versioned sample id.');
          const checkpoint = () => writeFile(stateFile, JSON.stringify(state, null, 2) + '\n');
          const image = { bytes, mediaType: imageMediaType(bytes) };
          if (!state.analysis) {
            const prompt = `${readPrompt(1, 0)}\nAlso return ceiling: ${ceilingPrompt(1)}`;
            state.analysis = { ...(await museJson({ schema, images: [image], prompt })), prompt };
            resultSchema.parse(state.analysis.result);
            await checkpoint();
            console.log(`${sample.id}: room details saved`);
          }
          const segment = async (input: Uint8Array) => {
            const sam = await samSegmentText({
              image: { bytes: input, mediaType: imageMediaType(input) },
              phrase: 'wall',
            });
            const masks = await parseSegmentation('wall', sam.text);
            if (masks.width <= 0 || masks.height <= 0)
              throw Error('Invalid wall segmentation dimensions');
            return { ...masks, model: sam.model, runId: sam.runId, imageSha256: hash(input) };
          };
          if (!state.walls) {
            state.walls = await segment(bytes);
            await checkpoint();
          }
          const dimensions = imageSize(bytes);
          for (const id of ['light-oak', 'walnut']) {
            let saved = state.floors[id];
            if (!saved) {
              const style = FLOOR_STYLES.find((s) => s.id === id)!;
              const made = await layFloor(
                museEditImage,
                { bytes, width: dimensions.width!, height: dimensions.height! },
                style,
              );
              const sha256 = hash(made.bytes),
                file = `${id}-${sha256.slice(0, 16)}.jpg`;
              await writeFile(new URL(file, folder), made.bytes, { flag: 'wx' });
              saved = state.floors[id] = {
                file,
                sha256,
                model: made.model,
                prompt: floorPrompt(style),
              };
              await checkpoint();
              console.log(`${sample.id}: ${id} preview saved`);
            }
            const floor = new Uint8Array(await readFile(new URL(saved.file, folder)));
            if (hash(floor) !== saved.sha256) throw Error('Generated image checksum mismatch');
            if (!saved.walls) {
              saved.walls = await segment(floor);
              await checkpoint();
            }
          }
          const read = resultSchema.parse(state.analysis.result);
          const room = read.read.photos.find((p) => p.index === 0);
          if (!room) throw Error('Missing source room analysis');
          const ceiling = ceilingFrom(read.ceiling);
          const estimated = roomSizeEstimate(room.approxWidthFt, room.approxLengthFt);
          const web = (file: string) => `./examples/starter-${sample.id}/${file}`;
          // Source bytes are copied exactly; existing image/mask relationships stay immutable.
          const sourceFile = `source-${sourceSha256.slice(0, 16)}.jpg`;
          await writeFile(new URL(sourceFile, folder), bytes);
          const project: HouseProject = {
            id: `starter-${sample.id}`,
            address: sample.title,
            place: `Sample photo · ${sample.source} · ${sample.license}`,
            ...(sample.sourceUrl ? { listing: sample.sourceUrl } : {}),
            ceilingFt: ceiling.ft,
            ceilingNote: ceilingNote(ceiling),
            rooms: [
              {
                id: sample.id,
                title: sample.title,
                existingFloor: room.floor === 'other' ? 'floor' : room.floor,
                photo: { src: web(sourceFile), walls: cleanMasks(state.walls) },
                floors: Object.fromEntries(
                  Object.entries(state.floors).map(([id, floor]) => [
                    id,
                    { src: web(floor.file), walls: cleanMasks(floor.walls!) },
                  ]),
                ),
                size: estimated ?? { xFt: 10, yFt: 10 },
                sizeNote: estimated
                  ? 'Rough photo-based planning estimate · not measured'
                  : 'Planning assumption: 10 × 10 ft · photo gives no reliable scale',
              },
            ],
            starting: {
              [sample.id]: {
                color: PRESET_COLORS.find((c) => c.code === 'SW 7008')!,
                floor: 'lvp',
                floorStyle: 'light-oak',
                included: true,
              },
            },
          };
          studioDesignSchema.parse({
            kind: 'studio-design',
            basis: 'listing-example',
            project,
            picks: project.starting,
            tier: 'mid',
            inspired: {},
            renderSignatures: {},
            styling: {},
          });
          await writeFile(new URL('project.json', folder), JSON.stringify(project, null, 2) + '\n');
          console.log(
            `${sample.id}: ready (${project.rooms[0]!.size!.xFt} × ${project.rooms[0]!.size!.yFt} ft estimate)`,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Preparation failed';
          errors.push(`${sample.id}: ${message}`);
          console.error(`${sample.id}: ${message}`);
        }
      }
    }),
  );
});
if (errors.length) process.exitCode = 1;
else {
  const file = new URL('starter-rooms/manifest.json', root);
  const manifest = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>[];
  await writeFile(
    file,
    JSON.stringify(
      manifest.map((room) => ({ ...room, prepared: true })),
      null,
      2,
    ) + '\n',
  );
}
console.log(`${samples.length - errors.length}/${samples.length} samples ready.`);
