import test from 'node:test';
import assert from 'node:assert/strict';
import { studioItemBudget } from '@renovagent/core';
import type { StudioItem } from '@renovagent/contracts';

test('studio allowances keep unknowns separate and exclude retained furniture', () => {
  const items: StudioItem[] = [
    {
      id: 'chair',
      name: 'Chair pair',
      category: 'furniture',
      action: 'add',
      quantity: 2,
      unitAllowanceMinor: 12500,
    },
    {
      id: 'sofa',
      name: 'My sofa',
      category: 'furniture',
      action: 'keep',
      quantity: 1,
      unitAllowanceMinor: 90000,
    },
    {
      id: 'rug',
      name: 'Rug',
      category: 'decor',
      action: 'add',
      quantity: null,
      unitAllowanceMinor: 5000,
    },
    {
      id: 'lamp',
      name: 'Lamp',
      category: 'lighting',
      action: 'replace',
      quantity: 1,
      unitAllowanceMinor: null,
    },
  ];
  const result = studioItemBudget(items);
  assert.equal(result.allowanceMinor, 25000);
  assert.equal(result.unpriced, 2);
  assert.equal(result.kept, 1);
  assert.deepEqual(
    result.lines.map((l) => l.totalMinor),
    [25000, null, null, null],
  );
  assert.throws(() => studioItemBudget([{ ...items[0], unitAllowanceMinor: -1 }]));
});
