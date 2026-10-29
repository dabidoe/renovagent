import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyCandidateSurvey, validatePropertyResearch } from '@renovagent/contracts';
import {
  photoQuestions,
  scopeAnswerRefs,
  candidateSurveyRefs,
  researchJobId,
} from '@renovagent/core';
import { Scenario } from '../foundation-helpers.js';
import { homePlanModel } from '../../apps/web/src/features/work/home-plan-model.js';
function setup(reverseQuestions = false) {
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
  if (reverseQuestions) p.photoReview!.planning!.questions.reverse();
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

function answer(s: Scenario, value: string, disposition: 'direction' | 'unsure' = 'direction') {
  const q = photoQuestions(s.state, 'project-a')[0];
  s.apply(
    s.command('AnswerPhotoQuestion', {
      researchRef: { kind: 'artifact', id: q.research.id, revision: q.research.revision },
      questionIndex: 0,
      expectedAnswerRevision: q.answer?.revision || 0,
      messageId: `reply-${++s.seq}`,
      answer: value,
      disposition,
      evidenceIds: [],
    }),
  );
}
function choose(s: Scenario, id = 'basement-powder') {
  const research = s.state.artifacts['project-a:property-research'].at(-1)!;
  s.apply(
    s.command('BuildProjectOptions', {
      researchRef: { kind: 'artifact', id: research.id, revision: research.revision },
      answerRefs: scopeAnswerRefs(s.state, 'project-a'),
      surveyRefs: candidateSurveyRefs(s.state, 'project-a'),
      expectedOptionsRevision: s.state.artifacts['project-a:scope-options']?.at(-1)?.revision || 0,
    }),
  );
  const options = s.state.artifacts['project-a:scope-options'].at(-1)!;
  s.apply(
    s.command('PlanProjectOption', {
      optionsRef: { kind: 'artifact', id: options.id, revision: options.revision },
      optionId: id,
      expectedPlanRevision: s.state.artifacts['project-a:scope-work-plan']?.at(-1)?.revision || 0,
    }),
  );
}
function measure(
  s: Scenario,
  basis: 'example' | 'user-reported',
  shape: 'rectangular' | 'irregular' = 'rectangular',
  amount = 120,
) {
  const m = homePlanModel(s.state, 'project-a');
  const old = m.survey?.payload;
  const survey =
    old?.kind === 'candidate-measurements'
      ? structuredClone(old.survey)
      : emptyCandidateSurvey('location:qa', 'QA footprint');
  survey.shape = shape;
  survey.measurement = 'finished';
  survey.method = 'Synthetic test survey; not owner observations';
  survey.values.width = { amount, unit: 'in' };
  survey.values.length = { amount: 96, unit: 'in' };
  s.apply(
    s.command('SaveCandidateMeasurements', {
      role: m.role,
      survey,
      basis,
      addressRef: { kind: 'fact', id: 'propertyAddress', revision: 1 },
      expectedMeasurementRevision: m.survey?.revision || 0,
      expectedOptionsRevision: s.state.artifacts['project-a:scope-options']?.at(-1)?.revision || 0,
      expectedPlanRevision: s.state.artifacts['project-a:scope-work-plan']?.at(-1)?.revision || 0,
      evidenceIds: [],
    }),
  );
}
test('home workflow advances from literal direction to a selected study to a footprint and a bounded investigation', () => {
  const s = setup();
  assert.equal(homePlanModel(s.state, 'project-a').next, 'direction');
  answer(s, 'Do not interpret this as approval; compare retaining the kitchen layout.', 'unsure');
  assert.equal(homePlanModel(s.state, 'project-a').next, 'study');
  choose(s);
  assert.equal(homePlanModel(s.state, 'project-a').role, 'basement');
  assert.equal(homePlanModel(s.state, 'project-a').next, 'measure');
  measure(s, 'example');
  assert.equal(
    homePlanModel(s.state, 'project-a').next,
    'measure',
    'examples cannot stand in for real measurements',
  );
  measure(s, 'user-reported', 'irregular');
  assert.equal(
    homePlanModel(s.state, 'project-a').next,
    'measure',
    'irregular footprint needs a measured drawing, not a rectangle assumption',
  );
  measure(s, 'user-reported');
  assert.equal(homePlanModel(s.state, 'project-a').next, 'investigate');
  const old = s.state.artifacts['project-a:scope-work-plan'].at(-1)!;
  measure(s, 'user-reported', 'rectangular', 100);
  assert.equal(
    s.state.artifacts[old.id].find((a) => a.revision === old.revision)!.freshness,
    'stale',
  );
  assert.equal(homePlanModel(s.state, 'project-a').next, 'investigate');
  const checks = s.state.artifacts['project-a:survey-checks:basement'].at(-1)!;
  assert.equal(checks.payload.kind, 'candidate-checks');
  if (checks.payload.kind === 'candidate-checks')
    assert.equal(checks.payload.feasibility, 'blocked');
});
test('changed direction stops displaying the old study as current; changed property fences the whole proposal', () => {
  const s = setup();
  answer(s, 'Compare the main layout');
  choose(s);
  measure(s, 'user-reported');
  answer(s, 'Reconsider the kitchen scope');
  assert.equal(homePlanModel(s.state, 'project-a').selection, null);
  assert.equal(homePlanModel(s.state, 'project-a').next, 'study');
  assert.equal(homePlanModel(s.state, 'project-a').options, undefined);
  s.apply(
    s.command('RecordFact', {
      scope: 'property',
      factId: 'propertyAddress',
      subjectId: 'property-a',
      key: 'propertyAddress',
      supersedesRevision: 1,
      value: { kind: 'text', text: 'Different property' },
      assertion: 'user_reported',
      evidenceIds: ['source'],
    }),
  );
  const m = homePlanModel(s.state, 'project-a');
  assert.equal(m.next, 'research');
  assert.equal(m.research, undefined);
  assert.equal(m.survey, undefined);
});

test('study selection, compiled records and home view commit atomically and survive repository reopen', async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  const { openTestRepo, context } = await import('../foundation-helpers.js');
  const { WorkspaceController } = await import('../../apps/web/src/app/workspace-controller.js');
  const s = setup();
  answer(s, 'QA direction only');
  const factory = new IDBFactory(),
    name = crypto.randomUUID();
  const repo = await openTestRepo(factory, name);
  await repo.executeBatch(s.commands, context);
  const c = new WorkspaceController(repo, await repo.read());
  const research = s.state.artifacts['project-a:property-research'].at(-1)!;
  const ref = { kind: 'artifact' as const, id: research.id, revision: research.revision };
  const args = [
    ref,
    scopeAnswerRefs(s.state, 'project-a'),
    candidateSurveyRefs(s.state, 'project-a'),
    0,
    0,
  ] as const;
  await assert.rejects(c.selectHomeStudy('project-a', 'unknown-option', ...args));
  assert.equal(
    (await repo.read()).artifacts['project-a:scope-options'],
    undefined,
    'failed selection rolls back the compiled options too',
  );
  await c.selectHomeStudy('project-a', 'basement-powder', ...args);
  const before = await repo.read();
  assert.equal(before.views['project-a'].surface, 'overview');
  assert.equal(before.views['project-a'].stage, 'options');
  assert.equal(homePlanModel(before, 'project-a').selection, 'basement-powder');
  repo.close();
  const reopened = await openTestRepo(factory, name);
  assert.deepEqual(await reopened.read(), before);
  reopened.close();
});

test('focused question labels and choices follow semantic identity when imported questions are reordered', () => {
  const s = setup(true);
  const m = homePlanModel(s.state, 'project-a');
  assert.match(m.questions[0].text, /Which kitchen elements must stay/);
  assert.equal(m.questions[0].index, 5, 'submission must use the original imported index');
  const q = m.questions[0];
  s.apply(
    s.command('AnswerPhotoQuestion', {
      researchRef: { kind: 'artifact', id: q.research.id, revision: q.research.revision },
      questionIndex: q.index,
      expectedAnswerRevision: 0,
      messageId: 'semantic-kitchen-reply',
      answer: 'QA only: keep kitchen layout',
      disposition: 'direction',
      evidenceIds: [],
    }),
  );
  assert.equal(homePlanModel(s.state, 'project-a').next, 'study');
  const answer = homePlanModel(s.state, 'project-a').questions[0].answer!.payload;
  assert.equal(answer.kind, 'photo-planning-answer');
  if (answer.kind === 'photo-planning-answer')
    assert.match(answer.question, /Which kitchen elements must stay/);
});
