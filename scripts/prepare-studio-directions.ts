// Explicit asset preparation only; never called by the public homepage.
// Two bounded Muse Image edits of the bundled public example, no workspace writes.
import { readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  STUDIO_DIRECTIONS,
  DIRECTION_INPUT,
} from '../apps/web/src/features/house-example/studio-directions.js';
import { restylePrompt } from '../apps/api/src/studio.js';
import { fitImage } from '../apps/api/src/design-images.js';
import { museEditImage, withMuseBudget } from './muse-provider.js';

if (!process.argv.includes('--render'))
  throw Error('Pass --render to prepare the two Muse image assets.');
// Saved studio revisions refer to these bundled paths. Never replace their pixels.
for (const d of STUDIO_DIRECTIONS.slice(1)) {
  const exists = await access(d.image.replace('./', 'public/')).then(
    () => true,
    () => false,
  );
  if (exists)
    throw Error(
      `${d.id} is already prepared. Use a new versioned asset path to preserve saved designs.`,
    );
}
const bytes = await readFile(DIRECTION_INPUT);
const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const changes = {
  'studio-office': [
    {
      target: 'open space in window bay',
      becomes: 'compact oak writing desk facing center window',
    },
    { target: 'floor in front of desk', becomes: 'one upholstered blue desk chair facing desk' },
    { target: 'blank wall on right', becomes: 'low oak bookcase with books' },
    { target: 'bare center floor', becomes: 'soft blue-gray area rug' },
    { target: 'empty right corner', becomes: 'brass floor lamp' },
    { target: 'bay corner floor', becomes: 'potted plant' },
  ],
  'studio-dining': [
    { target: 'open space under pendant', becomes: 'round walnut dining table' },
    {
      target: 'space surrounding table',
      becomes: 'four rust upholstered dining chairs facing table',
    },
    { target: 'blank wall on right', becomes: 'low walnut sideboard' },
    { target: 'bare center floor', becomes: 'cream rug with muted terracotta pattern' },
    { target: 'bay corner floor', becomes: 'potted plant' },
  ],
};
const receipts: unknown[] = [];
await withMuseBudget(AbortSignal.timeout(480000), 2, async () => {
  for (const d of STUDIO_DIRECTIONS.slice(1)) {
    const mapped = changes[d.id as keyof typeof changes];
    const prompt = restylePrompt(
      mapped,
      { name: 'Alabaster', code: 'SW 7008', hex: '#edeae0' },
      {
        mode: 'furnish',
        preserveFloor: true,
        hasReference: false,
        keep: 'Exact camera, room shape, all three bay windows, original pendant, trim and doorway.',
        brief: d.brief,
      },
    );
    const result = await museEditImage({ image: { bytes, mediaType: 'image/jpeg' }, prompt });
    const output = d.image.replace('./', 'public/');
    // Keep the costly provider output before normalization, without another call on failure.
    await writeFile(`.local/studio-evidence/2026-11-02/${d.id}-provider-image`, result.bytes);
    const fitted = await fitImage(result.bytes, 1600, 1066);
    await writeFile(output, fitted.bytes);
    receipts.push({
      id: d.id,
      model: result.model,
      input: DIRECTION_INPUT.replace('public/', '/'),
      inputSha256: hash(bytes),
      output: d.image,
      outputSha256: hash(fitted.bytes),
      prompt,
      changes: mapped,
    });
    await writeFile(
      'public/examples/studio-story/directions-provenance.json',
      JSON.stringify(
        {
          preparedAt: new Date().toISOString(),
          generated: true,
          note: 'Prepared Muse photo concepts. Editable 3D starters use illustrative CC0 assets, not photo reconstruction or exact products.',
          receipts,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(`${d.id}: prepared ${result.bytes.length} bytes with ${result.model}`);
  }
});
