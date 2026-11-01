import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { emptyWorkspace } from '@renovagent/contracts';
import { MongoWorkspaceRepository, OWNER } from '../../apps/api/src/repository.js';
import { createWorkspaceServer } from '../../apps/api/src/server.js';
import { CatalogStore } from '../../apps/api/src/catalog.js';
import { McpAccessStore } from '../../apps/api/src/mcp-access.js';

const uri = process.env.TEST_WORKSPACE_MONGO_URI;

test(
  'owners make agent keys in the website and agents use them at the site’s own /mcp',
  { skip: !uri },
  async () => {
    const mongo = new MongoClient(uri!);
    await mongo.connect();
    const db = mongo.db(`renovagent_test_${randomUUID().replaceAll('-', '')}`);
    const repo = MongoWorkspaceRepository.forDb(db);
    await repo.collection.insertOne({
      _id: OWNER,
      version: 0,
      workspace: emptyWorkspace(OWNER),
      blobs: [],
      jobs: [],
    });
    const access = new McpAccessStore(db);
    await access.ensureIndexes();
    const { server } = await createWorkspaceServer(
      repo,
      'synthetic-agent-key-token',
      true,
      undefined,
      new CatalogStore(db),
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
    if (!address || typeof address === 'string') throw Error('No address');
    const origin = `http://127.0.0.1:${address.port}`;
    const api = `${origin}/api/workspace`;
    const headers = { 'X-Renovagent-Client': 'workspace' };
    const clients: Client[] = [];
    try {
      const session = await fetch(api + '/session', { headers });
      const auth = { ...headers, Cookie: session.headers.get('set-cookie')!.split(';')[0]! };
      const post = (path: string, body: unknown) =>
        fetch(api + path, {
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

      const made = await (await post('/agent-keys', { name: 'Muse', access: 'read' })).json();
      assert.equal(made.endpoint, `${origin}/mcp`);
      assert.match(made.key, /^reno_[A-Za-z0-9_-]{43}$/);
      const listed = await (await fetch(api + '/agent-keys', { headers: auth })).json();
      assert.deepEqual(
        listed.keys.map((k: { name: string; access: string }) => [k.name, k.access]),
        [['Muse', 'read']],
      );
      assert.ok(
        !JSON.stringify(listed).includes(made.key),
        'a key is shown once, at creation, never listed',
      );
      const days = (new Date(made.grant.expiresAt).getTime() - Date.now()) / 86_400_000;
      assert.ok(days > 6.9 && days <= 7, 'keys last seven days');

      // The agent connects to the site's own /mcp with the key.
      const agent = new Client({ name: 'agent-key-test', version: '1.0' });
      clients.push(agent);
      await agent.connect(
        new StreamableHTTPClientTransport(new URL(made.endpoint), {
          requestInit: { headers: { Authorization: `Bearer ${made.key}` } },
        }),
      );
      const tools = (await agent.listTools()).tools.map((t) => t.name);
      assert.ok(tools.includes('plan_paint_and_floor'));
      assert.ok(!tools.includes('start_project'), 'a read-only key cannot propose');

      const mcp = (init: RequestInit) => fetch(`${origin}/mcp`, { method: 'POST', ...init });
      const ping = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' });
      const jsonHeaders = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      };
      assert.equal((await mcp({ headers: jsonHeaders, body: ping })).status, 401, 'key needed');
      assert.equal(
        (await mcp({ headers: { ...jsonHeaders, Cookie: auth.Cookie }, body: ping })).status,
        401,
        'a browser session is not a key',
      );
      assert.equal(
        (
          await mcp({
            headers: {
              ...jsonHeaders,
              Authorization: `Bearer ${made.key}`,
              Origin: 'https://evil.example',
            },
            body: ping,
          })
        ).status,
        403,
      );
      assert.equal((await fetch(`${origin}/.well-known/oauth-protected-resource`)).status, 404);

      // Another owner's key cannot be revoked from this workspace.
      const other = await access.issue({ ownerId: 'someone-else', name: 'Theirs', access: 'read' });
      assert.equal((await post('/agent-keys/revoke', { id: other.grant._id })).status, 404);
      assert.ok(await access.authenticate(other.token));

      assert.equal((await post('/agent-keys/revoke', { id: made.grant.id })).status, 200);
      assert.equal(
        (
          await mcp({
            headers: { ...jsonHeaders, Authorization: `Bearer ${made.key}` },
            body: ping,
          })
        ).status,
        401,
        'a revoked key stops working at once',
      );
      for (let i = 0; i < 5; i++)
        assert.equal((await post('/agent-keys', { name: `k${i}`, access: 'propose' })).status, 200);
      assert.equal(
        (await post('/agent-keys', { name: 'sixth', access: 'read' })).status,
        400,
        'five keys at a time',
      );
    } finally {
      await Promise.all(clients.map((c) => c.close().catch(() => {})));
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.dropDatabase();
      await mongo.close();
    }
  },
);
