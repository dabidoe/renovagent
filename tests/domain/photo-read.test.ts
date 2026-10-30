import test from 'node:test';
import assert from 'node:assert/strict';
import type { Workspace } from '@renovagent/contracts';
import { compileScopeDraft, photoNotes, photoPins, type PhotoRead } from '@renovagent/core';

const draft = (recipeId: string, packageIds: string[]) =>
  compileScopeDraft({ facts: {}, artifacts: {}, projects: {} } as unknown as Workspace, 'p', {
    recipeId,
    packageIds,
    request: 'test',
    reported: [],
    expectedDraftRevision: 0,
  }).draft;

// Shaped like Jev's reading of the example bathroom photo (sheet vinyl read
// as tile, no fan, dated vanity).
const bath: PhotoRead = {
  model: 'jev-test',
  room: { kind: 'bathroom', confidence: 1 },
  floor: { kind: 'tile', confidence: 0.66 },
  seen: {
    toilet: 0.98,
    vanity: 0.99,
    shower: 0.98,
    tub: 0.09,
    fan: 0.04,
    window: 0.7,
    damage: 0.12,
  },
  vanityDated: { score: 1.66, confidence: 0.49 },
  boxes: {
    toilet: { top: 0.58, bottom: 0.99, left: 0.87, right: 1 },
    vanity: { top: 0.54, bottom: 1, left: 0.15, right: 0.57 },
    floor: { top: 0.81, bottom: 0.96, left: 0.03, right: 0.95 },
    wall: { top: 0.02, bottom: 0.25, left: 0.85, right: 0.99 },
  },
};

test('planned work is pinned on what Jev located, and nothing else', () => {
  const pins = photoPins(bath, draft('bathroom-refresh', ['toilet', 'floor-tile', 'exhaust-fan']));
  assert.deepEqual(
    pins.map((p) => p.packageId),
    ['toilet', 'floor-tile'],
  );
  // Pin at the centre of the toilet's box.
  const toilet = pins.find((p) => p.packageId === 'toilet')!;
  assert.ok(Math.abs(toilet.x - 0.935) < 1e-9 && Math.abs(toilet.y - 0.785) < 1e-9);
  // No fan was seen, so the planned fan is not pinned at a guessed spot.
  assert.ok(!pins.some((p) => p.packageId === 'exhaust-fan'));
  assert.deepEqual(photoPins(bath, null), []);
});

test('photo findings become suggestions the owner approves, or checks', () => {
  const notes = photoNotes(bath, draft('bathroom-refresh', ['toilet', 'floor-tile', 'paint']));
  const byId = Object.fromEntries(notes.map((n) => [n.id, n]));
  assert.equal(byId['no-fan']!.kind, 'suggest-add');
  assert.equal(byId['no-fan']!.packageId, 'exhaust-fan');
  assert.equal(byId['dated-vanity']!.packageId, 'vanity');
  assert.equal(byId['old-floor']!.kind, 'check');
  assert.match(byId.floor!.text, /66% confident\)\. Confirm/);
  assert.equal(byId.damage, undefined);

  // Already planned: no suggestion to add it again.
  const withFan = photoNotes(bath, draft('bathroom-refresh', ['toilet', 'exhaust-fan', 'vanity']));
  assert.ok(!withFan.some((n) => n.packageId));
});

test('carpet under a planned living-room floor must come up first', () => {
  const living: PhotoRead = {
    ...bath,
    room: { kind: 'living', confidence: 0.9 },
    floor: { kind: 'carpet', confidence: 0.9 },
    seen: { ...bath.seen, damage: 0.8 },
  };
  const notes = photoNotes(living, draft('living-room-refresh', ['wall-paint', 'lvp-floor']));
  const carpet = notes.find((n) => n.id === 'carpet-out')!;
  assert.equal(carpet.kind, 'suggest-add');
  assert.equal(carpet.packageId, 'carpet-removal');
  assert.ok(notes.some((n) => n.id === 'damage' && n.kind === 'check'));
  // Bathroom-only rules stay out of a living room.
  assert.ok(!notes.some((n) => n.id === 'no-fan' || n.id === 'dated-vanity'));
});
