import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { emptyWorkspace } from '@renovagent/contracts';
import { MongoWorkspaceRepository, OWNER } from '../../apps/api/src/repository.js';
import { createWorkspaceServer } from '../../apps/api/src/server.js';
import type { rankReviewFindings } from '../../apps/api/src/jev.js';

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
    const { server } = await createWorkspaceServer(
      repo,
      'synthetic-rank-token',
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { configured: async () => true, rank },
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

      // 20 paid calls per window per owner.
      for (let i = seen.length; i < 20; i++) assert.equal((await post(auth)).status, 200);
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
