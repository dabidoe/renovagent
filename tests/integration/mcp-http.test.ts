import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { request } from 'node:http';
import { MongoClient } from 'mongodb';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { MongoWorkspaceRepository, type Aggregate } from '../../apps/api/src/repository.js';
import { McpAccessStore } from '../../apps/api/src/mcp-access.js';
import { createMcpHttpServer } from '../../apps/api/src/mcp-http.js';
import { startAgentProject } from '../../apps/api/src/agent-projects.js';

const uri = process.env.TEST_WORKSPACE_MONGO_URI;

async function withServer(
  fn: (context: {
    base: string;
    repo: MongoWorkspaceRepository;
    access: McpAccessStore;
    token: string;
    connect: (token: string) => Promise<Client>;
  }) => Promise<void>,
  requestsPerMinute?: number,
) {
  const mongo = new MongoClient(uri!, { serverSelectionTimeoutMS: 3000 });
  await mongo.connect();
  const db = mongo.db(`renovagent_mcp_http_test_${randomUUID().replaceAll('-', '')}`);
  const clients: Client[] = [];
  const repo = new MongoWorkspaceRepository(
    db.collection<Aggregate>('workspace_aggregates'),
    'user:alice',
  );
  await repo.ensure();
  await repo.forUser('user:bob').ensure();
  const access = new McpAccessStore(db);
  await access.ensureIndexes();
  const { token } = await access.issue({
    ownerId: repo.ownerId,
    access: 'propose',
    name: 'Test app',
  });
  const server = createMcpHttpServer(repo, access, undefined, {
    publicUrl: 'https://renovagent-test.example/mcp',
    requestsPerMinute,
  });
  try {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const connect = async (credential: string) => {
      const client = new Client({ name: 'ordinary-remote-client', version: '1.0' });
      clients.push(client);
      await client.connect(
        new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
          requestInit: { headers: { Authorization: `Bearer ${credential}` } },
        }),
      );
      return client;
    };
    await fn({ base, repo, access, token, connect });
  } finally {
    await Promise.all(clients.map((client) => client.close().catch(() => {})));
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.dropDatabase();
    await mongo.close();
  }
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as { type: string; text: string }[];
  return {
    error: result.isError === true,
    text: content[0].text,
    data: () => JSON.parse(content[0].text),
  };
}

// Unlike fetch, raw HTTP preserves an explicitly supplied Host header. Exercise
// the wire boundary rather than a fetch implementation's header normalization.
async function withHost(url: string, host: string, token: string, body = '') {
  return new Promise<number>((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'POST',
        headers: {
          Host: host,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode!));
      },
    );
    req.on('error', reject);
    req.end(body);
  });
}

test(
  'remote MCP starts a casual project, discovers its files and preserves retry identity',
  { skip: !uri },
  () =>
    withServer(async ({ connect, token, repo }) => {
      const mcp = await connect(token);
      const input = {
        requestId: 'living-room-1',
        name: 'Living room refresh',
        brief: 'I want to renovate my living room. Keep the sofa.',
      };
      const started = await call(mcp, 'start_project', input);
      assert.equal(started.error, false);
      const saved = started.data();
      const before = (await repo.read()).workspace;
      assert.equal(Object.keys(before.projects).length, 1);
      assert.equal(Object.keys(before.facts).length, 0);
      assert.equal(before.artifacts[saved.artifactRef.id][0].lifecycle, 'proposed');
      assert.match(before.artifacts[saved.artifactRef.id][0].payload.kind, /project-brief/);
      const files = (await call(mcp, 'list_project_files', { projectId: saved.projectId })).data();
      assert.deepEqual(files[0].artifactRef, saved.artifactRef);
      const context = (
        await call(mcp, 'get_project_context', { projectId: saved.projectId })
      ).data();
      assert.equal(context.capabilities.transports[0], 'streamable-http');
      assert.equal(context.files.length, 1);
      const replay = await call(mcp, 'start_project', input);
      assert.equal(replay.error, false);
      assert.deepEqual(replay.data(), saved);
      assert.equal((await repo.read()).workspace.events.length, before.events.length);
      const changed = await call(mcp, 'start_project', { ...input, brief: 'Different request' });
      assert.equal(changed.error, true);
      assert.match(changed.text, /idempotency|different|CONFLICT/i);
      assert.equal((await repo.read()).workspace.events.length, before.events.length);
      // Fresh HTTP client, same durable records. No process-local session holds the project.
      const reconnect = await connect(token);
      const artifact = (
        await call(reconnect, 'get_artifact', { artifactId: saved.artifactRef.id })
      ).data();
      assert.equal(artifact.artifact.payload.sections[0].text, input.brief);
    }),
);

