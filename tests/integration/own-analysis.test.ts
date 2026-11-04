import test from 'node:test';
import assert from 'node:assert/strict';
import {
  uploadedOwnStudio,
  analyzeUploadedRooms,
  applyOwnAnalysis,
} from '../../apps/web/src/features/house-example/own-analysis.js';

const sha = 'a'.repeat(64);
const pending = () =>
  uploadedOwnStudio({
    photos: [sha],
    plans: [],
    where: 'My room',
    ceilingFt: null,
    idea: 'Keep the windows, add a sofa',
  });

test('completed uploads open a photo studio before analysis with no invented dimensions', () => {
  const draft = pending();
  assert.equal(draft.project.rooms[0].photo.src, `/api/workspace/design-images/${sha}`);
  assert.equal(draft.project.rooms[0].size, undefined);
  assert.equal(draft.project.ceilingFt, null);
  assert.equal(draft.project.idea, 'Keep the windows, add a sofa');
  assert.deepEqual(draft.analysis, { photos: [sha], plans: [] });
  assert.deepEqual(JSON.parse(JSON.stringify(draft)), draft);
});

test('an analysis retry reuses uploaded hashes and a failed read never requests masks or uploads', async () => {
  const draft = pending();
  const calls: string[] = [];
  const request = async (path: string, body: unknown) => {
    calls.push(path);
    assert.deepEqual(body, { photos: [sha], plans: [] });
    throw Error('provider unavailable');
  };
  await assert.rejects(analyzeUploadedRooms(draft.analysis!, request), /provider unavailable/);
  await assert.rejects(analyzeUploadedRooms(draft.analysis!, request), /provider unavailable/);
  assert.deepEqual(calls, ['/studio/read', '/studio/read']);
  assert.equal(draft.project.rooms.length, 1);
  assert.equal(draft.project.idea, 'Keep the windows, add a sofa');
});

test('late analysis fills unknowns and tolerates failed masks without replacing owner measurements', async () => {
  const read = await analyzeUploadedRooms(pending().analysis!, async (path) => {
    if (path === '/studio/walls') throw Error('mask unavailable');
    return {
      photos: [
        {
          sha256: sha,
          kind: 'living room',
          title: 'Living room',
          floor: 'carpet',
          approxSize: { xFt: 14, yFt: 20 },
        },
      ],
      plans: [],
      ceiling: { ft: 8, note: 'Estimated from the photo' },
    };
  });
  const updated = applyOwnAnalysis(pending(), read);
  assert.equal(updated.analysis, undefined);
  assert.equal(updated.project.rooms[0].title, 'Living room');
  assert.deepEqual(updated.project.rooms[0].size, { xFt: 14, yFt: 20 });
  assert.match(updated.project.rooms[0].sizeNote!, /estimated/);
  assert.equal(updated.project.rooms[0].photo.walls, null);
  const edited = pending();
  edited.project.rooms[0].title = 'My den';
  edited.project.rooms[0].size = { xFt: 12, yFt: 18 };
  edited.project.ceilingFt = 9;
  const merged = applyOwnAnalysis(edited, read);
  assert.equal(merged.project.rooms[0].title, 'My den');
  assert.deepEqual(merged.project.rooms[0].size, { xFt: 12, yFt: 18 });
  assert.equal(merged.project.rooms[0].sizeNote, undefined);
  assert.equal(merged.project.ceilingFt, 9);
  assert.equal(merged.project.ceilingNote, undefined);
});

test('starting again with the same photo creates an independent studio and preserves retry identity', () => {
  const first = pending();
  const second = pending();
  assert.notEqual(first.project.id, second.project.id);
  assert.equal(first.project.rooms[0].photo.src, second.project.rooms[0].photo.src);
  const updated = applyOwnAnalysis(first, {
    photos: [{ sha256: sha, kind: 'other', title: 'Room', floor: 'other' }],
    plans: [],
    ceiling: { ft: null, note: 'unknown' },
    walls: {},
  });
  assert.equal(updated.project.id, first.project.id);
});

test('uploaded rooms retain the identity assigned when their new draft was opened', () => {
  const draft = uploadedOwnStudio({
    id: 'own-draft-one',
    photos: [sha],
    plans: [],
    where: 'New room',
    ceilingFt: null,
    idea: '',
  });
  assert.equal(draft.project.id, 'own-draft-one');
});
