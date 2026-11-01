import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { WorkspaceController } from '../../apps/web/src/app/workspace-controller.js';
import { IndexedDbProjectRepository } from '../../apps/web/src/adapters/indexeddb/project-repository.js';
import { hutchinsonCorpus as corpus } from '../../apps/web/src/features/house-example/hutchinson-corpus.js';
import {
  houseAreas,
  houseBrief,
  HOUSE_CHOICES_NAME,
  HOUSE_PACKET_NAME,
  isHouseCase,
  parseHouseChoices,
  saveHouseCase,
  scopeForArea,
} from '../../apps/web/src/features/house-example/house-example-model.js';

const source = (name: string) => readFileSync(`public/examples/hutchinson/${name}`);
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const json = (name: string) => JSON.parse(source(name).toString());

test('the source pack retains the actual inspected pixels, model provenance and uncertain views', () => {
  assert.equal(corpus.photos.length, 22);
  assert.equal(corpus.inventory.items.length, 27);
  for (const photo of corpus.photos)
    assert.equal(hash(source(`${photo.id}.jpg`)), photo.sha256, photo.id);
  const ids = new Set(corpus.photos.map((p) => p.id));
  for (const area of houseAreas)
    for (const id of [...area.photoIds, area.planId]) assert.ok(ids.has(id));
  assert.equal(corpus.photos.filter((p) => p.roomType === 'uncertain').length, 2);
  assert.ok(
    !houseAreas
      .find((a) => a.id === 'bedrooms')!
      .photoIds.some((id) => ['photo-08', 'photo-10'].includes(id)),
  );
});

test('SAM, Blender and Muse receipts describe the exact captured input/output chain', () => {
  const sam = json('sam-floor.json');
  assert.equal(sam.model, 'sam-3.1');
  assert.ok(sam.runId && sam.segments.length > 0);
  assert.equal(sam.sourceSha256, hash(source(`${sam.photoId}.jpg`)));
  assert.ok(sam.segments.every((s: { path: string }) => s.path.length > 0));
  const blender = json('blender-reference.json');
  assert.equal(blender.sourceSha256, hash(source(`${blender.sourcePhoto}.jpg`)));
  assert.ok(blender.displayOnly.includes('wall height and thickness'));
  assert.equal(source('hutchinson-concept.glb').subarray(0, 4).toString(), 'glTF');
  const muse = json('muse-concept.json');
  assert.equal(muse.model, 'muse-image-1.0');
  assert.equal(muse.inputSha256, hash(source(muse.input)));
  assert.equal(muse.outputSha256, hash(source('muse-concept.png')));
  assert.equal((corpus.visualReceipts?.sam as { runId: string }).runId, sam.runId);
});

test('concept scope works without dimensions and defers new work without erasing existing source conditions', () => {
  const brief = houseBrief(corpus, { excluded: ['exterior'], halfBath: false });
  assert.ok(!brief.includes('## Exterior & roof'));
  assert.ok(brief.includes('## Basement & laundry'));
  assert.ok(!brief.includes('## New half-bath investigation'));
  assert.ok(brief.includes('Concept planning does not require room dimensions'));
  assert.ok(!brief.includes('For the bath study:'));
  assert.doesNotMatch(brief, /\$\d/);
  const basement = scopeForArea(houseAreas.find((a) => a.id === 'basement')!, {
    excluded: [],
    halfBath: false,
  });
  assert.ok(basement.work.some((work) => work.includes('existing half-bath')));
  assert.deepEqual(parseHouseChoices({ excluded: ['exterior', 'exterior'], halfBath: true }), {
    excluded: ['exterior'],
    halfBath: true,
  });
  assert.throws(() => parseHouseChoices({ excluded: ['invented-room'], halfBath: true }));
});

test('saving preserves source history, reuses the property, and reopens without inventing geometry or rebinding old Muse planning', async () => {
  const factory = new IDBFactory();
  const name = crypto.randomUUID();
  const repo = await IndexedDbProjectRepository.open({ factory, name, ownerId: 'house-owner' });
  const controller = new WorkspaceController(repo, await repo.read());
  const original = await controller.createProject({
    name: 'Original owner project',
    goal: 'Review my home',
    propertyName: corpus.address,
    address: corpus.address,
    underway: false,
  });
  const choices = { excluded: ['exterior' as const], halfBath: true };
  const id = await saveHouseCase(controller, corpus, choices);
  let state = await repo.read();
  assert.equal(Object.keys(state.projects).length, 2);
  assert.equal(Object.keys(state.properties).length, 1);
  assert.equal(state.projects[id].propertyId, state.projects[original].propertyId);
  assert.ok(isHouseCase(state, id));
  assert.ok(
    !Object.values(state.facts)
      .flat()
      .some((f) =>
        ['finishedLength', 'finishedWidth', 'ceilingHeight', 'floorArea'].includes(f.key),
      ),
  );
  assert.ok(
    !Object.values(state.artifacts)
      .flat()
      .some((a) =>
        ['property-research', 'photo-inventory', 'scope-draft'].includes(a.payload.kind),
      ),
    'historical Muse results were attached, not rebound as fresh planning or geometry',
  );
  const oldPacket = Object.values(state.evidence).find(
    (e) => e.projectId === id && e.source.attachment?.name === HOUSE_PACKET_NAME,
  )!;
  const oldText = await (await repo.readBlob(oldPacket.source.attachment!.blobId))!.text();
  await controller.attachFile(
    id,
    new File(['%PDF-1.7 source plan'], 'owner-floor-plan.pdf', { type: 'application/pdf' }),
  );
  await saveHouseCase(controller, corpus, { excluded: [], halfBath: false }, id);
  state = await repo.read();
  assert.equal(Object.keys(state.projects).length, 2);
  assert.equal(await (await repo.readBlob(oldPacket.source.attachment!.blobId))!.text(), oldText);
  repo.close();
  const reopened = await IndexedDbProjectRepository.open({ factory, name, ownerId: 'house-owner' });
  const restored = await reopened.read();
  const direction = Object.values(restored.evidence)
    .filter((e) => e.projectId === id && e.source.attachment?.name === HOUSE_CHOICES_NAME)
    .at(-1)!;
  assert.deepEqual(
    parseHouseChoices(
      JSON.parse(await (await reopened.readBlob(direction.source.attachment!.blobId))!.text()),
    ),
    { excluded: [], halfBath: false },
  );
  const archived = Object.values(restored.evidence).find(
    (e) =>
      e.projectId === id && e.source.attachment?.name === 'hutchinson-source-receipts.json.txt',
  )!;
  const receipt = JSON.parse(
    await (await reopened.readBlob(archived.source.attachment!.blobId))!.text(),
  );
  assert.equal(receipt.originalGoal, corpus.originalGoal);
  assert.equal(receipt.originalPlanning.runId, corpus.originalPlanning!.runId);
  assert.equal(receipt.visualReceipts.sam.runId, json('sam-floor.json').runId);
  reopened.close();
});

test('invalid scope choices fail before creating or changing a project', async () => {
  const repo = await IndexedDbProjectRepository.open({
    factory: new IDBFactory(),
    name: crypto.randomUUID(),
    ownerId: 'house-owner',
  });
  const controller = new WorkspaceController(repo, await repo.read());
  await assert.rejects(
    saveHouseCase(controller, corpus, { excluded: ['invented' as never], halfBath: true }),
    /Invalid concept direction/,
  );
  assert.equal(Object.keys((await repo.read()).projects).length, 0);
  repo.close();
});
