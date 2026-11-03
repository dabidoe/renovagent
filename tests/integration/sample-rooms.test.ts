import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { imageSize } from 'image-size';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { register } from 'node:module';
import { indexedDB } from 'fake-indexeddb';
import {
  fetchSampleFile,
  parseSampleRooms,
  sampleForFile,
  sampleForPhoto,
  sampleThumbnail,
  preparedSampleRoute,
  rememberPreparedSample,
} from '../../apps/web/src/features/project-start/sample-rooms.js';
import { uploadStudioPhoto } from '../../apps/web/src/features/project-start/photo-upload.js';
import { studioDesignSchema } from '@renovagent/contracts';
import {
  roomTakeoff,
  type HouseProject,
} from '../../apps/web/src/features/house-example/paint-floor.js';
import {
  loadOwnIntake,
  saveOwnIntake,
} from '../../apps/web/src/features/house-example/own-intake-draft.js';
register(
  'data:text/javascript,' +
    encodeURIComponent(
      `export async function load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context); }`,
    ),
  import.meta.url,
);
const { SampleRoomGrid } = await import(
  '../../apps/web/src/features/project-start/add-photo-sheet.js'
);
const manifest = JSON.parse(
  readFileSync(new URL('../../public/starter-rooms/manifest.json', import.meta.url), 'utf8'),
);
const rooms = parseSampleRooms(manifest);
const bytes = (file: string) =>
  readFileSync(new URL(`../../public/starter-rooms/${file}`, import.meta.url));

test('prepared samples retain exact source bytes, verified outputs, estimates and credits in saveable projects', () => {
  for (const sample of rooms) {
    assert.equal(sample.prepared, true);
    const folder = new URL(`../../public/examples/starter-${sample.id}/`, import.meta.url);
    const project = JSON.parse(
      readFileSync(new URL('project.json', folder), 'utf8'),
    ) as HouseProject;
    const receipt = JSON.parse(readFileSync(new URL('preparation.json', folder), 'utf8'));
    const room = project.rooms[0]!;
    assert.equal(project.id, `starter-${sample.id}`);
    assert.equal(project.rooms.length, 1);
    assert.match(project.place!, new RegExp(sample.source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.ok(project.place!.includes(sample.license));
    assert.equal(project.listing, sample.sourceUrl);
    assert.match(room.sizeNote!, /estimate|assumption/);
    assert.ok(project.ceilingNote);
    const input = bytes(sample.file);
    assert.equal(receipt.sourceSha256, createHash('sha256').update(input).digest('hex'));
    assert.deepEqual(
      readFileSync(new URL(room.photo.src.replace('./', '../../public/'), import.meta.url)),
      input,
    );
    assert.equal(typeof room.photo.walls, 'object');
    assert.deepEqual(Object.keys(room.floors).sort(), ['light-oak', 'walnut']);
    for (const [style, floor] of Object.entries(room.floors)) {
      const saved = receipt.floors[style];
      const output = readFileSync(new URL(saved.file, folder));
      assert.equal(createHash('sha256').update(output).digest('hex'), saved.sha256);
      assert.equal(saved.walls.imageSha256, saved.sha256);
      assert.equal(saved.model, 'muse-image-1.0');
      assert.ok(floor!.src.endsWith(saved.file));
      assert.ok(typeof floor!.walls === 'object');
    }
    assert.equal(receipt.walls.imageSha256, receipt.sourceSha256);
    const picks = project.starting!;
    assert.ok(roomTakeoff(room, project.ceilingFt, picks[room.id]!, 'mid').totalMinor > 0);
    studioDesignSchema.parse({
      kind: 'studio-design',
      basis: 'listing-example',
      project,
      picks,
      tier: 'mid',
      inspired: {},
      renderSignatures: {},
      styling: {},
    });
    rememberPreparedSample(sample);
    assert.deepEqual(sampleForPhoto(room.photo.src), sample);
    assert.equal(preparedSampleRoute(sample), `#example/starter-${sample.id}`);
  }
});

test('sample manifest rejects missing/blank rights, unsafe paths and duplicate IDs before rendering', () => {
  const valid = rooms[0]!;
  const entries = parseSampleRooms([
    valid,
    { ...valid, id: 'no-source', source: undefined },
    { ...valid, id: 'no-license', license: '' },
    { ...valid, id: 'blank-source', source: '  ' },
    { ...valid, id: 'unsafe', file: '../example-room/before.jpg' },
    { ...valid, id: 'unsafe-source', sourceUrl: 'javascript:alert(1)' },
    valid,
  ]);
  assert.deepEqual(entries, [valid]);
  const html = renderToStaticMarkup(
    createElement(SampleRoomGrid, { rooms: entries, busy: false, onChoose: () => {} }),
  );
  assert.equal(
    (html.match(/class="sample-room-grid"[\s\S]*/)?.[0].match(/<button/g) ?? []).length,
    1,
  );
  assert.match(html, /Living room/);
  assert.doesNotMatch(html, /no-source|no-license|blank-source|unsafe/);
});

test('gallery contains eight approved room photos, resized JPEGs and 400px thumbnails', () => {
  assert.deepEqual(
    rooms.map((room) => room.id),
    [
      'living-room',
      'bedroom',
      'empty-apartment',
      'sunlit-kitchen',
      'bright-bathroom',
      'calm-bedroom',
      'forest-dining',
      'artist-studio',
    ],
  );
  for (const room of rooms) {
    if (['living-room', 'bedroom'].includes(room.id)) {
      assert.equal(room.source, 'Renovagent owner photo');
      assert.equal(room.license, 'Owner-provided for demo');
    } else {
      assert.equal(room.license, 'Unsplash License');
      assert.match(room.sourceUrl!, /^https:\/\/unsplash.com\/photos\//);
      assert.equal(room.licenseUrl, 'https://unsplash.com/license');
    }
    assert.equal(room.furnishingSuggestions?.length, 2);
    assert.ok(room.furnishingSuggestions!.every((idea) => idea.brief.length >= 20));
    const full = imageSize(bytes(room.file));
    assert.equal(full.type, 'jpg');
    assert.ok(Math.max(full.width!, full.height!) <= 2048);
    const thumb = imageSize(bytes(sampleThumbnail(room).split('/').pop()!));
    assert.equal(Math.max(thumb.width!, thumb.height!), 400);
  }
});

test('sample and user files use the identical raw /studio/photo request shape', async () => {
  const original = globalThis.fetch;
  const sha = 'a'.repeat(64);
  const uploads: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url, init) => {
    if (String(url).startsWith('/starter-rooms/'))
      return new Response(bytes(rooms[0]!.file), { headers: { 'Content-Type': 'image/jpeg' } });
    uploads.push({ url: String(url), init: init! });
    return Response.json({ sha256: sha });
  }) as typeof fetch;
  try {
    const sample = await fetchSampleFile(rooms[0]!);
    assert.deepEqual(Buffer.from(await sample.arrayBuffer()), bytes(rooms[0]!.file));
    const user = new File([sample], 'my-room.jpg', { type: 'image/jpeg' });
    for (const file of [sample, user]) assert.equal(await uploadStudioPhoto(file), sha);
    for (const [i, file] of [sample, user].entries()) {
      const request = uploads[i]!;
      assert.equal(request.url, '/api/workspace/studio/photo');
      assert.equal(request.init.method, 'POST');
      assert.equal(request.init.credentials, 'same-origin');
      assert.deepEqual(request.init.headers, {
        'X-Renovagent-Client': 'workspace',
        'Content-Type': 'image/jpeg',
        'X-File-Name': encodeURIComponent(file.name),
      });
      assert.equal(request.init.body, file);
    }
    assert.deepEqual(sampleForPhoto(`/api/workspace/design-images/${sha}`), rooms[0]);
  } finally {
    globalThis.fetch = original;
  }
});

test('failed or non-JPEG sample fetch rejects without uploading or supplying canned results', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response('missing', { status: 404 })) as typeof fetch;
    await assert.rejects(fetchSampleFile(rooms[0]!), /HTTP 404/);
    globalThis.fetch = (async () =>
      new Response('<html>missing</html>', {
        headers: { 'Content-Type': 'text/html' },
      })) as typeof fetch;
    await assert.rejects(fetchSampleFile(rooms[0]!), /nonempty JPEG/);
  } finally {
    globalThis.fetch = original;
  }
});

