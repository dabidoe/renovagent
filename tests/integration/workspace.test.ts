import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { DomainError } from '@renovagent/contracts';
import { handleCommand } from '@renovagent/core';
import { IndexedDbProjectRepository } from '../../apps/web/src/adapters/indexeddb/project-repository.js';
import { WorkspaceController } from '../../apps/web/src/app/workspace-controller.js';
import { context, Scenario } from '../foundation-helpers.js';
async function setup() {
  const factory = new IDBFactory(),
    name = crypto.randomUUID();
  const repo = await IndexedDbProjectRepository.open({ factory, name, ownerId: context.ownerId });
  const c = new WorkspaceController(repo, await repo.read());
  return { factory, name, repo, c };
}
async function create(c: WorkspaceController, name = 'Kitchen') {
  return c.createProject({
    name,
    goal: `Improve the ${name.toLowerCase()}`,
    propertyName: 'Test home',
    underway: false,
  });
}
async function output(c: WorkspaceController, id: string) {
  const run = await c.requestWork(id, 'options');
  await c.transition(id, run, 'advance');
  await c.transition(id, run, 'advance');
  await c.transition(
    id,
    run,
    'answer',
    'Keep the existing services; site measurements are unknown.',
  );
  await c.transition(id, run, 'advance');
  return run;
}

