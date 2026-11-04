import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { MongoClient } from 'mongodb';
import { studioDesignSchema } from '@renovagent/contracts';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createWorkspaceMcpServer } from '../../apps/api/src/mcp.js';
import { StudioPlanStore } from '../../apps/api/src/studio-plans.js';
import { AccountService, ACCOUNT_COOKIE } from '../../apps/api/src/accounts.js';
import { MongoWorkspaceRepository } from '../../apps/api/src/repository.js';
import { createWorkspaceServer } from '../../apps/api/src/server.js';
import { DesignImageStore, normalizeImage } from '../../apps/api/src/design-images.js';
import { saveStudioDesign, readStudioDesign } from '../../apps/api/src/studio-designs.js';
import { uploadedOwnStudio } from '../../apps/web/src/features/house-example/own-analysis.js';

const uri = process.env.TEST_WORKSPACE_MONGO_URI;
test(
  'guests publish a fixed revision, anonymous viewers see only its photos, and copies persist independently',
  { skip: !uri },
  async () => {
    const mongo = await new MongoClient(uri!).connect();
    const db = mongo.db(`renovagent_share_test_${randomUUID().replaceAll('-', '')}`);
    const repo = MongoWorkspaceRepository.forDb(db);
    const accounts = new AccountService(db, {});
    const guest = await accounts.guestLogin();
    const owner = repo.forUser(guest.user._id);
    await owner.ensure();
    const images = new DesignImageStore(db);
    const normalized = await normalizeImage(
      readFileSync(new URL('../../public/examples/hutchinson/photo-04.jpg', import.meta.url)),
    );
    const source = await images.put(owner.ownerId, normalized);
    const unrelated = await images.put(owner.ownerId, {
      ...normalized,
      bytes: new Uint8Array([...normalized.bytes, 0]),
    });
    const snapshot = studioDesignSchema.parse({
      kind: 'studio-design',
      basis: 'owner-studio',
      tier: 'mid',
      project: uploadedOwnStudio({
        photos: [source.sha256],
        plans: [],
        where: 'QA shared guest room',
        ceilingFt: null,
        idea: '',
      }).project,
      picks: {},
      inspired: {},
      styling: {},
      renderSignatures: {},
    });
    const saved = await saveStudioDesign(owner, images, {
      requestId: 'initial-save',
      expectedRevision: 0,
      snapshot,
    });
    const { server } = await createWorkspaceServer(
      repo,
      'share-test',
      false,
      accounts,
      undefined,
      undefined,
      { images },
    );
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/workspace`;
    const cookie = `${ACCOUNT_COOKIE}=${guest.token}`;
    const api = (path: string, data?: unknown, auth?: string) =>
      fetch(base + path, {
        method: data === undefined ? 'GET' : 'POST',
        headers: {
          'X-Renovagent-Client': 'workspace',
          ...(auth ? { Cookie: auth } : {}),
          ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      });
    try {
      const session = await api('/session', undefined, cookie);
      assert.match(session.headers.get('set-cookie')!, /Max-Age=31536000/);
      const guestSession = await accounts.sessions.findOne({ userId: guest.user._id });
      assert.ok(guestSession!.expiresAt.getTime() > Date.now() + 364 * 86400_000);
      const input = { projectId: saved.projectId, revision: 1, requestId: 'share-one' };
      assert.equal((await api('/studio-designs/share', input)).status, 403);
      const created = await api('/studio-designs/share', input, cookie);
      assert.equal(created.status, 200);
      const share = await created.json();
      assert.equal(
        (await (await api('/studio-designs/share', input, cookie)).json()).token,
        share.token,
      );
      const ownedShares = await (
        await api(
          `/studio-designs/shares/${encodeURIComponent(saved.projectId)}`,
          undefined,
          cookie,
        )
      ).json();
      assert.equal(ownedShares[0].token, share.token);
      assert.equal(
        (await api(`/studio-designs/shares/${encodeURIComponent(saved.projectId)}`)).status,
        403,
      );
      const publicResult = await api(`/shared-designs/${share.token}`);
      assert.equal(publicResult.status, 200);
      const shown = await publicResult.json();
      assert.equal(shown.snapshot.project.address, 'QA shared guest room');
      assert.equal(shown.ownerId, undefined);
      assert.equal(shown.projectId, undefined);
      assert.match(shown.snapshot.project.rooms[0].photo.src, /shared-designs/);
      const image = await fetch(new URL(shown.snapshot.project.rooms[0].photo.src, base));
      assert.equal(image.status, 200);
      assert.ok((await image.arrayBuffer()).byteLength > 100);
      assert.equal(
        (await api(`/shared-designs/${share.token}/images/${unrelated.sha256}`)).status,
        404,
      );
      assert.equal(
        (await api(`/studio-designs/${encodeURIComponent(saved.projectId)}/1`)).status,
        403,
      );
      const mcpServer = createWorkspaceMcpServer(owner, undefined, {
        images,
        plans: {
          store: new StudioPlanStore(db),
          origin: new URL(base).origin,
          agent: 'QA sharing agent',
        },
      });
      const client = new Client({ name: 'sharing-test', version: '1' });
      const [ct, st] = InMemoryTransport.createLinkedPair();
      await Promise.all([mcpServer.connect(st), client.connect(ct)]);
      try {
        const call = async (name: string, args: Record<string, unknown>) => {
          const result = await client.callTool({ name, arguments: args });
          assert.ok(!result.isError, JSON.stringify(result));
          return JSON.parse((result.content as { text: string }[])[0].text);
        };
        const sharedStudio = await call('share_project', {
          projectId: saved.projectId,
          revision: 1,
          requestId: 'agent-share-studio',
        });
        assert.match(sharedStudio.url, /#share\//);
        const plan = await call('save_plan', {
          requestId: 'agent-plan',
          title: 'QA agent plan to share',
          ceilingFt: 8,
          tier: 'mid',
          rooms: [
            {
              name: 'Living room',
              widthFt: 12,
              lengthFt: 16,
              existingFloor: 'carpet',
              floorStyle: 'light-oak',
              floorMaterial: 'lvp',
            },
          ],
        });
        assert.ok(plan.planId);
        const sharedPlan = await call('share_project', {
          planId: plan.planId,
          requestId: 'agent-share-plan',
        });
        const planToken = new URL(sharedPlan.url).hash.slice(7);
        const shownPlan = await (await api(`/shared-designs/${planToken}`)).json();
        assert.equal(shownPlan.snapshot.project.address, 'QA agent plan to share');
        assert.equal(shownPlan.snapshot.picks['room-1'].floor, 'lvp');
        assert.equal(
          (await call('share_project', { planId: plan.planId, requestId: 'agent-share-plan' })).url,
          sharedPlan.url,
        );
      } finally {
        await client.close();
        await mcpServer.close();
      }
      await saveStudioDesign(owner, images, {
        requestId: 'new-revision',
        projectId: saved.projectId,
        expectedRevision: 1,
        snapshot: { ...snapshot, project: { ...snapshot.project, address: 'Changed original' } },
      });
      assert.equal(
        (await (await api(`/shared-designs/${share.token}`)).json()).snapshot.project.address,
        'QA shared guest room',
      );
      const guestB = await accounts.guestLogin();
      const other = repo.forUser(guestB.user._id);
      await other.ensure();
      const cookieB = `${ACCOUNT_COOKIE}=${guestB.token}`;
      assert.equal((await api(`/shared-designs/${share.token}/revoke`, {}, cookieB)).status, 404);
      const copied = await api(
        `/shared-designs/${share.token}/copy`,
        { requestId: 'copy-one' },
        cookieB,
      );
      assert.equal(copied.status, 200);
      const copy = await copied.json();
      assert.notEqual(copy.projectId, saved.projectId);
      assert.notEqual(copy.snapshot.project.id, snapshot.project.id);
      assert.equal(
        (
          await (
            await api(`/shared-designs/${share.token}/copy`, { requestId: 'copy-one' }, cookieB)
          ).json()
        ).projectId,
        copy.projectId,
      );
      assert.ok(await images.get(other.ownerId, source.sha256));
      assert.equal(
        (await readStudioDesign(other, copy.projectId)).snapshot.project.address,
        'QA shared guest room',
      );
      assert.equal(
        (await readStudioDesign(owner, saved.projectId)).snapshot.project.address,
        'Changed original',
      );
      assert.equal((await api(`/shared-designs/${share.token}/revoke`, {}, cookie)).status, 200);
      assert.equal((await api(`/shared-designs/${share.token}`)).status, 404);
      assert.equal(
        (await api(`/shared-designs/${share.token}/images/${source.sha256}`)).status,
        404,
      );
      assert.equal(
        (
          await api(
            `/shared-designs/${share.token}/copy`,
            { requestId: 'copy-after-revoke' },
            cookieB,
          )
        ).status,
        404,
      );
      assert.ok(
        await readStudioDesign(other, copy.projectId),
        'saved copies survive original share revocation',
      );
    } finally {
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
      await db.dropDatabase();
      await mongo.close();
    }
  },
);
