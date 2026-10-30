import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { boxRoomModel, compileScopeDraft, exampleQuotes, roomAnnotations } from '@renovagent/core';
import type { Workspace } from '@renovagent/contracts';
import {
  directionFor,
  FLOOR_OPTIONS,
  packagesFor,
  savedPick,
  variantFor,
  WALL_OPTIONS,
} from '../../apps/web/src/features/room3d/example-photo.js';
import { examplePrompt } from '../../apps/api/src/example-render.js';

const pick = { wall: 'sage', floor: 'hardwood' } as const;

test('each step shows its stage of the work in the example room', () => {
  assert.equal(variantFor(null, pick, false), 'before');
  assert.equal(variantFor('carpet-removal', pick, true), 'carpet-out');
  assert.equal(variantFor('wall-paint', pick, true), 'painted-sage-subfloor');
  assert.equal(variantFor('wall-paint', { ...pick, floor: 'carpet' }, true), 'painted-sage-carpet');
  assert.equal(variantFor('hardwood-floor', pick, true), 'done-sage-hardwood');
  assert.equal(variantFor(null, pick, true), 'done-sage-hardwood');
});

test('every combination the picker can reach has a render and a Muse prompt', () => {
  const scene = JSON.parse(readFileSync('public/example-room/scene.json', 'utf8'));
  for (const w of WALL_OPTIONS)
    for (const f of FLOOR_OPTIONS) {
      const p = { wall: w.key, floor: f.key };
      for (const step of [null, 'carpet-removal', 'wall-paint']) {
        const v = variantFor(step, p, true);
        assert.ok(existsSync(`public/example-room/${v}.jpg`), v);
        assert.ok(scene.variants.includes(v), v);
      }
      assert.match(examplePrompt(variantFor(null, p, true)), new RegExp(w.label, 'i'));
    }
  assert.ok(existsSync('public/example-room/before.jpg'));
  // Every pin lands inside the frame.
  for (const id of ['wall-paint', 'carpet-removal', 'floor'])
    assert.ok(
      scene.anchors[id].every((v: number) => v > 0.03 && v < 0.97),
      `${id} at ${scene.anchors[id]}`,
    );
});

test('a pick round-trips through the draft and changes the quote', () => {
  const state = { facts: {}, artifacts: {}, projects: {} } as unknown as Workspace;
  const draftFor = (floor: 'carpet' | 'lvp' | 'hardwood') =>
    compileScopeDraft(state, 'p1', {
      recipeId: 'living-room-refresh',
      packageIds: packagesFor(floor),
      request: '[Example fixture] test',
      direction: directionFor({ wall: 'sage', floor }),
      reported: [],
      expectedDraftRevision: 0,
    }).draft;
  const hardwood = draftFor('hardwood');
  assert.deepEqual(savedPick(hardwood), { wall: 'sage', floor: 'hardwood' });
  assert.deepEqual(savedPick(draftFor('carpet')), { wall: 'sage', floor: 'carpet' });
  // Without measurements the steps stay unpriced by area, but the step list
  // follows the pick: keeping the carpet drops carpet removal and new flooring.
  const room = boxRoomModel({ lengthM: 4.2672, widthM: 3.6576, heightM: 2.4384 });
  const steps = (floor: 'carpet' | 'hardwood') =>
    roomAnnotations(room, draftFor(floor), null).steps.map((s) => s.id);
  assert.deepEqual(steps('carpet'), ['wall-paint']);
  assert.deepEqual(steps('hardwood'), ['carpet-removal', 'wall-paint', 'hardwood-floor']);
  // No recorded area here, so every quote waits for a measurement.
  assert.deepEqual(exampleQuotes(roomAnnotations(room, hardwood, null).steps), []);
  assert.ok(roomAnnotations(room, hardwood, null).template!.needsArea > 0);
});