test('project switching preserves per-project conversation, drafts, view, and files through reopen', async () => {
  const { factory, name, repo, c } = await setup();
  const a = await create(c);
  await c.saveDraft(a, 'Unsent kitchen question', []);
  const b = await create(c, 'Flooring');
  await c.saveDraft(b, 'Unsent flooring question', []);
  await c.setView(a, { surface: 'sources', tab: 'conversation' });
  const before = c.getSnapshot().workspace;
  assert.equal(before.drafts[a].text, 'Unsent kitchen question');
  assert.equal(before.drafts[b].text, 'Unsent flooring question');
  assert.equal(before.messages.filter((m) => m.projectId === a).length, 1);
  assert.equal(before.messages.filter((m) => m.projectId === b).length, 1);
  repo.close();
  const reopened = await IndexedDbProjectRepository.open({
    factory,
    name,
    ownerId: context.ownerId,
  });
  const restored = await reopened.read();
  assert.deepEqual(restored, before);
  assert.equal(restored.activeProjectId, a);
  assert.equal(restored.views[a].tab, 'conversation');
  reopened.close();
});
test('simulated work checkpoints persist while waiting, then store a proposal and a decision atomically', async () => {
  const { factory, name, repo, c } = await setup();
  const id = await create(c);
  const runId = await c.requestWork(id, 'options');
  await c.transition(id, runId, 'advance');
  await c.transition(id, runId, 'advance');
  assert.equal(c.getSnapshot().workspace.runs[runId].state, 'waiting_for_input');
  repo.close();
  const reopened = await IndexedDbProjectRepository.open({
    factory,
    name,
    ownerId: context.ownerId,
  });
  const restored = new WorkspaceController(reopened, await reopened.read());
  await restored.transition(id, runId, 'answer', 'Prioritize less disruption.');
  await restored.transition(id, runId, 'advance');
  let state = restored.getSnapshot().workspace;
  const ref = state.runs[runId].outputRef!;
  assert.equal(state.runs[runId].mode, 'simulated');
  assert.equal(state.runs[runId].state, 'waiting_for_approval');
  assert.equal(state.artifacts[ref.id][0].lifecycle, 'proposed');
  await restored.decide(id, ref.id, ref.revision);
  state = restored.getSnapshot().workspace;
  assert.equal(state.runs[runId].state, 'succeeded');
  assert.equal(state.artifacts[ref.id][0].lifecycle, 'accepted');
  assert.equal(Object.values(state.decisions)[0].outcome, 'accepted');
  reopened.close();
});
test('failure/retry and cancellation preserve history and never duplicate an output', async () => {
  const { repo, c } = await setup();
  const id = await create(c);
  const runId = await c.requestWork(id, 'plan');
  await c.transition(id, runId, 'advance');
  await c.transition(id, runId, 'fail');
  await c.transition(id, runId, 'retry');
  let run = c.getSnapshot().workspace.runs[runId];
  assert.equal(run.state, 'queued');
  assert.equal(run.attempt, 2);
  assert.ok(run.history.some((h) => h.state === 'failed'));
  await c.transition(id, runId, 'cancel');
  run = c.getSnapshot().workspace.runs[runId];
  assert.equal(run.state, 'cancelled');
  assert.equal(Object.keys(c.getSnapshot().workspace.artifacts).length, 0);
  await assert.rejects(c.transition(id, runId, 'advance'), /terminal/);
  repo.close();
});
test('old conversation links stay pinned to their original artifact revision after regeneration', async () => {
  const { repo, c } = await setup();
  const id = await create(c);
  const first = await output(c, id);
  let state = c.getSnapshot().workspace;
  const oldRef = state.runs[first].outputRef!;
  await c.decide(id, oldRef.id, oldRef.revision);
  const second = await output(c, id);
  state = c.getSnapshot().workspace;
  const newRef = state.runs[second].outputRef!;
  assert.equal(newRef.id, oldRef.id);
  assert.equal(newRef.revision, 2);
  assert.equal(
    state.messages.find((m) => m.runId === first && m.artifactRefs.length)!.artifactRefs[0]
      .revision,
    1,
  );
  await c.setView(id, { surface: 'artifact', artifactRef: oldRef });
  assert.equal(c.getSnapshot().workspace.views[id].artifactRef!.revision, 1);
  await assert.rejects(
    c.decide(id, oldRef.id, oldRef.revision),
    (e) => e instanceof DomainError && e.code === 'STALE',
  );
  repo.close();
});
test('changed inputs invalidate a proposal; stale decisions and late run output are rejected', async () => {
  const { repo, c } = await setup();
  const id = await create(c);
  await c.recordFact(id, { key: 'dimensions', text: '6 by 4 feet, approximate' });
  const runId = await output(c, id);
  let state = c.getSnapshot().workspace;
  const ref = state.runs[runId].outputRef!;
  const fact = Object.values(state.facts)
    .flat()
    .find((f) => f.key === 'dimensions')!;
  await c.recordFact(id, { key: fact.key, text: 'Actually 5 by 4 feet', fact });
  assert.equal(c.getSnapshot().workspace.artifacts[ref.id][0].freshness, 'stale');
  await assert.rejects(c.decide(id, ref.id, ref.revision), /stale/);
  await c.transition(id, runId, 'cancel');
  const next = await c.requestWork(id, 'technical');
  await c.transition(id, next, 'advance');
  await c.transition(id, next, 'advance');
  await c.transition(id, next, 'answer', 'Unknown vent route');
  await c.recordFact(id, { key: 'buildingUse', text: 'Two-unit building' });
  await c.transition(id, next, 'advance');
  state = c.getSnapshot().workspace;
  assert.equal(state.runs[next].state, 'failed');
  assert.equal(state.runs[next].outputRef, null);
  repo.close();
});
test('declining a proposal records the decision without pretending the artifact was accepted', async () => {
  const { repo, c } = await setup();
  const id = await create(c);
  const run = await output(c, id);
  const ref = c.getSnapshot().workspace.runs[run].outputRef!;
  await c.decide(id, ref.id, ref.revision, true);
  const state = c.getSnapshot().workspace;
  assert.equal(state.artifacts[ref.id][0].lifecycle, 'rejected');
  assert.equal(Object.values(state.decisions)[0].outcome, 'rejected');
  assert.equal(Object.values(state.decisions)[0].acceptedAt, null);
  assert.equal(state.artifacts[ref.id][0].acceptedAt, null);
  assert.equal(state.runs[run].state, 'succeeded');
  repo.close();
});
test('duplicate run transition commands do not repeat output creation; foreign run access is rejected', () => {
  const s = new Scenario();
  s.create();
  const request = s.command('RequestWork', { runId: 'run-test', kind: 'brief' });
  s.apply(request);
  const move = (action: string, answer?: string) =>
    s.command('TransitionRun', {
      runId: 'run-test',
      expectedRunRevision: s.state.runs['run-test'].revision,
      action,
      answer,
    });
  s.apply(move('advance'));
  s.apply(move('advance'));
  s.apply(move('answer', 'Unknown'));
  const publish = move('advance');
  const result = s.apply(publish);
  const before = structuredClone(s.state);
  assert.deepEqual(handleCommand(s.state, publish, context).result, result);
  assert.deepEqual(s.state, before);
  assert.equal(Object.values(s.state.artifacts)[0].length, 1);
  s.create('project-b', false);
  const foreign = s.command(
    'TransitionRun',
    { runId: 'run-test', expectedRunRevision: s.state.runs['run-test'].revision, action: 'cancel' },
    'project-b',
  );
  assert.throws(() => s.apply(foreign), /not found/);
});
test('Slice 1 snapshot migration preserves records while adding empty workflow state', async () => {
  const factory = new IDBFactory(),
    name = crypto.randomUUID();
  let repo = await IndexedDbProjectRepository.open({ factory, name, ownerId: context.ownerId });
  const s = new Scenario();
  s.create();
  repo.close();
  const { runs, messages, drafts, views, activeProjectId, ...rest } = s.state;
  const old = { ...rest, schemaVersion: 1 };
  await new Promise<void>((resolve, reject) => {
    const req = factory.open(name);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result,
        tx = db.transaction('snapshots', 'readwrite');
      tx.objectStore('snapshots').put(old, 'workspace');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    };
  });
  repo = await IndexedDbProjectRepository.open({ factory, name, ownerId: context.ownerId });
  const state = await repo.read();
  assert.equal(state.schemaVersion, 2);
  assert.deepEqual(state.projects, s.state.projects);
  assert.deepEqual(state.runs, {});
  assert.deepEqual(state.messages, []);
  repo.close();
});

