import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import {
  DomainError,
  emptyPlanningInputs,
  type PlanningInputs,
  planningGroups,
} from '@renovagent/contracts';
import {
  latest,
  fingerprint,
  planningId,
  taskViews,
  referenceCurrent,
  sourceSetVersion,
} from '@renovagent/core';
import { measured } from '../../fixtures/projects/technical-reference.js';
import { Scenario, openTestRepo, context } from '../foundation-helpers.js';
function setup() {
  const s = new Scenario();
  s.create();
  s.evidence('technical-observation', 'project');
  return s;
}
function save(s: Scenario, inputs: PlanningInputs = measured()) {
  return s.apply(
    s.command('SavePlanningInputs', {
      inputs,
      basis: 'example',
      evidenceIds: ['technical-observation'],
      expectedInputs: Object.fromEntries(
        planningGroups.map((g) => [
          g,
          latest(s.state.artifacts[planningId('project-a', g)])?.revision || 0,
        ]),
      ),
    }),
  );
}
const a = (s: Scenario, part: string) => latest(s.state.artifacts[planningId('project-a', part)])!;
const calc = (s: Scenario) => s.apply(s.command('CalculatePlanning', {}));
test('deterministic planning persists exact input refs, sources, quantities, gated tasks and reopen', async () => {
  const s = setup();
  save(s);
  calc(s);
  assert.equal(a(s, 'geometry').payload.kind, 'measured-layout');
  assert.equal(a(s, 'quantities').payload.kind, 'quantity-takeoff');
  assert.equal(a(s, 'sources').payload.kind, 'planning-sources');
  const factory = new IDBFactory(),
    name = crypto.randomUUID(),
    r = await openTestRepo(factory, name);
  await r.executeBatch(s.commands, context);
  r.close();
  const reopened = await openTestRepo(factory, name);
  assert.deepEqual((await reopened.read()).artifacts, s.state.artifacts);
  reopened.close();
});
test('geometry correction invalidates checks, quantities, estimate and tasks; code basis and unrelated brief stay current', () => {
  const s = setup();
  save(s);
  calc(s);
  s.artifact('independent-brief', []);
  s.accept(planningId('project-a', 'geometry'));
  const inputs = measured();
  inputs.site.width = { amount: 6, unit: 'ft' };
  const outcome = save(s, inputs);
  for (const part of ['geometry', 'quantities', 'cost', 'tasks'])
    assert.equal(a(s, part).freshness, 'stale');
  assert.equal(a(s, 'code').freshness, 'current');
  assert.equal(latest(s.state.artifacts['independent-brief'])!.freshness, 'current');
  assert.equal(a(s, 'geometry').lifecycle, 'accepted');
  assert.ok(outcome.staleArtifactIds.includes(planningId('project-a', 'tasks')));
  assert.throws(
    () => s.accept(planningId('project-a', 'tasks')),
    (e: unknown) => e instanceof DomainError && e.code === 'STALE',
  );
  calc(s);
  assert.equal(a(s, 'geometry').revision, 2);
  assert.equal(a(s, 'code').revision, 1);
  assert.equal(a(s, 'tasks').revision, 2);
  assert.equal(s.state.artifacts[planningId('project-a', 'geometry')][0].lifecycle, 'accepted');
});
test('selected fixture change invalidates layout and tasks without rewriting independent floor quantities', () => {
  const s = setup();
  save(s);
  calc(s);
  const p = measured();
  p.layout.toiletModel = 'Fixture B';
  p.layout.toiletProjection = { amount: 80, unit: 'in' };
  save(s, p);
  assert.equal(a(s, 'geometry').freshness, 'stale');
  assert.equal(a(s, 'tasks').freshness, 'stale');
  assert.equal(a(s, 'quantities').freshness, 'current');
  assert.equal(a(s, 'cost').freshness, 'current');
  calc(s);
  const g = a(s, 'geometry').payload;
  assert.equal(g.kind === 'measured-layout' && g.status, 'not_supported');
});
test('source access/basis changes invalidate code and plan but not geometry or quantities', () => {
  const s = setup();
  save(s);
  calc(s);
  const p = measured();
  p.context.sourceAvailability = 'unavailable';
  save(s, p);
  for (const k of ['sources', 'code', 'tasks']) assert.equal(a(s, k).freshness, 'stale');
  for (const k of ['geometry', 'quantities', 'cost']) assert.equal(a(s, k).freshness, 'current');
  calc(s);
  const c = a(s, 'code').payload;
  assert.equal(c.kind === 'code-assessment' && c.checks[0].applicability, 'unresolved');
});
test('source package version drift blocks stale acceptance before explicit refresh and regenerates affected outputs', () => {
  const s = setup();
  save(s);
  calc(s);
  const src = a(s, 'sources');
  if (src.payload.kind !== 'planning-sources') throw Error();
  src.payload.version = 'old-package';
  assert.notEqual(src.payload.version, sourceSetVersion);
  assert.equal(
    referenceCurrent(s.state, 'project-a', {
      kind: 'artifact',
      id: planningId('project-a', 'tasks'),
      revision: 1,
    }),
    false,
  );
  assert.throws(() => s.accept(planningId('project-a', 'tasks')));
  calc(s);
  assert.equal(a(s, 'sources').revision, 2);
  assert.equal(a(s, 'code').revision, 2);
  assert.equal(a(s, 'geometry').revision, 1);
});
test('calculation retries are idempotent and stale input editors cannot overwrite newer measurements', () => {
  const s = setup();
  save(s);
  const command = s.command('CalculatePlanning', {});
  s.apply(command);
  const before = structuredClone(s.state);
  s.apply(command);
  assert.deepEqual(s.state, before);
  calc(s);
  assert.equal(a(s, 'geometry').revision, 1);
  const stale = s.command('SavePlanningInputs', {
    inputs: measured(),
    basis: 'example',
    evidenceIds: ['technical-observation'],
    expectedInputs: { site: 0, layout: 0, finish: 0, context: 0 },
  });
  assert.throws(
    () => s.apply(stale),
    (e: unknown) => e instanceof DomainError && e.code === 'CONFLICT',
  );
});
test('a newly recorded conflicting physical fact invalidates geometry and purchasing; no hidden last-value-wins', () => {
  const s = setup();
  save(s);
  calc(s);
  s.evidence();
  s.apply(s.width(1200));
  assert.equal(a(s, 'geometry').freshness, 'stale');
  assert.equal(a(s, 'quantities').freshness, 'stale');
  calc(s);
  const g = a(s, 'geometry').payload,
    q = a(s, 'quantities').payload,
    c = a(s, 'cost').payload;
  assert.equal(g.kind === 'measured-layout' && g.status, 'needs_review');
  assert.equal(q.kind === 'quantity-takeoff' && q.status, 'needs_review');
  assert.equal(c.kind === 'cost-plan' && c.totalMinor, null);
});
test('user acceptance cannot release construction; caller-provided technical artifacts are rejected', () => {
  const s = setup();
  save(s);
  calc(s);
  s.accept(planningId('project-a', 'tasks'));
  const views = taskViews(s.state, 'project-a');
  assert.equal(views[0].readiness, 'ready');
  assert.ok(views.slice(1).every((t) => t.readiness === 'blocked'));
  const before = structuredClone(s.state);
  assert.throws(() => s.artifact('forged', [], 'project-a', a(s, 'geometry').payload));
  assert.deepEqual(s.state, before);
});

