import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { MongoClient } from 'mongodb';
import { imageSize } from 'image-size';
import { emptyWorkspace } from '@renovagent/contracts';
import { MongoWorkspaceRepository, OWNER } from '../../apps/api/src/repository.js';
import { createWorkspaceServer } from '../../apps/api/src/server.js';
import { DesignImageStore, normalizeImage } from '../../apps/api/src/design-images.js';
import { CatalogStore } from '../../apps/api/src/catalog.js';
import { ceilingSchema, imagineSchema, type StudioProviders } from '../../apps/api/src/studio.js';

const uri = process.env.TEST_WORKSPACE_MONGO_URI;
const photo = readFileSync(
  new URL('../../public/examples/hutchinson/photo-04.jpg', import.meta.url),
);
const samText = readFileSync(new URL('../fixtures/sam/before-pillow.txt', import.meta.url), 'utf8');

test(
  'the studio stores photos, outlines walls once, lays floors in the source frame and reads plans',
  { skip: !uri },
  async () => {
    const client = new MongoClient(uri!);
    await client.connect();
    const db = client.db(`renovagent_test_${randomUUID().replaceAll('-', '')}`);
    const repo = MongoWorkspaceRepository.forDb(db);
    await repo.collection.insertOne({
      _id: OWNER,
      version: 0,
      workspace: emptyWorkspace(OWNER),
      blobs: [],
      jobs: [],
    });
    const calls = { segment: 0, repaint: 0, read: 0 };
    const prompts: string[] = [];
    const providers: StudioProviders = {
      async segment() {
        calls.segment++;
        return { text: samText, runId: 'sam-run', model: 'sam-3.1' };
      },
      async repaint({ prompt }) {
        calls.repaint++;
        prompts.push(prompt);
        // Muse answers at its own size; the route must fit it back.
        const smaller = await normalizeImage(new Uint8Array(photo), 900);
        return { bytes: smaller.bytes, model: 'muse-image-1.0' };
      },
      async read({ schema, prompt }) {
        calls.read++;
        if (schema === imagineSchema) {
          prompts.push(prompt);
          return {
            result: {
              walls: true,
              colorName: 'Evergreen Mist',
              hex: '#2B4A36',
              sheen: 'satin',
              floor: 'lvp',
              extras: ['built-in bookshelf', ' ', 'brass sconces'],
            },
            runId: 'spark-imagine',
            model: 'muse-spark-1.3',
          };
        }
        if (schema === ceilingSchema)
          return {
            result: { estimateFt: 8.6, basis: 'door' },
            runId: 'spark-ceiling',
            model: 'muse-spark-1.3',
          };
        return {
          result: {
            photos: [
              { index: 0, kind: 'living room', title: 'Living room', floor: 'carpet' },
              { index: 7, kind: 'bedroom', title: 'Ghost', floor: 'carpet' },
            ],
            plans: [
              { name: 'LIVING ROOM', widthFt: 13.083, lengthFt: 23.167 },
              { name: 'NOISE', widthFt: 0, lengthFt: 400 },
            ],
          },
          runId: 'spark-run',
          model: 'muse-spark-1.3',
        };
      },
    };
    // A few colours standing in for a loaded brand palette.
    const catalog = new CatalogStore(db);
    await catalog.importPaint(
      [
        ['Alabaster', 'SW 7008', '#EDEAE0', 'white'],
        ['Rainforest', 'SW 9999', '#2F4B3C', 'green'],
        ['Naval', 'SW 6244', '#2F3D4C', 'blue'],
      ].map(([name, code, hex, family]) => ({
        id: `test:${code}`,
        brand: 'Test Paints',
        collection: 'Test',
        code: code!,
        name: name!,
        hex: hex!,
        family: family as 'green',
        lightness: 0.5,
      })),
    );
    const { server } = await createWorkspaceServer(
      repo,
      'synthetic-studio-token',
      true,
      undefined,
      catalog,
      undefined,
      { images: new DesignImageStore(db) },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      providers,
    );
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw Error('No address');
    const base = `http://127.0.0.1:${address.port}/api/workspace`;
    const headers = { Host: '127.0.0.1:4000', 'X-Renovagent-Client': 'workspace' };
    try {
      const session = await fetch(base + '/session', { headers });
      const auth = { ...headers, Cookie: session.headers.get('set-cookie')!.split(';')[0]! };
      const post = (path: string, body: unknown) =>
        fetch(base + path, {
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

      const uploaded = await (
        await post('/studio/photo', { data: photo.toString('base64'), name: 'living.jpg' })
      ).json();
      assert.match(uploaded.sha256, /^[a-f0-9]{64}$/);
      const served = await fetch(`${base}/design-images/${uploaded.sha256}`, { headers: auth });
      assert.equal(served.headers.get('content-type'), 'image/jpeg');

      const walls = await (await post('/studio/walls', { sha256: uploaded.sha256 })).json();
      assert.ok(walls.segments.length > 0);
      await post('/studio/walls', { sha256: uploaded.sha256 });
      assert.equal(calls.segment, 1, 'masks are cached by image');

      const floor = await (
        await post('/studio/floor', { sha256: uploaded.sha256, floor: 'lvp' })
      ).json();
      assert.deepEqual([floor.width, floor.height], [uploaded.width, uploaded.height]);
      const laid = new Uint8Array(
        await (
          await fetch(`${base}/design-images/${floor.sha256}`, { headers: auth })
        ).arrayBuffer(),
      );
      assert.equal(imageSize(laid).width, uploaded.width);
      assert.match(prompts[0]!, /oak wood-look luxury vinyl plank/);
      assert.equal(
        (await post('/studio/floor', { sha256: uploaded.sha256, floor: 'carpet' })).status,
        400,
        'only the fixed floors are offered',
      );
      assert.equal(
        (await post('/studio/walls', { sha256: 'f'.repeat(64) })).status,
        404,
        'only this workspace’s photos',
      );

      const read = await (
        await post('/studio/read', { photos: [uploaded.sha256], plans: [floor.sha256] })
      ).json();
      assert.deepEqual(
        read.photos.map((p: { title: string; sha256: string }) => [p.title, p.sha256]),
        [['Living room', uploaded.sha256]],
      );
      assert.deepEqual(read.plans, [{ name: 'LIVING ROOM', widthFt: 13.083, lengthFt: 23.167 }]);
      assert.deepEqual(
        [read.ceiling.ft, read.ceiling.note],
        [8.5, 'Ceiling estimated from the door height in the photos'],
      );
      assert.equal(calls.read, 2, 'rooms and ceiling are read side by side');

      const idea = await (
        await post('/studio/imagine', {
          text: 'dark green walls, light oak floors and a built-in bookshelf',
          room: 'Living room',
        })
      ).json();
      assert.deepEqual(idea.color, {
        name: 'Rainforest',
        code: 'SW 9999',
        hex: '#2f4b3c',
        brand: 'Test Paints',
      });
      assert.equal(idea.hex, null, 'snapped to a loaded colour, not a made-up name');
      assert.equal(idea.floor, 'lvp');
      assert.equal(idea.sheen, 'satin');
      assert.deepEqual(idea.extras, ['built-in bookshelf', 'brass sconces']);
      assert.match(prompts.at(-1)!, /"dark green walls, light oak floors/);
      assert.equal(
        (await post('/studio/imagine', { text: 'x'.repeat(301) })).status,
        400,
        'the owner’s words are bounded',
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.dropDatabase();
      await client.close();
    }
  },
);
