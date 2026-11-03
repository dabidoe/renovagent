import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recordEdit,
  startEditHistory,
} from '../../apps/web/src/features/house-example/design-history.js';
import {
  DEMO_FURNITURE_ALLOWANCES,
  withDemoFurnitureAllowances,
  studioItemBudget,
} from '../../packages/core/src/index.js';
import { studioItemSchema, studioAssetIds } from '../../packages/contracts/src/index.js';

test('edit history groups dragging, keeps reset separate and branches after undo', () => {
  let history = startEditHistory({ x: 0 });
  history = recordEdit(history, { x: 1 }, 1000);
  history = recordEdit(history, { x: 2 }, 1100);
  assert.equal(history.entries.length, 2);
  assert.deepEqual(history.entries[0]!.value, { x: 0 });
  history = recordEdit(history, { x: 0 }, 1200, true);
  assert.equal(history.entries.length, 3);
  assert.deepEqual(history.entries[history.index - 1]!.value, { x: 2 });
  history = { ...history, index: 1 };
  history = recordEdit(history, { x: 3 }, 1250);
  assert.equal(history.entries.length, 3);
  assert.deepEqual(history.entries.at(-1)!.value, { x: 3 });
  for (let i = 0; i < 100; i++) history = recordEdit(history, { x: i + 10 }, 2000 + i * 1000);
  assert.equal(history.entries.length, 50);
  assert.equal(history.index, 49);
});

test('demo furniture allowances preserve owner values, unknown quantities and kept items', () => {
  for (const asset of studioAssetIds)
    assert.ok(DEMO_FURNITURE_ALLOWANCES[asset] === null || DEMO_FURNITURE_ALLOWANCES[asset]! > 0);
  const item = (id: string, name: string, patch = {}) =>
    studioItemSchema.parse({
      id,
      name,
      category: 'furniture',
      action: 'add',
      quantity: 1,
      unitAllowanceMinor: null,
      ...patch,
    });
  const original = [
    item('sofa', 'Cream sofa'),
    item('rug', 'Area rug', { quantity: null }),
    item('chair', 'Lounge chair', { unitAllowanceMinor: 32100 }),
    item('kept', 'Coffee table', { action: 'keep' }),
    item('art', 'Artwork'),
  ];
  const filled = withDemoFurnitureAllowances(original);
  assert.equal(filled[0]!.allowanceSource, 'demo');
  assert.equal(filled[1]!.quantity, null);
  assert.equal(filled[2], original[2]);
  assert.equal(filled[3], original[3]);
  assert.equal(filled[4], original[4]);
  assert.equal(studioItemBudget(filled).allowanceMinor, 60000 + 32100);
  assert.equal(studioItemBudget(filled).unpriced, 2);
  assert.deepEqual(withDemoFurnitureAllowances(filled), filled);
});