test('per-source loss invalidates local checks and plan, preserves independent quantities, and blocks reacceptance', () => {
  const s = setup();
  save(s);
  calc(s);
  s.accept(planningId('project-a', 'code'));
  const p = measured();
  p.context.unavailableSourceIds = ['phila-single-stack'];
  save(s, p);
  assert.equal(a(s, 'drainage').freshness, 'stale');
  assert.equal(a(s, 'tasks').freshness, 'stale');
  assert.equal(a(s, 'geometry').freshness, 'current');
  assert.equal(a(s, 'quantities').freshness, 'current');
  assert.equal(a(s, 'cost').freshness, 'current');
  assert.throws(() => s.accept(planningId('project-a', 'tasks')));
  calc(s);
  const d = a(s, 'drainage').payload;
  assert.equal(d.kind === 'code-assessment' && d.checks[0].evaluation?.outcome, 'not-evaluated');
  assert.equal(s.state.artifacts[planningId('project-a', 'code')][0].lifecycle, 'accepted');
});
test('new conflicting locality evidence invalidates code and prevents numeric local checks, without altering floor arithmetic', () => {
  const s = setup();
  save(s);
  calc(s);
  s.evidence('location-evidence', 'property');
  s.apply(
    s.command('RecordFact', {
      factId: 'reported-region',
      scope: 'property',
      subjectId: 'property-a',
      key: 'regionCode',
      supersedesRevision: 0,
      value: { kind: 'text', text: 'NJ' },
      assertion: 'user_reported',
      evidenceIds: ['location-evidence'],
    }),
  );
  assert.equal(a(s, 'code').freshness, 'stale');
  assert.equal(a(s, 'drainage').freshness, 'stale');
  assert.equal(a(s, 'tasks').freshness, 'stale');
  assert.equal(a(s, 'quantities').freshness, 'current');
  calc(s);
  const c = a(s, 'code').payload,
    d = a(s, 'drainage').payload;
  assert.equal(c.kind === 'code-assessment' && c.locality?.jurisdictionId, null);
  assert.equal(d.kind === 'code-assessment' && d.checks[0].evaluation?.outcome, 'not-evaluated');
});
test('additive unknown applicability fields preserve legacy SavePlanningInputs command fingerprints', () => {
  const s = setup();
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
  const command = s.command('SavePlanningInputs', {
    inputs: old,
    basis: 'example',
    evidenceIds: ['technical-observation'],
    expectedInputs: { site: 0, layout: 0, finish: 0, context: 0 },
  });
  s.apply(command);
  assert.equal(s.state.commands[command.commandId].fingerprint, fingerprint(command));
  const before = structuredClone(s.state);
  s.apply(command);
  assert.deepEqual(s.state, before);
});
test('an unknown source override is rejected atomically', () => {
  const s = setup(),
    p = measured(),
    before = structuredClone(s.state);
  p.context.unavailableSourceIds = ['made-up-provision'];
  assert.throws(() => save(s, p));
  assert.deepEqual(s.state, before);
});

