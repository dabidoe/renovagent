import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { MongoClient, type Db } from 'mongodb';
import { MongoWorkspaceRepository, OWNER, type Aggregate } from '../../apps/api/src/repository.js';
import { AccountService } from '../../apps/api/src/accounts.js';
import { createWorkspaceServer } from '../../apps/api/src/server.js';
import { Scenario } from '../foundation-helpers.js';

const uri = process.env.TEST_WORKSPACE_MONGO_URI;
const headers = { 'X-Renovagent-Client': 'workspace' };

function stubAccounts(db: Db) {
  return new AccountService(
    db,
    {
      google: {
        clientId: 'test-google-client-id',
        clientSecret: 'test-google-client-secret',
        redirectUri: 'http://127.0.0.1:8741/api/workspace/auth/google/callback',
      },
      meta: {
        appId: 'test-meta-app-id',
        appSecret: 'test-meta-app-secret',
        redirectUri: 'http://127.0.0.1:8741/api/workspace/auth/meta/callback',
      },
    },
    {
      exchangeGoogleCode: async (_config, code) => ({ idToken: code }),
      verifyGoogleIdToken: async (_config, idToken) => ({
        sub: `google-${idToken}`,
        email: `${idToken}@example.com`,
      }),
      exchangeMetaCode: async (_config, code) => ({ accessToken: code }),
      verifyMetaToken: async (_config, accessToken) => ({
        sub: `meta-${accessToken}`,
        email: `${accessToken}@example.com`,
      }),
    },
  );
}

async function withAccountServer(
  fn: (
    base: string,
    login: (provider: 'google' | 'meta', code: string) => Promise<string>,
  ) => Promise<void>,
) {
  const client = new MongoClient(uri!);
  await client.connect();
  const db = client.db(`renovagent_accounts_test_${randomUUID().replaceAll('-', '')}`);
  const repo = new MongoWorkspaceRepository(db.collection<Aggregate>('workspace_aggregates'));
  await repo.ensure();
  const accounts = stubAccounts(db);
  const { server } = await createWorkspaceServer(
    repo,
    'synthetic-account-test-token',
    false,
    accounts,
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/workspace`;
  const login = async (provider: 'google' | 'meta', code: string) => {
    const start = await fetch(`${base}/auth/${provider}`, { headers, redirect: 'manual' });
    assert.equal(start.status, 302);
    const target = new URL(start.headers.get('location')!);
    if (provider === 'google') {
      assert.equal(target.hostname, 'accounts.google.com');
      assert.equal(target.searchParams.get('client_id'), 'test-google-client-id');
    } else {
      assert.equal(target.hostname, 'www.facebook.com');
      assert.equal(target.searchParams.get('client_id'), 'test-meta-app-id');
      assert.match(target.searchParams.get('scope')!, /email/);
    }
    const done = await fetch(
      `${base}/auth/${provider}/callback?code=${code}&state=${target.searchParams.get('state')}`,
      { headers, redirect: 'manual' },
    );
    assert.equal(done.status, 302);
    assert.equal(done.headers.get('location'), '/');
    return done.headers.getSetCookie()[0].split(';')[0];
  };
  try {
    await fn(base, login);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await db.dropDatabase();
    await client.close();
  }
}

test(
  'account mode signs in through Google, adopts local work, and isolates owners',
  { skip: !uri },
  () =>
    withAccountServer(async (base, login) => {
      const unauth = await fetch(base, { headers });
      assert.equal(unauth.status, 403);

      const badState = await fetch(`${base}/auth/google/callback?code=x&state=bogus`, {
        headers,
        redirect: 'manual',
      });
      assert.equal(badState.status, 302);
      assert.equal(badState.headers.get('location'), '/?auth=error');

      const alice = await login('google', 'alice');
      const me = await (
        await fetch(`${base}/auth/me`, { headers: { ...headers, Cookie: alice } })
      ).json();
      assert.equal(me.signedIn, true);
      assert.equal(me.user.email, 'alice@example.com');

      const session = await (
        await fetch(`${base}/session`, { headers: { ...headers, Cookie: alice } })
      ).json();
      assert.equal(session.mode, 'account');
      assert.equal(session.signedIn, true);

      const empty = await (await fetch(base, { headers: { ...headers, Cookie: alice } })).json();
      assert.deepEqual(empty.projects, {});

      const s = new Scenario();
      s.create();
      const imported = await fetch(`${base}/import`, {
        method: 'POST',
        headers: { ...headers, Cookie: alice, 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace: s.state, blobs: [] }),
      });
      assert.equal(imported.status, 200);
      const adopted = await (await fetch(base, { headers: { ...headers, Cookie: alice } })).json();
      assert.ok(adopted.projects['project-a']);
      assert.notEqual(adopted.ownerId, OWNER);
      assert.equal(adopted.properties['property-a'].ownerId, adopted.ownerId);

      const bob = await login('google', 'bob');
      const separate = await (await fetch(base, { headers: { ...headers, Cookie: bob } })).json();
      assert.deepEqual(separate.projects, {});
      assert.notEqual(separate.ownerId, adopted.ownerId);
      const stillAlice = await (
        await fetch(base, { headers: { ...headers, Cookie: alice } })
      ).json();
      assert.ok(stillAlice.projects['project-a']);

      const logout = await fetch(`${base}/auth/logout`, {
        method: 'POST',
        headers: { ...headers, Cookie: alice },
      });
      assert.equal(logout.status, 200);
      const after = await (
        await fetch(`${base}/auth/me`, { headers: { ...headers, Cookie: alice } })
      ).json();
      assert.equal(after.signedIn, false);
    }),
);

test(
  'Meta login signs in separately and never merges into a Google account by email',
  { skip: !uri },
  () =>
    withAccountServer(async (base, login) => {
      const session = await (await fetch(`${base}/session`, { headers })).json();
      assert.deepEqual(session.providers, ['google', 'meta']);

      const viaGoogle = await login('google', 'sam');
      const googleHome = await (
        await fetch(base, { headers: { ...headers, Cookie: viaGoogle } })
      ).json();

      // Same email through Meta must not merge into the Google account.
      const viaMeta = await login('meta', 'sam');
      const me = await (
        await fetch(`${base}/auth/me`, { headers: { ...headers, Cookie: viaMeta } })
      ).json();
      assert.equal(me.signedIn, true);
      assert.equal(me.user.email, 'sam@example.com');
      const metaHome = await (
        await fetch(base, { headers: { ...headers, Cookie: viaMeta } })
      ).json();
      assert.deepEqual(metaHome.projects, {});
      assert.notEqual(metaHome.ownerId, googleHome.ownerId);
    }),
);

test('local mode is unchanged when Google is not configured', { skip: !uri }, async () => {
  const client = new MongoClient(uri!);
  await client.connect();
  const db = client.db(`renovagent_localmode_test_${randomUUID().replaceAll('-', '')}`);
  try {
    const repo = new MongoWorkspaceRepository(db.collection<Aggregate>('workspace_aggregates'));
    await repo.ensure();
    const { server } = await createWorkspaceServer(repo, 'synthetic-local-test-token', false);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/workspace`;
    try {
      assert.equal(
        (await fetch(`${base}/auth/google`, { headers, redirect: 'manual' })).status,
        400,
      );
      const me = await (await fetch(`${base}/auth/me`, { headers })).json();
      assert.deepEqual(me, { mode: 'local-single-owner', signedIn: false });
      const session = await fetch(`${base}/session`, { headers });
      assert.equal(session.status, 200);
      assert.equal((await session.json()).mode, 'local-single-owner');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  } finally {
    await db.dropDatabase();
    await client.close();
  }
});
