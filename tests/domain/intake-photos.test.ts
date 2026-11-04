import test from 'node:test';
import assert from 'node:assert/strict';
import { validateIntakePhotos } from '../../apps/web/src/app/project-intake.js';

const bytes = (size: number) => new Uint8Array(size);
const photo = (name: string, type: string, size = 100) => new File([bytes(size)], name, { type });

test('the New Project intake accepts staged photo formats up to 20 MB', () => {
  for (const type of [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
  ])
    validateIntakePhotos([photo(`room.${type.split('/')[1]}`, type)]);
  validateIntakePhotos([photo('big.jpg', 'image/jpeg', 20 * 1024 * 1024)]);
});

test('the New Project intake rejects files the upload would fail on', () => {
  // No detectable type: the browser would send application/octet-stream and
  // the server would answer "Expected JSON".
  assert.throws(
    () => validateIntakePhotos([new File([bytes(100)], 'photo')]),
    /not a supported photo/,
  );
  for (const [name, type] of [
    ['photo.bmp', 'image/bmp'],
    ['scan.tiff', 'image/tiff'],
    ['photo.avif', 'image/avif'],
    ['drawing.svg', 'image/svg+xml'],
  ])
    assert.throws(() => validateIntakePhotos([photo(name, type)]), /not a supported photo/, name);
  // Oversize: the server aborts mid-upload, surfacing as "Failed to fetch".
  assert.throws(
    () => validateIntakePhotos([photo('huge.jpg', 'image/jpeg', 20 * 1024 * 1024 + 1)]),
    /between 1 byte and 20 MB/,
  );
  assert.throws(
    () => validateIntakePhotos([photo('empty.jpg', 'image/jpeg', 0)]),
    /between 1 byte and 20 MB/,
  );
  assert.throws(
    () => validateIntakePhotos([photo(`${'a'.repeat(301)}.jpg`, 'image/jpeg')]),
    /shorter than 300/,
  );
});
