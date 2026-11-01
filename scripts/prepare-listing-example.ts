// Turns a folder of listing images, saved by hand from a listing the owner
// chose to feature, into a curated paint-and-floor example: the same Muse
// Spark → SAM 3.1 → Muse Image pipeline as "Show your project", run once and
// saved under public/examples/<id>/ so the page costs nothing to browse.
//   node --import tsx scripts/prepare-listing-example.ts --folder ~/Downloads/oakland \
//     --id oakland --address "2244 E 20th St" --place "Oakland, CA" --listing <url> [--ceiling 8]
import { mkdir, readFile, readdir, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join } from 'node:path';
import { museEditImage, museJson, samSegmentText, imageMediaType } from './muse-provider.js';
import { fitImage, normalizeImage } from '../apps/api/src/design-images.js';
import { parseSegmentation } from '../apps/api/src/segmentation.js';
import { floorPrompt, readPrompt, readSchema, type StudioFloor } from '../apps/api/src/studio.js';
import {
  matchPlanRooms,
  type PlanRoom,
  type ReadPhoto,
} from '../apps/web/src/features/house-example/own-project.js';
import type {
  HouseProject,
  RoomPick,
  StudioRoom,
} from '../apps/web/src/features/house-example/paint-floor.js';
import { PRESET_COLORS } from '../apps/web/src/features/house-example/paint-floor.js';

const arg = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const folder = arg('--folder')!.replace(/^~/, process.env.HOME!);
const id = arg('--id')!;
if (!folder || !/^[a-z0-9-]+$/.test(id ?? ''))
  throw Error('--folder and a lowercase --id are required');
const out = new URL(`../public/examples/${id}/`, import.meta.url);
const outPath = (name: string) => new URL(name, out);
const web = (name: string) => `./examples/${id}/${name}`;
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const exists = (url: URL) =>
  access(url).then(
    () => true,
    () => false,
  );
await mkdir(out, { recursive: true });

// 1. The owner's saved images, normalized.
const files = (await readdir(folder))
  .filter((f) => /\.(jpe?g|png|webp|heic|heif|avif)$/i.test(extname(f)))
  .sort();
if (!files.length) throw Error(`No images in ${folder}`);
const images: { name: string; bytes: Uint8Array; original: string; originalSha256: string }[] = [];
// Saving by hand often makes "(1)" copies; identical images are read once.
const seenFiles = new Set<string>();
for (const file of files) {
  const raw = new Uint8Array(await readFile(join(folder, file)));
  if (seenFiles.has(hash(raw))) continue;
  seenFiles.add(hash(raw));
  const name = `image-${String(images.length + 1).padStart(2, '0')}`;
  const normalized = await normalizeImage(raw);
  images.push({ name, bytes: normalized.bytes, original: file, originalSha256: hash(raw) });
}
console.log(`${images.length} images normalized`);
const asModel = (bytes: Uint8Array) => ({ bytes, mediaType: imageMediaType(bytes) });

// 2. Which images are room photos, which are floor plans.
const sortSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['images'],
  properties: {
    images: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['index', 'type'],
        properties: {
          index: { type: 'integer' },
          type: {
            type: 'string',
            enum: ['interior room', 'floor plan', 'bathroom', 'exterior', 'other'],
          },
        },
      },
    },
  },
};
const sorted = await museJson({
  schema: sortSchema,
  images: images.map((i) => asModel(i.bytes)),
  prompt: `These ${images.length} images come from one home's real-estate listing, numbered 0 to ${images.length - 1} in order. For each, say whether it is a photo of an interior room (living, dining, kitchen, bedroom, office, basement), a floor plan drawing, a bathroom, an exterior, or other (hallway, detail, map).`,
});
const types = new Map(
  (sorted.result as { images: { index: number; type: string }[] }).images.map((x) => [
    x.index,
    x.type,
  ]),
);
const rooms = images.filter((_, i) => types.get(i) === 'interior room');
const plans = images.filter((_, i) => types.get(i) === 'floor plan');
console.log(`Spark: ${rooms.length} room photos, ${plans.length} plans (${sorted.runId})`);

// 3. Each room photo's room and floor; the plan's printed sizes.
const read = await museJson({
  schema: readSchema,
  images: [...rooms, ...plans].map((i) => asModel(i.bytes)),
  prompt: readPrompt(rooms.length, plans.length),
});
const result = read.result as {
  photos: { index: number; kind: string; title: string; floor: string }[];
  plans: PlanRoom[];
};
// One hero photo per room title, interior rooms only, at most six.
const seen = new Set<string>();
const heroes = result.photos
  .filter((p) => p.index >= 0 && p.index < rooms.length)
  .filter((p) => {
    const key = p.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })
  .slice(0, 6);
