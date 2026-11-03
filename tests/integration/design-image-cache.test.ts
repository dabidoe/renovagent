import test from 'node:test';
import assert from 'node:assert/strict';
import { Binary, type Db } from 'mongodb';
import { DesignImageStore } from '../../apps/api/src/design-images.js';

function storage() {
  const records = new Map<string, Record<string, unknown>>();
  const transfers: number[] = [];
  const collection = {
    async updateOne(filter: { _id: string }, update: { $setOnInsert: Record<string, unknown> }) {
      if (!records.has(filter._id)) records.set(filter._id, update.$setOnInsert);
    },
    async findOne(
      filter: { _id: string; ownerId: string },
      options?: { projection?: { data: number } },
    ) {
      const record = records.get(filter._id);
      if (!record || record.ownerId !== filter.ownerId) return null;
      if (options?.projection?.data === 0) {
        const { data: _bytes, ...meta } = record;
        transfers.push(0);
        return meta;
      }
      transfers.push((record.data as Binary).buffer.length);
      return { ...record, data: new Binary(Buffer.from((record.data as Binary).buffer)) };
    },
  };
  return { records, transfers, db: { collection: () => collection } as unknown as Db };
}
const fixture = (n: number) => ({
  bytes: new Uint8Array([255, 216, 255, n]),
  width: 1,
  height: 1,
  mediaType: 'image/jpeg' as const,
});

test('image bytes cached after commit avoid a binary fetch; returned arrays cannot mutate the cache', async () => {
  const store = storage(),
    images = new DesignImageStore(store.db);
  const input = fixture(1),
    original = new Uint8Array(input.bytes);
  const saved = await images.put('owner-a', input);
  input.bytes[3] = 99;
  const first = await images.get('owner-a', saved.sha256);
  assert.deepEqual(first!.bytes, original);
  first!.bytes[3] = 88;
  const next = await images.get('owner-a', saved.sha256);
  assert.deepEqual(next!.bytes, original);
  assert.deepEqual(store.transfers, [0, 0]);
  assert.equal(await images.get('owner-b', saved.sha256), null, 'cached bytes remain owner-scoped');
  store.records.delete(`owner-a:${saved.sha256}`);
  assert.equal(
    await images.get('owner-a', saved.sha256),
    null,
    'deleted records are not served from cache',
  );
});

test('cold reads fetch bytes once; the byte budget evicts least-recently-used images', async () => {
  const store = storage(),
    writer = new DesignImageStore(store.db, 0);
  const a = await writer.put('owner-a', fixture(1));
  const b = await writer.put('owner-a', fixture(2));
  const images = new DesignImageStore(store.db, 4);
  assert.ok(await images.get('owner-a', a.sha256));
  assert.ok(await images.get('owner-a', a.sha256));
  assert.ok(await images.get('owner-a', b.sha256));
  assert.ok(await images.get('owner-a', a.sha256));
  assert.deepEqual(store.transfers, [4, 0, 4, 4]);
});
