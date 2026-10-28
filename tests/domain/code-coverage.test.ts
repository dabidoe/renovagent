import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { emptyPlanningInputs, planningInputsSchema } from '@unpermitted/contracts';
import {
  assessCode,
  assessDrainage,
  determineCodeBasis,
  resolveLocalContext,
  missingSources,
  technicalSources,
} from '@unpermitted/core';
import { measured } from '../../fixtures/projects/technical-reference.js';
test('new complete filings use mandatory edition while incomplete dates cannot select one', () => {
  const c = measured().context;
  assert.equal(determineCodeBasis(c).generalEdition, '2021');
  c.filing.completeness = 'incomplete';
  assert.equal(determineCodeBasis(c).generalEdition, null);
  c.filing.completeness = 'reported-complete';
  c.filing.selectedEdition = '2018';
  assert.equal(determineCodeBasis(c).generalEdition, null);
  assert.ok(determineCodeBasis(c).missing.some((m) => m.includes('conflicts')));
});
test('transition election, authority default, amendments and expired resubmissions remain distinct', () => {
  const c = measured().context;
  c.applicationDate = '2026-06-30';
  c.filing.selectedEdition = 'unknown';
  assert.equal(determineCodeBasis(c).generalEdition, null);
  c.filing.selectedEdition = 'not-specified';
  assert.equal(determineCodeBasis(c).generalEdition, '2018');
  assert.match(determineCodeBasis(c).decision, /defaults/);
  c.filing.selectedEdition = '2021';
  assert.equal(determineCodeBasis(c).generalEdition, '2021');
  c.applicationDate = '2026-10-27';
  c.filing.kind = 'issued-permit-amendment';
  c.filing.originalEdition = '2018';
  assert.equal(determineCodeBasis(c).generalEdition, null);
  c.filing.originalPermitReference = 'User-supplied permit record';
  c.filing.withinOriginalScope = 'yes';
  assert.equal(determineCodeBasis(c).generalEdition, '2018');
  assert.equal(
    assessCode({ ...measured(), context: c }).checks[0].applicability,
    'outside-coverage',
  );
  c.filing.withinOriginalScope = 'no';
  assert.equal(determineCodeBasis(c).generalEdition, null);
  c.filing.kind = 'expired-resubmission';
  assert.equal(determineCodeBasis(c).generalEdition, '2021');
});
test('postal geography cannot select authority and reported locality never verifies prices, stores or contractors', () => {
  const c = measured().context;
  c.jurisdiction = 'unknown';
  c.locality.postalCode = '19103';
  assert.equal(resolveLocalContext(c).jurisdictionId, null);
  assert.equal(determineCodeBasis(c).generalEdition, null);
  c.jurisdiction = 'philadelphia';
  c.locality.regionCode = 'NJ';
  assert.equal(resolveLocalContext(c).status, 'needs_review');
  assert.equal(determineCodeBasis(c).generalEdition, null);
  c.locality.regionCode = 'PA';
  c.locality.boundaryBasis = 'unknown';
  assert.equal(resolveLocalContext(c).jurisdictionId, null);
  c.locality.boundaryBasis = 'user-reported';
  const local = resolveLocalContext(c);
  assert.equal(local.jurisdictionId, 'us-pa-philadelphia');
  assert.ok(local.uses.every((u) => u.status === 'not-verified'));
});
test('missing building/use evidence and outside playbook scope block executable local rules', () => {
  const p = measured();
  p.context.stories = null;
  assert.equal(assessCode(p).checks[0].status, 'needs_input');
  assert.equal(assessDrainage(p).checks[0].evaluation?.outcome, 'not-evaluated');
  p.context.stories = 4;
  assert.equal(assessCode(p).checks[0].applicability, 'outside-coverage');
  p.context.stories = 2;
  p.context.roomUse = 'public-or-employee';
  assert.equal(assessCode(p).checks[0].applicability, 'outside-coverage');
});
test('local single-stack fall arithmetic has exact method, source and boundary traces but no approved pass', () => {
  const p = measured();
  p.site.drainFall = { amount: 1, unit: 'in' };
  let c = assessDrainage(p);
  assert.equal(c.checks[0].status, 'not_supported');
  assert.equal(c.checks[0].evaluation?.required, 50.8);
  assert.equal(c.checks[0].evaluation?.observed, 25.4);
  assert.equal(c.checks[0].evaluation?.outcome, 'does-not-meet');
  p.site.drainFall = { amount: 2, unit: 'in' };
  c = assessDrainage(p);
  assert.equal(c.checks[0].status, 'needs_review');
  assert.equal(c.reviewComplete, false);
  assert.equal(c.checks[0].evaluation?.outcome, 'meets-threshold');
  p.context.drainDiameterInches = 4;
  assert.equal(assessDrainage(p).checks[0].evaluation?.required, 25.4);
  p.context.drainDiameterInches = 6;
  assert.equal(assessDrainage(p).checks[0].evaluation?.required, 25.4);
  p.context.drainDiameterInches = 8;
  assert.equal(assessDrainage(p).checks[0].evaluation?.required, 12.7);
});
test('unknown or other methods, missing measurements and unavailable sources cannot borrow local thresholds', () => {
  const p = measured();
  p.context.drainageMethod = 'other';
  assert.equal(assessDrainage(p).checks[0].evaluation?.required, null);
  assert.ok(missingSources(p.context, ['phila-drainage-table']).length);
  p.context.drainageMethod = 'philadelphia-single-stack';
  p.context.applicationDate = '2026-06-30';
  assert.equal(determineCodeBasis(p.context).generalEdition, '2021');
  assert.equal(assessDrainage(p).checks[0].evaluation?.outcome, 'not-evaluated');
  p.context.applicationDate = '2026-10-27';
  p.context.unavailableSourceIds = ['phila-single-stack'];
  assert.equal(assessDrainage(p).checks[0].evaluation?.outcome, 'not-evaluated');
  p.context.unavailableSourceIds = [];
  p.site.drainRun = { amount: 0, unit: 'ft' };
  assert.equal(assessDrainage(p).checks[0].evaluation?.outcome, 'not-evaluated');
});
test('local AAV water-closet exclusion and mixed-method restriction stay distinct from a reviewed vent design', () => {
  const p = measured();
  p.context.ventMethod = 'aav-for-water-closet';
  assert.equal(assessDrainage(p).checks[1].status, 'not_supported');
  p.context.unavailableSourceIds = ['phila-aav'];
  assert.equal(assessDrainage(p).checks[1].status, 'needs_review');
  p.context.unavailableSourceIds = [];
  p.context.ventMethod = 'mixed-methods';
  assert.equal(assessDrainage(p).checks[1].status, 'not_supported');
  p.context.ventMethod = 'aav-for-lavatory';
  assert.equal(assessDrainage(p).checks[1].status, 'needs_review');
});
test('retained accessibility, exact-source gaps, redlines and qualified-review state cannot collapse into covered', () => {
  const c = assessCode(measured());
  assert.equal(c.codeBasis?.accessibilityEdition, '2018');
  assert.equal(c.reviewComplete, false);
  assert.ok(c.requirements?.every((r) => r.review === 'unreviewed'));
  assert.equal(
    technicalSources.find((s) => s.id === 'phila-drainage-table')!.interpretation,
    'formatting-ambiguous',
  );
  assert.equal(
    technicalSources.find((s) => s.id === 'ipc-fixture-clearance')!.edition,
    '2018 IPC candidate, subject to state/local accessibility mapping',
  );
  for (const source of technicalSources)
    assert.equal(source.contentHash, createHash('sha256').update(source.paraphrase).digest('hex'));
});
test('older inputs load new applicability fields as unknown, without manufactured local or filing evidence', () => {
  const p = emptyPlanningInputs();
  const old = structuredClone(p) as unknown as { context: Record<string, unknown> };
  for (const key of Object.keys(old.context))
    if (
      ![
        'jurisdiction',
        'applicationDate',
        'building',
        'scope',
        'accessibility',
        'sourceAvailability',
      ].includes(key)
    )
      delete old.context[key];
  const parsed = planningInputsSchema.parse(old);
  assert.equal(parsed.context.locality.boundaryBasis, 'unknown');
  assert.equal(parsed.context.filing.kind, 'unknown');
  assert.equal(parsed.context.stories, null);
});

