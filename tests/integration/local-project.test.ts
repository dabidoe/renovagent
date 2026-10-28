import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { type Command, DomainError } from '@unpermitted/contracts';
import { context, createCommand, Scenario, openTestRepo } from '../foundation-helpers.js';
import { IndexedDbProjectRepository } from '../../apps/web/src/adapters/indexeddb/project-repository.js';
import {
  blobDigest,
  prepareLegacyImport,
  previewLegacyImport,
} from '../../apps/web/src/adapters/fixtures/import-legacy.js';

const isCode = (code: string) => (e: unknown) => e instanceof DomainError && e.code === code;
async function attachment(
  projectId: string,
  baseRevision: number,
  id: string,
  blob: Blob,
  originalEvidenceId?: string,
): Promise<Command> {
  return {
    commandId: `attach:${id}`,
    projectId,
    baseRevision,
    type: 'AttachEvidence',
    payload: {
      scope: 'project',
      evidence: {
        id,
        kind: 'attachment',
        description: 'Test media',
        attachment: {
          blobId: `blob:${id}`,
          sha256: await blobDigest(blob),
          name: `${id}.txt`,
          mediaType: blob.type,
          role: originalEvidenceId ? 'derived' : 'original',
          ...(originalEvidenceId ? { originalEvidenceId } : {}),
        },
      },
    },
  };
}

