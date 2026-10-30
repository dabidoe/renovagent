import test from 'node:test';
import assert from 'node:assert/strict';
import { boxRoomModel, roomSurfaces, scopeDraftId } from '@renovagent/core';
import type { PurchasePlanPayload, ScopeDraft } from '@renovagent/contracts';
import { Scenario } from '../foundation-helpers.js';

function draft(packageIds: string[]) {
  const s = new Scenario();
  s.create();
  s.apply(
    s.command('DraftScope', {
      recipeId: 'bathroom-refresh',
      packageIds,
      request: 'Bath refresh',
      reported: [
        { key: 'floorLengthFt', amount: 8, unit: 'ft' },
        { key: 'floorWidthFt', amount: 5, unit: 'ft' },
        { key: 'ceilingHeightFt', amount: 8, unit: 'ft' },
      ],
      expectedDraftRevision: 0,
    }),
  );
  return s.state.artifacts[scopeDraftId('project-a')].at(-1)!.payload as ScopeDraft;
}
const model = {
  ...boxRoomModel({ lengthM: 2.4384, widthM: 1.524, heightM: 2.4384 }),
  fixtures: [
    {
      id: 'wc',
      category: 'toilet',
      center: [0.5, 0.5] as [number, number],
      rotationRad: 0,
      widthM: 0.4,
      depthM: 0.7,
      heightM: 0.75,
      confidence: null,
    },
  ],
};

test('surfaces show scope quantities from the draft, separate from measured geometry', () => {
  const surfaces = roomSurfaces(model, draft(['paint', 'floor-tile', 'toilet']));
  const wall = surfaces.find((s) => s.id === 'wall:wall-1')!;
  assert.equal(wall.geometry.grossAreaM2, 5.94);
  const paint = wall.links.find((l) => l.requirementId === 'paint:walls')!;
  assert.equal(paint.quantity, 208); // package total from the draft, in sq ft
  assert.equal(paint.unit, 'sq ft');
  const floor = surfaces.find((s) => s.id === 'floor')!;
  assert.equal(floor.geometry.areaM2, 3.72);
  assert.equal(floor.links.find((l) => l.requirementId === 'floor-tile:tile')!.quantity, 40);
  assert.match(floor.notes.join(' '), /measured length × width/);
  // The scanned toilet links to the toilet package only because it is in scope.
  const wc = surfaces.find((s) => s.id === 'fixture:wc')!;
  assert.ok(wc.links.some((l) => l.requirementId === 'toilet:toilet'));
  assert.match(wc.notes.join(' '), /not a proposed product/);
  const without = roomSurfaces(model, draft(['paint'])).find((s) => s.id === 'fixture:wc')!;
  assert.deepEqual(without.links, []);
});

test('a whole-home plan warns that its geometry is not this room', () => {
  const surfaces = roomSurfaces({ ...model, spaces: ['bedroom', 'bath'] }, null);
  assert.match(surfaces.find((s) => s.id === 'floor')!.notes.join(' '), /covers 2 spaces/);
  assert.deepEqual(surfaces.find((s) => s.id === 'floor')!.links, []);
});

test('a purchase plan line attaches its product to the linked requirement', () => {
  const plan = {
    lines: [
      {
        bomItemId: 'paint:walls',
        productName: 'Interior eggshell, 1 gal',
        retailer: 'Demo Hardware',
        sku: 'P-1',
        lineTotalMinor: 4200,
        currency: 'USD',
        freshness: 'fresh',
      },
    ],
  } as unknown as PurchasePlanPayload;
  const wall = roomSurfaces(model, draft(['paint']), plan).find((s) => s.id === 'wall:wall-1')!;
  assert.equal(
    wall.links.find((l) => l.requirementId === 'paint:walls')!.product?.name,
    'Interior eggshell, 1 gal',
  );
});
