// Prepares the Hutchinson paint-and-floor walkthrough: for each hero listing
// photo, Muse Image floor variants and SAM 3.1 wall masks of every variant.
// Paid provider calls, run once by hand; the page only reads the saved files.
//   node --import tsx scripts/hutchinson-rooms.ts --photo photo-04 --floor lvp
//   node --import tsx scripts/hutchinson-rooms.ts --all
import { mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { imageSize } from 'image-size';
import { museEditImage, samSegmentText } from './muse-provider.js';
import { parseSegmentation } from '../apps/api/src/segmentation.js';

const dir = new URL('../public/examples/hutchinson/', import.meta.url);
const out = new URL('rooms/', dir);
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const exists = (url: URL) =>
  access(url).then(
    () => true,
    () => false,
  );

export const HERO_PHOTOS = ['photo-04', 'photo-05', 'photo-12', 'photo-11', 'photo-08'];
export const FLOORS: Record<string, string> = {
  lvp: 'light natural oak wood-look luxury vinyl plank flooring',
  hardwood: 'wide-plank white oak engineered hardwood flooring with a matte finish',
};
const floorPrompt = (floor: string) =>
  `Edit this real-estate listing photo. Replace only the floor covering of this room with ${floor}, laid straight, meeting the existing baseboards. Remove the existing room carpet or floor covering only. Keep everything else exactly as it is: the same camera, framing and perspective, walls and wall color, ceiling, windows, doors, closets, radiators, staircase and its carpet, furniture and lighting. Photorealistic.`;

// Muse returns WebP at its own size; the page overlays masks on the source
// frame, so every variant is converted to a JPEG at the source photo's size.
function toSourceFrame(file: string, width: number, height: number) {
  execFileSync('vips', [
    'thumbnail',
    file,
    `${file.replace(/\.webp$/, '.jpg')}[Q=86,strip]`,
    String(width),
    '--height',
    String(height),
    '--size',
    'force',
  ]);
}

async function walls(name: string, bytes: Uint8Array) {
  const raw = await samSegmentText({ image: { bytes, mediaType: 'image/jpeg' }, phrase: 'wall' });
  const segmentation = await parseSegmentation('wall', raw.text);
  await writeFile(
    new URL(`${name}-walls.json`, out),
    JSON.stringify({
      ...segmentation,
      model: raw.model,
      runId: raw.runId,
      generatedAt: new Date().toISOString(),
      imageSha256: hash(bytes),
    }),
  );
  console.log(`${name}: ${segmentation.segments.length} wall masks (${raw.runId})`);
}

async function prepare(photo: string, floors: string[]) {
  const source = new Uint8Array(await readFile(new URL(`${photo}.jpg`, dir)));
  const { width = 0, height = 0 } = imageSize(source);
  if (!(await exists(new URL(`${photo}-walls.json`, out)))) await walls(photo, source);
  for (const floor of floors) {
    const name = `${photo}-${floor}`;
    if (await exists(new URL(`${name}.jpg`, out))) continue;
    const prompt = floorPrompt(FLOORS[floor]!);
    const result = await museEditImage({
      image: { bytes: source, mediaType: 'image/jpeg' },
      prompt,
    });
    const webp = new URL(`${name}.webp`, out);
    await writeFile(webp, result.bytes);
    const { width: native, height: nativeH } = imageSize(result.bytes);
    toSourceFrame(fileURLToPath(webp), width, height);
    await rm(webp);
    const jpg = new Uint8Array(await readFile(new URL(`${name}.jpg`, out)));
    await writeFile(
      new URL(`${name}.json`, out),
      JSON.stringify(
        {
          model: result.model,
          generatedAt: new Date().toISOString(),
          input: `${photo}.jpg`,
          inputSha256: hash(source),
          outputSha256: hash(jpg),
          museSize: `${native}x${nativeH}`,
          shownSize: `${width}x${height}`,
          prompt,
          status: 'generated-concept',
        },
        null,
        2,
      ),
    );
    console.log(`${name}: Muse ${native}x${nativeH} → ${width}x${height}`);
    await walls(name, jpg);
  }
}

await mkdir(out, { recursive: true });
const arg = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : undefined;
};
if (process.argv.includes('--all'))
  for (const photo of HERO_PHOTOS) await prepare(photo, Object.keys(FLOORS));
else await prepare(arg('--photo') ?? 'photo-04', [arg('--floor') ?? 'lvp']);