test('exact publisher clearances remain separate from retained local applicability and manufacturer constraints', () => {
  const p = measured();
  const source = technicalSources.find((s) => s.id === 'ipc-fixture-clearance')!;
  assert.equal(source.access, 'retrieved');
  assert.match(source.locator, /405.3.1/);
  const check = assessCode(p).checks.find((c) => c.id === 'fixture-clearances')!;
  assert.ok(check.referenceCriteria?.some((c) => c.includes('15 inches')));
  assert.ok(check.referenceCriteria?.some((c) => c.includes('children')));
  assert.equal(check.applicability, 'candidate');
  assert.equal(
    check.mapping?.edition,
    '2021 general plumbing; separate retained accessibility basis',
  );
  assert.equal(check.evaluation, undefined);
  assert.equal(check.status, 'needs_review');
  p.context.unavailableSourceIds = ['ipc-2021-clearance'];
  assert.deepEqual(assessCode(p).checks.find((c) => c.id === check.id)!.referenceCriteria, []);
});

test('apparently adequate equipment and circuit observations never unlock unreconciled electrical or exhaust checks', () => {
  const p = measured();
  Object.assign(p.context.systems, {
    dwellingForm: 'rowhouse-townhouse',
    circuitAmps: 20,
    circuitServes: 'single-bathroom',
    gfci: 'reported-present',
    basinReceptacleDistanceInches: 24,
    electricalRecord: 'Unverified circuit schedule',
    exhaustStrategy: 'mechanical',
    exhaustOperation: 'continuous',
    exhaustRatedCfm: 80,
    exhaustRatingPressureInWg: 0.25,
    exhaustDischarge: 'outdoors',
    exhaustRecord: 'Unverified fan sheet',
  });
  const c = assessCode(p);
  for (const id of [
    'electrical-circuit',
    'electrical-gfci',
    'exhaust-capacity',
    'exhaust-discharge',
  ]) {
    const check = c.checks.find((c) => c.id === id)!;
    assert.equal(check.status, 'needs_review');
    assert.equal(check.evaluation, undefined);
    assert.ok(check.missing.some((m) => m.includes('Qualified')));
    assert.ok(check.referenceCriteria?.length);
  }
  assert.equal(c.reviewComplete, false);
  assert.ok(!c.checks.some((c) => c.status === 'supported'));
  p.context.systems.exhaustDischarge = 'attic';
  assert.match(
    assessCode(p).checks.find((c) => c.id === 'exhaust-discharge')!.rationale,
    /conflicts/,
  );
});

