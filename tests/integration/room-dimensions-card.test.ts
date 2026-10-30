import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IDBFactory } from 'fake-indexeddb';
import { roomDimensionCommands, roomDimensionFact, scopeDraftId } from '@renovagent/core';
import { RoomDimensionsCard } from '../../apps/web/src/features/scope/room-dimensions-card.js';
import { WorkspaceController } from '../../apps/web/src/app/workspace-controller.js';
import { IndexedDbProjectRepository } from '../../apps/web/src/adapters/indexeddb/project-repository.js';
import { Scenario, context } from '../foundation-helpers.js';

const controller = {} as WorkspaceController;
const render = (s: Scenario) =>
  renderToStaticMarkup(
    createElement(RoomDimensionsCard, {
      state: s.state,
      projectId: 'project-a',
      controller,
      busy: false,
    }),
  );

test('the controller saves a photo once, cites it from each fact, and skips unchanged values', async () => {
  const repo = await IndexedDbProjectRepository.open({
    factory: new IDBFactory(),
    name: crypto.randomUUID(),
    ownerId: context.ownerId,
  });
  const c = new WorkspaceController(repo, await repo.read());
  const id = await c.createProject({
    name: 'Bath',
    goal: 'Retile the bathroom',
    propertyName: 'Test home',
    underway: false,
  });
  const photo = new File([new Uint8Array([1, 2, 3])], 'room.jpg', { type: 'image/jpeg' });
  const room = {
    length: { amount: 8, unit: 'ft' as const },
    width: { amount: 5, unit: 'ft' as const },
    height: { amount: 8, unit: 'ft' as const },
    method: 'tape-measure' as const,
    notes: 'Wall to wall at the floor',
  };
  await c.recordRoomDimensions(id, room, photo);
  let state = await repo.read();
  const photoEvidence = Object.values(state.evidence).find((e) => e.source.attachment)!;
  assert.equal(photoEvidence.source.attachment!.name, 'room.jpg');
  assert.ok(await repo.readBlob(photoEvidence.source.attachment!.blobId));
  const dims = (['length', 'width', 'height'] as const).map(
    (d) => roomDimensionFact(state, id, d)!,
  );
  for (const f of dims) assert.ok(f.evidenceIds.includes(photoEvidence.id));

  // The form resubmits prefilled values; only the changed width is re-recorded.
  await c.recordRoomDimensions(id, { ...room, width: { amount: 6, unit: 'ft' } });
  state = await repo.read();
  assert.deepEqual(
    (['length', 'width', 'height'] as const).map((d) => roomDimensionFact(state, id, d)!.revision),
    [1, 2, 1],
  );
  await assert.rejects(
    c.recordRoomDimensions(id, { ...room, width: { amount: 6, unit: 'ft' } }),
    /already saved/,
  );
  repo.close();
});

test('the room card starts empty and open, with no invented dimensions', () => {
  const s = new Scenario();
  s.create();
  const html = render(s);
  assert.match(html, /Measure this room · 0\/3 recorded/);
  assert.match(html, /<details[^>]*open/);
  assert.doesNotMatch(html, /value="\d/);
  assert.match(html, /Phone AR measuring app/);
  assert.match(html, /nothing here is verified/);
});

test('saved dimensions show in their original units and a stale draft asks for a re-draft', () => {
  const s = new Scenario();
  s.create();
  s.apply(
    s.command('DraftScope', {
      recipeId: 'bathroom-refresh',
      packageIds: ['paint'],
      request: 'Paint it',
      reported: [],
      expectedDraftRevision: 0,
    }),
  );
  let n = 0;
  const commands = roomDimensionCommands(
    s.state,
    'project-a',
    {
      length: { amount: 12, unit: 'ft' },
      width: null,
      height: { amount: 96, unit: 'in' },
      method: 'lidar-scan',
      notes: '',
      photoEvidenceIds: [],
    },
    { commandId: (x) => `c-${x}`, evidenceId: 'e-1', factId: () => `f-${n++}` },
  );
  for (const c of commands) s.apply(c);
  assert.equal(s.state.artifacts[scopeDraftId('project-a')].at(-1)!.freshness, 'stale');
  const html = render(s);
  assert.match(html, /2\/3 recorded/);
  assert.match(html, /value="12"/);
  assert.match(html, /value="96"/);
  assert.match(html, /Ask Muse to re-draft/);
});
