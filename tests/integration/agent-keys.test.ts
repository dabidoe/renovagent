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
import { StudioPlanStore } from '../../apps/api/src/studio-plans.js';

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
    const plans = new StudioPlanStore(db);
    await plans.ensureIndexes();
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
      plans,
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
      assert.ok(!tools.includes('save_plan'), 'a read-only key cannot save plans');

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
      const proposer = await (
        await post('/agent-keys', { name: 'Muse', access: 'propose' })
      ).json();
      for (let i = 1; i < 5; i++)
        assert.equal((await post('/agent-keys', { name: `k${i}`, access: 'propose' })).status, 200);

      // A propose key saves a plan and gets a link only its owner can open.
      const muse = new Client({ name: 'agent-key-plan', version: '1.0' });
      clients.push(muse);
      await muse.connect(
        new StreamableHTTPClientTransport(new URL(proposer.endpoint), {
          requestInit: { headers: { Authorization: `Bearer ${proposer.key}` } },
        }),
      );
      assert.ok((await muse.listTools()).tools.some((t) => t.name === 'save_plan'));
      const save = async () => {
        const result = await muse.callTool({
          name: 'save_plan',
          arguments: {
            requestId: 'muse-living-room-0001',
            title: 'Living room refresh',
            ceilingFt: 8,
            rooms: [
              {
                name: 'Living room',
                widthFt: 13,
                lengthFt: 24,
                paint: { hex: '#b3ae95' },
                floorStyle: 'walnut',
              },
            ],
          },
        });
        const [content] = result.content as { type: string; text: string }[];
        return JSON.parse(content!.text);
      };
      const saved = await save();
      assert.match(saved.url, new RegExp(`^${origin}/#plan/[A-Za-z0-9_-]{22}$`));
      assert.equal(saved.saved, 'new');
      assert.match(saved.total, /^\$/);
      const again = await save();
      assert.equal(again.url, saved.url, 'a retried requestId returns the same plan');
      const planId = saved.url.split('#plan/')[1];
      const opened = await (await fetch(`${api}/studio-plans/${planId}`, { headers: auth })).json();
      assert.equal(opened.agent, 'Muse');
      assert.equal(opened.project.tier, 'mid');
      assert.equal(opened.project.rooms[0].photo.src, '', 'shown in 3D, no photo');
      assert.deepEqual(opened.project.rooms[0].size, { xFt: 13, yFt: 24 });
      assert.equal(opened.project.starting['room-1'].floorStyle, 'walnut');
      assert.equal(
        (await fetch(`${api}/studio-plans/${planId}`, { headers })).status,
        403,
        'a signed-out visitor cannot open it',
      );
      const theirs = await plans.save({
        requestId: 'someone-elses-plan',
        ownerId: 'someone-else',
        agent: 'Theirs',
        title: 'Theirs',
        ceilingFt: 8,
        tier: 'mid',
        rooms: [],
      });
      assert.equal(
        (await fetch(`${api}/studio-plans/${theirs.plan._id}`, { headers: auth })).status,
        404,
        'another owner’s plan does not open here',
      );
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
