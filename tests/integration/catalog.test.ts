import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { MongoClient } from 'mongodb';
import { MongoWorkspaceRepository, OWNER } from '../../apps/api/src/repository.js';
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

    const latest = await store.offersFor(['van-cab-builder'], { region: '19148' });
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
    const refreshed = await store.offersFor(['van-cab-builder'], { region: '19148' });
    assert.equal(refreshed.observations.length, 1);
    assert.equal(refreshed.observations[0].unitPrice.amountMinor, 13900);
    const otherRegion = await store.offersFor(['van-cab-builder'], { region: '00000' });
    assert.equal(otherRegion.offers.length, 0);
  }),
);

test('catalog recall covers search, SKU lookup, and price history', { skip: !uri }, () =>
  withDb(async (db) => {
    const store = new CatalogStore(db);
    await store.ensureIndexes();
    await store.importBatch(vanityCatalog);
    const found = await store.search('faucet');
    assert.ok(found.products.some((p) => p.id === 'van-fau-mid'));
    assert.ok(found.offers.length >= 3);
    const bySku = await store.offersFor(undefined, { sku: 'FW-SKU-VC30-H' });
    assert.equal(bySku.offers.length, 1);
    assert.equal(bySku.products[0].id, 'van-cab-high');
    const byRetailer = await store.offersFor(undefined, { retailer: 'Nobody' });
    assert.equal(byRetailer.offers.length, 0);
    // An empty candidate list is an empty answer, never the whole catalog.
    const none = await store.offersFor([]);
    assert.deepEqual(none, { products: [], offers: [], observations: [] });
    const nonsense = await store.search('zzqxnonexistent');
    assert.equal(nonsense.offers.length, 0);
    const history = await store.history('offer-van-cab-builder');
    assert.equal(history.length, 1);
    assert.equal(history[0].source, 'example-import');
  }),
);

test('price submissions quarantine until review and never duplicate facts', { skip: !uri }, () =>
  withDb(async (db) => {
    const store = new CatalogStore(db);
    await store.ensureIndexes();
    await store.importBatch(vanityCatalog);
    const observedAt = '2026-10-29T17:00:00Z';
    const first = await store.submitObservation(
      'user:alice',
      {
        offerId: 'offer-van-fau-builder',
        observedAt,
        unitPrice: { amountMinor: 4298, currency: 'USD' },
        stock: 'in_stock',
        note: 'Shelf tag, Oregon Ave store',
      },
      { autoApprove: false },
    );
    assert.equal(first.submission.status, 'pending');
    assert.equal(first.observationId, null);
    // Re-submit is idempotent while pending.
    const replay = await store.submitObservation(
      'user:alice',
      {
        offerId: 'offer-van-fau-builder',
        observedAt,
        unitPrice: { amountMinor: 4298, currency: 'USD' },
        stock: 'in_stock',
      },
      { autoApprove: false },
    );
    assert.equal(replay.submission.id, first.submission.id);
    // Pending submissions are invisible to pricing reads.
    assert.equal((await store.history('offer-van-fau-builder')).length, 1);

    const approved = await store.reviewSubmission(first.submission.id, true);
    assert.equal(approved.submission.status, 'approved');
    assert.ok(approved.observationId);
    const history = await store.history('offer-van-fau-builder');
    assert.equal(history.length, 2);
    assert.equal(history[0].source, 'manual-entry');

    // A second observer's identical fact approves without duplicating.
    const duplicate = await store.submitObservation(
      'user:bob',
      {
        offerId: 'offer-van-fau-builder',
        observedAt,
        unitPrice: { amountMinor: 4298, currency: 'USD' },
        stock: 'in_stock',
      },
      { autoApprove: false },
    );
    const reviewed = await store.reviewSubmission(duplicate.submission.id, true);
    assert.equal(reviewed.observationId, null);
    assert.equal(reviewed.submission.reason, 'Already recorded');
    assert.equal((await store.history('offer-van-fau-builder')).length, 2);

    const rejected = await store.submitObservation(
      'user:mallory',
      {
        offerId: 'offer-van-fau-builder',
        observedAt: '2026-10-29T18:00:00Z',
        unitPrice: { amountMinor: 1, currency: 'USD' },
        stock: 'in_stock',
      },
      { autoApprove: false },
    );
    const declined = await store.reviewSubmission(
      rejected.submission.id,
      false,
      'Implausible price',
    );
    assert.equal(declined.submission.status, 'rejected');
    assert.equal((await store.history('offer-van-fau-builder')).length, 2);

    await assert.rejects(
      store.submitObservation(
        'user:alice',
        {
          offerId: 'no-such-offer',
          unitPrice: { amountMinor: 100, currency: 'USD' },
          stock: 'unknown',
        },
        { autoApprove: false },
      ),
      /Unknown offer/,
    );
    await assert.rejects(
      store.submitObservation(
        'user:alice',
        {
          offerId: 'offer-van-fau-builder',
          observedAt: '2999-01-01T00:00:00Z',
          unitPrice: { amountMinor: 100, currency: 'USD' },
          stock: 'unknown',
        },
        { autoApprove: false },
      ),
      /future/,
    );
    // Local mode records immediately: the owner is the operator.
    const direct = await store.submitObservation(
      'local-homeowner',
      {
        offerId: 'offer-van-drain-builder',
        observedAt,
        unitPrice: { amountMinor: 1199, currency: 'USD' },
        stock: 'in_stock',
      },
      { autoApprove: true },
    );
    assert.equal(direct.submission.status, 'approved');
    assert.ok(direct.observationId);
  }),
);

