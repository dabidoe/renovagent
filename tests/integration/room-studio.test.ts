import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDbProjectRepository } from '../../apps/web/src/adapters/indexeddb/project-repository.js';
import { WorkspaceController } from '../../apps/web/src/app/workspace-controller.js';
import { loadRoomSource } from '../../apps/web/src/features/room3d/room-source.js';
import { RoomStudio } from '../../apps/web/src/features/room3d/room-studio.js';
import { context } from '../foundation-helpers.js';

const wall = (id: string, x1: number, y1: number, x2: number, y2: number) => ({
  id,
  start: { x: x1, y: y1 },
  end: { x: x2, y: y2 },
  thickness: 12,
  height: 250,
});
const planText = JSON.stringify({
  id: 'p',
  name: 'Plan',
  floors: [
    {
      id: 'f',
      level: 0,
      walls: [
        wall('a', 0, 0, 300, 0),
        wall('b', 300, 0, 300, 200),
        wall('c', 300, 200, 0, 200),
        wall('d', 0, 200, 0, 0),
      ],
      rooms: [],
      doors: [],
      windows: [],
    },
  ],
});

async function setup() {
  const repo = await IndexedDbProjectRepository.open({
    factory: new IDBFactory(),
    name: crypto.randomUUID(),
    ownerId: context.ownerId,
  });
  const c = new WorkspaceController(repo, await repo.read());
  const id = await c.createProject({
    name: 'Bath',
    goal: 'Refresh',
    propertyName: 'Test home',
    underway: false,
  });
  return { repo, c, id };
}
const read = (repo: IndexedDbProjectRepository) => (blobId: string) => repo.readBlob(blobId);

test('the studio builds from the plan file cited by the current facts', async () => {
  const { repo, c, id } = await setup();
  assert.equal(await loadRoomSource(await repo.read(), id, read(repo)), null);
  await c.recordRoomDimensions(
    id,
    {
      length: null,
      width: null,
      height: { amount: 2.5, unit: 'm' },
      area: { amount: 6, unit: 'm2' },
      perimeter: { amount: 10, unit: 'm' },
      method: 'floor-plan-file',
      notes: '',
    },
    new File([planText], 'bath.json', { type: 'application/json' }),
  );
  const source = (await loadRoomSource(await repo.read(), id, read(repo)))!;
  assert.equal(source.model.format, 'openplan3d-project');
  assert.equal(source.model.walls.length, 4);
  assert.equal(source.label, 'From bath.json');
  assert.ok(source.evidenceId);
  assert.deepEqual(source.warnings, []);

  // A later tape measurement that did not come from the plan flags it.
  await new Promise((r) => setTimeout(r, 5));
  await c.recordRoomDimensions(id, {
    length: { amount: 10, unit: 'ft' },
    width: null,
    height: null,
    method: 'tape-measure',
    notes: '',
  });
  const flagged = (await loadRoomSource(await repo.read(), id, read(repo)))!;
  assert.match(flagged.warnings.join(' '), /updated after this plan/);
  repo.close();
});

test('without a plan, the studio shows a labelled box from length × width', async () => {
  const { repo, c, id } = await setup();
  await c.recordRoomDimensions(id, {
    length: { amount: 12, unit: 'ft' },
    width: { amount: 10, unit: 'ft' },
    height: null,
    method: 'tape-measure',
    notes: '',
  });
  const source = (await loadRoomSource(await repo.read(), id, read(repo)))!;
  assert.equal(source.model.format, 'measured-box');
  assert.equal(source.label, 'Box from your measured length × width');
  assert.deepEqual(
    source.model.walls.map((w) => w.lengthM),
    [3.658, 3.048, 3.658, 3.048],
  );
  assert.ok(source.model.walls.every((w) => w.heightM === null));
  // Before loading, the studio renders its empty state without touching WebGL.
  const html = renderToStaticMarkup(
    createElement(RoomStudio, { state: await repo.read(), projectId: id, controller: c }),
  );
  assert.match(html, /Room studio/);
  repo.close();
});
