import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { MongoWorkspaceRepository } from '../../apps/api/src/repository.js';
import { PhotoWorker } from '../../apps/api/src/photo-jobs.js';

const uri = process.env.TEST_WORKSPACE_MONGO_URI;

async function withRepo(
  run: (repo: MongoWorkspaceRepository, client: MongoClient) => Promise<void>,
) {
  const client = new MongoClient(uri!);
  await client.connect();
  const db = client.db(`renovagent_cache_${randomUUID().slice(0, 8)}`);
  try {
    const repo = MongoWorkspaceRepository.forDb(db);
    await repo.ensure();
    await run(repo, client);
  } finally {
    await db.dropDatabase();
    await client.close();
  }
}

test('cached reads are copies, current after any versioned write', { skip: !uri }, async () => {
  await withRepo(async (repo) => {
    const first = await repo.read();
    // Mutating what read() returned never leaks into the next read.
    first.jobs.push({ id: 'scribble' } as never);
    assert.equal((await repo.read()).jobs.length, 0);

    // A write through update() is visible at once.
    await repo.update((doc) => {
      doc.workspace.projects = {};
    });
    const v = await repo.version();
    assert.equal((await repo.read()).version, v);

    // Another process (here: a direct versioned write) is picked up by version.
    await repo.collection.updateOne(
      { _id: repo.ownerId },
      { $set: { version: v! + 1, jobs: [{ id: 'elsewhere' } as never] } },
    );
    assert.deepEqual(
      (await repo.read()).jobs.map((j) => j.id),
      ['elsewhere'],
    );
  });
});

test('overlapping worker ticks do not both read the workspace', { skip: !uri }, async () => {
  await withRepo(async (repo) => {
    let reads = 0;
    const read = repo.read.bind(repo);
    repo.read = async () => {
      reads++;
      await new Promise((r) => setTimeout(r, 50));
      return read();
    };
    const worker = new PhotoWorker(repo);
    await Promise.all([worker.tick(), worker.tick(), worker.tick()]);
    // One idle tick reads twice (recovery check, queue check); the others skip.
    assert.equal(reads, 2);
    // The guard is released, so the next tick runs.
    await worker.tick();
    assert.equal(reads, 4);
  });
});