test('catalog HTTP honors sessions and gates imports by operator token', { skip: !uri }, () =>
  withDb(async (db) => {
    const repo = MongoWorkspaceRepository.forDb(db);
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
      const bySku = await (
        await fetch(`${base}/catalog/offers?sku=FW-SKU-VF1-B`, { headers: session })
      ).json();
      assert.equal(bySku.offers.length, 1);
      const search = await (
        await fetch(`${base}/catalog/search?q=faucet`, { headers: session })
      ).json();
      assert.ok(search.products.some((p: { id: string }) => p.id === 'van-fau-mid'));
      const history = await (
        await fetch(`${base}/catalog/offers/offer-van-fau-builder/history`, { headers: session })
      ).json();
      assert.equal(history.length, 1);

      const submit = await fetch(`${base}/catalog/submissions`, {
        method: 'POST',
        headers: { ...session, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId: 'offer-van-fau-builder',
          observedAt: '2026-10-29T17:30:00Z',
          unitPrice: { amountMinor: 4198, currency: 'USD' },
          stock: 'in_stock',
          note: 'Endcap display',
        }),
      });
      assert.equal(submit.status, 201);
      const pending = await submit.json();
      assert.equal(pending.submission.status, 'pending');
      assert.equal(
        (
          await (
            await fetch(`${base}/catalog/offers/offer-van-fau-builder/history`, {
              headers: session,
            })
          ).json()
        ).length,
        1,
      );

      const reviewDenied = await fetch(
        `${base}/catalog/submissions/${pending.submission.id}/review`,
        {
          method: 'POST',
          headers: { ...session, 'Content-Type': 'application/json' },
          body: JSON.stringify({ approve: true }),
        },
      );
      assert.equal(reviewDenied.status, 403);
      const review = await fetch(`${base}/catalog/submissions/${pending.submission.id}/review`, {
        method: 'POST',
        headers: {
          ...session,
          'Content-Type': 'application/json',
          'X-Renovagent-Operator': 'test-operator-token',
        },
        body: JSON.stringify({ approve: true }),
      });
      assert.equal(review.status, 200);
      const approved = await (
        await fetch(`${base}/catalog/offers/offer-van-fau-builder/history`, { headers: session })
      ).json();
      assert.equal(approved.length, 2);
      assert.equal(approved[0].source, 'manual-entry');
    } finally {
      delete process.env.RENOVAGENT_CATALOG_OPERATOR;
      await new Promise((resolve) => server.close(resolve));
    }
  }),
);

test('a conflicting import writes nothing from any collection', { skip: !uri }, () =>
  withDb(async (db) => {
    const store = new CatalogStore(db);
    await store.ensureIndexes();
    await store.importBatch(vanityCatalog);
    const before = {
      products: await store.products.countDocuments(),
      offers: await store.offers.countDocuments(),
      observations: await store.observations.countDocuments(),
    };
    const newProduct = { ...vanityCatalog.products[0], id: 'van-new-product', model: 'NEW-1' };
    const changedOffer = { ...vanityCatalog.offers[0], sku: 'CHANGED-SKU' };
    await assert.rejects(
      store.importBatch({ products: [newProduct], offers: [changedOffer], observations: [] }),
      /different content/,
    );
    // A unique-index race (new offer ID, existing identity) also rolls back earlier inserts.
    const duplicateIdentity = { ...vanityCatalog.offers[0], id: 'offer-duplicate-identity' };
    const freshOffer = { ...vanityCatalog.offers[0], id: 'offer-fresh', productId: newProduct.id };
    await assert.rejects(
      store.importBatch({
        products: [newProduct],
        offers: [freshOffer, duplicateIdentity],
        observations: [],
      }),
      /duplicates an existing offer/,
    );
    assert.deepEqual(
      {
        products: await store.products.countDocuments(),
        offers: await store.offers.countDocuments(),
        observations: await store.observations.countDocuments(),
      },
      before,
    );
  }),
);
