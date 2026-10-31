import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { propertyAddress, roomDimensionFact } from '@renovagent/core';
import { WorkspaceController } from '../../apps/web/src/app/workspace-controller.js';
import { IndexedDbProjectRepository } from '../../apps/web/src/adapters/indexeddb/project-repository.js';
const input = {
  name: 'Bathroom project',
  goal: 'Replace the vanity and tile.',
  propertyName: 'My home',
  underway: false,
};
async function setup() {
  const factory = new IDBFactory(),
    name = crypto.randomUUID(),
    ownerId = 'intake-owner';
  const repo = await IndexedDbProjectRepository.open({ factory, name, ownerId });
  return { factory, name, ownerId, repo, c: new WorkspaceController(repo, await repo.read()) };
}
test('intake preserves original photos, brief, room, budget and location through reopen', async () => {
  const { factory, name, ownerId, repo, c } = await setup();
  const file = new File([new Uint8Array([1, 2, 3, 4])], 'my-room.png', { type: 'image/png' });
  const id = await c.createProject({
    ...input,
    address: 'Philadelphia, PA, 19125',
    room: 'Bathroom',
    approach: 'contractor',
    budgetMinor: 500000,
    photos: [file],
  });
  repo.close();
  const reopened = await IndexedDbProjectRepository.open({ factory, name, ownerId });
  const state = await reopened.read();
  assert.equal(state.projects[id].name, input.name);
  assert.equal(state.spaces[state.projects[id].spaceIds[0]].name, 'Bathroom');
  assert.equal(propertyAddress(state, id)?.value.kind, 'text');
  assert.deepEqual(propertyAddress(state, id)?.value, {
    kind: 'text',
    text: 'Philadelphia, PA, 19125',
  });
  const photo = Object.values(state.evidence).find((e) => e.source.attachment)!;
  assert.equal(photo.projectId, id);
  assert.equal(photo.source.attachment?.role, 'original');
  assert.equal(photo.source.attachment?.name, 'my-room.png');
  assert.deepEqual(
    new Uint8Array(await (await reopened.readBlob(photo.source.attachment!.blobId))!.arrayBuffer()),
    new Uint8Array([1, 2, 3, 4]),
  );
  const message = state.messages.find((m) => m.projectId === id)!;
  assert.ok(message.evidenceIds.includes(photo.id));
  assert.match(message.text, /Room: Bathroom/);
  assert.match(message.text, /contractor/);
  const budget = Object.values(state.facts)
    .map((v) => v.at(-1)!)
    .find((f) => f.key === 'targetBudget')!;
  assert.deepEqual(budget.value, { kind: 'money', minorUnits: 500000, currency: 'USD' });
  assert.equal(budget.assertion, 'user_reported');
  assert.deepEqual(budget.evidenceIds, [message.id]);
  assert.equal(roomDimensionFact(state, id, 'length'), undefined);
  assert.deepEqual(
    Object.values(state.artifacts).map((versions) => versions.at(-1)!.payload.kind),
    ['project-brief'],
  );
  reopened.close();
});
test('invalid photos are rejected before creating any project', async () => {
  const { repo, c } = await setup();
  await assert.rejects(
    c.createProject({ ...input, photos: [new File(['x'], 'photo.heic', { type: 'image/heic' })] }),
    /JPG, PNG/,
  );
  await assert.rejects(
    c.createProject({
      ...input,
      photos: Array.from(
        { length: 6 },
        (_, i) => new File(['x'], `${i}.png`, { type: 'image/png' }),
      ),
    }),
    /up to 5/,
  );
  const state = await repo.read();
  assert.equal(Object.keys(state.projects).length, 0);
  assert.equal(Object.keys(state.evidence).length, 0);
  repo.close();
});
test('a failed intake batch leaves no partial project, address, message or attachment', async () => {
  const { repo, c } = await setup();
  await assert.rejects(
    c.createProject({
      ...input,
      address: 'User supplied city',
      budgetMinor: -100,
      photos: [new File(['x'], 'room.jpg', { type: 'image/jpeg' })],
    }),
  );
  const state = await repo.read();
  assert.equal(Object.keys(state.projects).length, 0);
  assert.equal(Object.keys(state.properties).length, 0);
  assert.equal(Object.keys(state.evidence).length, 0);
  assert.equal(Object.keys(state.facts).length, 0);
  assert.equal(state.messages.length, 0);
  repo.close();
});
test('another project on an existing home preserves its address and prior photos', async () => {
  const { repo, c } = await setup();
  const first = await c.createProject({
    ...input,
    address: 'Existing home location',
    photos: [new File(['original'], 'room.jpg', { type: 'image/jpeg' })],
  });
  const before = await repo.read();
  const propertyId = before.projects[first].propertyId;
  const next = await c.createProject({ ...input, name: 'Kitchen', propertyId, room: 'Kitchen' });
  const state = await repo.read();
  assert.equal(Object.keys(state.properties).length, 1);
  assert.equal(Object.keys(state.projects).length, 2);
  assert.equal(state.properties[propertyId].revision, before.properties[propertyId].revision + 1);
  assert.deepEqual(propertyAddress(state, next)?.value, {
    kind: 'text',
    text: 'Existing home location',
  });
  assert.equal(propertyAddress(state, next)?.revision, 1);
  assert.deepEqual(
    state.messages.filter((m) => m.projectId === first),
    before.messages.filter((m) => m.projectId === first),
  );
  assert.equal(
    Object.values(state.evidence).filter((e) => e.projectId === first && e.source.attachment)
      .length,
    1,
  );
  repo.close();
});
