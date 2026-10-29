import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';
import {
  validatePropertyResearch,
  type Command,
  type ArtifactPayload,
} from '@renovagent/contracts';
import {
  scopeAnswerRefs,
  photoQuestions,
  researchJobId,
  handleCommand,
  scopePlanningCoverage,
  validateScopeSequence,
  referenceCurrent,
} from '@renovagent/core';
import { Scenario, context, openTestRepo } from '../foundation-helpers.js';
function setup() {
  const s = new Scenario();
  s.create();
  s.evidence('source');
  const research = validatePropertyResearch(
    JSON.parse(
      readFileSync(
        new URL('../../docs/evidence/muse-photo-vision/muse-vision-results.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  for (const [key, text] of [
    ['propertyAddress', research.address],
    ['goal', research.photoReview!.planning!.goal],
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
  research.jobId = researchJobId('project-a', 'propertyAddress', 1);
  s.artifact(
    'project-a:property-research',
    [
      { kind: 'fact', id: 'propertyAddress', revision: 1 },
      { kind: 'fact', id: 'goal', revision: 1 },
    ],
    'project-a',
    research,
  );
  return s;
}
function answer(
  s: Scenario,
  index: number,
  text = `[Workflow test] Direction ${index + 1}`,
  disposition = 'direction',
) {
  const q = photoQuestions(s.state, 'project-a')[index];
  s.apply(
    s.command('AnswerPhotoQuestion', {
      researchRef: { kind: 'artifact', id: q.research.id, revision: q.research.revision },
      questionIndex: index,
      expectedAnswerRevision: q.answer?.revision || 0,
      messageId: `response-${++s.seq}`,
      answer: text,
      disposition,
      evidenceIds: [],
    }),
  );
}
function buildCommand(s: Scenario) {
  const source = s.state.artifacts['project-a:property-research'].at(-1)!;
  return s.command('BuildProjectOptions', {
    researchRef: { kind: 'artifact', id: source.id, revision: source.revision },
    answerRefs: scopeAnswerRefs(s.state, 'project-a'),
    expectedOptionsRevision: s.state.artifacts['project-a:scope-options']?.at(-1)?.revision || 0,
  });
}
function build(s: Scenario) {
  s.apply(buildCommand(s));
  return s.state.artifacts['project-a:scope-options'].at(-1)!;
}
function planCommand(s: Scenario, id = 'ground-floor-powder'): Command {
  const options = s.state.artifacts['project-a:scope-options'].at(-1)!;
  return s.command('PlanProjectOption', {
    optionsRef: { kind: 'artifact', id: options.id, revision: options.revision },
    optionId: id,
    expectedPlanRevision: s.state.artifacts['project-a:scope-work-plan']?.at(-1)?.revision || 0,
  });
}
function plan(s: Scenario, id?: string) {
  s.apply(planCommand(s, id));
  return s.state.artifacts['project-a:scope-work-plan'].at(-1)!;
}
test('real saved question direction compiles three distinct sourced options without assuming yes/no, measurements or feasibility', () => {
  const s = setup();
  const facts = structuredClone(s.state.facts);
  answer(s, 0, '[Workflow test] Replace cabinets; keep the sink only if services are suitable.');
  answer(s, 3, '[Workflow test] Basement undecided until we know the drainage.', 'unsure');
  answer(s, 4, '[Workflow test] Do not use the understair area; compare another ground-floor bay.');
  const options = build(s);
  assert.equal(options.payload.kind, 'project-options');
  if (options.payload.kind !== 'project-options') throw Error();
  assert.deepEqual(
    options.payload.options.map((o) => o.id),
    ['kitchen-only', 'ground-floor-powder', 'basement-powder'],
  );
  assert.equal(options.payload.constructionRelease, 'blocked');
  const [kitchen, ground, basement] = options.payload.options;
  assert.ok(kitchen.exclusions.includes('New powder-room construction.'));
  assert.ok(
    ground.dependencies
      .find((d) => d.id === 'survey')
      ?.detail.includes('sloping/finished headroom'),
  );
  assert.ok(
    basement.dependencies.find((d) => d.id === 'survey')?.detail.includes('floor/elevation survey'),
  );
  assert.ok(
    basement.dependencies
      .find((d) => d.id === 'feasibility')
      ?.detail.includes('Gravity drainage or a pumping solution remains unsupported'),
  );
  for (const o of options.payload.options) {
    assert.equal(o.fit, 'needs-reconciliation');
    assert.equal(o.feasibility, 'blocked');
    const reported = o.dependencies.find((d) => d.id === 'direction-0')!;
    assert.ok(
      reported.detail.includes('Replace cabinets; keep the sink only if services are suitable.'),
    );
    assert.equal(reported.inputRefs[0].revision, 1);
    assert.ok(reported.photoIds.includes('listing-photo-11'));
    assert.equal(o.dependencies.find((d) => d.id === 'code')?.status, 'unsupported');
    assert.deepEqual(o.dependencies.find((d) => d.id === 'code')?.photoIds, []);
    assert.equal(o.dependencies.find((d) => d.id === 'scope-fit')?.status, 'needs-review');
  }
  assert.ok(
    ground.dependencies
      .find((d) => d.id === 'direction-4')
      ?.detail.includes('Do not use the understair area'),
  );
  assert.equal(basement.dependencies.find((d) => d.id === 'direction-3')?.status, 'missing');
  assert.equal(s.state.messages.at(-1)?.mode, 'system');
  assert.deepEqual(s.state.facts, facts);
});
test('all option sequences retain survey/services joins, inspection holds and physical-work blocks, even with all direction reported', async () => {
  const s = setup();
  for (let i = 0; i < 6; i++) answer(s, i);
  const source = build(s);
  const snapshot = structuredClone(s.state.facts);
  for (const id of ['kitchen-only', 'ground-floor-powder', 'basement-powder']) {
    const artifact = plan(s, id);
    if (artifact.payload.kind !== 'project-work-plan') throw Error();
    const p = artifact.payload;
    assert.equal(p.constructionRelease, 'blocked');
    assert.deepEqual(p.steps.find((step) => step.id === 'design')?.dependsOn, [
      'survey',
      'services',
    ]);
    assert.deepEqual(p.steps.find((step) => step.id === 'finish')?.dependsOn, ['rough-hold']);
    assert.ok(
      p.steps.every((step) => step.completion === 'not-reported' && step.blockers.length > 0),
    );
    assert.ok(
      p.steps
        .filter((step) =>
          ['physical-work', 'preparation', 'inspection', 'handover'].includes(step.kind),
        )
        .every((step) => step.status === 'blocked'),
    );
    assert.equal(artifact.inputRefs[0].id, source.id);
    assert.equal(artifact.inputRefs[0].revision, source.revision);
    assert.equal(artifact.freshness, 'current');
    assert.doesNotThrow(() => validateScopeSequence(p.steps));
    const bad = structuredClone(p.steps);
    bad[0].dependsOn = ['finish'];
    assert.throws(() => validateScopeSequence(bad), /acyclic/);
    const released = structuredClone(p.steps);
    released.find((step) => step.id === 'rough')!.status = 'needs-input';
    assert.throws(() => validateScopeSequence(released), /cannot be released/);
  }
  assert.deepEqual(s.state.facts, snapshot);
  const factory = new IDBFactory(),
    name = crypto.randomUUID();
  let repo = await openTestRepo(factory, name);
  await repo.executeBatch(s.commands, context);
  repo.close();
  repo = await openTestRepo(factory, name);
  assert.deepEqual(await repo.read(), s.state);
  repo.close();
});
test('first answers and corrections invalidate option/plan descendants, preserve accepted history and block stale selection', () => {
  const s = setup();
  const options = build(s);
  const work = plan(s);
  s.accept(options.id);
  s.accept(work.id);
  s.artifact('downstream', [{ kind: 'artifact', id: work.id, revision: work.revision }]);
  s.artifact('unrelated', []);
  answer(s, 0, '[Workflow test] Newly reported kitchen scope.');
  for (const id of [options.id, work.id, 'downstream'])
    assert.equal(s.state.artifacts[id].at(-1)?.freshness, 'stale');
  assert.equal(s.state.artifacts['unrelated'].at(-1)?.freshness, 'current');
  const before = structuredClone(s.state);
  assert.throws(() => s.apply(planCommand(s)), /stale/);
  assert.deepEqual(s.state, before);
  assert.throws(() => s.accept(work.id), /stale/);
  assert.deepEqual(s.state, before);
  const rebuilt = build(s);
  plan(s, 'basement-powder');
  assert.equal(rebuilt.revision, 2);
  assert.equal(s.state.artifacts[work.id].at(-1)?.revision, 2);
  assert.equal(s.state.artifacts[work.id][0].lifecycle, 'accepted');
  assert.equal(
    s.state.messages.find((m) => m.artifactRefs.some((r) => r.id === work.id && r.revision === 1))
      ?.artifactRefs[0].revision,
    1,
  );
  answer(s, 0, '[Workflow test] Corrected kitchen scope.');
  assert.equal(s.state.artifacts[options.id].at(-1)?.freshness, 'stale');
  assert.equal(s.state.artifacts[work.id].at(-1)?.freshness, 'stale');
});
test('optimistic source/answer/target guards, idempotency and unsupported recipes reject atomically without fixture fallback', () => {
  const s = setup();
  const cmd = buildCommand(s);
  s.apply(cmd);
  assert.equal(handleCommand(s.state, cmd, context).duplicate, true);
  const pending = buildCommand(s);
  answer(s, 0);
  pending.baseRevision = s.state.projects['project-a'].revision;
  const before = structuredClone(s.state);
  assert.throws(() => s.apply(pending), /answers changed/);
  assert.deepEqual(s.state, before);
  build(s);
  const invalid = planCommand(s, 'unknown-option');
  const beforeBad = structuredClone(s.state);
  assert.throws(() => s.apply(invalid), /does not exist/);
  assert.deepEqual(s.state, beforeBad);
  const fake: ArtifactPayload = s.state.artifacts['project-a:scope-options'].at(-1)!.payload;
  assert.throws(() => s.artifact('forged-options', [], 'project-a', fake), /validated project/);
  assert.deepEqual(s.state, beforeBad);
  const staleTarget = buildCommand(s);
  build(s);
  staleTarget.baseRevision = s.state.projects['project-a'].revision;
  const latest = structuredClone(s.state);
  assert.throws(() => s.apply(staleTarget), /changed/);
  assert.deepEqual(s.state, latest);
  const source = s.state.artifacts['project-a:property-research'].at(-1)!;
  const p = structuredClone(source.payload);
  if (p.kind !== 'property-research') throw Error();
  p.photoReview!.planning!.questions[0].text =
    'A different project question with no supported semantic binding?';
  p.nextQuestions[0] = p.photoReview!.planning!.questions[0].text;
  s.artifact(source.id, source.inputRefs, 'project-a', p);
  assert.equal(scopePlanningCoverage(s.state, 'project-a').supported, false);
  const unsupported = structuredClone(s.state);
  assert.throws(() => s.apply(buildCommand(s)), /reviewed recipe binding/);
  assert.deepEqual(s.state, unsupported);
});
test('source, address and goal changes stale derived options and work; old source refs cannot generate a current plan', () => {
  for (const key of ['source', 'goal', 'propertyAddress']) {
    const s = setup();
    answer(s, 0);
    const options = build(s);
    const work = plan(s);
    const source = s.state.artifacts['project-a:property-research'].at(-1)!;
    if (key === 'source') s.artifact(source.id, source.inputRefs, 'project-a', source.payload);
    else
      s.apply(
        s.command('RecordFact', {
          scope: key === 'goal' ? 'project' : 'property',
          factId: key,
          subjectId: key === 'goal' ? 'project-a' : 'property-a',
          key,
          supersedesRevision: 1,
          value: { kind: 'text', text: '[Workflow test] Changed scope/location' },
          assertion: 'user_reported',
          evidenceIds: ['source'],
        }),
      );
    assert.equal(s.state.artifacts[options.id].at(-1)?.freshness, 'stale');
    assert.equal(s.state.artifacts[work.id].at(-1)?.freshness, 'stale');
    if (key !== 'source')
      assert.throws(() => s.apply(buildCommand(s)), /current property research/);
    else {
      const rebuilt = build(s);
      assert.ok(!JSON.stringify(rebuilt.payload).includes('[Workflow test] Direction 1'));
    }
  }
});

test('foreign project selection and obsolete recipe revisions cannot produce a current work plan', () => {
  const s = setup();
  const options = build(s);
  plan(s);
  s.apply(
    s.command(
      'CreateProject',
      { propertyId: 'property-a', name: 'Foreign selection test', spaces: [] },
      'project-b',
    ),
  );
  const before = structuredClone(s.state);
  const foreign = s.command(
    'PlanProjectOption',
    {
      optionsRef: { kind: 'artifact', id: options.id, revision: options.revision },
      optionId: 'basement-powder',
      expectedPlanRevision: 0,
    },
    'project-b',
  );
  assert.throws(() => s.apply(foreign), /this project/);
  assert.deepEqual(s.state, before);
  const obsolete = structuredClone(s.state);
  const old = obsolete.artifacts[options.id].at(-1)!;
  if (old.payload.kind !== 'project-options') throw Error();
  old.payload.recipe = 'kitchen-powder-study/obsolete';
  assert.equal(
    referenceCurrent(obsolete, 'project-a', {
      kind: 'artifact',
      id: old.id,
      revision: old.revision,
    }),
    false,
  );
  const command = planCommand(s);
  assert.throws(() => handleCommand(obsolete, command, context), /stale/);
});
test('semantic recipe bindings follow question identity when Muse question order changes', () => {
  const s = setup();
  const source = s.state.artifacts['project-a:property-research'].at(-1)!;
  const content = structuredClone(source.payload);
  if (content.kind !== 'property-research') throw Error();
  content.photoReview!.planning!.questions.reverse();
  content.nextQuestions = content.photoReview!.planning!.questions.map((q) => q.text);
  s.artifact(source.id, source.inputRefs, 'project-a', content);
  const index = photoQuestions(s.state, 'project-a').findIndex((q) =>
    q.text.startsWith('Which kitchen elements'),
  );
  assert.equal(index, 5);
  answer(s, index, '[Workflow test] Reordered kitchen response.');
  const options = build(s);
  if (options.payload.kind !== 'project-options') throw Error();
  const direction = options.payload.options[0].dependencies.find((d) => d.id === 'direction-0')!;
  assert.ok(direction.detail.includes('Reordered kitchen response.'));
  assert.equal(direction.inputRefs[0].id, photoQuestions(s.state, 'project-a')[5].answer!.id);
  assert.ok(direction.photoIds.includes('listing-photo-11'));
});
