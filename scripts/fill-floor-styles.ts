// Lays every floor style (packages/core floor-styles.ts) in each prepared
// example room that does not have it yet, the same way the studio does for
// an owner's photo (layFloor: the style's swatch goes with the photo), and
// outlines its walls with SAM 3.1 so paint can be tried over the new floor.
// Listing examples' project.json gains the new floors and their receipts;
// Hutchinson lists its style images in hutchinson-project.ts.
//   node --import tsx scripts/fill-floor-styles.ts [--only oakland]
import { access, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { FLOOR_STYLES } from '@renovagent/core';
import { museEditImage, samSegmentText, imageMediaType } from './muse-provider.js';
import { parseSegmentation } from '../apps/api/src/segmentation.js';
import { floorPrompt, layFloor } from '../apps/api/src/studio.js';
import { imageSize } from 'image-size';
import { HUTCHINSON } from '../apps/web/src/features/house-example/hutchinson-project.js';
import {
  floorImage,
  type HouseProject,
  type StudioRoom,
} from '../apps/web/src/features/house-example/paint-floor.js';

const LISTINGS = ['oakland', 'brooklyn'];
const only = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1]
  : null;
const pub = (src: string) => new URL(`../public/${src.replace(/^\.\//, '')}`, import.meta.url);
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const exists = (url: URL) =>
  access(url).then(
    () => true,
    () => false,
  );

// Four model jobs at a time.
async function pool<T>(jobs: (() => Promise<T>)[], size = 4) {
  const results: T[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < jobs.length) {
        const i = next++;
        results[i] = await jobs[i]!();
      }
    }),
  );
  return results;
}

type Made = { room: string; style: string; src: string; walls: string; receipt: unknown };
function jobsFor(project: HouseProject) {
  return project.rooms.flatMap((room: StudioRoom) =>
    FLOOR_STYLES.map((style) => async (): Promise<Made | null> => {
      // A style the room already shows, from an image on disk, is done.
      const listed = floorImage(room, style.id);
      if (listed && (await exists(pub(listed.src))) && !listed.src.endsWith(`-${style.id}.jpg`))
        return null;
      // Next to the room's first floor image: "<photo name>-<style>".
      const first = Object.values(room.floors)[0]?.src ?? room.photo.src;
      const dir = first.slice(0, first.lastIndexOf('/') + 1);
      const name = room.photo.src
        .split('/')
        .pop()!
        .replace(/\.jpg$/, '');
      const src = `${dir}${name}-${style.id}.jpg`;
      const walls = `${dir}${name}-${style.id}-walls.json`;
      const photo = new Uint8Array(await readFile(pub(room.photo.src)));
      const { width, height } = imageSize(photo);
      let receipt: unknown = null;
      if (!(await exists(pub(src)))) {
        const laid = await layFloor(
          museEditImage,
          { bytes: photo, width: width!, height: height! },
          style,
        );
        await writeFile(pub(src), laid.bytes);
        receipt = {
          model: laid.model,
          input: room.photo.src.split('/').pop(),
          inputSha256: hash(photo),
          reference: `finishes/${style.id}.jpg`,
          outputSha256: hash(laid.bytes),
          prompt: floorPrompt(style),
          status: 'generated-concept',
        };
        console.log(`  ${project.id} ${room.id}: ${style.id}`);
      }
      if (!(await exists(pub(walls)))) {
        const bytes = new Uint8Array(await readFile(pub(src)));
        const sam = await samSegmentText({
          image: { bytes, mediaType: imageMediaType(bytes) },
          phrase: 'wall',
        });
        const seg = await parseSegmentation('wall', sam.text);
        await writeFile(
          pub(walls),
          JSON.stringify({ ...seg, model: sam.model, runId: sam.runId, imageSha256: hash(bytes) }),
        );
      }
      return { room: room.id, style: style.id, src, walls, receipt };
    }),
  );
}

// Hutchinson keeps its images as files beside the room photos.
if (!only || only === 'hutchinson') {
  const made = await pool(jobsFor(HUTCHINSON));
  for (const m of made)
    if (m?.receipt)
      await writeFile(pub(m.src.replace(/\.jpg$/, '.json')), JSON.stringify(m.receipt, null, 2));
}
for (const id of LISTINGS.filter((l) => !only || l === only)) {
  const file = pub(`examples/${id}/project.json`);
  const project = JSON.parse(await readFile(file, 'utf8')) as HouseProject & {
    receipts: { floors: Record<string, unknown> };
  };
  const made = await pool(jobsFor(project));
  for (const m of made) {
    if (!m) continue;
    const room = project.rooms.find((r) => r.id === m.room)!;
    room.floors[m.style] = { src: m.src, walls: m.walls };
    if (m.receipt)
      project.receipts.floors[
        m.src
          .split('/')
          .pop()!
          .replace(/\.jpg$/, '')
      ] = m.receipt;
  }
  await writeFile(file, JSON.stringify(project, null, 2));
  console.log(`${id}: ${made.filter(Boolean).length} floor styles`);
}
