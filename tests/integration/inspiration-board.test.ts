import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { MongoClient } from 'mongodb';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { emptyWorkspace } from '@renovagent/contracts';
import { MongoWorkspaceRepository, OWNER } from '../../apps/api/src/repository.js';
import { createWorkspaceServer } from '../../apps/api/src/server.js';
import { CatalogStore } from '../../apps/api/src/catalog.js';
import { McpAccessStore } from '../../apps/api/src/mcp-access.js';
import { StudioPlanStore } from '../../apps/api/src/studio-plans.js';
import { DesignImageStore } from '../../apps/api/src/design-images.js';

const uri = process.env.TEST_WORKSPACE_MONGO_URI;
const photo = readFileSync(
  new URL('../../public/examples/bedroom-refresh/before.jpg', import.meta.url),
);

test(
  'an owner’s agent adds links and photos to their inspiration board; the owner sees them as not checked',
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
      'synthetic-board-token',
      true,
      undefined,
      new CatalogStore(db),
      undefined,
      { images: new DesignImageStore(db) },
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
      const connect = async (name: string, mode: 'read' | 'propose') => {
        const made = await (await post('/agent-keys', { name, access: mode })).json();
        const client = new Client({ name: `board-${mode}`, version: '1.0' });
        clients.push(client);
        await client.connect(
          new StreamableHTTPClientTransport(new URL(made.endpoint), {
            requestInit: { headers: { Authorization: `Bearer ${made.key}` } },
          }),
        );
        return client;
      };
      const call = async (client: Client, name: string, args: Record<string, unknown>) => {
        const result = await client.callTool({ name, arguments: args });
        const [content] = result.content as { type: string; text: string }[];
        return { error: !!result.isError, body: content!.text };
      };

      const reader = await connect('Reader', 'read');
      const readTools = (await reader.listTools()).tools.map((t) => t.name);
      assert.ok(!readTools.includes('save_inspiration'), 'a read-only key cannot add finds');

      const muse = await connect('Muse', 'propose');
      const tools = (await muse.listTools()).tools.map((t) => t.name);
      assert.ok(tools.includes('save_inspiration') && tools.includes('list_inspiration'));

      const link = {
        requestId: 'muse-find-pillow-0001',
        kind: 'product',
        title: 'Rust velvet lumbar pillow',
        url: 'https://example.com/pillow',
        note: 'Matches the rust in the pin',
      };
      const saved = JSON.parse((await call(muse, 'save_inspiration', link)).body);
      assert.equal(saved.saved, 'new');
      assert.equal(saved.shownAt, `${origin}/#your-project`);
      const again = JSON.parse((await call(muse, 'save_inspiration', link)).body);
      assert.equal(again.id, saved.id, 'a retried requestId saves once');

      const unsafe = await call(muse, 'save_inspiration', {
        ...link,
        requestId: 'muse-find-unsafe-0001',
        url: 'javascript:alert(1)',
      });
      assert.ok(unsafe.error, 'only http(s) links');
      const bare = await call(muse, 'save_inspiration', {
        requestId: 'muse-find-bare-0001',
        kind: 'inspiration',
        title: 'Nothing to show',
      });
      assert.ok(bare.error, 'a find needs a link or a photo');

      const pictured = JSON.parse(
        (
          await call(muse, 'save_inspiration', {
            requestId: 'muse-find-photo-0001',
            kind: 'inspiration',
            title: 'Bedroom the owner sent',
            photoBase64: photo.toString('base64'),
          })
        ).body,
      );
      assert.equal(pictured.saved, 'new');

      // The owner sees both in the studio, newest first, marked as the agent's.
      const board = await (await fetch(api + '/studio/finds', { headers: auth })).json();
      assert.deepEqual(
        board.finds.map((f: { title: string; agent: string }) => [f.title, f.agent]),
        [
          ['Bedroom the owner sent', 'Muse'],
          ['Rust velvet lumbar pillow', 'Muse'],
        ],
      );
      assert.ok(!('price' in board.finds[1]), 'finds never carry a price');
      const image = await fetch(`${api}/design-images/${board.finds[0].imageSha256}`, {
        headers: auth,
      });
      assert.equal(image.status, 200, 'the agent’s photo is in the owner’s image store');

      // The owner adds and removes their own links; another owner's finds stay out.
      assert.equal(
        (
          await post('/studio/finds', {
            requestId: 'owner-link-0001',
            kind: 'inspiration',
            title: 'A room I love',
            url: 'https://example.com/room',
          })
        ).status,
        200,
      );
      await plans.saveFind({
        ownerId: 'someone-else',
        requestId: 'theirs-0001',
        kind: 'inspiration',
        title: 'Theirs',
        url: 'https://example.com/theirs',
        agent: 'Theirs',
      });
      const listed = JSON.parse((await call(muse, 'list_inspiration', {})).body);
      assert.deepEqual(
        listed.map((f: { title: string; addedBy: string }) => [f.title, f.addedBy]),
        [
          ['A room I love', 'owner'],
          ['Bedroom the owner sent', 'Muse'],
          ['Rust velvet lumbar pillow', 'Muse'],
        ],
      );
      const theirs = (await plans.listFinds('someone-else'))[0]!;
      assert.equal(
        (await post('/studio/finds/remove', { id: theirs._id })).status,
        404,
        'another owner’s find cannot be removed here',
      );
      assert.equal((await post('/studio/finds/remove', { id: saved.id })).status, 200);
      assert.equal(
        (await (await fetch(api + '/studio/finds', { headers: auth })).json()).finds.length,
        2,
      );
      assert.equal(
        (await fetch(api + '/studio/finds', { headers })).status,
        403,
        'signed out, no board',
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