test('source loss, dates and outside residential scope suppress criteria or candidate applicability', () => {
  const p = measured();
  p.context.unavailableSourceIds = [
    'irc-exhaust-rates',
    'irc-bathroom-circuit',
    'irc-bathroom-outlets',
  ];
  for (const id of ['exhaust-capacity', 'electrical-circuit', 'electrical-gfci']) {
    const check = assessCode(p).checks.find((c) => c.id === id)!;
    assert.deepEqual(check.referenceCriteria, []);
    assert.equal(check.applicability, 'unresolved');
    assert.match(check.rationale, /withheld/);
    assert.ok(check.missing.some((m) => m.includes('Unavailable source')));
  }
  p.context.stories = 4;
  assert.equal(
    assessCode(p).checks.find((c) => c.id === 'exhaust-capacity')!.applicability,
    'outside-coverage',
  );
  p.context.stories = 2;
  p.context.unavailableSourceIds = [];
  assert.equal(
    assessCode(p).checks.find((c) => c.id === 'exhaust-capacity')!.applicability,
    'unresolved',
  );
  const old = structuredClone(measured()) as unknown as { context: Record<string, unknown> };
  delete old.context.systems;
  assert.equal(planningInputsSchema.parse(old).context.systems.exhaustRatedCfm, null);
  assert.equal(planningInputsSchema.parse(old).context.systems.gfci, 'unknown');
  old.context.systems = { ...measured().context.systems, exhaustRatedCfm: -1 };
  assert.equal(planningInputsSchema.safeParse(old).success, false);
});
