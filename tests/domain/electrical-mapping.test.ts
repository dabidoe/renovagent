import test from 'node:test';
import assert from 'node:assert/strict';
import { planningInputsSchema } from '@unpermitted/contracts';
import { assessCode, electricalPath } from '@unpermitted/core';
import { measured } from '../../fixtures/projects/technical-reference.js';
export function scopedElectrical() {
  const p = measured();
  p.context.systems.dwellingForm = 'rowhouse-townhouse';
  p.context.electrical = {
    designBasis: 'irc-part-viii',
    serviceVoltage: '120-240',
    servicePhase: 'single',
    serviceAmps: 100,
    basinMeasurement: 'outside-edge',
    basinMount: 'adjacent-wall-partition',
    basinBelowTopInches: 0,
    countertopAssemblyListed: 'unknown',
  };
  p.context.systems.basinReceptacleDistanceInches = 36;
  return p;
}
const check = (p: ReturnType<typeof measured>, id: string) =>
  assessCode(p).checks.find((c) => c.id === id)!;
test('clearance mapping separates current general IPC geometry, public compartment amendments and retained accessibility', () => {
  const p = measured(),
    general = check(p, 'fixture-clearances'),
    accessible = check(p, 'fixture-accessibility');
  assert.equal(general.mapping?.status, 'candidate-incorporation');
  assert.match(general.mapping!.locator, /2021 IPC 405.3.1/);
  assert.equal(general.applicability, 'candidate');
  assert.equal(general.evaluation, undefined);
  assert.ok(general.referenceCriteria!.some((c) => c.includes('private-dwelling')));
  assert.equal(accessible.mapping?.status, 'unresolved');
  assert.equal(accessible.applicability, 'unresolved');
  p.context.unavailableSourceIds = ['phila-clearance-amendment'];
  assert.equal(check(p, 'fixture-clearances').mapping?.status, 'unresolved');
  assert.deepEqual(check(p, 'fixture-clearances').referenceCriteria, []);
  p.context.unavailableSourceIds = [];
  p.context.applicationDate = '2026-06-30';
  p.context.filing.selectedEdition = '2018';
  assert.equal(check(p, 'fixture-clearances').applicability, 'outside-coverage');
});
test('exact circuit exception, GFCI supply scope, lighting exceptions and local wet-zone replacement are distinct records', () => {
  const p = scopedElectrical();
  assert.equal(electricalPath(p).candidate, true);
  assert.ok(check(p, 'electrical-circuit').referenceCriteria!.some((c) => c.includes('E3702')));
  assert.ok(check(p, 'electrical-gfci').referenceCriteria!.some((c) => c.includes('150 V')));
  assert.ok(
    check(p, 'electrical-lighting').referenceCriteria!.some((c) =>
      c.includes('excludes bathrooms'),
    ),
  );
  assert.equal(check(p, 'electrical-wet-zone').mapping?.status, 'local-replacement');
  assert.match(check(p, 'electrical-wet-zone').mapping!.locator, /R-E4002.11/);
  assert.ok(assessCode(p).checks.every((c) => c.status !== 'supported'));
  assert.equal(assessCode(p).reviewComplete, false);
});
test('outside-edge distance boundary is deterministic and never approves outlet installation', () => {
  const p = scopedElectrical();
  let c = check(p, 'electrical-basin');
  assert.equal(c.evaluation?.required, 36);
  assert.equal(c.evaluation?.outcome, 'meets-threshold');
  assert.equal(c.status, 'needs_review');
  p.context.systems.basinReceptacleDistanceInches = 36.0001;
  c = check(p, 'electrical-basin');
  assert.equal(c.evaluation?.outcome, 'does-not-meet');
  assert.equal(c.status, 'not_supported');
  p.context.electrical.basinMeasurement = 'unknown';
  assert.equal(check(p, 'electrical-basin').evaluation?.required, null);
});
test('NEC alternative, ambiguous form, service scope and source gaps cannot borrow the residential comparison', () => {
  for (const mutate of [
    (p: ReturnType<typeof measured>) => (p.context.electrical.designBasis = 'nec-alternative'),
    (p: ReturnType<typeof measured>) => (p.context.systems.dwellingForm = 'twin-or-duplex'),
    (p: ReturnType<typeof measured>) => (p.context.dwellingUnits = 2),
    (p: ReturnType<typeof measured>) => (p.context.electrical.serviceAmps = 401),
    (p: ReturnType<typeof measured>) => (p.context.electrical.servicePhase = 'other'),
    (p: ReturnType<typeof measured>) => (p.context.unavailableSourceIds = ['irc-bathroom-outlets']),
    (p: ReturnType<typeof measured>) => (p.context.unavailableSourceIds = ['pa-irc-amendments']),
    (p: ReturnType<typeof measured>) =>
      (p.context.unavailableSourceIds = ['phila-residential-amendments']),
  ]) {
    const p = scopedElectrical();
    mutate(p);
    const c = check(p, 'electrical-basin');
    assert.equal(c.evaluation?.outcome, 'not-evaluated');
    assert.equal(c.evaluation?.required, null);
    assert.equal(c.applicability, 'unresolved');
  }
});
test('older stored context gains unknown electrical path, without inferring service or measurement evidence', () => {
  const p = structuredClone(measured()) as unknown as { context: Record<string, unknown> };
  delete p.context.electrical;
  const parsed = planningInputsSchema.parse(p);
  assert.equal(parsed.context.electrical.serviceAmps, null);
  assert.equal(parsed.context.electrical.designBasis, 'unknown');
  assert.equal(electricalPath(parsed).candidate, false);
  assert.equal(check(parsed, 'electrical-basin').evaluation?.outcome, 'not-evaluated');
});