test('sample attribution and suggestions survive intake recovery alongside real file bytes', async () => {
  globalThis.indexedDB = indexedDB;
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(bytes(rooms[1]!.file), {
      headers: { 'Content-Type': 'image/jpeg' },
    })) as typeof fetch;
  try {
    const sample = await fetchSampleFile(rooms[1]!);
    await saveOwnIntake({ idea: '', where: '', ceiling: '', photos: [sample], plans: [] });
    const restored = (await loadOwnIntake())!;
    assert.deepEqual(sampleForFile(restored.photos[0]!), rooms[1]);
    assert.deepEqual(Buffer.from(await restored.photos[0]!.arrayBuffer()), bytes(rooms[1]!.file));
    await saveOwnIntake(null);
  } finally {
    globalThis.fetch = original;
  }
});

test('curated source credits and hashes pin all six downloaded photos and their thumbnails', () => {
  const provenance = JSON.parse(
    readFileSync(new URL('../../public/starter-rooms/provenance.json', import.meta.url), 'utf8'),
  );
  assert.equal(provenance.records.length, 6);
  assert.equal(new Set(rooms.map((room) => room.roomType)).size, 6);
  for (const record of provenance.records) {
    const room = rooms.find((candidate) => candidate.id === record.id)!;
    assert.equal(room.source, `${record.photographer} / Unsplash`);
    assert.equal(room.sourceUrl, record.sourceUrl);
    assert.equal(room.licenseUrl, record.licenseUrl);
    for (const asset of Object.values(record.assets) as {
      file: string;
      bytes: number;
      sha256: string;
    }[]) {
      const data = bytes(asset.file);
      assert.equal(data.length, asset.bytes);
      assert.equal(createHash('sha256').update(data).digest('hex'), asset.sha256);
    }
  }
  const html = renderToStaticMarkup(
    createElement(SampleRoomGrid, { rooms, busy: false, onChoose: () => {} }),
  );
  assert.equal((html.match(/<article/g) ?? []).length, 8);
  assert.equal((html.match(/href="https:\/\/unsplash.com\/photos\//g) ?? []).length, 6);
});
