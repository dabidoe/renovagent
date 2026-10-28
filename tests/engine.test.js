import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcProject } from '../src/engine.js';

const baseline = { L: 6, W: 4, stack: 8, layout: 'standard', floor: 12, budget: 4000, basement: true, vent: false, permit: false };

test('baseline demo room matches documented totals', () => {
  const r = calcProject(baseline, {});
  assert.equal(r.area, 24);
  assert.equal(r.cost, 972);
  assert.equal(r.m.length, 15);
  assert.equal(r.totalSave, 573);
});

test('owned inventory removes the fitting from the buy list', () => {
  const r = calcProject(baseline, { wax: true });
  const wax = r.m.find((x) => x.name === 'Wax ring');
  assert.equal(wax.buy, 0);
  assert.equal(wax.owned, 1);
});

test('LVP floor swaps tile lines for a single flooring line', () => {
  const r = calcProject({ ...baseline, floor: 0 }, {});
  assert.ok(r.m.some((x) => x.name === 'LVP flooring'));
  assert.ok(!r.m.some((x) => x.name === 'Floor tile'));
});
