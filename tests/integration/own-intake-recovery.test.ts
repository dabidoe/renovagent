import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import {
  loadOwnIntake,
  saveOwnIntake,
} from '../../apps/web/src/features/house-example/own-intake-draft.js';
import {
  newOwnStudioHash,
  ownStudioDraftId,
} from '../../apps/web/src/features/house-example/own-studio-route.js';
import { publicRoute } from '../../apps/web/src/app/public-routes.js';

test('failed-build intake restores actual photo/plan bytes and the latest brief; clear is ordered after pending saves', async () => {
  globalThis.indexedDB = indexedDB;
  const draft = {
    idea: 'Keep my sofa. Sage walls.',
    where: 'My room',
    ceiling: '8 ft',
    photos: [
      new File([new Uint8Array([1, 2, 3, 255])], 'room.jpg', {
        type: 'image/jpeg',
        lastModified: 42,
      }),
    ],
    plans: [new File(['plan bytes'], 'plan.png', { type: 'image/png', lastModified: 43 })],
  };
  await saveOwnIntake(draft);
  // Reopening uses only durable storage, not a retained File input.
  const restored = (await loadOwnIntake())!;
  assert.equal(restored.idea, draft.idea);
  assert.equal(restored.where, draft.where);
  assert.equal(restored.ceiling, draft.ceiling);
  assert.equal(restored.photos[0]!.name, 'room.jpg');
  assert.equal(restored.photos[0]!.type, 'image/jpeg');
  assert.equal(restored.photos[0]!.lastModified, 42);
  assert.deepEqual(
    new Uint8Array(await restored.photos[0]!.arrayBuffer()),
    new Uint8Array([1, 2, 3, 255]),
  );
  assert.equal(await restored.plans[0]!.text(), 'plan bytes');
  await Promise.all([
    saveOwnIntake({ ...draft, idea: 'First change' }),
    saveOwnIntake({ ...draft, idea: 'Latest change' }),
  ]);
  assert.equal((await loadOwnIntake())!.idea, 'Latest change');
  await Promise.all([saveOwnIntake(draft), saveOwnIntake(null)]);
  assert.equal(
    await loadOwnIntake(),
    null,
    'a completed build cannot be resurrected by an earlier draft save',
  );
});

test('new projects isolate intake files and briefs by route ID, preserving other drafts and legacy recovery', async () => {
  globalThis.indexedDB = indexedDB;
  const firstHash = newOwnStudioHash();
  const secondHash = newOwnStudioHash();
  assert.notEqual(firstHash, secondHash);
  assert.equal(publicRoute(firstHash), 'studio');
  assert.equal(publicRoute('#resume-project'), 'studio');
  const firstId = ownStudioDraftId(firstHash)!;
  const secondId = ownStudioDraftId(secondHash)!;
  const draft = {
    idea: 'First project only',
    where: 'First room',
    ceiling: '',
    photos: [new File(['first photo'], 'first.jpg', { type: 'image/jpeg' })],
    plans: [],
  };
  await saveOwnIntake({ ...draft, idea: 'Legacy recovery' });
  await saveOwnIntake(draft, firstId);
  assert.equal(await loadOwnIntake(secondId), null);
  await saveOwnIntake({ ...draft, idea: 'Second project only', photos: [] }, secondId);
  assert.equal((await loadOwnIntake(firstId))?.idea, 'First project only');
  assert.equal(await (await loadOwnIntake(firstId))?.photos[0].text(), 'first photo');
  assert.equal((await loadOwnIntake(secondId))?.idea, 'Second project only');
  await saveOwnIntake(null, secondId);
  assert.equal((await loadOwnIntake(firstId))?.where, 'First room');
  assert.equal((await loadOwnIntake())?.idea, 'Legacy recovery');
});