test(
  'remote credentials isolate owners; read access cannot discover or call mutation tools',
  { skip: !uri },
  () =>
    withServer(async ({ connect, access, token, repo }) => {
      const alice = await connect(token);
      const project = (
        await call(alice, 'start_project', {
          requestId: 'private-project',
          name: 'Private',
          brief: 'Private project request',
        })
      ).data();
      const bobGrant = await access.issue({ ownerId: 'user:bob', access: 'propose', name: 'Bob' });
      const bob = await connect(bobGrant.token);
      assert.deepEqual((await call(bob, 'list_projects')).data(), []);
      assert.equal(
        (await call(bob, 'get_artifact', { artifactId: project.artifactRef.id })).error,
        true,
      );
      assert.equal(
        (await call(bob, 'list_project_files', { projectId: project.projectId })).error,
        true,
      );
      assert.equal(
        (
          await call(bob, 'start_project', {
            requestId: 'foreign-home',
            name: 'No',
            brief: 'No',
            propertyId: project.propertyId,
          })
        ).error,
        true,
      );
      const read = await access.issue({ ownerId: repo.ownerId, access: 'read', name: 'Read only' });
      const reader = await connect(read.token);
      const tools = await reader.listTools();
      assert.ok(tools.tools.every((tool) => tool.annotations?.readOnlyHint === true));
      assert.ok(
        tools.tools.every(
          (tool) => !['start_project', 'propose_project_change'].includes(tool.name),
        ),
      );
      assert.equal(
        (await call(reader, 'start_project', { requestId: 'forbidden', name: 'No', brief: 'No' }))
          .error,
        true,
      );
      const before = (await repo.read()).workspace.events.length;
      const denied = await call(alice, 'propose_project_change', {
        commands: [
          {
            commandId: 'cannot-approve',
            projectId: project.projectId,
            baseRevision: 2,
            type: 'AcceptDecision',
            payload: { decisionId: 'no', question: 'No', artifactRefs: [project.artifactRef] },
          },
        ],
      });
      assert.equal(denied.error, true);
      assert.match(denied.text, /Capability limit/);
      assert.equal((await repo.read()).workspace.events.length, before);
    }),
);

test(
  'remote auth is rechecked after revocation and expiry; malformed and URL credentials fail',
  { skip: !uri },
  () =>
    withServer(async ({ base, access, token, connect, repo }) => {
      assert.equal((await fetch(`${base}/mcp`, { method: 'POST' })).status, 401);
      assert.equal((await fetch(`${base}/mcp?token=${token}`, { method: 'POST' })).status, 404);
      assert.equal(
        (
          await fetch(`${base}/mcp`, {
            method: 'POST',
            headers: { Authorization: 'Bearer invalid' },
          })
        ).status,
        401,
      );
      const mcp = await connect(token);
      const grant = await access.authenticate(token);
      assert.ok(grant);
      assert.notEqual(grant._id, token);
      assert.equal(JSON.stringify(grant).includes(token), false);
      await access.revoke(grant._id);
      await assert.rejects(mcp.listTools());
      const expired = await access.issue({
        ownerId: repo.ownerId,
        access: 'read',
        name: 'Expired',
      });
      await access.grants.updateOne(
        { _id: expired.grant._id },
        { $set: { expiresAt: new Date(0) } },
      );
      assert.equal(await access.authenticate(expired.token), null);
      assert.equal(
        (
          await fetch(`${base}/mcp`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${expired.token}` },
          })
        ).status,
        401,
      );
    }),
);

test(
  'remote boundary rejects foreign origins, hosts, sessions and oversized bodies',
  { skip: !uri },
  () =>
    withServer(async ({ base, token }) => {
      const headers = { Authorization: `Bearer ${token}` };
      const documentation = await fetch(base);
      assert.equal(documentation.status, 200);
      assert.match(await documentation.text(), /Authorization: Bearer/);
      assert.equal(
        (
          await fetch(`${base}/mcp`, {
            method: 'POST',
            headers: { ...headers, Origin: 'https://attacker.example' },
          })
        ).status,
        403,
      );
      assert.equal(await withHost(`${base}/mcp`, 'attacker.example', token), 403);
      assert.equal((await fetch(`${base}/api/workspace`, { headers })).status, 404);
      assert.equal((await fetch(`${base}/mcp`, { headers })).status, 405);
      const initialized = await fetch(`${base}/mcp`, {
        method: 'POST',
        headers: {
          ...headers,
          Host: 'renovagent-test.example',
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'test', version: '1' },
          },
        }),
      });
      assert.equal(initialized.status, 200);
      assert.equal(initialized.headers.get('mcp-session-id'), null);
      assert.equal(
        await withHost(
          `${base}/mcp`,
          'renovagent-test.example',
          token,
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2025-03-26',
              capabilities: {},
              clientInfo: { name: 'test', version: '1' },
            },
          }),
        ),
        200,
      );
      assert.equal(
        (
          await fetch(`${base}/mcp`, {
            method: 'POST',
            headers: {
              ...headers,
              'Content-Type': 'application/json',
              Accept: 'application/json, text/event-stream',
            },
            body: JSON.stringify({ padding: 'x'.repeat(1024 * 1024) }),
          })
        ).status,
        413,
      );
    }),
);

test('remote requests enforce per-credential rate limits', { skip: !uri }, () =>
  withServer(async ({ base, token }) => {
    const request = () =>
      fetch(`${base}/mcp`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    assert.notEqual((await request()).status, 429);
    const limited = await request();
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
  }, 1),
);

test(
  'project intake attaches to an existing home and rolls back invalid retries',
  { skip: !uri },
  () =>
    withServer(async ({ repo }) => {
      const first = await startAgentProject(repo, {
        requestId: 'first',
        name: 'Bathroom',
        brief: 'How much for this bathroom?',
      });
      const second = await startAgentProject(repo, {
        requestId: 'second',
        name: 'Living room',
        brief: 'Keep the sofa',
        propertyId: first.propertyId,
      });
      const before = (await repo.read()).workspace;
      assert.equal(first.propertyId, second.propertyId);
      assert.equal(Object.keys(before.properties).length, 1);
      const replay = await startAgentProject(repo, {
        requestId: 'second',
        name: 'Living room',
        brief: 'Keep the sofa',
        propertyId: first.propertyId,
      });
      assert.deepEqual(replay, second);
      await assert.rejects(
        startAgentProject(repo, {
          requestId: 'third',
          name: '',
          brief: 'Invalid',
          propertyId: first.propertyId,
        }),
      );
      assert.deepEqual((await repo.read()).workspace, before);
    }),
);