test('two projects, fact histories, audit results, and original/derived media survive database close/reopen', async () => {
  const factory = new IDBFactory(),
    name = crypto.randomUUID();
  let repo = await openTestRepo(factory, name);
  const s = new Scenario();
  s.create();
  s.create('project-b', false);
  s.evidence();
  s.apply(s.width());
  s.apply(s.width(1100));
  await repo.executeBatch(s.commands, context);
  const original = new Blob(['original bytes'], { type: 'text/plain' }),
    derived = new Blob(['thumbnail bytes'], { type: 'text/plain' });
  const revision = (await repo.read()).projects['project-a'].revision;
  const c1 = await attachment('project-a', revision, 'original', original);
  const c2 = await attachment('project-a', revision + 1, 'derived', derived, 'original');
  await repo.executeBatch([c1, c2], context, [
    { id: 'blob:original', blob: original },
    { id: 'blob:derived', blob: derived },
  ]);
  const before = await repo.read();
  repo.close();
  repo = await openTestRepo(factory, name);
  assert.deepEqual(await repo.read(), before);
  assert.equal(Object.keys(before.projects).length, 2);
  assert.equal(before.facts['fact-width'].length, 2);
  assert.equal(await (await repo.readBlob('blob:original'))!.text(), 'original bytes');
  assert.equal(await (await repo.readBlob('blob:derived'))!.text(), 'thumbnail bytes');
  assert.equal(before.evidence.derived.source.attachment?.originalEvidenceId, 'original');
  const backup = await repo.exportBackup();
  assert.equal(backup.blobs.length, 2);
  assert.deepEqual(backup.workspace, before);
  repo.close();
});
test('identical retries are durable; reused command IDs with changed data fail', async () => {
  const repo = await openTestRepo(new IDBFactory());
  const command = createCommand();
  const first = await repo.execute(command, context);
  const before = await repo.read();
  assert.deepEqual(await repo.execute(command, context), first);
  assert.deepEqual(await repo.read(), before);
  await assert.rejects(
    repo.execute({ ...command, payload: { ...command.payload, name: 'Changed' } }, context),
    isCode('IDEMPOTENCY'),
  );
  assert.deepEqual(await repo.read(), before);
  repo.close();
});
test('simultaneous connections serialize revision checks; no edit is lost', async () => {
  const factory = new IDBFactory(),
    name = crypto.randomUUID();
  const a = await openTestRepo(factory, name),
    b = await openTestRepo(factory, name);
  const s = new Scenario();
  s.create();
  s.evidence();
  await a.executeBatch(s.commands, context);
  const one = s.width(1200),
    two = { ...s.width(1100), commandId: 'concurrent-2' };
  const results = await Promise.allSettled([a.execute(one, context), b.execute(two, context)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
  assert.equal(rejected.reason.code, 'CONFLICT');
  const state = await b.read();
  assert.equal(state.facts['fact-width'].length, 1);
  assert.equal(state.projects['project-a'].revision, s.state.projects['project-a'].revision + 1);
  a.close();
  b.close();
});
test('a failed batch writes neither earlier commands, audit/idempotency records, nor blobs', async () => {
  const repo = await openTestRepo(new IDBFactory());
  await repo.execute(createCommand(), context);
  const before = await repo.read();
  const blob = new Blob(['new data'], { type: 'text/plain' });
  const valid = await attachment('project-a', 1, 'atomic-media', blob);
  const invalid = { ...createCommand('unrelated', false), basePropertyRevision: 999 };
  await assert.rejects(
    repo.executeBatch([valid, invalid], context, [{ id: 'blob:atomic-media', blob }]),
    isCode('CONFLICT'),
  );
  assert.deepEqual(await repo.read(), before);
  assert.equal(await repo.readBlob('blob:atomic-media'), undefined);
  assert.equal((await repo.exportBackup()).blobs.length, 0);
  repo.close();
});
test('attachment validation binds bytes to metadata, allows exact retries, and leaves no orphan', async () => {
  const repo = await openTestRepo(new IDBFactory());
  await repo.execute(createCommand(), context);
  const blob = new Blob(['abc'], { type: 'text/plain' }),
    command = await attachment('project-a', 1, 'photo', blob);
  await assert.rejects(repo.execute(command, context), isCode('VALIDATION'));
  await assert.rejects(
    repo.execute(command, context, [
      { id: 'blob:photo', blob: new Blob(['wrong'], { type: 'text/plain' }) },
    ]),
    isCode('VALIDATION'),
  );
  const first = await repo.execute(command, context, [{ id: 'blob:photo', blob }]);
  assert.deepEqual(await repo.execute(command, context, [{ id: 'blob:photo', blob }]), first);
  assert.deepEqual(await repo.execute(command, context), first);
  assert.equal((await repo.read()).events.length, 2);
  repo.close();
});
test('invalidation commits with fact revision and prevents a stale accepted plan from being reaccepted', async () => {
  const repo = await openTestRepo(new IDBFactory());
  const s = new Scenario();
  s.create();
  s.evidence();
  s.apply(s.width());
  s.artifact('plan', [{ kind: 'fact', id: 'fact-width', revision: 1 }]);
  s.accept('plan');
  await repo.executeBatch(s.commands, context);
  const result = await repo.execute(s.width(1100), context);
  assert.deepEqual(result.staleArtifactIds, ['plan']);
  const after = await repo.read();
  assert.equal(after.facts['fact-width'].at(-1)?.revision, 2);
  assert.equal(after.artifacts.plan[0].freshness, 'stale');
  await assert.rejects(
    repo.execute(
      {
        commandId: 'accept-stale',
        projectId: 'project-a',
        baseRevision: after.projects['project-a'].revision,
        type: 'AcceptDecision',
        payload: {
          decisionId: 'bad-decision',
          question: 'Try old plan',
          artifactRefs: [{ kind: 'artifact', id: 'plan', revision: 1 }],
        },
      },
      context,
    ),
    isCode('STALE'),
  );
  assert.deepEqual(await repo.read(), after);
  repo.close();
});
test('legacy import is previewed, additive, atomic and retains source; booleans cannot become approvals', async () => {
  const repo = await openTestRepo(new IDBFactory());
  await repo.execute(createCommand(), context);
  const raw = JSON.stringify({
    facts: { goal: 'Half bath', dimensions: '6 by 4', permit: true },
    messages: [{ role: 'user', text: 'Original discussion' }],
    photos: [],
    doneTaskIds: ['rough-in'],
  });
  const preview = previewLegacyImport(raw);
  assert.equal(preview.facts.length, 2);
  assert.ok(preview.warnings.some((w) => w.includes('Permit booleans')));
  const prepared = await prepareLegacyImport(preview, {
    importId: 'import-1',
    projectId: 'imported',
    propertyId: 'property-a',
    projectName: 'Imported idea',
    basePropertyRevision: 1,
  });
  await repo.executeBatch(prepared.commands, context, prepared.blobs);
  const state = await repo.read();
  assert.equal(Object.keys(state.projects).length, 2);
  assert.equal(
    Object.values(state.facts).some((v) => v[0].key.includes('permit')),
    false,
  );
  assert.equal(Object.keys(state.decisions).length, 0);
  assert.equal(state.facts['import-1:fact:dimensions'][0].value.kind, 'text');
  assert.equal(await (await repo.readBlob('import-1:source-blob'))!.text(), raw);
  assert.equal(raw, preview.raw);
  repo.close();
});
test('v1 database upgrade preserves snapshot/bytes and enforces owner isolation', async () => {
  const factory = new IDBFactory(),
    name = crypto.randomUUID();
  const s = new Scenario();
  s.create();
  await new Promise<void>((resolve, reject) => {
    const req = factory.open(name, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('snapshots');
      req.result.createObjectStore('blobs');
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(['snapshots', 'blobs'], 'readwrite');
      tx.objectStore('snapshots').put(s.state, 'workspace');
      tx.objectStore('blobs').put(new Blob(['preserved']), 'old-blob');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    };
  });
  const repo = await openTestRepo(factory, name);
  assert.deepEqual(await repo.read(), s.state);
  assert.equal((await repo.exportBackup()).blobs.length, 1);
  repo.close();
  const other = await IndexedDbProjectRepository.open({ name, ownerId: 'intruder', factory });
  await assert.rejects(other.read(), isCode('FORBIDDEN'));
  other.close();
});

test('unknown stored schema is never overwritten; raw recovery preserves snapshot and blobs', async () => {
  const factory = new IDBFactory(),
    name = crypto.randomUUID();
  let repo = await openTestRepo(factory, name);
  repo.close();
  const raw = { schemaVersion: 99, ownerId: context.ownerId, futureField: 'must survive' };
  await new Promise<void>((resolve, reject) => {
    const req = factory.open(name);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(['snapshots', 'blobs'], 'readwrite');
      tx.objectStore('snapshots').put(raw, 'workspace');
      tx.objectStore('blobs').put(new Blob(['preserved original']), 'source-blob');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    };
  });
  repo = await openTestRepo(factory, name);
  await assert.rejects(repo.read(), isCode('STORAGE'));
  await assert.rejects(repo.execute(createCommand(), context), isCode('STORAGE'));
  const recovery = await repo.exportRecoveryBundle();
  assert.deepEqual(recovery.rawWorkspace, raw);
  assert.equal(await recovery.blobs[0].blob.text(), 'preserved original');
  repo.close();
});
test('legacy photo import survives reopen; invalid imported values roll back the entire new project', async () => {
  const factory = new IDBFactory(),
    name = crypto.randomUUID();
  let repo = await openTestRepo(factory, name);
  const raw = JSON.stringify({
    facts: { goal: 'Flooring' },
    messages: [],
    photos: [{ name: 'reference.png', dataUrl: 'data:image/png;base64,YWJj' }],
  });
  const preview = previewLegacyImport(raw),
    prepared = await prepareLegacyImport(preview, {
      importId: 'photo-import',
      projectId: 'p-import',
      propertyId: 'property-import',
      projectName: 'Flooring',
      propertyName: 'Home',
      basePropertyRevision: 0,
    });
  await repo.executeBatch(prepared.commands, context, prepared.blobs);
  repo.close();
  repo = await openTestRepo(factory, name);
  assert.equal(await (await repo.readBlob('photo-import:photo:0:blob'))!.text(), 'abc');
  const before = await repo.read();
  const broken = await prepareLegacyImport(
    previewLegacyImport(JSON.stringify({ facts: { goal: 'x'.repeat(5000) }, photos: [] })),
    {
      importId: 'bad-import',
      projectId: 'bad-project',
      propertyId: 'new-property',
      projectName: 'Bad',
      propertyName: 'Other home',
      basePropertyRevision: 0,
    },
  );
  await assert.rejects(
    repo.executeBatch(broken.commands, context, broken.blobs),
    isCode('VALIDATION'),
  );
  assert.deepEqual(await repo.read(), before);
  assert.equal((await repo.exportBackup()).blobs.length, 2);
  repo.close();
});

test('an asynchronous IndexedDB constraint failure rolls back snapshot, events, and command records', async () => {
  const factory = new IDBFactory(),
    name = crypto.randomUUID();
  let repo = await openTestRepo(factory, name);
  await repo.execute(createCommand(), context);
  const before = await repo.read();
  repo.close();
  const original = new Blob(['orphan from a prior recovery'], { type: 'text/plain' });
  await new Promise<void>((resolve, reject) => {
    const req = factory.open(name);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result,
        tx = db.transaction('blobs', 'readwrite');
      tx.objectStore('blobs').put(original, 'blob:collision');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    };
  });
  repo = await openTestRepo(factory, name);
  const command = await attachment(
    'project-a',
    1,
    'collision',
    new Blob(['new bytes'], { type: 'text/plain' }),
  );
  await assert.rejects(
    repo.execute(command, context, [
      { id: 'blob:collision', blob: new Blob(['new bytes'], { type: 'text/plain' }) },
    ]),
    isCode('STORAGE'),
  );
  assert.deepEqual(await repo.read(), before);
  assert.equal(
    await (await repo.exportRecoveryBundle()).blobs[0].blob.text(),
    'orphan from a prior recovery',
  );
  repo.close();
});
test('idempotency result survives reopening the database and a reordered JSON object', async () => {
  const factory = new IDBFactory(),
    name = crypto.randomUUID();
  let repo = await openTestRepo(factory, name);
  const command = createCommand();
  const result = await repo.execute(command, context);
  repo.close();
  repo = await openTestRepo(factory, name);
  const reordered = Object.fromEntries(Object.entries(command).reverse());
  assert.deepEqual(
    await repo.execute(reordered, { ...context, now: '2026-10-28T00:00:00.000Z' }),
    result,
  );
  assert.equal((await repo.read()).events.length, 1);
  repo.close();
});
