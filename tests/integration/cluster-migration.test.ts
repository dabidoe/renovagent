import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { emptyWorkspace } from '@renovagent/contracts';
import { Scenario } from '../foundation-helpers.js';
import {
  snapshotHash,
  validateMigration,
  type MigrationSnapshot,
  type MigrationRecord,
} from '../../apps/api/src/cluster-migration.js';
import { photoJobFile, PhotoJobFiles } from '../../apps/api/src/photo-job-files.js';

function snapshot(): MigrationSnapshot {
  const s = new Scenario();
  s.create();
  s.evidence('retained-source');
  return {
    workspace_aggregates: [
      { _id: s.state.ownerId, version: 7, workspace: s.state, blobs: [], jobs: [] },
    ],
    catalog_products: [],
    retailer_offers: [],
    price_observations: [],
    photo_job_files: [],
  };
}
test('cluster preflight accepts preserved history/retries but refuses existing work, active jobs and foreign/checksum-corrupt files', () => {
  const source = snapshot(),
    owner = source.workspace_aggregates[0]._id;
  const blank = {
    ...snapshot(),
    workspace_aggregates: [
      { _id: owner, version: 1, workspace: emptyWorkspace(owner), blobs: [], jobs: [] },
    ],
  };
  validateMigration(source, blank);
  validateMigration(source, structuredClone(source));
  const changed = structuredClone(source);
  (changed.workspace_aggregates[0].workspace as Scenario['state']).projects['project-a'].name =
    'Different destination work';
  const before = snapshotHash(changed);
  assert.throws(() => validateMigration(source, changed), /already has different content/);
  assert.equal(snapshotHash(changed), before);
  const active = structuredClone(source);
  active.workspace_aggregates[0].jobs = [{ id: 'job', projectId: 'project-a', status: 'running' }];
  assert.throws(() => validateMigration(active, blank), /active source/);
  const corrupt = structuredClone(source);
  corrupt.photo_job_files = [
    photoJobFile(owner, 'unknown-job', 'input-0.json', '{}') as unknown as MigrationRecord,
  ];
  assert.throws(() => validateMigration(corrupt, blank), /outside source/);
  assert.throws(() => photoJobFile(owner, 'job', '../input.json', '{}'), /Invalid private/);
  assert.notEqual(snapshotHash({ date: new Date(0) }), snapshotHash({ date: new Date(1) }));
});

test('cluster preflight rejects orphaned catalog imports before any writes', () => {
  const source = snapshot();
  source.price_observations = [
    {
      _id: 'price',
      id: 'price',
      schemaVersion: 1,
      offerId: 'missing',
      observedAt: new Date().toISOString(),
      unitPrice: { amountMinor: 1, currency: 'USD' },
      stock: 'unknown',
      source: 'example-import',
      freshness: 'historical',
    },
  ];
  assert.throws(() => validateMigration(source, {}), /unknown offer/);
});

const uri = process.env.TEST_WORKSPACE_MONGO_URI;
test(
  'private cluster photo files survive reconnect, isolate owners and reject replacing original pixels',
  { skip: !uri },
  async () => {
    const client = new MongoClient(uri!);
    await client.connect();
    const name = `renovagent_test_${randomUUID().replaceAll('-', '')}`,
      db = client.db(name);
    try {
      const files = new PhotoJobFiles(db);
      await files.put('owner-a', 'job', 'input-0.json', '{"data":"original"}');
      await files.put('owner-a', 'job', 'input-0.json', '{"data":"original"}');
      assert.equal(await files.get('owner-b', 'job', 'input-0.json'), null);
      await assert.rejects(
        files.put('owner-a', 'job', 'input-0.json', '{"data":"changed"}'),
        /different content/,
      );
      const second = new MongoClient(uri!);
      await second.connect();
      try {
        assert.equal(
          await new PhotoJobFiles(second.db(name)).get('owner-a', 'job', 'input-0.json'),
          '{"data":"original"}',
        );
      } finally {
        await second.close();
      }
      await files.collection.updateOne(
        { ownerId: 'owner-a' },
        { $set: { text: '{"data":"corrupt"}' } },
      );
      await assert.rejects(files.get('owner-a', 'job', 'input-0.json'), /checksum mismatch/);
    } finally {
      await db.dropDatabase();
      await client.close();
    }
  },
);
