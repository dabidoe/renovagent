import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { MongoClient } from 'mongodb';
import { MongoWorkspaceRepository, OWNER, type Aggregate } from '../../apps/api/src/repository.js';
import { requestPhotoJob, publishPhotoJob, PhotoWorker } from '../../apps/api/src/photo-jobs.js';
import { createWorkspaceServer } from '../../apps/api/src/server.js';
import { Scenario } from '../foundation-helpers.js';
import { researchJobId, homeInventory } from '@unpermitted/core';
import { type PropertyResearch } from '@unpermitted/contracts';
const uri = process.env.TEST_WORKSPACE_MONGO_URI;
function setup() {
  const s = new Scenario();
  s.create();
  s.evidence('source');
  const research: PropertyResearch = JSON.parse(
    readFileSync(
      new URL('../../docs/evidence/muse-hutchinson/photo-results-live.json', import.meta.url),
      'utf8',
    ),
  );
  for (const [key, text] of [
    ['propertyAddress', research.address],
    ['goal', research.photoReview!.goal!],
  ])
    s.apply(
      s.command('RecordFact', {
        scope: key === 'goal' ? 'project' : 'property',
        factId: key,
        subjectId: key === 'goal' ? 'project-a' : 'property-a',
        key,
        supersedesRevision: 0,
        value: { kind: 'text', text },
        assertion: 'user_reported',
        evidenceIds: ['source'],
      }),
    );
  research.jobId = researchJobId('project-a', 'propertyAddress', 1);
  s.artifact(
    'project-a:property-research',
    [
      { kind: 'fact', id: 'propertyAddress', revision: 1 },
      { kind: 'fact', id: 'goal', revision: 1 },
    ],
    'project-a',
    research,
  );
  return { s, research };
}
const mongoState = (state: Scenario['state']) =>
  JSON.parse(JSON.stringify(state).replaceAll('owner-test', OWNER));
