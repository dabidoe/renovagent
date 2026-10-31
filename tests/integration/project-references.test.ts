import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IDBFactory } from 'fake-indexeddb';
import { projectReferenceSchema } from '@renovagent/contracts';
import { WorkspaceController } from '../../apps/web/src/app/workspace-controller.js';
import { IndexedDbProjectRepository } from '../../apps/web/src/adapters/indexeddb/project-repository.js';
import { RoomWelcome } from '../../apps/web/src/features/room3d/room-welcome.js';
import { ReferenceBoard } from '../../apps/web/src/features/references/reference-board.js';
import { requestPhotoJob } from '../../apps/api/src/photo-jobs.js';
import type { MongoWorkspaceRepository } from '../../apps/api/src/repository.js';
async function setup() {
  const options = {
    factory: new IDBFactory(),
    name: crypto.randomUUID(),
    ownerId: 'reference-owner',
  };
  const repo = await IndexedDbProjectRepository.open(options);
  const controller = new WorkspaceController(repo, await repo.read());
  return { options, repo, controller };
}
const input = {
  name: 'Kitchen',
  goal: 'Use this look in my kitchen.',
  propertyName: 'My home',
  underway: false,
};
test('inspiration originals and product links/prices survive reopen without becoming site observations or offers', async () => {
  const { options, repo, controller } = await setup();
  const id = await controller.createProject({
    ...input,
    photos: [new File(['inspo'], 'reference.jpg', { type: 'image/jpeg' })],
    photoKind: 'inspiration',
    references: [
      {
        reference: {
          kind: 'product',
          url: 'https://example.com/vanity?sku=oak',
          title: 'Oak vanity',
          note: 'The finish and clean lines',
          price: { minorUnits: 33900, currency: 'USD' },
        },
      },
    ],
  });
  repo.close();
  const reopened = await IndexedDbProjectRepository.open(options);
  const state = await reopened.read();
  const evidence = Object.values(state.evidence).filter(
    (e) => e.projectId === id && e.source.reference,
  );
  assert.equal(evidence.length, 2);
  const inspo = evidence.find((e) => e.source.reference?.kind === 'inspiration')!;
  assert.equal(await (await reopened.readBlob(inspo.source.attachment!.blobId))!.text(), 'inspo');
  const product = evidence.find((e) => e.source.reference?.kind === 'product')!;
  assert.deepEqual(product.source.reference, {
    kind: 'product',
    url: 'https://example.com/vanity?sku=oak',
    title: 'Oak vanity',
    note: 'The finish and clean lines',
    price: { minorUnits: 33900, currency: 'USD' },
  });
  assert.match(product.source.description, /User-saved price/);
  assert.ok(state.messages.find((m) => m.projectId === id)!.evidenceIds.includes(product.id));
  assert.equal(
    Object.values(state.facts)
      .flat()
      .some((f) => f.value.kind === 'money'),
    false,
  );
  const c = new WorkspaceController(reopened, state);
  const room = renderToStaticMarkup(
    createElement(RoomWelcome, { state, projectId: id, controller: c, heading: 'Kitchen' }),
  );
  assert.match(room, /Your room starts here/);
  assert.doesNotMatch(room, /reference.jpg/);
  const board = renderToStaticMarkup(
    createElement(ReferenceBoard, { state, projectId: id, controller: c, onAdd: () => {} }),
  );
  assert.match(board, /Oak vanity/);
  assert.match(board, /Saved.*339/);
  assert.match(board, /https:\/\/example.com\/vanity\?sku=oak/);
  reopened.close();
});
test('saving references preserves unsent conversation and an existing room photo', async () => {
  const { repo, controller } = await setup();
  const id = await controller.createProject({
    ...input,
    photos: [new File(['site'], 'room.jpg', { type: 'image/jpeg' })],
  });
  await controller.saveDraft(id, 'My unsent question', []);
  const before = await repo.read();
  await controller.saveReferences(id, [
    {
      reference: {
        kind: 'inspiration',
        url: 'https://pinterest.com/pin/123',
        note: 'The floor color',
      },
    },
  ]);
  const after = await repo.read();
  assert.deepEqual(after.drafts[id], before.drafts[id]);
  assert.deepEqual(after.messages, before.messages);
  assert.deepEqual(
    Object.values(after.evidence).find((e) => e.source.attachment),
    Object.values(before.evidence).find((e) => e.source.attachment),
  );
  assert.equal(Object.keys(after.evidence).length, Object.keys(before.evidence).length + 1);
  repo.close();
});
test('invalid or incomplete references reject the entire intake or reference batch', async () => {
  const { repo, controller } = await setup();
  await assert.rejects(
    controller.createProject({
      ...input,
      references: [{ reference: { kind: 'inspiration', url: 'javascript:alert(1)' } }],
    }),
  );
  assert.equal(Object.keys((await repo.read()).projects).length, 0);
  const id = await controller.createProject(input);
  const before = await repo.read();
  await assert.rejects(
    controller.saveReferences(id, [
      { reference: { kind: 'inspiration', url: 'https://example.com/look' } },
      { reference: { kind: 'product', title: 'Missing source' } },
    ]),
  );
  assert.deepEqual(await repo.read(), before);
  for (const url of ['data:text/html,hi', 'file:///etc/hosts', 'https://user:secret@example.com'])
    assert.equal(projectReferenceSchema.safeParse({ kind: 'product', url }).success, false);
  assert.equal(
    projectReferenceSchema.safeParse({
      kind: 'inspiration',
      price: { minorUnits: 1, currency: 'USD' },
    }).success,
    false,
  );
  repo.close();
});
test('the existing property-photo analysis rejects inspiration images', async () => {
  const { repo, controller } = await setup();
  const id = await controller.createProject({
    ...input,
    address: 'Philadelphia, PA',
    photos: [new File(['inspo'], 'inspiration.jpg', { type: 'image/jpeg' })],
    photoKind: 'inspiration',
  });
  const state = await repo.read();
  const evidenceId = Object.values(state.evidence).find((e) => e.source.attachment)!.id;
  const fake = {
    update: async (fn: (doc: unknown) => unknown) => fn({ workspace: state, jobs: [] }),
  } as unknown as MongoWorkspaceRepository;
  await assert.rejects(
    requestPhotoJob(fake, {
      requestId: crypto.randomUUID(),
      projectId: id,
      photoIds: [],
      evidenceIds: [evidenceId],
    }),
    /Choose a project JPEG/,
  );
  repo.close();
});