test('authority-profile or playbook revision drift blocks dependent acceptance before recalculation', () => {
  const s = setup();
  save(s);
  calc(s);
  const c = a(s, 'code').payload;
  if (c.kind !== 'code-assessment' || !c.locality) throw Error('Missing local profile');
  c.locality.profileVersion = 'obsolete-profile';
  assert.equal(
    referenceCurrent(s.state, 'project-a', {
      kind: 'artifact',
      id: planningId('project-a', 'tasks'),
      revision: 1,
    }),
    false,
  );
  assert.throws(() => s.accept(planningId('project-a', 'tasks')));
  calc(s);
  assert.equal(a(s, 'code').revision, 2);
  assert.equal(a(s, 'geometry').revision, 1);
});

test('systems observations persist across reopen, revise assessment and invalidate tasks while preserving floor quantities and accepted history', async () => {
  const s = setup();
  save(s);
  calc(s);
  s.accept(planningId('project-a', 'code'));
  const p = measured();
  Object.assign(p.context.systems, {
    exhaustStrategy: 'mechanical',
    exhaustOperation: 'intermittent',
    exhaustRatedCfm: 50,
    exhaustRatingPressureInWg: 0.1,
    exhaustDischarge: 'attic',
    electricalRecord: 'Reported circuit schedule A',
  });
  save(s, p);
  for (const part of ['code', 'drainage', 'tasks']) assert.equal(a(s, part).freshness, 'stale');
  for (const part of ['geometry', 'quantities', 'cost'])
    assert.equal(a(s, part).freshness, 'current');
  assert.throws(() => s.accept(planningId('project-a', 'tasks')));
  calc(s);
  assert.equal(a(s, 'code').revision, 2);
  assert.equal(s.state.artifacts[planningId('project-a', 'code')][0].lifecycle, 'accepted');
  const c = a(s, 'code').payload;
  assert.ok(
    c.kind === 'code-assessment' &&
      c.checks.find((c) => c.id === 'exhaust-discharge')!.rationale.includes('conflicts'),
  );
  const factory = new IDBFactory(),
    name = crypto.randomUUID(),
    r = await openTestRepo(factory, name);
  await r.executeBatch(s.commands, context);
  r.close();
  const reopened = await openTestRepo(factory, name);
  assert.deepEqual((await reopened.read()).artifacts, s.state.artifacts);
  reopened.close();
  p.context.unavailableSourceIds = ['irc-exhaust-rates'];
  save(s, p);
  calc(s);
  const lost = a(s, 'code').payload;
  assert.ok(
    lost.kind === 'code-assessment' &&
      !lost.checks.find((c) => c.id === 'exhaust-capacity')!.referenceCriteria!.length,
  );
  assert.equal(a(s, 'quantities').revision, 1);
  assert.ok(
    taskViews(s.state, 'project-a')
      .slice(1)
      .every((t) => t.readiness === 'blocked'),
  );
});

