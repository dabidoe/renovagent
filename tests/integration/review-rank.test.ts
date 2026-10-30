import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { MongoClient } from 'mongodb';
import { emptyWorkspace } from '@renovagent/contracts';
import { MongoWorkspaceRepository, OWNER } from '../../apps/api/src/repository.js';
import { createWorkspaceServer } from '../../apps/api/src/server.js';
import type { rankReviewFindings, readRoomPhoto } from '../../apps/api/src/jev.js';

// A plain grey PNG of the given size (valid image bytes for size checks).
function png(width: number, height: number) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  const rows = Buffer.alloc((width + 1) * height, 0x80);
  for (let y = 0; y < height; y++) rows[y * (width + 1)] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const uri = process.env.TEST_WORKSPACE_MONGO_URI;
const body = {
  work: { request: 'Repaint the living room', packages: ['Wall paint'], facts: [] },
  findings: [
    {
      id: 'f1',
      summary: 'not sent on',
      citations: [
        {
          kind: 'code-provision',
          title: 'CRC 2025 R105.2',
          locator: 'Section R105.2',
          excerpt: 'Painting',
          extra: 'x',
        },
      ],
    },
    { id: 'f2', citations: [] },
  ],
};

test(
  'review ranking needs a session, returns scores only, and is rate limited',
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
    const seen: unknown[] = [];
    const rank = (async (findings, work) => {
      seen.push({ findings, work });
      return {
        model: 'jev-test',
        findings: findings.map((f) => ({ ...f, relevance: f.citations.length ? 0.9 : null })),
      };
    }) as typeof rankReviewFindings;
    const photos: unknown[] = [];
    const readPhoto = (async (image) => {
      photos.push(image);
      return {
        model: 'jev-test',
        room: { kind: 'bathroom', confidence: 1 },
        floor: { kind: 'tile', confidence: 0.7 },
        seen: { toilet: 0.9, vanity: 0.9, shower: 0, tub: 0, fan: 0.05, window: 0, damage: 0 },
        vanityDated: null,
        boxes: { toilet: { top: 0.5, bottom: 0.9, left: 0.7, right: 0.9 } },
      };
    }) as typeof readRoomPhoto;
    const { server } = await createWorkspaceServer(
      repo,
      'synthetic-rank-token',
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { configured: async () => true, rank, readPhoto },
    );
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw Error('No address');
    const base = `http://127.0.0.1:${address.port}/api/workspace`;
    const headers = {
      Host: '127.0.0.1:4000',
      'X-Renovagent-Client': 'workspace',
      'Content-Type': 'application/json',
    };
    const post = (h: Record<string, string>, b: unknown = body) =>
      fetch(`${base}/review/rank`, { method: 'POST', headers: h, body: JSON.stringify(b) });
    try {
      // No session cookie: refused before any model call.
      assert.equal((await post(headers)).status, 403);
      assert.equal(seen.length, 0);

      const session = await fetch(`${base}/session`, { headers });
      assert.equal((await session.json()).jev, true);
      const auth = { ...headers, Cookie: session.headers.get('set-cookie')!.split(';')[0]! };

      const ok = await post(auth);
      assert.equal(ok.status, 200);
      const result = await ok.json();
      assert.deepEqual(result.relevance, { f1: 0.9, f2: null });
      assert.equal(result.model, 'jev-test');
      assert.match(result.note, /interpretation/);
      // Only ids, citations and the work description reach the model; extra
      // fields are stripped.
      const sent = seen[0] as { findings: { citations: Record<string, unknown>[] }[] };
      assert.equal('summary' in sent.findings[0]!, false);
      assert.equal('extra' in sent.findings[0]!.citations[0]!, false);

      // Oversized input is rejected.
      const big = {
        ...body,
        findings: Array.from({ length: 81 }, (_, i) => ({ id: `f${i}`, citations: [] })),
      };
      assert.equal((await post(auth, big)).status, 400);

      // Photo reading: outside Jev's 280–1568 px range is refused before any
      // model call; a valid photo is read and returned as observations.
      const photo = (data: Buffer) =>
        fetch(`${base}/photo/read`, {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({ format: 'png', data: data.toString('base64') }),
        });
      assert.equal((await photo(png(100, 100))).status, 400);
      assert.equal((await photo(Buffer.from('not an image'))).status, 400);
      assert.equal(photos.length, 0);
      const read = await photo(png(400, 300));
      assert.equal(read.status, 200);
      assert.deepEqual((await read.json()).boxes.toilet, {
        top: 0.5,
        bottom: 0.9,
        left: 0.7,
        right: 0.9,
      });
      assert.equal(photos.length, 1);

      // 20 paid Jev calls per window per owner, shared by ranking and photos.
      for (let i = seen.length + photos.length; i < 20; i++)
        assert.equal((await post(auth)).status, 200);
      const limited = await post(auth);
      assert.equal(limited.status, 400);
      assert.match((await limited.json()).message, /limit/i);
    } finally {
      server.close();
      await db.dropDatabase();
      await client.close();
    }
  },
);
