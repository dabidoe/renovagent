import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { MongoClient, type Db } from 'mongodb';
import { MongoWorkspaceRepository, OWNER } from '../../apps/api/src/repository.js';
import { AccountService } from '../../apps/api/src/accounts.js';
import { createWorkspaceServer } from '../../apps/api/src/server.js';
import type { HostingConfig } from '../../apps/api/src/hosting.js';
import { request } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
    login: (provider: 'google' | 'meta', code: string, signedInAs?: string) => Promise<string>,
  ) => Promise<void>,
  hosting?: HostingConfig,
) {
  const client = new MongoClient(uri!);
  await client.connect();
  const db = client.db(`renovagent_accounts_test_${randomUUID().replaceAll('-', '')}`);
  const repo = MongoWorkspaceRepository.forDb(db);
  await repo.ensure();
  const accounts = stubAccounts(db);
  const { server } = await createWorkspaceServer(
    repo,
    'synthetic-account-test-token',
    false,
    accounts,
    undefined,
    undefined,
    undefined,
    hosting,
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/workspace`;
  const login = async (provider: 'google' | 'meta', code: string, signedInAs?: string) => {
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
    // A browser arrives here from the provider's site, so the request is cross-site.
    const done = await fetch(
      `${base}/auth/${provider}/callback?code=${code}&state=${target.searchParams.get('state')}`,
      {
        headers: {
          ...headers,
          'Sec-Fetch-Site': 'cross-site',
          ...(signedInAs ? { Cookie: signedInAs } : {}),
        },
        redirect: 'manual',
      },
    );
    assert.equal(done.status, 302);
    assert.equal(done.headers.get('location'), '/');
    const cookie = done.headers.getSetCookie()[0];
    assert.equal(/; Secure/.test(cookie), hosting?.publicUrl?.protocol === 'https:');
    return cookie.split(';')[0];
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

test(
  'a guest gets their own private workspace in one click, limited per address',
  { skip: !uri },
  () =>
    withAccountServer(async (base) => {
      const session = await (await fetch(`${base}/session`, { headers })).json();
      assert.equal(session.guests, true);
      const guest = async (from: string) =>
        fetch(`${base}/auth/guest`, {
          method: 'POST',
          headers: { ...headers, 'X-Forwarded-For': from },
        });
      // A guest start is a same-origin POST with the workspace header, never a link.
      assert.equal(
        (await fetch(`${base}/auth/guest`, { method: 'POST' })).status,
        403,
        'the workspace header is required',
      );
      const first = await guest('203.0.113.7');
      assert.equal(first.status, 200);
      const a = first.headers.getSetCookie()[0]!.split(';')[0]!;
      const b = (await guest('203.0.113.7')).headers.getSetCookie()[0]!.split(';')[0]!;
      const me = await (
        await fetch(`${base}/session`, { headers: { ...headers, Cookie: a } })
      ).json();
      assert.equal(me.signedIn, true);
      assert.deepEqual(me.user, { email: 'Guest', guest: true });
      const homeA = await (await fetch(base, { headers: { ...headers, Cookie: a } })).json();
      const homeB = await (await fetch(base, { headers: { ...headers, Cookie: b } })).json();
      assert.notEqual(homeA.ownerId, homeB.ownerId, 'each guest has their own workspace');
      for (let i = 2; i < 20; i++) assert.equal((await guest('203.0.113.7')).status, 200);
      assert.equal((await guest('203.0.113.7')).status, 400, 'twenty an hour per address');
      assert.equal((await guest('198.51.100.4')).status, 200, 'other addresses are unaffected');
    }),
);

test(
  'a guest who signs in with Google keeps their workspace; an existing account is not merged',
  { skip: !uri },
  () =>
    withAccountServer(async (base, login) => {
      const asGuest = async () =>
        (await fetch(`${base}/auth/guest`, { method: 'POST', headers })).headers
          .getSetCookie()[0]!
          .split(';')[0]!;
      const owner = async (cookie: string) =>
        (await (await fetch(base, { headers: { ...headers, Cookie: cookie } })).json()).ownerId;
      const session = async (cookie: string) =>
        (await fetch(`${base}/session`, { headers: { ...headers, Cookie: cookie } })).json();

      const guest = await asGuest();
      const guestOwner = await owner(guest);
      const kept = await login('google', 'judge', guest);
      assert.equal(await owner(kept), guestOwner, 'the guest workspace is now the Google account');
      assert.deepEqual((await session(kept)).user, { email: 'judge@example.com', guest: false });
      assert.equal((await session(guest)).signedIn, false, 'the guest session is ended');
      const again = await login('google', 'judge');
      assert.equal(await owner(again), guestOwner, 'later sign-ins return to the same workspace');

      // Someone who already has an account signs into it; the guest stays separate.
      const ann = await owner(await login('google', 'ann'));
      const other = await asGuest();
      const otherOwner = await owner(other);
      assert.equal(await owner(await login('google', 'ann', other)), ann);
      assert.notEqual(ann, otherOwner);
    }),
);

test('local mode is unchanged when Google is not configured', { skip: !uri }, async () => {
  const client = new MongoClient(uri!);
  await client.connect();
  const db = client.db(`renovagent_localmode_test_${randomUUID().replaceAll('-', '')}`);
  try {
    const repo = MongoWorkspaceRepository.forDb(db);
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
    // The shared local token must never be offered on a public origin.
    await assert.rejects(
      createWorkspaceServer(
        repo,
        'synthetic-local-test-token',
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        publicHosting,
      ),
      /needs Google or Meta sign-in/,
    );
  } finally {
    await db.dropDatabase();
    await client.close();
  }
});

const publicHosting: HostingConfig = {
  listenHost: '0.0.0.0',
  listenPort: 0,
  publicUrl: new URL('https://renovagent.example'),
};

// Sends a request as a browser on the public origin would (fetch cannot set Host).
const asPublic = (base: string, path: string, origin?: string) =>
  new Promise<{ status: number; body: string }>((done, fail) =>
    request(
      `${base.replace(/\/api\/workspace$/, '')}${path}`,
      {
        headers: { ...headers, Host: 'renovagent.example', ...(origin ? { Origin: origin } : {}) },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => done({ status: res.statusCode!, body }));
      },
    )
      .on('error', fail)
      .end(),
  );

test(
  'a public deployment serves the site, trusts only its origin and sets secure cookies',
  { skip: !uri },
  async () => {
    const site = await mkdtemp(join(tmpdir(), 'renovagent-public-'));
    await writeFile(join(site, 'index.html'), '<h1>Renovagent</h1>');
    try {
      await withAccountServer(
        async (base, login) => {
          assert.equal((await asPublic(base, '/healthz')).status, 200);
          const page = await asPublic(base, '/', 'https://elsewhere.example');
          assert.equal(page.body, '<h1>Renovagent</h1>');
          const own = await asPublic(base, '/api/workspace/auth/me', 'https://renovagent.example');
          assert.equal(own.status, 200);
          assert.equal(JSON.parse(own.body).mode, 'account');
          const foreign = await asPublic(base, '/api/workspace/auth/me', 'https://evil.example');
          assert.equal(foreign.status, 403);
          const wrongHost = await fetch(`${base}/auth/me`, {
            headers: { ...headers, Origin: 'https://renovagent.example.evil' },
          });
          assert.equal(wrongHost.status, 403);
          // Sign-in returns to / with a Secure cookie (asserted in login).
          const alice = await login('google', 'alice');
          const me = await (
            await fetch(`${base}/auth/me`, { headers: { ...headers, Cookie: alice } })
          ).json();
          assert.equal(me.signedIn, true);
          // Only the provider return is exempt: cross-site data reads stay blocked.
          const crossSite = await fetch(base, {
            headers: { ...headers, Cookie: alice, 'Sec-Fetch-Site': 'cross-site' },
          });
          assert.equal(crossSite.status, 403);
        },
        { ...publicHosting, staticDir: site },
      );
    } finally {
      await rm(site, { recursive: true, force: true });
    }
  },
);
