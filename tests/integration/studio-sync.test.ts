import test from 'node:test';
import assert from 'node:assert/strict';
import { studioDesignSchema, type StudioDesignSaveRequest } from '@renovagent/contracts';
import { uploadedOwnStudio } from '../../apps/web/src/features/house-example/own-analysis.js';
import {
  StudioSync,
  pendingStudioSave,
  restorePendingStudioDesign,
} from '../../apps/web/src/features/house-example/studio-sync.js';

const snapshot = (address: string) =>
  studioDesignSchema.parse({
    kind: 'studio-design',
    basis: 'owner-studio',
    project: {
      ...uploadedOwnStudio({
        photos: ['a'.repeat(64)],
        plans: [],
        where: address,
        ceilingFt: null,
        idea: '',
      }).project,
      id: 'fixture-studio',
    },
    picks: {},
    tier: 'mid',
    inspired: {},
    styling: {},
    renderSignatures: {},
  });

test('a lost first-save response replays its exact command before syncing newer edits', async () => {
  let pending: StudioDesignSaveRequest | null = null;
  const sent: StudioDesignSaveRequest[] = [];
  const committed = new Map<string, { projectId: string; revision: number }>();
  let drop = true;
  const options = {
    meta: null,
    acknowledged: '',
    pending: null as unknown,
    requestId: () => crypto.randomUUID(),
    persist: (p: StudioDesignSaveRequest | null) => {
      pending = p;
    },
    onSaved: () => {},
    send: async (request: StudioDesignSaveRequest) => {
      sent.push(structuredClone(request));
      const result = committed.get(request.requestId) ?? {
        projectId: 'one-project',
        revision: committed.size + 1,
      };
      committed.set(request.requestId, result);
      if (drop) {
        drop = false;
        throw Error('reply lost');
      }
      return result;
    },
  };
  await assert.rejects(new StudioSync(options).sync(snapshot('first')), /reply lost/);
  assert.ok(pending);
  const recovered = new StudioSync({ ...options, pending });
  const result = await recovered.sync(snapshot('edited while offline'));
  assert.deepEqual(sent[1], sent[0]);
  assert.equal(sent[2].projectId, 'one-project');
  assert.equal(sent[2].expectedRevision, 1);
  assert.equal(sent[2].snapshot.project.address, 'edited while offline');
  assert.equal(result.revision, 2);
  assert.equal(pending, null);
});

test('simultaneous sync requests serialize revision changes', async () => {
  const sent: StudioDesignSaveRequest[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const writer = new StudioSync({
    meta: null,
    acknowledged: '',
    pending: null,
    requestId: () => crypto.randomUUID(),
    persist: () => {},
    onSaved: () => {},
    send: async (request) => {
      sent.push(request);
      if (sent.length === 1) await gate;
      return { projectId: 'one-project', revision: sent.length };
    },
  });
  const first = writer.sync(snapshot('one'));
  const second = writer.sync(snapshot('two'));
  assert.equal(sent.length, 1);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(
    sent.map((r) => r.expectedRevision),
    [0, 1],
  );
  assert.equal(sent[1].snapshot.project.address, 'two');
});

test('a revision conflict retains the pending command and never retries at a guessed revision', async () => {
  let pending: StudioDesignSaveRequest | null = null;
  let calls = 0;
  const writer = new StudioSync({
    meta: { projectId: 'one-project', revision: 2 },
    acknowledged: '',
    pending: null,
    requestId: () => crypto.randomUUID(),
    persist: (p) => {
      pending = p;
    },
    onSaved: () => {},
    send: async () => {
      calls++;
      throw Error('conflict');
    },
  });
  await assert.rejects(writer.sync(snapshot('edited')), /conflict/);
  assert.equal(calls, 1);
  assert.equal(pending!.expectedRevision, 2);
});

test('reopening a saved revision restores only a pending draft from that exact project and revision', () => {
  const saved = { projectId: 'project-a', revision: 2, snapshot: snapshot('server') };
  const pending = pendingStudioSave({
    requestId: 'pending-save',
    projectId: 'project-a',
    expectedRevision: 2,
    snapshot: snapshot('local edit'),
  })!;
  assert.equal(restorePendingStudioDesign(saved, pending).snapshot.project.address, 'local edit');
  assert.equal(
    restorePendingStudioDesign({ ...saved, revision: 1 }, pending).snapshot.project.address,
    'server',
  );
  assert.equal(
    restorePendingStudioDesign({ ...saved, projectId: 'other-project' }, pending).snapshot.project
      .address,
    'server',
  );
  assert.equal(pendingStudioSave({ broken: true }), null);
});

test('save metadata excludes the full HTTP response before a strict follow-up request', async () => {
  const fullResponse = {
    projectId: 'saved-room',
    revision: 1,
    artifactRef: { kind: 'artifact', id: 'saved-room:studio-design', revision: 1 },
    snapshot: snapshot('room'),
  };
  let notified: unknown;
  const writer = new StudioSync({
    meta: null,
    acknowledged: '',
    pending: null,
    requestId: () => 'save-metadata',
    persist: () => {},
    send: async () => fullResponse,
    onSaved: (meta) => {
      notified = meta;
    },
  });
  const meta = await writer.sync(fullResponse.snapshot);
  assert.deepEqual(meta, { projectId: 'saved-room', revision: 1 });
  assert.deepEqual(notified, meta);
  assert.deepEqual(await writer.sync(fullResponse.snapshot), meta);
});
