// A bounded capture for the owner's prepared demo. No workspace mutations.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { samSegmentText, museEditImage } from './muse-provider.js';
import { parseSegmentation } from '../apps/api/src/segmentation.js';
const dir = new URL('../public/examples/hutchinson/', import.meta.url);
const image = new Uint8Array(await readFile(new URL('photo-04.jpg', dir)));
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
if (process.argv.includes('--sam')) {
  const raw = await samSegmentText({
    image: { bytes: image, mediaType: 'image/jpeg' },
    phrase: 'floor',
  });
  const segmentation = await parseSegmentation('floor', raw.text);
  await writeFile(
    new URL('sam-floor.json', dir),
    JSON.stringify(
      {
        ...segmentation,
        model: raw.model,
        runId: raw.runId,
        generatedAt: new Date().toISOString(),
        photoId: 'photo-04',
        sourceSha256: hash(image),
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ model: raw.model, runId: raw.runId, masks: segmentation.segments.length }),
  );
}
if (process.argv.includes('--look')) {
  const reference = new Uint8Array(await readFile(new URL('blender-reference.png', dir)));
  const prompt =
    'Create a polished architectural concept rendering from this Blender room-layout reference. Preserve the L-shaped exterior footprint, front open living/dining room, rear galley kitchen and the existing stair position. Keep the isometric cutaway camera and all exterior openings. Whole-house refresh: warm white walls, light oak flooring, simple black lighting details, restrained contemporary furnishings. Keep the kitchen layout as a starting option. Do not add a new enclosed bathroom; its position is still an investigation. Improve realism and materials, but retain the reference layout. This is an unverified concept based on a listing floor plan, not a construction drawing. No text or dimension labels.';
  const result = await museEditImage({
    image: { bytes: reference, mediaType: 'image/png' },
    prompt,
  });
  await writeFile(new URL('muse-concept.png', dir), result.bytes);
  await writeFile(
    new URL('muse-concept.json', dir),
    JSON.stringify(
      {
        model: result.model,
        generatedAt: new Date().toISOString(),
        input: 'blender-reference.png',
        inputSha256: hash(reference),
        outputSha256: hash(result.bytes),
        prompt,
        status: 'generated-concept',
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ model: result.model, bytes: result.bytes.length }));
}