const inventory = JSON.parse(
  readFileSync(
    new URL('../../docs/evidence/muse-hutchinson/inventory.json', import.meta.url),
    'utf8',
  ),
).inventory;
async function withRepo(
  fn: (repo: MongoWorkspaceRepository, client: MongoClient) => Promise<void>,
) {
  const client = new MongoClient(uri!);
  await client.connect();
  const db = client.db(`unpermitted_test_${randomUUID().replaceAll('-', '')}`);
  const repo = new MongoWorkspaceRepository(db.collection<Aggregate>('workspace_aggregates'));
  const { emptyWorkspace } = await import('@unpermitted/contracts');
  await repo.collection.insertOne({
    _id: OWNER,
    version: 0,
    workspace: emptyWorkspace(OWNER),
    blobs: [],
    jobs: [],
  });
  try {
    await fn(repo, client);
  } finally {
    await db.dropDatabase();
    await client.close();
  }
}
test(
  'real Mongo migration preserves history, rejects overwrite, deduplicates commands and fences concurrent writes atomically',
  { skip: !uri },
  () =>
    withRepo(async (repo) => {
      const { s } = setup();
      await repo.importWorkspace(mongoState(s.state), []);
      assert.deepEqual((await repo.read()).workspace, mongoState(s.state));
      await assert.rejects(repo.importWorkspace(mongoState(s.state), []), /already contains/);
      const command = s.command('AppendMessage', {
        messageId: 'server-message',
        text: 'Synthetic Mongo concurrency test',
        evidenceIds: [],
      });
      const results = await Promise.all([repo.execute([command]), repo.execute([command])]);
      assert.deepEqual(results[0], results[1]);
      assert.equal(
        (await repo.read()).workspace.messages.filter((m) => m.id === 'server-message').length,
        1,
      );
      const before = (await repo.read()).workspace;
      await assert.rejects(
        repo.execute([
          {
            ...command,
            commandId: 'stale-edit',
            payload: { ...command.payload, messageId: 'stale-message' },
          },
        ]),
      );
      assert.deepEqual((await repo.read()).workspace, before);
      await assert.rejects(
        repo.execute([
          {
            ...command,
            commandId: 'bad-edit',
            baseRevision: before.projects['project-a'].revision,
            payload: { nonsense: true },
          },
        ]),
      );
      assert.deepEqual((await repo.read()).workspace, before);
    }),
);
test(
  'real Mongo photo-job commit is atomic, exact-once and invalidates previous directions without rewriting history',
  { skip: !uri },
  () =>
    withRepo(async (repo) => {
      const { s, research } = setup();
      s.apply(
        s.command('ImportPhotoInventory', {
          researchRef: { kind: 'artifact', id: 'project-a:property-research', revision: 1 },
          inventory,
          expectedInventoryRevision: 0,
        }),
      );
      const inv = homeInventory(s.state, 'project-a')!;
      s.apply(
        s.command('SetInventoryDirection', {
          inventoryRef: { kind: 'artifact', id: inv.id, revision: 1 },
          itemId: inventory.items[0].id,
          expectedDirectionRevision: 0,
          disposition: 'retain',
          identification: 'confirmed',
          correctedLabel: null,
          note: 'QA only',
          messageId: 'qa-direction',
        }),
      );
      const direction = Object.values(s.state.artifacts)
        .find((v) => v.at(-1)?.payload.kind === 'inventory-direction')!
        .at(-1)!;
      s.artifact('downstream', [{ kind: 'artifact', id: direction.id, revision: 1 }]);
      s.accept('downstream');
      await repo.importWorkspace(mongoState(s.state), []);
      const request = {
        requestId: randomUUID(),
        projectId: 'project-a',
        photoIds: ['photo-04'],
        evidenceIds: [],
      };
      const job = await requestPhotoJob(repo, request);
      assert.equal((await requestPhotoJob(repo, request)).id, job.id);
      await assert.rejects(
        requestPhotoJob(repo, { ...request, photoIds: ['photo-05'] }),
        /different inputs/,
      );
      const beforeInvalid = (await repo.read()).workspace;
      const invalid = structuredClone(inventory);
      invalid.photos[0].sha256 = '0'.repeat(64);
      await assert.rejects(
        repo.update((doc) => publishPhotoJob(doc, doc.jobs[0], research, invalid)),
      );
      assert.deepEqual((await repo.read()).workspace, beforeInvalid);
      await repo.update((doc) => publishPhotoJob(doc, doc.jobs[0], research, inventory));
      const committed = (await repo.read()).workspace;
      assert.equal(committed.artifacts[inv.id].length, 2);
      assert.equal(committed.artifacts[direction.id][0].freshness, 'stale');
      assert.equal(committed.artifacts.downstream[0].lifecycle, 'accepted');
      assert.equal(committed.artifacts.downstream[0].freshness, 'stale');
      assert.deepEqual(committed.facts, s.state.facts);
      await repo.update((doc) => publishPhotoJob(doc, doc.jobs[0], research, inventory));
      assert.deepEqual((await repo.read()).workspace, committed);
    }),
);
test(
  'real Mongo rejects late photo output after input changes; recovery and cancellation preserve checkpoints',
  { skip: !uri },
  () =>
    withRepo(async (repo) => {
      const { s, research } = setup();
      await repo.importWorkspace(mongoState(s.state), []);
      const job = await requestPhotoJob(repo, {
        requestId: randomUUID(),
        projectId: 'project-a',
        photoIds: ['photo-04'],
        evidenceIds: [],
      });
      await repo.execute([
        s.command('RecordFact', {
          scope: 'project',
          factId: 'goal',
          subjectId: 'project-a',
          key: 'goal',
          supersedesRevision: 1,
          value: { kind: 'text', text: 'Changed project goal during provider work' },
          assertion: 'user_reported',
          evidenceIds: ['source'],
        }),
      ]);
      const before = (await repo.read()).workspace;
      await assert.rejects(
        repo.update((doc) => publishPhotoJob(doc, doc.jobs[0], research, inventory)),
        /changed during/,
      );
      assert.deepEqual((await repo.read()).workspace, before);
      await repo.update((doc) => {
        doc.jobs[0].status = 'running';
        doc.jobs[0].stage = 'Saved checkpoint';
      });
      const worker = new PhotoWorker(repo);
      await worker.recover();
      assert.equal((await repo.read()).jobs[0].status, 'queued');
      await worker.cancel(job.id);
      assert.equal((await repo.read()).jobs[0].status, 'cancelled');
      await assert.rejects(
        repo.update((doc) => publishPhotoJob(doc, doc.jobs[0], research, inventory)),
        /cancelled/,
      );
    }),
);
test(
  'local HTTP API rejects cross-origin, unauthenticated and foreign-owner operations',
  { skip: !uri },
  () =>
    withRepo(async (repo) => {
      const { server } = await createWorkspaceServer(
        repo,
        'synthetic-api-test-session-token',
        true,
      );
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      if (!address || typeof address === 'string') throw Error('No address');
      const base = `http://127.0.0.1:${address.port}/api/workspace`;
      const headers = { Host: '127.0.0.1:4000', 'X-Unpermitted-Client': 'workspace' };
      try {
        assert.equal((await fetch(base, { headers })).status, 403);
        assert.equal(
          (
            await fetch(base + '/session', {
              headers: { ...headers, Origin: 'https://untrusted.example' },
            })
          ).status,
          403,
        );
        const session = await fetch(base + '/session', { headers });
        assert.equal(session.status, 200);
        const cookie = session.headers.get('set-cookie')!.split(';')[0];
        const state = setup().s.state;
        state.ownerId = 'another-owner';
        assert.equal(
          (
            await fetch(base + '/import', {
              method: 'POST',
              headers: { ...headers, Cookie: cookie, 'Content-Type': 'application/json' },
              body: JSON.stringify({ workspace: state, blobs: [] }),
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await fetch(base + '/commands', {
              method: 'POST',
              headers: { Host: headers.Host, Cookie: cookie, 'Content-Type': 'application/json' },
              body: JSON.stringify({ commands: [] }),
            })
          ).status,
          403,
        );
        assert.equal(Object.keys((await repo.read()).workspace.projects).length, 0);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    }),
);

test(
  'Mongo attachments commit with matching evidence only, survive reconnect, and reject replacement bytes',
  { skip: !uri },
  () =>
    withRepo(async (repo) => {
      const { createHash } = await import('node:crypto');
      const { s } = setup();
      await repo.importWorkspace(mongoState(s.state), []);
      const content = Buffer.from('synthetic attachment bytes for durable storage test');
      const blob = {
        id: 'blob:connected',
        mediaType: 'text/plain',
        data: content.toString('base64'),
      };
      const command = s.command('AttachEvidence', {
        scope: 'project',
        evidence: {
          id: 'connected-file',
          kind: 'attachment',
          description: 'QA only',
          attachment: {
            blobId: blob.id,
            sha256: createHash('sha256').update(content).digest('hex'),
            name: 'fixture.txt',
            mediaType: blob.mediaType,
            role: 'original',
          },
        },
      });
      const before = (await repo.read()).workspace;
      await assert.rejects(
        repo.execute([command], [{ ...blob, data: Buffer.from('wrong bytes').toString('base64') }]),
        /hash mismatch/,
      );
      assert.deepEqual((await repo.read()).workspace, before);
      await repo.execute([command], [blob]);
      const saved = await repo.read();
      const second = new MongoClient(uri!);
      await second.connect();
      try {
        const reopened = new MongoWorkspaceRepository(
          second.db(repo.collection.dbName).collection<Aggregate>(repo.collection.collectionName),
        );
        assert.deepEqual(await reopened.read(), saved);
      } finally {
        await second.close();
      }
      await assert.rejects(
        repo.execute([command], [{ ...blob, data: 'Y2hhbmdlZA==' }]),
        /overwrite/,
      );
      assert.equal((await repo.read()).blobs[0].data, blob.data);
    }),
);

test('bounded photo refresh keeps earlier source references discoverable without claiming they were refreshed', async () => {
  const { savedPhotoReferences } = await import('@unpermitted/core');
  const { s, research } = setup();
  const subset = { ...research, photoReview: undefined, images: research.images.slice(0, 1) };
  s.artifact(
    'project-a:property-research',
    [{ kind: 'fact', id: 'propertyAddress', revision: 1 }],
    'project-a',
    subset,
  );
  const refs = savedPhotoReferences(s.state, 'project-a');
  assert.equal(refs.length, 22);
  assert.equal(refs.find((p) => p.id === subset.images[0].id)!.researchRevision, 2);
  assert.ok(refs.some((p) => p.researchRevision === 1));
  s.apply(
    s.command('RecordFact', {
      scope: 'property',
      factId: 'propertyAddress',
      subjectId: 'property-a',
      key: 'propertyAddress',
      supersedesRevision: 1,
      value: { kind: 'text', text: 'A different address' },
      assertion: 'user_reported',
      evidenceIds: ['source'],
    }),
  );
  assert.equal(savedPhotoReferences(s.state, 'project-a').length, 0);
});
