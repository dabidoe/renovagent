import { measured } from '../../fixtures/projects/technical-reference.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyPlanningInputs, planningInputsSchema } from '@renovagent/contracts';
import {
  mm,
  geometry,
  takeoff,
  estimate,
  assessCode,
  halfBathTasks,
  taskReadiness,
  validateTaskGraph,
} from '@renovagent/core';

const trace = (p: ReturnType<typeof geometry> | ReturnType<typeof takeoff>, label: string) =>
  p.traces.find((t) => t.label === label)!.value;
test('unit conversion and rectangular arithmetic match independently calculated dimensions', () => {
  assert.equal(mm({ amount: 1, unit: 'ft' }), 304.8);
  assert.equal(mm({ amount: 12, unit: 'in' }), 304.8);
  const g = geometry(measured());
  assert.equal(g.status, 'supported');
  assert.ok(Math.abs(trace(g, 'Floor area')! - 3.2516064) < 1e-10);
  assert.equal(trace(g, 'Toilet side clearance'), 457.2);
  assert.ok(Math.abs(trace(g, 'Observed drain gradient')! - 100 / 48) < 1e-10);
  assert.throws(() => mm({ amount: 1, unit: 'ft2' } as never));
  assert.throws(() => mm({ amount: 1e9, unit: 'ft' }));
});
test('missing, rough and conflicting geometry cannot become a supported layout', () => {
  assert.equal(geometry(emptyPlanningInputs()).status, 'needs_input');
  const p = measured();
  p.site.measurement = 'rough';
  assert.equal(geometry(p).status, 'needs_input');
  p.site.measurement = 'conflicting';
  assert.equal(geometry(p).status, 'needs_review');
  p.site.width = { amount: 0, unit: 'mm' };
  assert.equal(trace(geometry(p), 'Floor area'), null);
});
test('fixture changes detect wall collision, overlapping footprints, front constraints and door conflicts', () => {
  const p = measured();
  p.layout.toiletCenterX = { amount: 3, unit: 'in' };
  assert.equal(geometry(p).status, 'not_supported');
  p.layout.toiletCenterX = { amount: 18, unit: 'in' };
  p.layout.toiletProjection = { amount: 80, unit: 'in' };
  assert.equal(geometry(p).status, 'not_supported');
  p.layout.toiletProjection = { amount: 28, unit: 'in' };
  p.layout.door = 'conflict';
  assert.equal(geometry(p).status, 'not_supported');
  p.layout.door = 'unknown';
  assert.equal(geometry(p).status, 'needs_input');
});
test('package arithmetic preserves decimals, applies inventory once, and rounds only purchase packages', () => {
  const p = measured();
  const q = takeoff(p);
  assert.equal(q.status, 'calculated');
  assert.equal(trace(q, 'Packages to purchase'), 4);
  assert.ok(Math.abs(trace(q, 'Required with allowance')! - 3.57676704) < 1e-10);
  assert.equal(estimate(p, q).totalMinor, 14000);
  assert.equal(estimate(p, q).status, 'partial');
  p.finish.inventoryAreaM2 = 1;
  p.finish.inventorySpecification = p.finish.specification;
  assert.equal(trace(takeoff(p), 'Packages to purchase'), 3);
  p.finish.inventoryAreaM2 = 100;
  assert.equal(trace(takeoff(p), 'Packages to purchase'), 0);
  p.finish.inventoryAreaM2 = 0;
  p.site.width = { amount: 1, unit: 'm' };
  p.site.length = { amount: 3, unit: 'm' };
  p.finish.wasteBps = 0;
  assert.equal(trace(takeoff(p), 'Packages to purchase'), 3);
  p.site.length = { amount: 3.00000001, unit: 'm' };
  assert.equal(trace(takeoff(p), 'Packages to purchase'), 4);
});
test('unknown specifications, coverage, inventory, waste or prices are not defaulted', () => {
  const p = measured();
  p.finish.inventoryAreaM2 = null;
  assert.equal(trace(takeoff(p), 'Packages to purchase'), null);
  assert.equal(estimate(p, takeoff(p)).totalMinor, null);
  p.finish.inventoryAreaM2 = 0;
  p.finish.packagePriceMinor = null;
  assert.equal(estimate(p, takeoff(p)).totalMinor, null);
  p.finish.packagePriceMinor = 1;
  p.finish.priceSource = '';
  assert.equal(planningInputsSchema.safeParse(p).success, false);
  p.finish.priceSource = 'quote';
  p.finish.inventoryAreaM2 = 1;
  p.finish.inventorySpecification = 'incompatible';
  assert.equal(planningInputsSchema.safeParse(p).success, false);
});
test('candidate applicability is separated from adoption and can never claim a complete code review', () => {
  const p = measured();
  const c = assessCode(p);
  assert.equal(c.checks[0].applicability, 'candidate');
  assert.equal(c.reviewComplete, false);
  assert.ok(c.checks.every((c) => c.status !== 'supported'));
  assert.ok(c.coverage.some((c) => c.status === 'unavailable'));
  p.context.jurisdiction = 'other';
  assert.equal(assessCode(p).checks[0].applicability, 'outside-coverage');
  p.context.jurisdiction = 'philadelphia';
  p.context.applicationDate = '2026-06-30';
  assert.equal(assessCode(p).checks[0].applicability, 'unresolved'); // edition election known, amendment execution coverage not established
  p.context.applicationDate = '2030-01-01';
  assert.equal(assessCode(p).checks[0].applicability, 'unresolved');
  p.context.applicationDate = '2026-10-27';
  p.context.sourceAvailability = 'unavailable';
  assert.equal(assessCode(p).checks[0].applicability, 'unresolved');
  p.context.building = 'unknown';
  assert.equal(assessCode(p).checks[0].status, 'needs_input');
});
test('DAG rejects cycles, missing nodes and duplicates; only evidence collection is initially ready', () => {
  const t = halfBathTasks().tasks;
  validateTaskGraph(t);
  const r = taskReadiness(t, true);
  assert.equal(r[0].readiness, 'ready');
  assert.ok(r.slice(1).every((t) => t.readiness === 'blocked'));
  assert.ok(taskReadiness(t, false).every((t) => t.readiness === 'blocked'));
  assert.throws(() => validateTaskGraph([...t, t[0]]));
  assert.throws(() => validateTaskGraph([{ ...t[0], deps: ['missing'] }]));
  assert.throws(() => validateTaskGraph([{ ...t[0], deps: [t[0].id] }]));
});
test('scheduled inspection, absent evidence, or failed review cannot satisfy release gates', () => {
  const t = [
    {
      id: 'close',
      title: 'Close wall',
      deps: [],
      gates: ['rough-inspection' as const],
      completionEvidence: 'Authority record',
    },
  ];
  assert.equal(
    taskReadiness(
      t,
      true,
      [],
      [{ gate: 'rough-inspection', status: 'scheduled', evidenceIds: ['appointment'] }],
    )[0].readiness,
    'blocked',
  );
  assert.equal(
    taskReadiness(t, true, [], [{ gate: 'rough-inspection', status: 'passed', evidenceIds: [] }])[0]
      .readiness,
    'blocked',
  );
  assert.equal(
    taskReadiness(
      t,
      true,
      [],
      [{ gate: 'rough-inspection', status: 'passed', evidenceIds: ['authority-result'] }],
    )[0].readiness,
    'ready',
  );
  assert.equal(
    taskReadiness(
      t,
      false,
      [],
      [{ gate: 'rough-inspection', status: 'passed', evidenceIds: ['authority-result'] }],
    )[0].readiness,
    'blocked',
  );
});

test('equivalent mixed units at a manufacturer boundary do not create false failures', () => {
  const p = measured();
  p.layout.toiletCenterX = { amount: 15, unit: 'in' };
  p.layout.minimumSide = { amount: 1.25, unit: 'ft' };
  assert.equal(geometry(p).status, 'supported');
});