test('electrical scope and source revisions invalidate limited comparisons, preserve accepted history, quantities and reopen', async () => {
  const s = setup(),
    p = measured();
  p.context.systems.dwellingForm = 'detached';
  Object.assign(p.context.electrical, {
    designBasis: 'irc-part-viii',
    serviceVoltage: '120-240',
    servicePhase: 'single',
    serviceAmps: 200,
    basinMeasurement: 'outside-edge',
  });
  p.context.systems.basinReceptacleDistanceInches = 36;
  save(s, structuredClone(p));
  calc(s);
  s.accept(planningId('project-a', 'code'));
  p.context.systems.basinReceptacleDistanceInches = 37;
  save(s, structuredClone(p));
  assert.equal(a(s, 'code').freshness, 'stale');
  assert.equal(a(s, 'tasks').freshness, 'stale');
  assert.equal(a(s, 'quantities').freshness, 'current');
  assert.throws(() => s.accept(planningId('project-a', 'tasks')));
  calc(s);
  const c = a(s, 'code').payload;
  assert.equal(
    c.kind === 'code-assessment' && c.checks.find((c) => c.id === 'electrical-basin')!.status,
    'not_supported',
  );
  p.context.unavailableSourceIds = ['phila-residential-amendments'];
  save(s, structuredClone(p));
  calc(s);
  const unavailable = a(s, 'code').payload;
  assert.equal(
    unavailable.kind === 'code-assessment' &&
      unavailable.checks.find((c) => c.id === 'electrical-basin')!.evaluation?.required,
    null,
  );
  assert.equal(a(s, 'quantities').revision, 1);
  assert.equal(s.state.artifacts[planningId('project-a', 'code')][0].lifecycle, 'accepted');
  assert.ok(
    taskViews(s.state, 'project-a')
      .slice(1)
      .every((t) => t.readiness === 'blocked'),
  );
  const factory = new IDBFactory(),
    name = crypto.randomUUID(),
    repo = await openTestRepo(factory, name);
  await repo.executeBatch(s.commands, context);
  repo.close();
  const reopened = await openTestRepo(factory, name);
  assert.deepEqual((await reopened.read()).artifacts, s.state.artifacts);
  reopened.close();
});

test('conflicting locality evidence suppresses the new electrical threshold and section mappings', () => {
  const s = setup(),
    p = measured();
  p.context.systems.dwellingForm = 'detached';
  p.context.systems.basinReceptacleDistanceInches = 24;
  Object.assign(p.context.electrical, {
    designBasis: 'irc-part-viii',
    serviceVoltage: '120-240',
    servicePhase: 'single',
    serviceAmps: 100,
    basinMeasurement: 'outside-edge',
  });
  save(s, p);
  calc(s);
  s.evidence('local-boundary-conflict', 'property');
  s.apply(
    s.command('RecordFact', {
      factId: 'different-state',
      scope: 'property',
      subjectId: 'property-a',
      key: 'regionCode',
      supersedesRevision: 0,
      value: { kind: 'text', text: 'NJ' },
      assertion: 'observed',
      evidenceIds: ['local-boundary-conflict'],
    }),
  );
  assert.equal(a(s, 'code').freshness, 'stale');
  calc(s);
  const code = a(s, 'code').payload;
  assert.equal(code.kind, 'code-assessment');
  if (code.kind !== 'code-assessment') throw Error();
  const outlet = code.checks.find((c) => c.id === 'electrical-basin')!;
  assert.equal(outlet.evaluation?.required, null);
  assert.equal(outlet.evaluation?.outcome, 'not-evaluated');
  assert.equal(outlet.mapping?.status, 'unresolved');
  assert.equal(a(s, 'quantities').revision, 1);
});
