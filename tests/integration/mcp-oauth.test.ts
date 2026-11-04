import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { auth, type OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type {
  OAuthClientInformationMixed,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import { MongoWorkspaceRepository } from '../../apps/api/src/repository.js';
import { createWorkspaceServer } from '../../apps/api/src/server.js';
import { McpAccessStore } from '../../apps/api/src/mcp-access.js';
import { McpOAuth } from '../../apps/api/src/mcp-oauth.js';
import { AccountService, ACCOUNT_COOKIE } from '../../apps/api/src/accounts.js';

const uri = process.env.TEST_WORKSPACE_MONGO_URI;
async function fixture(
  fn: (ctx: {
    origin: string;
    access: McpAccessStore;
    pairing: McpOAuth;
    api: (path: string, data?: unknown, cookie?: string) => Promise<Response>;
    alice: string;
    bob: string;
  }) => Promise<void>,
) {
  const mongo = await new MongoClient(uri!).connect();
  const db = mongo.db(`renovagent_oauth_test_${randomUUID().replaceAll('-', '')}`);
  const repo = MongoWorkspaceRepository.forDb(db);
  await repo.ensure();
  const access = new McpAccessStore(db);
  await access.ensureIndexes();
  const accounts = new AccountService(db, {});
  const a = await accounts.guestLogin();
  const b = await accounts.guestLogin();
  await repo.forUser(a.user._id).ensure();
  await repo.forUser(b.user._id).ensure();
  const { server } = await createWorkspaceServer(
    repo,
    'test-oauth',
    false,
    accounts,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    access,
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('No listener');
  const origin = `http://127.0.0.1:${address.port}`;
  const api = (path: string, data?: unknown, cookie?: string) =>
    fetch(`${origin}/api/workspace${path}`, {
      method: data === undefined ? 'GET' : 'POST',
      headers: {
        'X-Renovagent-Client': 'workspace',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
  try {
    await fn({
      origin,
      access,
      pairing: new McpOAuth(access),
      api,
      alice: `${ACCOUNT_COOKIE}=${a.token}`,
      bob: `${ACCOUNT_COOKIE}=${b.token}`,
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    await db.dropDatabase();
    await mongo.close();
  }
}
const post = (url: string, value: Record<string, string>, json = false) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded' },
    body: json ? JSON.stringify(value) : new URLSearchParams(value),
  });

// Exercise the SDK's actual discovery, registration, PKCE and token exchange;
// only the owner's browser approval is simulated through the authenticated API.
test(
  'MCP OAuth SDK pairs by owner approval, reads tools, and respects revocation',
  { skip: !uri },
  () =>
    fixture(async ({ origin, api, alice, bob, access }) => {
      let info: OAuthClientInformationMixed | undefined;
      let tokens: OAuthTokens | undefined;
      let verifier = '';
      let authorization: URL | undefined;
      const provider: OAuthClientProvider = {
        redirectUrl: 'http://127.0.0.1:7777/callback',
        clientMetadata: {
          client_name: 'Muse integration test',
          redirect_uris: ['http://127.0.0.1:7777/callback'],
          token_endpoint_auth_method: 'none',
          grant_types: ['authorization_code'],
          response_types: ['code'],
          scope: 'renovagent:read renovagent:propose',
        },
        state: () => 'client-state',
        clientInformation: () => info,
        saveClientInformation: (value) => {
          info = value;
        },
        tokens: () => tokens,
        saveTokens: (value) => {
          tokens = value;
        },
        redirectToAuthorization: (value) => {
          authorization = value;
        },
        saveCodeVerifier: (value) => {
          verifier = value;
        },
        codeVerifier: () => verifier,
      };
      const challenge = await fetch(origin + '/mcp', { method: 'POST' });
      assert.equal(challenge.status, 401);
      assert.match(challenge.headers.get('www-authenticate')!, /resource_metadata=/);
      assert.equal(await auth(provider, { serverUrl: origin + '/mcp' }), 'REDIRECT');
      assert.ok(authorization);
      const browser = await fetch(authorization, { redirect: 'manual' });
      assert.equal(browser.status, 302);
      const requestId = new URL(browser.headers.get('location')!).hash.split('/')[2];
      assert.equal((await api(`/agent-pairing/${requestId}`, undefined)).status, 403);
      const described = await (await api(`/agent-pairing/${requestId}`, undefined, alice)).json();
      assert.equal(described.name, 'Muse integration test');
      assert.equal(described.access, 'propose');
      const approved = await api(`/agent-pairing/${requestId}`, { approve: true }, alice);
      assert.equal(approved.status, 200);
      const callback = new URL((await approved.json()).redirect);
      assert.equal(callback.searchParams.get('state'), 'client-state');
      assert.ok(callback.searchParams.get('code'));
      assert.equal((await api(`/agent-pairing/${requestId}`, { approve: true }, bob)).status, 404);
      assert.equal(
        await auth(provider, {
          serverUrl: origin + '/mcp',
          authorizationCode: callback.searchParams.get('code')!,
        }),
        'AUTHORIZED',
      );
      assert.ok(tokens?.access_token);
      assert.equal(tokens?.refresh_token, undefined);
      const client = new Client({ name: 'approved-client', version: '1' });
      try {
        await client.connect(
          new StreamableHTTPClientTransport(new URL(origin + '/mcp'), { authProvider: provider }),
        );
        const tools = await client.listTools();
        assert.ok(tools.tools.some((t) => t.name === 'start_project'));
        const listed = await client.callTool({ name: 'list_projects', arguments: {} });
        assert.ok(!listed.isError);
      } finally {
        await client.close();
      }
      const aliceKeys = await (await api('/agent-keys', undefined, alice)).json();
      const bobKeys = await (await api('/agent-keys', undefined, bob)).json();
      assert.equal(aliceKeys.keys.length, 1);
      assert.equal(bobKeys.keys.length, 0);
      assert.ok(!JSON.stringify(aliceKeys).includes(tokens!.access_token));
      const grant = await access.authenticate(tokens!.access_token);
      assert.equal(grant?.resource, origin + '/mcp');
      assert.equal((await api('/agent-keys/revoke', { id: grant!._id }, bob)).status, 404);
      assert.equal((await api('/agent-keys/revoke', { id: grant!._id }, alice)).status, 200);
      assert.equal(
        (
          await fetch(origin + '/mcp', {
            method: 'POST',
            headers: { Authorization: `Bearer ${tokens!.access_token}` },
          })
        ).status,
        401,
      );
    }),
);

test(
  'OAuth rejects unsafe redirects, PKCE/resource substitution, expired codes and replay; denial issues no grant',
  { skip: !uri },
  () =>
    fixture(async ({ origin, api, alice, access, pairing }) => {
      for (const redirect of [
        'https://evil.example/#fragment',
        'https://u:p@evil.example/cb',
        'http://evil.example/cb',
        'javascript:alert(1)',
      ]) {
        const r = await fetch(origin + '/oauth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ redirect_uris: [redirect] }),
        });
        assert.equal(r.status, 400);
      }
      const redirectUri = 'https://agent.example/callback';
      const registration = await fetch(origin + '/oauth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'Test agent',
          redirect_uris: [redirectUri],
          token_endpoint_auth_method: 'none',
        }),
      });
      const { client_id } = await registration.json();
      assert.ok(client_id);
      const verifier = randomBytes(32).toString('base64url');
      const base = {
        client_id,
        redirect_uri: redirectUri,
        response_type: 'code',
        code_challenge_method: 'S256',
        code_challenge: createHash('sha256').update(verifier).digest('base64url'),
        resource: origin + '/mcp',
        scope: 'renovagent:read',
        state: 'preserved',
      };
      const authorize = (overrides = {}) =>
        fetch(origin + '/oauth/authorize?' + new URLSearchParams({ ...base, ...overrides }), {
          redirect: 'manual',
        });
      for (const overrides of [
        { redirect_uri: 'https://evil.example/cb' },
        { code_challenge_method: 'plain' },
        { resource: 'https://other.example/mcp' },
        { scope: 'admin' },
      ])
        assert.equal((await authorize(overrides)).status, 400);
      const make = async () => {
        const response = await authorize();
        assert.equal(response.status, 302);
        return new URL(response.headers.get('location')!).hash.split('/')[2];
      };
      const denied = await make();
      const deniedResult = await (
        await api(`/agent-pairing/${denied}`, { approve: false }, alice)
      ).json();
      assert.equal(new URL(deniedResult.redirect).searchParams.get('error'), 'access_denied');
      assert.equal(await access.grants.countDocuments(), 0);
      const id = await make();
      // The owner API's same-origin custom-header guard prevents cross-site consent.
      assert.equal(
        (
          await fetch(origin + `/api/workspace/agent-pairing/${id}`, {
            method: 'POST',
            headers: { Cookie: alice, 'Content-Type': 'application/json' },
            body: '{"approve":true}',
          })
        ).status,
        403,
      );
      const callback = new URL(
        (await (await api(`/agent-pairing/${id}`, { approve: true }, alice)).json()).redirect,
      );
      const code = callback.searchParams.get('code')!;
      const exchange = {
        grant_type: 'authorization_code',
        client_id,
        redirect_uri: redirectUri,
        resource: origin + '/mcp',
        code_verifier: verifier,
        code,
      };
      for (const overrides of [
        { code_verifier: 'x'.repeat(43) },
        { redirect_uri: 'https://evil.example/cb' },
        { client_id: 'other-client' },
        { resource: 'https://other.example/mcp' },
      ])
        assert.equal(
          (await post(origin + '/oauth/token', { ...exchange, ...overrides })).status,
          400,
        );
      const results = await Promise.all([
        post(origin + '/oauth/token', exchange),
        post(origin + '/oauth/token', exchange),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
      const success = await results.find((r) => r.status === 200)!.json();
      const readClient = new Client({ name: 'read-client', version: '1' });
      try {
        await readClient.connect(
          new StreamableHTTPClientTransport(new URL(origin + '/mcp'), {
            requestInit: { headers: { Authorization: `Bearer ${success.access_token}` } },
          }),
        );
        assert.ok(!(await readClient.listTools()).tools.some((t) => t.name === 'start_project'));
      } finally {
        await readClient.close();
      }
      assert.equal(
        (await post(origin + '/oauth/revoke', { token: success.access_token, client_id })).status,
        200,
      );
      assert.equal(await access.authenticate(success.access_token), null);
      const expiredRequest = await make();
      await pairing.requests.updateOne(
        { _id: expiredRequest },
        { $set: { expiresAt: new Date(0) } },
      );
      assert.equal(
        (await api(`/agent-pairing/${expiredRequest}`, { approve: true }, alice)).status,
        404,
      );
      const expiredCodeId = await make();
      const expiredCallback = new URL(
        (
          await (await api(`/agent-pairing/${expiredCodeId}`, { approve: true }, alice)).json()
        ).redirect,
      );
      const expiredCode = expiredCallback.searchParams.get('code')!;
      await pairing.codes.updateOne(
        { _id: createHash('sha256').update(expiredCode).digest('hex') },
        { $set: { expiresAt: new Date(0) } },
      );
      assert.equal(
        (await post(origin + '/oauth/token', { ...exchange, code: expiredCode })).status,
        400,
      );
    }),
);