const planRooms = result.plans.filter(
  (p) => p.widthFt > 0 && p.widthFt < 100 && p.lengthFt > 0 && p.lengthFt < 100,
);
const readPhotos: ReadPhoto[] = heroes.map((h) => ({
  sha256: rooms[h.index]!.name,
  kind: h.kind,
  title: h.title,
  floor: h.floor,
}));
const matches = matchPlanRooms(readPhotos, planRooms);
console.log(
  `Spark: ${heroes.map((h) => h.title).join(', ')}; plan rooms: ${planRooms.map((p) => p.name).join(', ') || 'none'} (${read.runId})`,
);

// 4. SAM walls and Muse floors for each hero photo.
const receipts: Record<string, unknown> = {};
async function walls(name: string, bytes: Uint8Array) {
  const file = outPath(`${name}-walls.json`);
  if (await exists(file)) return;
  const sam = await samSegmentText({ image: asModel(bytes), phrase: 'wall' });
  const seg = await parseSegmentation('wall', sam.text);
  await writeFile(
    file,
    JSON.stringify({ ...seg, model: sam.model, runId: sam.runId, imageSha256: hash(bytes) }),
  );
  console.log(`  ${name}: ${seg.segments.length} wall masks`);
}
const studioRooms: StudioRoom[] = [];
for (const [i, h] of heroes.entries()) {
  const img = rooms[h.index]!;
  await writeFile(outPath(`${img.name}.jpg`), img.bytes);
  await walls(img.name, img.bytes);
  const floors: StudioRoom['floors'] = {};
  for (const floor of ['lvp', 'hardwood'] as StudioFloor[]) {
    const name = `${img.name}-${floor}`;
    if (!(await exists(outPath(`${name}.jpg`)))) {
      const edit = await museEditImage({ image: asModel(img.bytes), prompt: floorPrompt(floor) });
      const { width, height } = await import('image-size').then((m) => m.imageSize(img.bytes));
      const fitted = await fitImage(edit.bytes, width!, height!);
      await writeFile(outPath(`${name}.jpg`), fitted.bytes);
      receipts[name] = {
        model: edit.model,
        input: `${img.name}.jpg`,
        inputSha256: hash(img.bytes),
        outputSha256: hash(fitted.bytes),
        prompt: floorPrompt(floor),
        status: 'generated-concept',
      };
      console.log(`  ${name}: Muse floor`);
    }
    await walls(name, new Uint8Array(await readFile(outPath(`${name}.jpg`))));
    floors[floor] = { src: web(`${name}.jpg`), walls: web(`${name}-walls.json`) };
  }
  const plan = matches[i] === null ? undefined : planRooms[matches[i]!];
  studioRooms.push({
    id: img.name,
    title: h.title,
    existingFloor: h.floor === 'other' ? 'floor' : h.floor,
    photo: { src: web(`${img.name}.jpg`), walls: web(`${img.name}-walls.json`) },
    floors,
    ...(plan ? { size: { xFt: plan.widthFt, yFt: plan.lengthFt } } : {}),
  });
}

// 5. The example, with starting picks so it opens on an "after".
const looks: RoomPick[] = [
  { color: PRESET_COLORS[0]!, floor: 'lvp', included: true },
  { color: PRESET_COLORS[2]!, floor: 'hardwood', included: true },
  { color: PRESET_COLORS[3]!, floor: 'lvp', included: true },
  { color: PRESET_COLORS[1]!, floor: 'hardwood', included: true },
];
const ceiling = arg('--ceiling') ? Number(arg('--ceiling')) : null;
const project: HouseProject & { receipts: unknown } = {
  id,
  address: arg('--address') ?? id,
  ...(arg('--place') ? { place: arg('--place')! } : {}),
  ...(arg('--listing') ? { listing: arg('--listing')! } : {}),
  ceilingFt: ceiling,
  rooms: studioRooms,
  starting: Object.fromEntries(studioRooms.map((r, i) => [r.id, looks[i % looks.length]!])),
  receipts: {
    sources: images.map((i, n) => ({
      image: i.name,
      original: i.original,
      originalSha256: i.originalSha256,
      type: types.get(n),
    })),
    sort: { model: sorted.model, runId: sorted.runId },
    read: { model: read.model, runId: read.runId, plans: planRooms },
    floors: receipts,
  },
};
await writeFile(outPath('project.json'), JSON.stringify(project, null, 2));
console.log(`Wrote public/examples/${id}/project.json with ${studioRooms.length} rooms`);
