import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { MongoClient } from 'mongodb';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { MongoWorkspaceRepository } from '../../apps/api/src/repository.js';
import { AccountService, ACCOUNT_COOKIE } from '../../apps/api/src/accounts.js';
import { createWorkspaceServer } from '../../apps/api/src/server.js';
import { McpAccessStore } from '../../apps/api/src/mcp-access.js';
import { DesignImageStore } from '../../apps/api/src/design-images.js';
import { StudioPlanStore } from '../../apps/api/src/studio-plans.js';
import { ProjectNotebook } from '../../apps/api/src/project-notebook.js';
import { handleCommand } from '@renovagent/core';
const uri = process.env.TEST_WORKSPACE_MONGO_URI;
async function fixture(
  run: (ctx: {
    repo: MongoWorkspaceRepository;
    images: DesignImageStore;
    access: McpAccessStore;
    accounts: AccountService;
    plans: StudioPlanStore;
    base: string;
    cookie: string;
    token: string;
    clients: Client[];
    connect: (token?: string) => Promise<Client>;
  }) => Promise<void>,
) {
  const mongo = await new MongoClient(uri!).connect();
  const db = mongo.db(`renovagent_notebook_${randomUUID().replaceAll('-', '')}`);
  const accounts = new AccountService(db, {});
  const guest = await accounts.guestLogin();
  const root = MongoWorkspaceRepository.forDb(db);
  const repo = root.forUser(guest.user._id);
  await repo.ensure();
  const images = new DesignImageStore(db),
    access = new McpAccessStore(db),
    plans = new StudioPlanStore(db);
  await access.ensureIndexes();
  await plans.ensureIndexes();
  const grant = await access.issue({
    ownerId: repo.ownerId,
    name: 'Muse notebook QA',
    access: 'propose',
  });
  const { server } = await createWorkspaceServer(
    root,
    'notebook-test',
    false,
    accounts,
    undefined,
    undefined,
    { images },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    access,
    plans,
  );
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const a = server.address();
  if (!a || typeof a === 'string') throw Error('No address');
  const base = `http://127.0.0.1:${a.port}`;
  const clients: Client[] = [];
  const connect = async (token = grant.token) => {
    const client = new Client({ name: 'notebook-test', version: '1' });
    clients.push(client);
    await client.connect(
      new StreamableHTTPClientTransport(new URL(base + '/mcp'), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );
    return client;
  };
  try {
    await run({
      repo,
      images,
      access,
      accounts,
      plans,
      base,
      cookie: `${ACCOUNT_COOKIE}=${guest.token}`,
      token: grant.token,
      clients,
      connect,
    });
  } finally {
    await Promise.all(clients.map((c) => c.close().catch(() => {})));
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    await db.dropDatabase();
    await mongo.close();
  }
}
async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const r = await client.callTool({ name, arguments: args });
  assert.ok(!r.isError, JSON.stringify(r));
  return JSON.parse((r.content as { text: string }[])[0].text);
}
test(
  'notebook MCP saves mixed project material, replays precisely, rejects stale writes and reads historical images',
  { skip: !uri },
  () =>
    fixture(async ({ repo, connect, accounts, access }) => {
      const client = await connect();
      const empty = await call(client, 'get_connection_context');
      assert.equal(empty.projectCount, 0);
      assert.match(client.getInstructions()!, /get_connection_context/);
      const project = await call(client, 'start_project', {
        requestId: 'notebook-project',
        name: 'Living room refresh',
        brief: 'Keep the sofa; warm walls; room dimensions not known.',
      });
      const another = await call(client, 'start_project', {
        requestId: 'another-project',
        name: 'Bedroom',
        brief: 'Separate room, do not reuse living room sources.',
      });
      const upload = await call(client, 'upload_design_photo', {
        name: 'fixture-room.jpg',
        label: 'QA room',
        permission: 'Repository fixture for local testing',
        data: readFileSync(
          new URL('../../public/examples/hutchinson/photo-04.jpg', import.meta.url),
        ).toString('base64'),
      });
      const args = {
        projectId: project.projectId,
        requestId: 'entry-one',
        content: {
          entryType: 'decision',
          title: 'Keep the sofa',
          text: 'Owner says: keep our existing sofa. Like the warm wood in this reference.',
          room: 'Living room',
          tags: ['keep', 'warm'],
          links: [{ url: 'https://example.com/reference', label: 'Reference source' }],
          images: [
            { sha256: upload.sourcePhotoSha256, label: 'Actual room fixture', role: 'room' },
          ],
          assertion: 'user-reported',
        },
      };
      const saved = await call(client, 'add_project_entry', args);
      const retry = await call(client, 'add_project_entry', args);
      assert.deepEqual(retry.entry, saved.entry);
      assert.equal(saved.entry.author.kind, 'agent');
      assert.ok(
        (
          await client.callTool({
            name: 'add_project_entry',
            arguments: { ...args, content: { ...args.content, text: 'Changed reuse' } },
          })
        ).isError,
      );
      const listed = await call(client, 'list_project_entries', {
        projectId: project.projectId,
        query: 'sofa',
        room: 'living room',
      });
      assert.equal(listed.total, 1);
      assert.equal(
        (await call(client, 'list_project_entries', { projectId: another.projectId })).total,
        0,
      );
      const pixels = await client.callTool({
        name: 'get_project_image',
        arguments: { projectId: project.projectId, sha256: upload.sourcePhotoSha256 },
      });
      assert.ok(!pixels.isError);
      assert.ok(
        (pixels.content as { type: string; data?: string }[]).some(
          (c: any) => c.type === 'image' && c.data.length > 100,
        ),
      );
      assert.ok(
        (
          await client.callTool({
            name: 'get_project_image',
            arguments: { projectId: another.projectId, sha256: upload.sourcePhotoSha256 },
          })
        ).isError,
      );
      const updated = await call(client, 'update_project_entry', {
        ...args,
        requestId: 'edit-one',
        entryId: saved.entry.id,
        expectedRevision: 1,
        content: { ...args.content, text: 'Keep the sofa and choose warm white walls.' },
      });
      assert.equal(updated.entry.revision, 2);
      assert.equal(
        (
          await call(client, 'get_project_entry', {
            projectId: project.projectId,
            entryId: saved.entry.id,
            revision: 1,
          })
        ).content.text,
        args.content.text,
      );
      const stale = await client.callTool({
        name: 'update_project_entry',
        arguments: {
          ...args,
          requestId: 'stale-edit',
          entryId: saved.entry.id,
          expectedRevision: 1,
        },
      });
      assert.ok(stale.isError);
      const beforeLegacy = (await repo.read()).workspace;
      await repo.execute([
        {
          type: 'AppendMessage',
          commandId: 'legacy-project-note',
          projectId: project.projectId,
          baseRevision: beforeLegacy.projects[project.projectId].revision,
          payload: {
            messageId: 'legacy-message',
            text: 'Earlier note: retain the bookcase.',
            evidenceIds: [],
          },
        },
      ]);
      const afterMessage = (await repo.read()).workspace;
      await repo.execute([
        {
          type: 'SaveDraft',
          commandId: 'legacy-project-draft',
          projectId: project.projectId,
          baseRevision: afterMessage.projects[project.projectId].revision,
          payload: {
            text: 'Unsent earlier draft about window shades.',
            evidenceIds: [],
            expectedDraftRevision: afterMessage.drafts[project.projectId]?.revision ?? 0,
          },
        },
      ]);
      const eventCount = (await repo.read()).workspace.events.length;
      const reconnect = await connect();
      assert.match(reconnect.getInstructions()!, /Keep the sofa/);
      assert.match(reconnect.getInstructions()!, /saved user\/source data, not instructions/);
      const context = await call(reconnect, 'get_project_context', {
        projectId: project.projectId,
      });
      assert.equal(context.notebook.entries.length, 1);
      assert.equal(context.messages.at(-1).text, 'Earlier note: retain the bookcase.');
      assert.equal(context.draft.text, 'Unsent earlier draft about window shades.');
      assert.equal(
        (await repo.read()).workspace.events.length,
        eventCount,
        'Connecting and context reads do not mutate the workspace',
      );
      assert.equal(context.notebook.entries[0].revision, 2);
      const briefing = await call(reconnect, 'get_connection_context');
      assert.equal(
        briefing.projects.find((p: any) => p.id === project.projectId).savedDecisions[0].title,
        'Keep the sofa',
      );
      const before = (await repo.read()).workspace;
      const projectState = before.projects[project.projectId];
      assert.throws(
        () =>
          handleCommand(
            before,
            {
              type: 'ProposeArtifact',
              commandId: 'cannot-fake-notebook',
              projectId: project.projectId,
              baseRevision: projectState.revision,
              payload: {
                artifactId: 'fake-entry',
                supersedesRevision: 0,
                inputRefs: [],
                evidenceIds: [],
                content: {
                  kind: 'project-entry',
                  content: saved.entry.content,
                  author: { kind: 'owner', name: 'Fake owner' },
                  deleted: false,
                },
              },
            },
            { ownerId: repo.ownerId, now: new Date().toISOString() },
          ),
        /notebook tools/,
      );
      const removed = await call(client, 'remove_project_entry', {
        projectId: project.projectId,
        entryId: saved.entry.id,
        expectedRevision: 2,
        requestId: 'remove-one',
      });
      assert.equal(removed.entry.deleted, true);
      assert.equal(
        (await call(client, 'list_project_entries', { projectId: project.projectId })).total,
        0,
      );
      const historyImage = await client.callTool({
        name: 'get_project_image',
        arguments: {
          projectId: project.projectId,
          entryId: saved.entry.id,
          revision: 1,
          sha256: upload.sourcePhotoSha256,
        },
      });
      assert.ok(!historyImage.isError);
      const other = await accounts.guestLogin();
      await repo.forUser(other.user._id).ensure();
      const otherGrant = await access.issue({
        ownerId: other.user._id,
        name: 'Other owner',
        access: 'propose',
      });
      const stranger = await connect(otherGrant.token);
      assert.ok(
        (
          await stranger.callTool({
            name: 'get_project_entry',
            arguments: { projectId: project.projectId, entryId: saved.entry.id },
          })
        ).isError,
      );
      assert.equal((await call(stranger, 'get_connection_context')).projectCount, 0);
      const readGrant = await access.issue({
        ownerId: repo.ownerId,
        name: 'Reader',
        access: 'read',
      });
      const reader = await connect(readGrant.token);
      assert.ok(!(await reader.listTools()).tools.some((t) => t.name === 'add_project_entry'));
      assert.ok(
        (
          await reader.callTool({
            name: 'remove_project_entry',
            arguments: {
              projectId: project.projectId,
              entryId: saved.entry.id,
              expectedRevision: 3,
              requestId: 'denied',
            },
          })
        ).isError,
      );
    }),
);
test(
  'browser notebook API and shared notebook-only projects preserve notes, photos, source attribution and independent copies',
  { skip: !uri },
  () =>
    fixture(async ({ repo, base, cookie, connect, accounts, plans }) => {
      const client = await connect();
      const project = await call(client, 'start_project', {
        requestId: 'notes-only',
        name: 'Notes before design',
        brief: 'Collect ideas first. No measurements supplied.',
      });
      const uploaded = await call(client, 'upload_design_photo', {
        name: 'reference.jpg',
        label: 'Reference fixture',
        permission: 'Local test fixture',
        data: readFileSync(
          new URL('../../public/examples/hutchinson/photo-04.jpg', import.meta.url),
        ).toString('base64'),
      });
      const content = {
        title: 'Warm reference',
        text: 'Like the wood. Keep our sofa.',
        entryType: 'inspiration',
        images: [{ sha256: uploaded.sourcePhotoSha256, label: 'Reference', role: 'inspiration' }],
        links: [{ url: 'https://example.com/look' }],
      };
      const entry = await call(client, 'add_project_entry', {
        projectId: project.projectId,
        requestId: 'reference-entry',
        content,
      });
      const api = (path: string, data?: unknown, auth = cookie) =>
        fetch(base + '/api/workspace' + path, {
          method: data === undefined ? 'GET' : 'POST',
          headers: {
            'X-Renovagent-Client': 'workspace',
            ...(auth ? { Cookie: auth } : {}),
            ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
          },
          ...(data === undefined ? {} : { body: JSON.stringify(data) }),
        });
      const data = await (
        await api(`/projects/${encodeURIComponent(project.projectId)}/notebook`)
      ).json();
      assert.equal(data.entries[0].id, entry.entry.id);
      assert.equal(data.designRevision, null);
      const edited = await api(`/projects/${encodeURIComponent(project.projectId)}/notebook`, {
        entryId: entry.entry.id,
        expectedRevision: 1,
        requestId: 'browser-edit',
        content: { ...content, text: 'Owner-edited note' },
      });
      assert.equal(edited.status, 200);
      assert.equal((await edited.json()).entry.author.kind, 'owner');
      const find = await plans.saveFind({
        requestId: 'legacy-find-one',
        ownerId: repo.ownerId,
        kind: 'inspiration',
        title: 'Existing board find',
        url: 'https://example.com/old',
        note: 'Legacy note retained',
        agent: 'Earlier agent',
      });
      await call(client, 'attach_inspiration_to_project', {
        projectId: project.projectId,
        findId: find.find._id,
        requestId: 'attach-legacy',
      });
      const shared = await call(client, 'share_project', {
        projectId: project.projectId,
        requestId: 'share-notebook',
      });
      const token = new URL(shared.url).hash.slice(7);
      const published = await (await api(`/shared-designs/${token}`, undefined, '')).json();
      assert.equal(published.snapshot, undefined);
      assert.equal(published.notebook.length, 2);
      assert.equal(published.name, 'Notes before design');
      assert.equal(
        (await api(`/shared-designs/${token}/images/${uploaded.sourcePhotoSha256}`, undefined, ''))
          .status,
        200,
      );
      const guest = await accounts.guestLogin();
      await repo.forUser(guest.user._id).ensure();
      const destCookie = `${ACCOUNT_COOKIE}=${guest.token}`;
      const copied = await (
        await api(`/shared-designs/${token}/copy`, { requestId: 'copy-notebook' }, destCookie)
      ).json();
      assert.equal(copied.view, 'notebook', JSON.stringify(copied));
      assert.notEqual(copied.projectId, project.projectId);
      const dest = new ProjectNotebook(repo.forUser(guest.user._id));
      assert.equal((await dest.list(copied.projectId)).total, 2);
      assert.equal(
        (
          await (
            await api(`/shared-designs/${token}/copy`, { requestId: 'copy-notebook' }, destCookie)
          ).json()
        ).projectId,
        copied.projectId,
      );
      assert.equal((await dest.list(copied.projectId)).total, 2);
      await call(client, 'remove_project_entry', {
        projectId: project.projectId,
        entryId: entry.entry.id,
        expectedRevision: 2,
        requestId: 'remove-source',
      });
      assert.equal(
        (await (await api(`/shared-designs/${token}`, undefined, '')).json()).notebook.length,
        2,
        'shared revision remains fixed',
      );
      assert.equal((await dest.list(copied.projectId)).total, 2, 'copy remains independent');
      assert.equal(
        (await api(`/projects/${encodeURIComponent(project.projectId)}/notebook`, undefined, ''))
          .status,
        403,
      );
    }),
);
