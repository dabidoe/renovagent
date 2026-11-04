import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { emptyWorkspace } from '@renovagent/contracts';
import { MongoWorkspaceRepository, OWNER } from '../../apps/api/src/repository.js';
import { createWorkspaceServer } from '../../apps/api/src/server.js';
import { CatalogStore } from '../../apps/api/src/catalog.js';
import { McpAccessStore, redactedFingerprint } from '../../apps/api/src/mcp-access.js';
import { StudioPlanStore } from '../../apps/api/src/studio-plans.js';

const uri = process.env.TEST_WORKSPACE_MONGO_URI;
const FP = /^[0-9a-f]{8}…[0-9a-f]{4}$/;

test(
  'mcp auth denials are distinct and fingerprinted; keys expose fingerprint, workspace and last use',
  { skip: !uri },
  async () => {
    const mongo = new MongoClient(uri!);
    await mongo.connect();
    const db = mongo.db(`renovagent_mcp_auth_${randomUUID().replaceAll('-', '')}`);
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
    try {
      const session = await fetch(api + '/session', { headers });
      const auth = { ...headers, Cookie: session.headers.get('set-cookie')!.split(';')[0]! };
      const post = (path: string, body: unknown) =>
        fetch(api + path, {
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      const jsonHeaders = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      };
      const initialize = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'auth-probe', version: '1' },
        },
      });
      const mcp = (init: RequestInit) => fetch(`${origin}/mcp`, { method: 'POST', ...init });

      const made = await (await post('/agent-keys', { name: 'Muse', access: 'read' })).json();
      assert.match(made.key, /^reno_[A-Za-z0-9_-]{43}$/);
      const listed = async () =>
        (await (await fetch(api + '/agent-keys', { headers: auth })).json()).keys as {
          id: string;
          fingerprint: string;
          workspace: string;
          lastUsedAt: string | null;
        }[];
      const before = (await listed())[0];
      assert.match(before.fingerprint, FP);
      assert.equal(before.fingerprint, redactedFingerprint(before.id));
      assert.equal(before.workspace, repo.ownerId);
      assert.equal(before.lastUsedAt, null);

      const warnings: string[] = [];
      const infos: string[] = [];
      const warn = console.warn;
      const info = console.info;
      console.warn = (...args: unknown[]) => void warnings.push(args.map(String).join(' '));
      console.info = (...args: unknown[]) => void infos.push(args.map(String).join(' '));
      try {
        // One direct-key call: a usable credential reaches the endpoint.
        const direct = await mcp({
          headers: { ...jsonHeaders, Authorization: `Bearer ${made.key}` },
          body: initialize,
        });
        assert.equal(direct.status, 200);
        // Presence tracking is fire-and-forget, so allow it to land.
        const deadline = Date.now() + 5000;
        for (;;) {
          if ((await listed())[0].lastUsedAt !== null) break;
          assert.ok(Date.now() < deadline, 'lastUsedAt was not recorded');
          await new Promise((r) => setTimeout(r, 50));
        }

        // One unknown-key call: a well-formed but unissued credential gets a
        // distinct error, not the generic missing-credential message.
        const unknownKey = `reno_${randomBytes(32).toString('base64url')}`;
        assert.notEqual(unknownKey, made.key);
        const denied = await mcp({
          headers: { ...jsonHeaders, Authorization: `Bearer ${unknownKey}` },
          body: initialize,
        });
        assert.equal(denied.status, 401);
        const body = (await denied.json()) as {
          error: string;
          code: string;
          fingerprint: string | null;
        };
        assert.equal(body.code, 'MCP_UNKNOWN_CREDENTIAL');
        assert.match(body.fingerprint ?? '', FP);
        assert.match(body.error, /unknown/i);
        assert.match(body.error, /#connect/);
        assert.equal(body.error.includes(unknownKey), false);
        assert.equal(JSON.stringify(body).includes(unknownKey), false);

        // One synthetic surrogate call: the hsurr: shape Muse hands off gets
        // its own code. Synthetic format only; this does not verify the real
        // Muse handoff against the live site.
        const surrogate = `hsurr:${randomBytes(16).toString('base64url')}`;
        const surrogateDenied = await mcp({
          headers: { ...jsonHeaders, Authorization: `Bearer ${surrogate}` },
          body: initialize,
        });
        assert.equal(surrogateDenied.status, 401);
        const surrogateBody = (await surrogateDenied.json()) as {
          error: string;
          code: string;
          fingerprint: string | null;
        };
        assert.equal(surrogateBody.code, 'MCP_SURROGATE_CREDENTIAL');
        assert.match(surrogateBody.fingerprint ?? '', FP);
        assert.match(surrogateBody.error, /surrogate/i);
        assert.match(surrogateBody.error, /#connect/);
        assert.equal(JSON.stringify(surrogateBody).includes(surrogate), false);

        const missing = await mcp({ headers: jsonHeaders, body: initialize });
        assert.equal(missing.status, 401);
        assert.equal((await missing.json()).code, 'MCP_MISSING_CREDENTIAL');

        const malformed = await mcp({
          headers: { ...jsonHeaders, Authorization: 'Bearer short' },
          body: initialize,
        });
        assert.equal(malformed.status, 401);
        assert.equal((await malformed.json()).code, 'MCP_MALFORMED_CREDENTIAL');

        assert.equal((await post('/agent-keys/revoke', { id: made.grant.id })).status, 200);
        const revoked = await mcp({
          headers: { ...jsonHeaders, Authorization: `Bearer ${made.key}` },
          body: initialize,
        });
        assert.equal(revoked.status, 401);
        const revokedBody = (await revoked.json()) as {
          error: string;
          code: string;
          fingerprint: string;
        };
        assert.equal(revokedBody.code, 'MCP_REVOKED_CREDENTIAL');
        assert.equal(revokedBody.fingerprint, before.fingerprint);
        assert.match(revokedBody.error, /revoked/i);

        const expired = await access.issue({ ownerId: OWNER, access: 'read', name: 'Old' });
        await access.grants.updateOne(
          { _id: expired.grant._id },
          { $set: { expiresAt: new Date(0) } },
        );
        const gone = await mcp({
          headers: { ...jsonHeaders, Authorization: `Bearer ${expired.token}` },
          body: initialize,
        });
        assert.equal(gone.status, 401);
        assert.equal((await gone.json()).code, 'MCP_EXPIRED_CREDENTIAL');

        const foreign = await access.issue({
          ownerId: OWNER,
          access: 'read',
          name: 'Other site',
          clientId: 'client-1',
          resource: 'https://other.example/mcp',
        });
        const wrong = await mcp({
          headers: { ...jsonHeaders, Authorization: `Bearer ${foreign.token}` },
          body: initialize,
        });
        assert.equal(wrong.status, 401);
        assert.equal((await wrong.json()).code, 'MCP_WRONG_RESOURCE');

        const codes = [
          'MCP_MISSING_CREDENTIAL',
          'MCP_UNKNOWN_CREDENTIAL',
          'MCP_SURROGATE_CREDENTIAL',
          'MCP_MALFORMED_CREDENTIAL',
          'MCP_REVOKED_CREDENTIAL',
        ];
        for (const code of codes)
          assert.ok(
            warnings.some((line) => line.includes(code) && line.includes('[mcp]')),
            `server logs ${code}`,
          );
        assert.ok(
          infos.some((line) => line.includes('auth ok') && line.includes(before.fingerprint)),
        );
        for (const line of [...warnings, ...infos]) {
          assert.equal(line.includes(made.key), false);
          assert.equal(line.includes(unknownKey), false);
          assert.equal(line.includes(surrogate), false);
        }
      } finally {
        console.warn = warn;
        console.info = info;
      }
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.dropDatabase();
      await mongo.close();
    }
  },
);
