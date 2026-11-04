import test from 'node:test';
import assert from 'node:assert/strict';
import { studioPlacementWarnings } from '@renovagent/core';
import {
  HUTCHINSON,
  HUTCHINSON_DESIGN,
} from '../../apps/web/src/features/house-example/hutchinson-project.js';
import { roomModel } from '../../apps/web/src/features/house-example/paint-floor.js';

test('Hutchinson photo furniture has linked Keep items inside the traced living room', () => {
  const items = HUTCHINSON_DESIGN.items!.living!;
  const placements = HUTCHINSON_DESIGN.placements!.living!;
  const model = roomModel(HUTCHINSON.rooms[0]!, HUTCHINSON.ceilingFt)!;
  assert.equal(placements.length, 9);
  assert.deepEqual(studioPlacementWarnings(model, placements), []);
  for (const item of items) {
    assert.equal(item.action, 'keep');
    assert.equal(item.unitAllowanceMinor, null);
    assert.equal(placements.filter((p) => p.itemId === item.id).length, item.quantity);
  }
  assert.ok(placements.every((p) => items.some((i) => i.id === p.itemId)));
  assert.equal(placements.find((p) => p.id.includes(':sofa:'))!.rotationDeg, -90);
  assert.equal(placements.find((p) => p.id.includes(':loveseat:'))!.rotationDeg, 180);
  assert.deepEqual(
    placements.filter((p) => p.assetId === 'dining-chair').map((p) => p.rotationDeg),
    [90, 90, -90, -90],
  );
  assert.equal(HUTCHINSON_DESIGN.placements!.primary, undefined);
});
