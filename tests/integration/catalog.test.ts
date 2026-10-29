import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { MongoClient } from 'mongodb';
import { MongoWorkspaceRepository, OWNER, type Aggregate } from '../../apps/api/src/repository.js';
import { CatalogStore } from '../../apps/api/src/catalog.js';
import { AccountService } from '../../apps/api/src/accounts.js';
import { createWorkspaceServer } from '../../apps/api/src/server.js';
import { vanityCatalog } from '../../fixtures/catalog/vanity-philadelphia.js';
import { emptyWorkspace } from '@renovagent/contracts';

const uri = process.env.TEST_WORKSPACE_MONGO_URI;
const headers = { 'X-Renovagent-Client': 'workspace' };

async function withDb(fn: (db: import('mongodb').Db) => Promise<void>) {
  const client = new MongoClient(uri!);
  await client.connect();
  const db = client.db(`renovagent_catalog_test_${randomUUID().replaceAll('-', '')}`);
  try {
    await fn(db);
  } finally {
    await db.dropDatabase();
    await client.close();
  }
}

test('catalog import is idempotent, conflict-safe, and reference-checked', { skip: !uri }, () =>
  withDb(async (db) => {
    const store = new CatalogStore(db);
    await store.ensureIndexes();
    const first = await store.importBatch(vanityCatalog);
    assert.equal(first.products, 17);
    assert.equal(first.offers, 17);
    assert.equal(first.observations, 17);
    assert.equal(first.skipped, 0);
    const replay = await store.importBatch(vanityCatalog);
    assert.equal(replay.products, 0);
    assert.equal(replay.skipped, 51);
    assert.equal(await store.products.countDocuments(), 17);

    await assert.rejects(
      store.importBatch({
        products: [{ ...vanityCatalog.products[0], name: 'Tampered name' }],
        offers: [],
        observations: [],
      }),
      /different content/,
    );
    await assert.rejects(
      store.importBatch({
        products: [],
        offers: [],
        observations: [
          { ...vanityCatalog.observations[0], id: 'obs-dangling', offerId: 'no-such-offer' },
        ],
      }),
      /unknown offer/,
    );

    const latest = await store.offersFor(['van-cab-builder'], '19148');
    assert.equal(latest.offers.length, 1);
    assert.equal(latest.products.length, 1);
    assert.equal(latest.observations.length, 1);
    // A newer observation supersedes without duplicating the read model.
    await store.importBatch({
      products: [],
      offers: [],
      observations: [
        {
          ...vanityCatalog.observations[0],
          id: 'obs-van-cab-builder-2',
          observedAt: '2026-10-30T14:00:00Z',
          unitPrice: { amountMinor: 13900, currency: 'USD' },
        },
      ],
    });
    const refreshed = await store.offersFor(['van-cab-builder'], '19148');
    assert.equal(refreshed.observations.length, 1);
    assert.equal(refreshed.observations[0].unitPrice.amountMinor, 13900);
    const otherRegion = await store.offersFor(['van-cab-builder'], '00000');
    assert.equal(otherRegion.offers.length, 0);
  }),
);

test('catalog HTTP honors sessions and gates imports by operator token', { skip: !uri }, () =>
  withDb(async (db) => {
    const repo = new MongoWorkspaceRepository(db.collection<Aggregate>('workspace_aggregates'));
    await repo.collection.insertOne({
      _id: OWNER,
      version: 0,
      workspace: emptyWorkspace(OWNER),
      blobs: [],
      jobs: [],
    });
    const catalog = new CatalogStore(db);
    await catalog.ensureIndexes();
    const accounts = new AccountService(db, {
      google: {
        clientId: 'test-id',
        clientSecret: 'test-secret',
        redirectUri: 'http://127.0.0.1:8741/api/workspace/auth/google/callback',
      },
    });
    const userId = `user:${randomUUID().replaceAll('-', '')}`;
    await accounts.users.insertOne({
      _id: userId,
      email: 'op@example.com',
      googleSub: 'google-op',
      createdAt: new Date().toISOString(),
    });
    await accounts.sessions.insertOne({
      _id: createHash('sha256').update('operator-session').digest('hex'),
      userId,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    });
    await repo.forUser(userId).ensure();
    const { server } = await createWorkspaceServer(
      repo,
      'synthetic-catalog-test-token',
      false,
      accounts,
      catalog,
    );
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/workspace`;
    const session = { ...headers, Cookie: 'renovagent_account=operator-session' };
    try {
      assert.equal(
        (await fetch(`${base}/catalog/offers?productIds=van-cab-builder`, { headers })).status,
        403,
      );
      const empty = await (
        await fetch(`${base}/catalog/offers?productIds=van-cab-builder`, { headers: session })
      ).json();
      assert.equal(empty.offers.length, 0);

      const denied = await fetch(`${base}/catalog/import`, {
        method: 'POST',
        headers: { ...session, 'Content-Type': 'application/json' },
        body: JSON.stringify(vanityCatalog),
      });
      assert.equal(denied.status, 403);

      process.env.RENOVAGENT_CATALOG_OPERATOR = 'test-operator-token';
      const allowed = await fetch(`${base}/catalog/import`, {
        method: 'POST',
        headers: {
          ...session,
          'Content-Type': 'application/json',
          'X-Renovagent-Operator': 'test-operator-token',
        },
        body: JSON.stringify(vanityCatalog),
      });
      assert.equal(allowed.status, 200);
      assert.equal((await allowed.json()).products, 17);
      const filled = await (
        await fetch(`${base}/catalog/offers?productIds=van-cab-builder`, { headers: session })
      ).json();
      assert.equal(filled.offers.length, 1);
    } finally {
      delete process.env.RENOVAGENT_CATALOG_OPERATOR;
      await new Promise((resolve) => server.close(resolve));
    }
  }),
);
