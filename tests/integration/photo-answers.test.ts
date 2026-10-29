import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';
import { validatePropertyResearch } from '@renovagent/contracts';
import { photoQuestions, researchJobId, referenceCurrent, handleCommand } from '@renovagent/core';
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
  ]) {
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
  }
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
  index = 0,
  text = '[Workflow test] Keep cabinets; countertops undecided.',
  disposition = 'direction',
  expected?: number,
) {
  const q = photoQuestions(s.state, 'project-a')[index];
  return s.command('AnswerPhotoQuestion', {
    researchRef: { kind: 'artifact', id: q.research.id, revision: q.research.revision },
    questionIndex: index,
    expectedAnswerRevision: expected ?? q.answer?.revision ?? 0,
    messageId: `response-${++s.seq}`,
    answer: text,
    disposition,
    evidenceIds: [],
  });
}
test('all six real Muse questions capture literal reported direction, revise plan and queue, preserve exact history and persist', async () => {
  const s = setup();
  const facts = structuredClone(s.state.facts);
  const questions = photoQuestions(s.state, 'project-a');
  assert.equal(questions.length, 6);
  const researchBefore = structuredClone(questions[0].research);
  const firstCommand = answer(s);
  s.apply(firstCommand);
  const first = photoQuestions(s.state, 'project-a')[0].answer!;
  let brief = s.state.artifacts['project-a:working-brief'].at(-1)!;
  assert.equal(brief.payload.kind, 'project-brief');
  assert.ok(JSON.stringify(brief.payload).includes('Keep cabinets; countertops undecided.'));
  assert.ok(JSON.stringify(brief.payload).includes('Clarify question 2:'));
  assert.ok(!JSON.stringify(brief.payload).includes('Clarify question 1:'));
  assert.ok(JSON.stringify(brief.payload).includes('Measurement still required'));
  assert.ok(brief.inputRefs.some((r) => r.id === first.id && r.revision === 1));
  s.accept('project-a:working-brief');
  const acceptedRevision = brief.revision;
  s.artifact('downstream', [{ kind: 'artifact', id: brief.id, revision: brief.revision }]);
  s.artifact('unrelated', []);
  s.apply(answer(s, 0, '[Workflow test] Replace the cabinets instead.'));
  assert.equal(s.state.artifacts[first.id].length, 2);
  assert.equal(s.state.artifacts[first.id][0].payload.kind, 'photo-planning-answer');
  assert.equal(s.state.artifacts['downstream'].at(-1)!.freshness, 'stale');
  assert.equal(s.state.artifacts['unrelated'].at(-1)!.freshness, 'current');
  const historical = s.state.artifacts[brief.id].find((a) => a.revision === acceptedRevision)!;
  assert.equal(historical.lifecycle, 'accepted');
  assert.equal(historical.freshness, 'stale');
  assert.ok(JSON.stringify(historical.payload).includes('Keep cabinets; countertops undecided.'));
  assert.equal(
    s.state.messages.find(
      (m) =>
        m.id ===
        (firstCommand.type === 'AnswerPhotoQuestion' ? firstCommand.payload.messageId : ''),
    )?.artifactRefs[0].revision,
    1,
  );
  for (let i = 1; i < 6; i++) s.apply(answer(s, i, `[Workflow test] Direction ${i + 1}`));
  brief = s.state.artifacts[brief.id].at(-1)!;
  assert.ok(JSON.stringify(brief.payload).includes('Review the captured direction together'));
  assert.ok(JSON.stringify(brief.payload).includes('Measurement still required'));
  assert.deepEqual(s.state.facts, facts);
  assert.deepEqual(s.state.artifacts[researchBefore.id].at(-1), researchBefore);
  const factory = new IDBFactory();
  const name = crypto.randomUUID();
  let repo = await openTestRepo(factory, name);
  await repo.executeBatch(s.commands, context);
  repo.close();
  repo = await openTestRepo(factory, name);
  const restored = await repo.read();
  assert.deepEqual(restored, s.state);
  repo.close();
});
test('unsure and deferred responses remain open; revisions, retries and stale writes are atomic', () => {
  const s = setup();
  const cmd = answer(s, 0, '[Workflow test] I need to inspect the kitchen.', 'unsure');
  s.apply(cmd);
  assert.equal(handleCommand(s.state, cmd, context).duplicate, true);
  assert.ok(
    JSON.stringify(s.state.artifacts['project-a:working-brief'].at(-1)!.payload).includes(
      'Clarify question 1:',
    ),
  );
  s.apply(answer(s, 1, '[Workflow test] Defer until measurements.', 'deferred'));
  const before = structuredClone(s.state);
  assert.throws(() => s.accept(photoQuestions(s.state, 'project-a')[0].id), /user response/);
  assert.deepEqual(s.state, before);
  assert.throws(
    () => s.apply(answer(s, 0, 'Concurrent overwrite', 'direction', 0)),
    /answer has changed/,
  );
  assert.deepEqual(s.state, before);
  const reused = structuredClone(cmd);
  if (reused.type !== 'AnswerPhotoQuestion') throw Error();
  reused.payload.answer = 'Different payload under the same ID';
  assert.throws(() => s.apply(reused), /different|reused/i);
  assert.deepEqual(s.state, before);
  assert.throws(
    () =>
      s.apply(
        s.command('AnswerPhotoQuestion', {
          ...cmd.payload,
          messageId: 'bad-attachment-response',
          expectedAnswerRevision: 1,
          evidenceIds: ['missing-evidence'],
        }),
      ),
    /Missing evidence/,
  );
  assert.deepEqual(s.state, before);
  const wrongQuestion = answer(s);
  if (wrongQuestion.type !== 'AnswerPhotoQuestion') throw Error();
  wrongQuestion.payload.questionIndex = 5;
  wrongQuestion.payload.researchRef.revision = 999;
  assert.throws(() => s.apply(wrongQuestion));
  assert.deepEqual(s.state, before);
  assert.throws(
    () =>
      s.artifact(
        'forged-answer',
        [],
        'project-a',
        photoQuestions(s.state, 'project-a')[0].answer!.payload,
      ),
    /Use AnswerPhotoQuestion/,
  );
  assert.deepEqual(s.state, before);
});
test('new research requires reconfirmation, and goal or address edits block old answers and remove stale direction from current plan', () => {
  for (const change of ['research', 'goal', 'propertyAddress']) {
    const s = setup();
    s.apply(answer(s));
    const staleCommand = answer(s, 1);
    if (change === 'research') {
      const old = photoQuestions(s.state, 'project-a')[0].research;
      s.artifact(old.id, old.inputRefs, 'project-a', old.payload);
      assert.equal(photoQuestions(s.state, 'project-a')[0].answer, undefined);
    } else
      s.apply(
        s.command('RecordFact', {
          scope: change === 'goal' ? 'project' : 'property',
          factId: change,
          subjectId: change === 'goal' ? 'project-a' : 'property-a',
          key: change,
          supersedesRevision: 1,
          value: { kind: 'text', text: '[Workflow test] Changed context' },
          assertion: 'user_reported',
          evidenceIds: ['source'],
        }),
      );
    // Use current project revision to isolate source freshness guard from optimistic concurrency.
    staleCommand.baseRevision = s.state.projects['project-a'].revision;
    const before = structuredClone(s.state);
    assert.throws(() => s.apply(staleCommand), /review changed/);
    assert.deepEqual(s.state, before);
    const oldAnswer = Object.values(s.state.artifacts)
      .flat()
      .find((a) => a.payload.kind === 'photo-planning-answer')!;
    assert.equal(
      referenceCurrent(s.state, 'project-a', {
        kind: 'artifact',
        id: oldAnswer.id,
        revision: oldAnswer.revision,
      }),
      false,
    );
    const plan = s.state.artifacts['project-a:working-brief'].at(-1)!;
    const direction =
      plan.payload.kind === 'project-brief' &&
      plan.payload.sections.find(
        (section) => section.title === 'Your direction from the photo review',
      );
    assert.ok(direction && direction.text.includes('need reconfirmation'));
    assert.ok(!direction.text.includes('Keep cabinets'));
  }
});
test('workflow proposals and late simulated output invalidate on direction changes; historical views stay pinned and drafts retain question context', async () => {
  const s = setup();
  const brief = s.state.artifacts['project-a:working-brief'].at(-1)!;
  s.apply(
    s.command('SetWorkspaceView', {
      stage: 'brief',
      tab: 'work',
      surface: 'artifact',
      artifactRef: { kind: 'artifact', id: brief.id, revision: brief.revision },
    }),
  );
  const q = photoQuestions(s.state, 'project-a')[0];
  s.apply(
    s.command('SaveDraft', {
      text: '[Workflow test] Draft for question one.',
      evidenceIds: [],
      expectedDraftRevision: 0,
      photoReply: {
        researchId: q.research.id,
        researchRevision: 1,
        questionIndex: 0,
        expectedAnswerRevision: 0,
        disposition: 'unsure',
      },
    }),
  );
  const factory = new IDBFactory();
  const name = crypto.randomUUID();
  let repo = await openTestRepo(factory, name);
  await repo.executeBatch(s.commands, context);
  repo.close();
  repo = await openTestRepo(factory, name);
  assert.deepEqual((await repo.read()).drafts, s.state.drafts);
  repo.close();
  const run = (id: string, finish: boolean) => {
    s.apply(s.command('RequestWork', { runId: id, kind: 'options' }));
    const transition = (action: string) =>
      s.apply(
        s.command('TransitionRun', {
          runId: id,
          expectedRunRevision: s.state.runs[id].revision,
          action,
          ...(action === 'answer'
            ? { answer: '[Workflow test] Keep unknown conditions open.' }
            : {}),
        }),
      );
    transition('advance');
    transition('advance');
    transition('answer');
    if (finish) transition('advance');
    return transition;
  };
  run('completed-proposal', true);
  const proposal = s.state.runs['completed-proposal'].outputRef!;
  s.accept(proposal.id);
  const advance = run('late-proposal', false);
  s.apply(answer(s));
  const currentBrief = s.state.artifacts[brief.id].at(-1)!;
  assert.equal(s.state.views['project-a'].artifactRef?.revision, currentBrief.revision);
  assert.equal(s.state.drafts['project-a'].photoReply, undefined);
  assert.equal(s.state.artifacts[proposal.id][0].freshness, 'stale');
  assert.equal(s.state.artifacts[proposal.id][0].lifecycle, 'accepted');
  assert.throws(() => s.accept(proposal.id), /stale/);
  advance('advance');
  assert.equal(s.state.runs['late-proposal'].state, 'failed');
  assert.equal(s.state.runs['late-proposal'].outputRef, null);
  s.apply(
    s.command('SetWorkspaceView', {
      stage: 'brief',
      tab: 'work',
      surface: 'artifact',
      artifactRef: { kind: 'artifact', id: brief.id, revision: brief.revision },
    }),
  );
  s.apply(answer(s, 0, '[Workflow test] Corrected direction.'));
  assert.equal(s.state.views['project-a'].artifactRef?.revision, brief.revision);
});