test('new site facts invalidate outputs that were assembled with missing context', async () => {
  const { repo, c } = await setup();
  const id = await create(c);
  const runId = await output(c, id);
  let state = c.getSnapshot().workspace;
  const ref = state.runs[runId].outputRef!;
  await c.recordFact(id, { key: 'buildingUse', text: 'Single-family home, stories unconfirmed' });
  state = c.getSnapshot().workspace;
  assert.equal(state.artifacts[ref.id][0].freshness, 'stale');
  assert.equal(state.runs[runId].state, 'failed');
  await c.transition(id, runId, 'retry');
  assert.equal(c.getSnapshot().workspace.runs[runId].state, 'queued');
  repo.close();
});
test('reference files and draft attachments survive switching and resume into a waiting run', async () => {
  const { repo, c } = await setup();
  const id = await create(c);
  await c.saveDraft(id, 'Notes to include', []);
  const evidenceId = await c.attachFile(
    id,
    new File(['measured sketch notes'], 'site-notes.txt', { type: 'text/plain' }),
  );
  let state = c.getSnapshot().workspace;
  assert.deepEqual(state.drafts[id].evidenceIds, [evidenceId]);
  assert.equal(state.drafts[id].text, 'Notes to include');
  await create(c, 'Other project');
  await c.setView(id);
  assert.equal(c.getSnapshot().workspace.drafts[id].text, 'Notes to include');
  const run = await c.requestWork(id, 'technical');
  await c.transition(id, run, 'advance');
  await c.transition(id, run, 'advance');
  await c.transition(id, run, 'answer', 'The notes are a reference only.');
  state = c.getSnapshot().workspace;
  const answer = state.messages.find((m) => m.runId === run && m.role === 'user')!;
  assert.deepEqual(answer.evidenceIds, [evidenceId]);
  assert.equal(state.drafts[id].text, '');
  const attachment = state.evidence[evidenceId].source.attachment!;
  assert.equal(await (await repo.readBlob(attachment.blobId))!.text(), 'measured sketch notes');
  repo.close();
});
test('a stale fact editor conflicts without storing its new evidence or losing the current value', async () => {
  const { repo, c } = await setup();
  const id = await create(c);
  await c.recordFact(id, { key: 'priorities', text: 'Keep disruption low' });
  let state = c.getSnapshot().workspace;
  const old = Object.values(state.facts)
    .flat()
    .find((f) => f.key === 'priorities')!;
  await c.recordFact(id, { key: 'priorities', text: 'Schedule matters most', fact: old });
  const before = await repo.read();
  await assert.rejects(
    c.recordFact(id, { key: 'priorities', text: 'An old edit', fact: old }),
    (e) => e instanceof DomainError && e.code === 'CONFLICT',
  );
  assert.deepEqual(await repo.read(), before);
  assert.equal(c.getSnapshot().error?.includes('changed in another view'), true);
  repo.close();
});

test('the option fixture does not impose bathroom layouts on a flooring project', async () => {
  const { repo, c } = await setup();
  const id = await create(c, 'Flooring');
  const run = await output(c, id);
  const ref = c.getSnapshot().workspace.runs[run].outputRef!;
  const payload = c.getSnapshot().workspace.artifacts[ref.id][0].payload;
  assert.equal(payload.kind, 'option-comparison');
  if (payload.kind === 'option-comparison') {
    assert.ok(payload.options.every((o) => o.diagram === 'flooring'));
    assert.match(payload.options[0].title, /floor/);
    assert.doesNotMatch(JSON.stringify(payload), /toilet|vent path/);
  }
  repo.close();
});
test('retry limits bound a failed simulation and preserve every attempt', async () => {
  const { repo, c } = await setup();
  const id = await create(c);
  const run = await c.requestWork(id, 'brief');
  for (let attempt = 1; attempt <= 3; attempt++) {
    await c.transition(id, run, 'fail');
    if (attempt < 3) await c.transition(id, run, 'retry');
  }
  await assert.rejects(c.transition(id, run, 'retry'), /fewer than three/);
  const stored = c.getSnapshot().workspace.runs[run];
  assert.equal(stored.attempt, 3);
  assert.equal(stored.history.filter((h) => h.state === 'failed').length, 3);
  repo.close();
});
