import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { imageSize } from 'image-size';
import { thumbnailUrl } from '../../apps/web/src/features/house-example/ui-thumbnails.js';

test('bundled UI thumbnails resolve to small existing images; private and unknown URLs remain intact', async () => {
  const module = await readFile(
    new URL('../../apps/web/src/features/house-example/ui-thumbnails.ts', import.meta.url),
    'utf8',
  );
  const sources = [...module.matchAll(/'((?:examples|finishes)\/[^']+\.jpg)':/g)].map(
    (match) => match[1]!,
  );
  assert.ok(sources.length >= 20);
  let originalBytes = 0,
    thumbnailBytes = 0;
  for (const source of sources) {
    const url = thumbnailUrl(`./${source}`);
    assert.match(url, /^\.\/ui-thumbnails\/[a-f0-9]{16}\.webp$/);
    assert.equal(thumbnailUrl(`/${source}`), url);
    const [original, thumbnail] = await Promise.all([
      readFile(new URL(`../../public/${source}`, import.meta.url)),
      readFile(new URL(`../../public/${url.slice(2)}`, import.meta.url)),
    ]);
    const dimensions = imageSize(thumbnail);
    assert.ok(Math.max(dimensions.width, dimensions.height) <= 640);
    assert.equal(dimensions.type, 'webp');
    originalBytes += original.length;
    thumbnailBytes += thumbnail.length;
  }
  assert.ok(thumbnailBytes < originalBytes / 10);
  for (const src of [
    '/api/workspace/design-images/' + 'a'.repeat(64),
    'blob:private-browser-photo',
    './examples/not-prepared.jpg',
  ])
    assert.equal(thumbnailUrl(src), src);
});
