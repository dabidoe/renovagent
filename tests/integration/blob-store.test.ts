import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Binary, MongoClient, type Db } from 'mongodb';
import { Scenario } from '../foundation-helpers.js';
import { MongoWorkspaceRepository, OWNER, type StoredBlob } from '../../apps/api/src/repository.js';
import {
  readMigrationSnapshot,
  validateMigration,
  type MigrationSnapshot,
} from '../../apps/api/src/cluster-migration.js';

const uri = process.env.TEST_WORKSPACE_MONGO_URI;
const asOwner = (state: Scenario['state']) =>
  JSON.parse(JSON.stringify(state).replaceAll('owner-test', OWNER));

async function withDb(fn: (db: Db) => Promise<void>) {
  const client = new MongoClient(uri!);
  await client.connect();
  const db = client.db(`renovagent_blobs_test_${randomUUID().replaceAll('-', '')}`);
  try {
    await fn(db);
  } finally {
    await db.dropDatabase();
    await client.close();
  }
}

// Saves one attachment through the normal command path and keeps the scenario in step.
async function attach(repo: MongoWorkspaceRepository, s: Scenario, id: string, data: Buffer) {
  const blob: StoredBlob = { id, mediaType: 'image/jpeg', data: data.toString('base64') };
  const command = s.command('AttachEvidence', {
    scope: 'project',
    evidence: {
      id: `evidence-${id}`,
      kind: 'attachment',
      description: 'QA only',
      attachment: {
        blobId: id,
        sha256: createHash('sha256').update(data).digest('hex'),
        name: `${id}.jpg`,
        mediaType: blob.mediaType,
        role: 'original',
      },
    },
  });
  await repo.execute([command], [blob]);
  s.apply(command);
  return blob;
}

async function seeded(db: Db) {
  const repo = MongoWorkspaceRepository.forDb(db);
  await repo.ensure();
  const s = new Scenario();
  s.create();
  await repo.importWorkspace(asOwner(s.state), []);
  return { repo, s };
}

test('an owner can keep more than 16 MB of attachments', { skip: !uri }, () =>
  withDb(async (db) => {
    const { repo, s } = await seeded(db);
    const saved = [];
    for (let i = 0; i < 3; i++) saved.push(await attach(repo, s, `photo-${i}`, randomBytes(6e6)));
    // 18 MB stored; the workspace document itself stays small.
    const doc = await repo.collection.findOne({ _id: OWNER });
    assert.ok(Buffer.byteLength(JSON.stringify(doc)) < 1e6);
    for (const blob of saved) {
      const read = (await repo.readBlob(blob.id))!;
      assert.equal(read.bytes.toString('base64'), blob.data);
    }
    assert.equal((await repo.listBlobs()).length, 3);
  }),
);

test('wrong bytes are refused without blocking the correct retry', { skip: !uri }, () =>
  withDb(async (db) => {
    const { repo, s } = await seeded(db);
    const data = randomBytes(1000);
    const command = s.command('AttachEvidence', {
      scope: 'project',
      evidence: {
        id: 'evidence-retry',
        kind: 'attachment',
        description: 'QA only',
        attachment: {
          blobId: 'retry',
          sha256: createHash('sha256').update(data).digest('hex'),
          name: 'retry.jpg',
          mediaType: 'image/jpeg',
          role: 'original',
        },
      },
    });
    const wrong = {
      id: 'retry',
      mediaType: 'image/jpeg',
      data: randomBytes(1000).toString('base64'),
    };
    await assert.rejects(repo.execute([command], [wrong]), /hash mismatch/);
    assert.equal(await repo.readBlob('retry'), null);
    await repo.execute([command], [{ ...wrong, data: data.toString('base64') }]);
    assert.ok(await repo.readBlob('retry'));
  }),
);

test('another owner cannot read an attachment by its id', { skip: !uri }, () =>
  withDb(async (db) => {
    const { repo, s } = await seeded(db);
    await attach(repo, s, 'private-photo', randomBytes(100));
    const bob = repo.forUser('user:bob');
    await bob.ensure();
    assert.equal(await bob.readBlob('private-photo'), null);
    assert.deepEqual(await bob.listBlobs(), []);
  }),
);

test('attachments embedded by the old layout move out once and stay readable', { skip: !uri }, () =>
  withDb(async (db) => {
    const { repo, s } = await seeded(db);
    const blob = await attach(repo, s, 'legacy-photo', randomBytes(500));
    // Recreate the old layout: bytes inside the aggregate, none in the blob collection.
    await repo.blobStore.deleteMany({});
    await repo.collection.updateOne({ _id: OWNER }, { $set: { blobs: [blob] } });
    await repo.ensure();
    await repo.ensure(); // idempotent
    assert.deepEqual((await repo.read()).blobs, []);
    assert.equal((await repo.readBlob(blob.id))!.bytes.toString('base64'), blob.data);
  }),
);

test('a login-scoped ensure() never builds indexes; ensureIndexes() does it once', { skip: !uri }, () =>
  withDb(async (db) => {
    const repo = MongoWorkspaceRepository.forDb(db);
    let ddl = 0;
    const target = repo.blobStore;
    (repo as { blobStore: unknown }).blobStore = new Proxy(target, {
      get(t, prop, receiver) {
        if (prop === 'createIndex')
          return (...args: unknown[]) => {
            ddl++;
            return (target.createIndex as (...a: never[]) => unknown)(...(args as never[]));
          };
        const value = Reflect.get(t, prop, receiver);
        return typeof value === 'function' ? (value as () => unknown).bind(t) : value;
      },
    });
    // The Google callback runs this before redirecting; DDL there stalls sign-in.
    await repo.forUser('user:login-probe').ensure();
    assert.equal(ddl, 0);
    await repo.ensureIndexes();
    const keys = (await repo.blobStore.listIndexes().toArray()).map((i) => i.key);
    assert.ok(
      keys.some((k) => (k as Record<string, number>)['_id.ownerId'] === 1 && (k as Record<string, number>)['_id.blobId'] === 1),
      'the blob compound index exists after ensureIndexes()',
    );
  }),
);

test('cluster migration carries attachment records and checks them', { skip: !uri }, () =>
  withDb(async (db) => {
    const { repo, s } = await seeded(db);
    await attach(repo, s, 'migrating-photo', randomBytes(300));
    const source = await readMigrationSnapshot(db);
    assert.equal(source.workspace_blobs.length, 1);
    const empty: MigrationSnapshot = Object.fromEntries(
      Object.keys(source).map((name) => [name, []]),
    );
    validateMigration(source, empty);
    // An identical destination, read back from Mongo as a real one would be.
    validateMigration(source, await readMigrationSnapshot(db));
    // Missing or altered bytes fail before anything is written.
    assert.throws(() => validateMigration({ ...source, workspace_blobs: [] }, empty), /must match/);
    const altered = await readMigrationSnapshot(db);
    (altered.workspace_blobs[0] as unknown as { bytes: Binary }).bytes = new Binary(
      randomBytes(300),
    );
    assert.throws(() => validateMigration(altered, empty), /checksum mismatch/);
  }),
);
