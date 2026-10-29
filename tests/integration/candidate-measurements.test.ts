import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';
import {
  emptyCandidateSurvey,
  validatePropertyResearch,
  type CandidateSurvey,
  type Command,
} from '@renovagent/contracts';
import {
  candidateCheck,
  candidateMeasurement,
  candidateSurveyRefs,
  scopeAnswerRefs,
  researchJobId,
  handleCommand,
  referenceCurrent,
} from '@renovagent/core';
import { Scenario, context, openTestRepo } from '../foundation-helpers.js';
function setup() {
  const s = new Scenario();
  s.create();
  s.evidence('source');
  const p = validatePropertyResearch(
    JSON.parse(
      readFileSync(
        new URL('../../docs/evidence/muse-photo-vision/muse-vision-results.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  for (const [key, text] of [
    ['propertyAddress', p.address],
    ['goal', p.photoReview!.planning!.goal],
  ])
    s.apply(
      s.command('RecordFact', {
        scope: key === 'goal' ? 'project' : 'property',
        factId: key,
        subjectId: key === 'goal' ? 'project-a' : 'property-a',
        key,
        supersedesRevision: 0,
        value: { kind: 'text', text },
        assertion: 'user_reported',
        evidenceIds: ['source'],
      }),
    );
  p.jobId = researchJobId('project-a', 'propertyAddress', 1);
  s.artifact(
    'project-a:property-research',
    [
      { kind: 'fact', id: 'propertyAddress', revision: 1 },
      { kind: 'fact', id: 'goal', revision: 1 },
    ],
    'project-a',
    p,
  );
  return s;
}
function survey(role = 'basement'): CandidateSurvey {
  return {
    ...emptyCandidateSurvey(`location:${role}`, `Synthetic ${role} candidate`),
    shape: 'rectangular',
    measurement: 'finished',
    measuredAt: '2026-10-26',
    method: 'Synthetic test survey only; mixed units and finished boundaries.',
    doorSwing: 'reported-clear',
    values: {
      width: { amount: 4, unit: 'ft' },
      length: { amount: 2, unit: 'm' },
      minimumHeadroom: { amount: 80, unit: 'in' },
      clearDoorWidth: { amount: 32, unit: 'in' },
      approachWidth: { amount: 0.9, unit: 'm' },
      drainRun: { amount: 10, unit: 'ft' },
      drainFall: { amount: 2, unit: 'in' },
    },
  };
}
function saveCommand(
  s: Scenario,
  role = 'basement',
  data = survey(role),
  basis = 'user-reported',
): Command {
  return s.command('SaveCandidateMeasurements', {
    role,
    survey: data,
    basis,
    addressRef: {
      kind: 'fact',
      id: 'propertyAddress',
      revision: s.state.facts.propertyAddress.at(-1)!.revision,
    },
    expectedMeasurementRevision: candidateMeasurement(s.state, 'project-a', role)?.revision || 0,
    expectedOptionsRevision: s.state.artifacts['project-a:scope-options']?.at(-1)?.revision || 0,
    expectedPlanRevision: s.state.artifacts['project-a:scope-work-plan']?.at(-1)?.revision || 0,
    evidenceIds: [],
  });
}
function buildCommand(s: Scenario): Command {
  const a = s.state.artifacts['project-a:property-research'].at(-1)!;
  return s.command('BuildProjectOptions', {
    researchRef: { kind: 'artifact', id: a.id, revision: a.revision },
    answerRefs: scopeAnswerRefs(s.state, 'project-a'),
    surveyRefs: candidateSurveyRefs(s.state, 'project-a'),
    expectedOptionsRevision: s.state.artifacts['project-a:scope-options']?.at(-1)?.revision || 0,
  });
}
function build(s: Scenario) {
  s.apply(buildCommand(s));
}
function plan(s: Scenario, id = 'basement-powder') {
  const a = s.state.artifacts['project-a:scope-options'].at(-1)!;
  s.apply(
    s.command('PlanProjectOption', {
      optionsRef: { kind: 'artifact', id: a.id, revision: a.revision },
      optionId: id,
      expectedPlanRevision: s.state.artifacts['project-a:scope-work-plan']?.at(-1)?.revision || 0,
    }),
  );
}
function checks(s: Scenario, role = 'basement') {
  const p = candidateCheck(s.state, 'project-a', role)!.payload;
  if (p.kind !== 'candidate-checks') throw Error();
  return p;
}
function options(s: Scenario) {
  const p = s.state.artifacts['project-a:scope-options'].at(-1)!.payload;
  if (p.kind !== 'project-options') throw Error();
  return p;
}
function work(s: Scenario) {
  const p = s.state.artifacts['project-a:scope-work-plan'].at(-1)!.payload;
  if (p.kind !== 'project-work-plan') throw Error();
  return p;
}
const trace = (s: Scenario, label: string, role = 'basement') =>
  checks(s, role).traces.find((t) => t.label === label)!.value;
test('candidate surveys preserve units, method, date and evidence; shared arithmetic does not grant fixture, code or drainage feasibility', () => {
  const s = setup(),
    facts = structuredClone(s.state.facts),
    cmd = saveCommand(s);
  s.apply(cmd);
  const a = candidateMeasurement(s.state, 'project-a', 'basement')!;
  if (a.payload.kind !== 'candidate-measurements') throw Error();
  assert.deepEqual(a.payload.survey.values.width, { amount: 4, unit: 'ft' });
  assert.equal(a.payload.survey.measuredAt, '2026-10-26');
  assert.ok(
    s.state.evidence[a.evidenceIds[0]].source.description.includes('Synthetic test survey'),
  );
  assert.equal(trace(s, 'Floor area'), 2.4384);
  assert.equal(trace(s, 'Room perimeter'), 6.4384);
  assert.ok(Math.abs(trace(s, 'Observed drain gradient')! - 100 / 60) < 1e-12);
  assert.equal(trace(s, 'minimum observed headroom'), 2032);
  assert.equal(trace(s, 'clear doorway width'), 812.8);
  assert.equal(trace(s, 'approach / circulation width'), 900);
  assert.deepEqual(checks(s).missing, []);
  assert.equal(checks(s).checks[0].status, 'needs-review');
  for (const id of ['fixture-fit', 'drainage', 'code'])
    assert.equal(checks(s).checks.find((c) => c.id === id)?.status, 'blocked');
  assert.equal(checks(s).constructionRelease, 'blocked');
  assert.deepEqual(s.state.facts, facts);
  const brief = s.state.artifacts['project-a:working-brief'].at(-1)!;
  assert.equal(brief.freshness, 'current');
  assert.ok(JSON.stringify(brief.payload).includes('Synthetic basement candidate'));
  assert.ok(brief.inputRefs.some((r) => r.id === a.id && r.revision === 1));
});
test('saving first and revised measurements refreshes current options and the selected plan atomically, preserving accepted and downstream history', () => {
  const s = setup();
  build(s);
  plan(s);
  s.accept('project-a:scope-options');
  s.accept('project-a:scope-work-plan');
  s.artifact('downstream', [{ kind: 'artifact', id: 'project-a:scope-work-plan', revision: 1 }]);
  s.artifact('unrelated', []);
  s.apply(saveCommand(s, 'kitchen'));
  const kitchenChecks = structuredClone(candidateCheck(s.state, 'project-a', 'kitchen'));
  assert.equal(s.state.artifacts['project-a:scope-options'].at(-1)!.revision, 2);
  assert.equal(s.state.artifacts['project-a:scope-work-plan'].at(-1)!.revision, 2);
  assert.equal(s.state.artifacts.downstream.at(-1)!.freshness, 'stale');
  assert.equal(s.state.artifacts.unrelated.at(-1)!.freshness, 'current');
  assert.equal(s.state.artifacts['project-a:scope-work-plan'][0].lifecycle, 'accepted');
  assert.equal(work(s).steps.find((step) => step.id === 'survey')?.status, 'needs-input');
  s.apply(saveCommand(s));
  assert.deepEqual(candidateCheck(s.state, 'project-a', 'kitchen'), kitchenChecks);
  const surveyGate = options(s)
    .options.find((o) => o.id === 'basement-powder')!
    .dependencies.find((d) => d.id === 'survey')!;
  assert.equal(surveyGate.status, 'needs-review');
  assert.ok(surveyGate.detail.includes('2.4384 m²'));
  assert.equal(surveyGate.inputRefs.length, 4);
  assert.equal(work(s).steps.find((step) => step.id === 'survey')?.status, 'needs-review');
  assert.equal(work(s).steps.find((step) => step.id === 'survey')?.completion, 'not-reported');
  assert.ok(
    work(s)
      .steps.filter((step) =>
        ['physical-work', 'inspection', 'preparation', 'handover'].includes(step.kind),
      )
      .every((step) => step.status === 'blocked'),
  );
  assert.equal(s.state.artifacts['project-a:scope-work-plan'].at(-1)!.freshness, 'current');
  const corrected = survey();
  corrected.values.width = { amount: 5, unit: 'ft' };
  s.apply(saveCommand(s, 'basement', corrected));
  assert.equal(trace(s, 'Floor area'), 3.048);
  assert.equal(candidateMeasurement(s.state, 'project-a', 'basement')!.revision, 2);
  assert.equal(
    s.state.artifacts[candidateCheck(s.state, 'project-a', 'basement')!.id][0].freshness,
    'stale',
  );
  assert.equal(s.state.artifacts['project-a:scope-work-plan'][2].freshness, 'stale');
  assert.ok(
    s.state.messages.some((m) =>
      m.artifactRefs.some((r) => r.id === 'project-a:scope-work-plan' && r.revision === 1),
    ),
  );
});
test('rough, conflicting, partial, irregular, zero and example inputs retain uncertainty and cannot become a completed survey', () => {
  const s = setup();
  build(s);
  plan(s);
  const rough = survey();
  rough.measurement = 'rough';
  rough.measuredAt = null;
  rough.values.minimumHeadroom = null;
  s.apply(saveCommand(s, 'basement', rough));
  assert.equal(trace(s, 'Floor area'), 2.4384);
  assert.equal(checks(s).surveyBasis, 'rough');
  assert.ok(checks(s).missing.includes('minimum observed headroom'));
  const irregular = survey();
  irregular.shape = 'irregular';
  s.apply(saveCommand(s, 'basement', irregular));
  assert.equal(trace(s, 'Floor area'), null);
  assert.equal(trace(s, 'Room perimeter'), null);
  const conflicting = survey();
  conflicting.measurement = 'conflicting';
  conflicting.doorSwing = 'reported-conflict';
  s.apply(saveCommand(s, 'basement', conflicting));
  assert.equal(checks(s).checks[0].status, 'not-supported');
  const zero = survey();
  zero.values.drainFall = { amount: 0, unit: 'mm' };
  s.apply(saveCommand(s, 'basement', zero));
  assert.equal(trace(s, 'Observed drain gradient'), 0);
  zero.values.width = { amount: 0, unit: 'mm' };
  s.apply(saveCommand(s, 'basement', zero));
  assert.equal(trace(s, 'Floor area'), null);
  assert.equal(checks(s).checks[0].status, 'not-supported');
  s.apply(saveCommand(s, 'kitchen', survey('kitchen'), 'example'));
  s.apply(saveCommand(s, 'basement', survey(), 'example'));
  assert.ok(checks(s).missing.some((m) => m.includes('examples')));
  assert.equal(
    options(s)
      .options.find((o) => o.id === 'basement-powder')!
      .dependencies.find((d) => d.id === 'survey')!.status,
    'missing',
  );
  assert.equal(work(s).steps.find((step) => step.id === 'survey')!.status, 'needs-input');
});
test('stale scope work is not silently revived by a survey save; explicit rebuild fences the latest measurement set', () => {
  const s = setup();
  build(s);
  plan(s);
  s.apply(
    s.command('RecordFact', {
      scope: 'project',
      factId: 'priority',
      subjectId: 'project-a',
      key: 'priority',
      supersedesRevision: 0,
      value: { kind: 'text', text: 'Synthetic new direction' },
      assertion: 'user_reported',
      evidenceIds: ['source'],
    }),
  );
  assert.equal(s.state.artifacts['project-a:scope-options'].at(-1)!.freshness, 'stale');
  s.apply(saveCommand(s));
  assert.equal(s.state.artifacts['project-a:scope-work-plan'].length, 1);
  assert.equal(s.state.artifacts['project-a:scope-options'].length, 1);
  assert.equal(candidateCheck(s.state, 'project-a', 'basement')!.freshness, 'current');
  const oldBuild = buildCommand(s),
    next = survey();
  next.values.length = { amount: 3, unit: 'm' };
  s.apply(saveCommand(s, 'basement', next));
  oldBuild.baseRevision = s.state.projects['project-a'].revision;
  const before = structuredClone(s.state);
  assert.throws(() => s.apply(oldBuild), /survey set changed/);
  assert.deepEqual(s.state, before);
  build(s);
  plan(s);
  assert.ok(
    options(s)
      .options[2].dependencies.find((d) => d.id === 'survey')!
      .detail.includes('3.6576 m²'),
  );
});
test('survey, option, selection and property revision conflicts plus invalid observations reject without partial evidence or artifacts', () => {
  const s = setup();
  build(s);
  plan(s);
  const first = saveCommand(s);
  s.apply(first);
  assert.equal(handleCommand(s.state, first, context).duplicate, true);
  const variants: ((cmd: Extract<Command, { type: 'SaveCandidateMeasurements' }>) => void)[] = [
    (c) => {
      c.payload.expectedMeasurementRevision = 0;
    },
    (c) => {
      c.payload.expectedOptionsRevision = 0;
    },
    (c) => {
      c.payload.expectedPlanRevision = 0;
    },
    (c) => {
      c.payload.addressRef.revision = 999;
    },
    (c) => {
      c.payload.role = 'unsupported-role';
    },
    (c) => {
      c.payload.survey.method = '';
    },
    (c) => {
      c.payload.survey.measuredAt = '2099-01-01';
    },
    (c) => {
      c.payload.survey.values.width = { amount: -1, unit: 'mm' };
    },
    (c) => {
      c.payload.survey.values.width = { amount: 10001, unit: 'm' };
    },
    (c) => {
      c.payload.evidenceIds = ['missing-evidence'];
    },
    (c) => {
      c.payload.survey.values = emptyCandidateSurvey('empty', 'Empty').values;
    },
  ];
  for (const mutate of variants) {
    const cmd = saveCommand(s);
    if (cmd.type !== 'SaveCandidateMeasurements') throw Error();
    mutate(cmd);
    const before = structuredClone(s.state);
    assert.throws(() => s.apply(cmd));
    assert.deepEqual(s.state, before);
  }
  const before = structuredClone(s.state);
  const reused = structuredClone(first);
  if (reused.type !== 'SaveCandidateMeasurements') throw Error();
  reused.payload.survey.notes = 'Different retry';
  assert.throws(() => s.apply(reused), /different content/);
  assert.deepEqual(s.state, before);
  const record = candidateMeasurement(s.state, 'project-a', 'basement')!;
  assert.throws(() => s.artifact('forged-survey', [], 'project-a', record.payload), /validated/);
  assert.deepEqual(s.state, before);
  assert.throws(() => s.accept(record.id), /measurement/);
  assert.deepEqual(s.state, before);
  const wrongRole = saveCommand(s, 'kitchen', survey());
  assert.throws(() => s.apply(wrongRole), /identity cannot be reused/);
  assert.deepEqual(s.state, before);
});
test('address changes invalidate site evidence, old-address editors are fenced, goal changes do not overwrite physical surveys', () => {
  const s = setup();
  build(s);
  plan(s);
  s.apply(saveCommand(s));
  s.apply(saveCommand(s, 'kitchen'));
  const pending = saveCommand(s),
    checkId = candidateCheck(s.state, 'project-a', 'basement')!.id;
  s.apply(
    s.command('RecordFact', {
      scope: 'project',
      factId: 'goal',
      subjectId: 'project-a',
      key: 'goal',
      supersedesRevision: 1,
      value: { kind: 'text', text: 'Synthetic changed goal' },
      assertion: 'user_reported',
      evidenceIds: ['source'],
    }),
  );
  assert.equal(candidateCheck(s.state, 'project-a', 'basement')!.freshness, 'current');
  s.apply(
    s.command('RecordFact', {
      scope: 'property',
      factId: 'propertyAddress',
      subjectId: 'property-a',
      key: 'propertyAddress',
      supersedesRevision: 1,
      value: { kind: 'text', text: 'A different synthetic property address' },
      assertion: 'user_reported',
      evidenceIds: ['source'],
    }),
  );
  assert.equal(s.state.artifacts[checkId].at(-1)!.freshness, 'stale');
  if (pending.type !== 'SaveCandidateMeasurements') throw Error();
  pending.baseRevision = s.state.projects['project-a'].revision;
  pending.basePropertyRevision = s.state.properties['property-a'].revision;
  pending.payload.expectedOptionsRevision =
    s.state.artifacts['project-a:scope-options'].at(-1)!.revision;
  pending.payload.expectedPlanRevision =
    s.state.artifacts['project-a:scope-work-plan'].at(-1)!.revision;
  const before = structuredClone(s.state);
  assert.throws(() => s.apply(pending), /address changed/);
  assert.deepEqual(s.state, before);
  const replacement = {
    ...emptyCandidateSurvey('location:new-address', 'New synthetic candidate'),
    method: 'Synthetic new observation',
    values: {
      ...emptyCandidateSurvey('x', 'x').values,
      width: { amount: 1500, unit: 'mm' as const },
    },
  };
  s.apply(saveCommand(s, 'basement', replacement));
  assert.equal(candidateMeasurement(s.state, 'project-a', 'basement')!.revision, 2);
  assert.equal(trace(s, 'Floor area'), null);
  assert.equal(
    referenceCurrent(s.state, 'project-a', {
      kind: 'artifact',
      id: checkId,
      revision: candidateCheck(s.state, 'project-a', 'basement')!.revision,
    }),
    true,
  );
  assert.equal(candidateMeasurement(s.state, 'project-a', 'kitchen')!.freshness, 'stale');
});
test('three candidate histories, exact checks and refreshed work survive IndexedDB reopen and remain isolated across projects', async () => {
  const s = setup();
  build(s);
  plan(s);
  for (const role of ['kitchen', 'ground-floor', 'basement']) s.apply(saveCommand(s, role));
  const newCandidate = {
    ...emptyCandidateSurvey('location:basement-b', 'Synthetic basement B'),
    method: 'Synthetic replacement candidate',
    values: { ...emptyCandidateSurvey('x', 'x').values, width: { amount: 1, unit: 'm' as const } },
  };
  s.apply(saveCommand(s, 'basement', newCandidate));
  const a = candidateMeasurement(s.state, 'project-a', 'basement')!;
  if (a.payload.kind !== 'candidate-measurements') throw Error();
  assert.equal(a.payload.survey.values.length, null);
  assert.equal(s.state.artifacts[a.id][0].payload.kind, 'candidate-measurements');
  s.apply(
    s.command(
      'CreateProject',
      { propertyId: 'property-a', name: 'Second synthetic project', spaces: [] },
      'project-b',
    ),
  );
  assert.equal(candidateMeasurement(s.state, 'project-b', 'basement'), undefined);
  s.evidence('private-project-survey', 'project');
  const foreign = s.command(
    'SaveCandidateMeasurements',
    {
      role: 'basement',
      survey: survey(),
      basis: 'user-reported',
      addressRef: { kind: 'fact', id: 'propertyAddress', revision: 1 },
      expectedMeasurementRevision: 0,
      expectedOptionsRevision: 0,
      expectedPlanRevision: 0,
      evidenceIds: ['private-project-survey'],
    },
    'project-b',
  );
  const before = structuredClone(s.state);
  assert.throws(() => s.apply(foreign), /another project/);
  assert.deepEqual(s.state, before);
  const factory = new IDBFactory(),
    name = crypto.randomUUID();
  let repo = await openTestRepo(factory, name);
  await repo.executeBatch(s.commands, context);
  repo.close();
  repo = await openTestRepo(factory, name);
  assert.deepEqual(await repo.read(), s.state);
  repo.close();
});

test('measurement refresh keeps historical views pinned and does not discard the technical input surface', () => {
  const s = setup();
  build(s);
  plan(s);
  s.apply(saveCommand(s));
  const id = 'project-a:scope-work-plan';
  s.apply(
    s.command('SetWorkspaceView', {
      stage: 'plan',
      tab: 'work',
      surface: 'artifact',
      artifactRef: { kind: 'artifact', id, revision: 1 },
    }),
  );
  s.apply(saveCommand(s, 'kitchen'));
  assert.equal(s.state.views['project-a'].artifactRef?.revision, 1);
  assert.equal(s.state.artifacts[id].at(-1)!.revision, 3);
  s.apply(
    s.command('SetWorkspaceView', {
      stage: 'technical',
      tab: 'work',
      surface: 'overview',
      artifactRef: null,
    }),
  );
  s.apply(saveCommand(s, 'ground-floor'));
  assert.equal(s.state.views['project-a'].stage, 'technical');
  assert.equal(s.state.views['project-a'].surface, 'overview');
});
