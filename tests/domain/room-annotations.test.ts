import test from 'node:test';
import assert from 'node:assert/strict';
import type { PurchasePlanPayload, ScopeDraft } from '@renovagent/contracts';
import { boxRoomModel, roomAnnotations, type RoomModel } from '@renovagent/core';
import { Scenario } from '../foundation-helpers.js';

function bathDraft(): ScopeDraft {
  const s = new Scenario();
  s.create();
  s.apply(
    s.command('DraftScope', {
      recipeId: 'bathroom-refresh',
      packageIds: ['removal-protection', 'vanity', 'toilet', 'floor-tile', 'paint', 'exhaust-fan'],
      request: 'Refresh this half bath',
      reported: [],
      expectedDraftRevision: 0,
    }),
  );
  return s.state.artifacts['project-a:scope-draft'].at(-1)!.payload as ScopeDraft;
}
const box = () => boxRoomModel({ lengthM: 2.4, widthM: 1.8, heightM: 2.4 });
function withToilet(): RoomModel {
  const m = box();
  return {
    ...m,
    fixtures: [
      {
        id: 'wc',
        category: 'toilet',
        center: [0.5, 0.5],
        rotationRad: 0,
        widthM: 0.4,
        depthM: 0.7,
        heightM: 0.75,
        confidence: 'high',
      },
    ],
  };
}
function planFor(draft: ScopeDraft, ids: string[]): PurchasePlanPayload {
  return {
    kind: 'purchase-plan',
    tier: 'mid',
    lines: ids.map((id, i) => ({
      bomItemId: id,
      productName: `Product ${i}`,
      retailer: 'Example retailer',
      sku: `SKU-${i}`,
      lineTotalMinor: 1000 * (i + 1),
      currency: 'USD',
      freshness: 'fresh',
    })),
  } as unknown as PurchasePlanPayload;
  void draft;
}

test('a box room pins wall, floor and ceiling work and lists work without a recorded place', () => {
  const draft = bathDraft();
  const a = roomAnnotations(box(), draft, null);
  const pinned = Object.fromEntries(a.pins.map((p) => [p.id, p.surfaceIds]));
  assert.equal(pinned.paint.length, 4);
  assert.ok(pinned.paint.every((id) => id.startsWith('wall:')));
  assert.deepEqual(pinned['floor-tile'], ['floor']);
  assert.deepEqual(pinned['exhaust-fan'], ['ceiling']);
  // No scanned toilet or sink: never placed at a guessed spot.
  const unplaced = Object.fromEntries(a.unplaced.map((p) => [p.id, p.unplacedReason]));
  assert.match(unplaced.toilet!, /No toilet location recorded/);
  assert.match(unplaced.vanity!, /No sink location recorded/);
  assert.equal(unplaced['removal-protection'], 'Whole-room work');
  // Without a purchase plan there is no cost at all.
  assert.equal(a.totalMinor, null);
  assert.ok(a.pins.every((p) => p.costMinor === null));
  assert.deepEqual(
    [...a.pins, ...a.unplaced].map((p) => p.number).sort((x, y) => x - y),
    [1, 2, 3, 4, 5, 6],
  );
});

test('a scanned toilet carries the toilet package', () => {
  const a = roomAnnotations(withToilet(), bathDraft(), null);
  assert.deepEqual(a.pins.find((p) => p.id === 'toilet')?.surfaceIds, ['fixture:wc']);
  assert.ok(a.unplaced.some((p) => p.id === 'vanity'));
});

test('costs come only from purchase-plan lines, with partial pricing stated', () => {
  const draft = bathDraft();
  const paint = draft.requirements.filter((r) => r.packageId === 'paint').map((r) => r.id);
  const tile = draft.requirements.find((r) => r.packageId === 'floor-tile')!.id;
  const a = roomAnnotations(box(), draft, planFor(draft, [...paint, tile]));
  const pin = (id: string) => [...a.pins, ...a.unplaced].find((p) => p.id === id)!;
  assert.equal(pin('paint').priced, paint.length);
  assert.equal(
    pin('paint').costMinor,
    paint.reduce((n, _, i) => n + 1000 * (i + 1), 0),
  );
  assert.equal(pin('floor-tile').priced, 1);
  assert.equal(pin('exhaust-fan').costMinor, null);
  assert.equal(a.tier, 'mid');
  assert.equal(a.priced, paint.length + 1);
  assert.equal(a.totalMinor, pin('paint').costMinor! + pin('floor-tile').costMinor!);
  assert.match(
    a.notes.join(' '),
    new RegExp(`${a.items - a.priced} of ${a.items} items are not priced`),
  );
});

test('a whole-home plan says its geometry is not this room', () => {
  const m = { ...box(), spaces: [{}, {}] } as unknown as RoomModel;
  assert.match(roomAnnotations(m, bathDraft(), null).notes.join(' '), /covers 2 spaces/);
});

test('no draft means no callouts', () => {
  const a = roomAnnotations(box(), null, null);
  assert.deepEqual([a.pins, a.unplaced], [[], []]);
});
