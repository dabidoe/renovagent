import {
  DomainError,
  type Workspace,
  type Command,
  type CommandContext,
} from '@unpermitted/contracts';
import { referenceCurrent, resolveRef } from '../domain/invalidate.js';
import { addMessage } from '../domain/workflow.js';
export const photoAnswerId = (researchId: string, revision: number, index: number) =>
  `${researchId}:r${revision}:question:${index}`;
export function photoQuestions(state: Workspace, projectId: string) {
  const research = state.artifacts[`${projectId}:property-research`]?.at(-1);
  if (!research || research.payload.kind !== 'property-research') return [];
  const review = research.payload.photoReview;
  return (review?.planning?.questions || []).map((question, index) => {
    const id = photoAnswerId(research.id, research.revision, index);
    const answer = state.artifacts[id]?.at(-1);
    return {
      ...question,
      index,
      id,
      research,
      answer,
      current: referenceCurrent(state, projectId, {
        kind: 'artifact',
        id: research.id,
        revision: research.revision,
      }),
      photos: review!.photos.filter((p) => question.photoIds.includes(p.id)),
    };
  });
}
export function answerPhotoQuestion(
  state: Workspace,
  command: Extract<Command, { type: 'AnswerPhotoQuestion' }>,
  ctx: CommandContext,
) {
  const p = command.payload;
  if (p.researchRef.kind !== 'artifact')
    throw new DomainError('VALIDATION', 'A research artifact is required');
  const source = resolveRef(state, command.projectId, p.researchRef);
  if (
    !('payload' in source) ||
    source.id !== `${command.projectId}:property-research` ||
    source.payload.kind !== 'property-research'
  )
    throw new DomainError('VALIDATION', 'Expected this project’s photo research');
  if (!referenceCurrent(state, command.projectId, p.researchRef))
    throw new DomainError(
      'STALE',
      'The Muse review changed. Reopen the current question before answering.',
    );
  const question = source.payload.photoReview?.planning?.questions[p.questionIndex];
  if (!question) throw new DomainError('VALIDATION', 'Question does not exist in this review');
  const id = photoAnswerId(source.id, source.revision, p.questionIndex);
  const old = state.artifacts[id]?.at(-1);
  if ((old?.revision || 0) !== p.expectedAnswerRevision)
    throw new DomainError(
      'CONFLICT',
      'This answer has changed. Review the saved response before revising.',
    );
  if (old && old.payload.kind !== 'photo-planning-answer')
    throw new DomainError('CONFLICT', 'Response identity is occupied by another artifact');
  const revision = (old?.revision || 0) + 1;
  const text = `Muse photo question ${p.questionIndex + 1}: ${question.text}\n${p.disposition === 'direction' ? 'Reported direction' : p.disposition === 'unsure' ? 'Still unsure' : 'Deferred'}: ${p.answer}`;
  addMessage(state, command.projectId, p.messageId, text, ctx, {
    user: true,
    evidenceIds: p.evidenceIds,
    artifactRefs: [{ kind: 'artifact', id, revision }],
  });
  (state.artifacts[id] ||= []).push({
    schemaVersion: 1,
    id,
    projectId: command.projectId,
    revision,
    lifecycle: 'proposed',
    freshness: 'current',
    createdAt: ctx.now,
    acceptedAt: null,
    inputRefs: [p.researchRef],
    evidenceIds: [p.messageId, ...p.evidenceIds],
    payload: {
      kind: 'photo-planning-answer',
      questionIndex: p.questionIndex,
      question: question.text,
      photoIds: question.photoIds,
      answer: p.answer,
      disposition: p.disposition,
      verification: 'user-reported',
    },
  });
  state.drafts[command.projectId] = {
    text: '',
    evidenceIds: [],
    revision: (state.drafts[command.projectId]?.revision || 0) + 1,
  };
  return id;
}
