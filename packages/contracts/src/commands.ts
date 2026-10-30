import { photoInventorySchema } from './home-inventory.js';
import { candidateSurveySchema } from './candidate-measurements.js';
import { z } from 'zod';
import { planningInputsSchema } from './planning.js';
import { id, ref, revision } from './common.js';
import { valueSchema, assertionSchema, evidenceInputSchema } from './facts.js';
import { workKindSchema, viewSchema, photoReplySchema } from './workflow.js';
import { artifactPayloadSchema } from './artifacts.js';
import { draftScopePayloadSchema } from './scope-draft.js';
import {
  buildDesignOptionsPayloadSchema,
  recordDesignPreviewPayloadSchema,
  reviseDesignOptionsPayloadSchema,
} from './design-options.js';
const envelope = {
  commandId: id,
  projectId: id,
  baseRevision: revision,
  basePropertyRevision: revision.optional(),
};
export const commandSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...envelope,
      type: z.literal('AppendMuseReply'),
      payload: z.object({ messageId: id, planRef: ref }).strict(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      type: z.literal('ImportPhotoInventory'),
      payload: z
        .object({
          researchRef: ref,
          inventory: photoInventorySchema,
          expectedInventoryRevision: revision,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      type: z.literal('SetInventoryDirection'),
      payload: z
        .object({
          inventoryRef: ref,
          itemId: id,
          expectedDirectionRevision: revision,
          disposition: z.enum(['retain', 'replace', 'investigate', 'exclude']),
          identification: z.enum(['unconfirmed', 'confirmed', 'rejected']),
          correctedLabel: z.string().trim().min(1).max(100).nullable(),
          note: z.string().trim().max(1000),
          messageId: id,
        })
        .strict(),
    })
    .strict(),

  z
    .object({
      ...envelope,
      type: z.literal('SaveCandidateMeasurements'),
      payload: z
        .object({
          role: id,
          addressRef: ref,
          survey: candidateSurveySchema,
          basis: z.enum(['user-reported', 'example']),
          expectedMeasurementRevision: revision,
          expectedOptionsRevision: revision,
          expectedPlanRevision: revision,
          evidenceIds: z.array(id),
        })
        .strict(),
    })
    .strict(),
  z
    .object({ ...envelope, type: z.literal('DraftScope'), payload: draftScopePayloadSchema })
    .strict(),
  z
    .object({
      ...envelope,
      type: z.literal('BuildDesignOptions'),
      payload: buildDesignOptionsPayloadSchema,
    })
    .strict(),
  z
    .object({
      ...envelope,
      type: z.literal('ReviseDesignOptions'),
      payload: reviseDesignOptionsPayloadSchema,
    })
    .strict(),
  z
    .object({
      ...envelope,
      type: z.literal('RecordDesignPreview'),
      payload: recordDesignPreviewPayloadSchema,
    })
    .strict(),
  z
    .object({
      ...envelope,
      type: z.literal('BuildProjectOptions'),
      payload: z
        .object({
          researchRef: ref,
          answerRefs: z.array(ref).max(6),
          surveyRefs: z.array(ref).max(3).optional(),
          expectedOptionsRevision: revision,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      type: z.literal('PlanProjectOption'),
      payload: z
        .object({
          optionsRef: ref,
          optionId: id,
          expectedPlanRevision: revision,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      type: z.literal('AnswerPhotoQuestion'),
      payload: z
        .object({
          researchRef: ref,
          questionIndex: z.number().int().min(0).max(5),
          expectedAnswerRevision: revision,
          messageId: id,
          answer: z.string().trim().min(1).max(4000),
          disposition: z.enum(['direction', 'unsure', 'deferred']),
          evidenceIds: z.array(id),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      type: z.literal('SavePlanningInputs'),
      payload: z
        .object({
          inputs: planningInputsSchema,
          basis: z.enum(['user-reported', 'example']),
          expectedInputs: z
            .object({ site: revision, layout: revision, finish: revision, context: revision })
            .strict(),
          evidenceIds: z.array(id).min(1),
        })
        .strict(),
    })
    .strict(),
  z
    .object({ ...envelope, type: z.literal('CalculatePlanning'), payload: z.object({}).strict() })
    .strict(),
  z
    .object({
      ...envelope,
      type: z.literal('AppendMessage'),
      payload: z
        .object({ messageId: id, text: z.string().min(1).max(4000), evidenceIds: z.array(id) })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      type: z.literal('SaveDraft'),
      payload: z
        .object({
          text: z.string().max(4000),
          evidenceIds: z.array(id),
          expectedDraftRevision: revision,
          photoReply: photoReplySchema.optional(),
        })
        .strict(),
    })
    .strict(),
  z.object({ ...envelope, type: z.literal('SetWorkspaceView'), payload: viewSchema }).strict(),
  z
    .object({
      ...envelope,
      type: z.literal('RequestWork'),
      payload: z.object({ runId: id, kind: workKindSchema }).strict(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      type: z.literal('TransitionRun'),
      payload: z
        .object({
          runId: id,
          expectedRunRevision: revision,
          action: z.enum(['advance', 'answer', 'retry', 'cancel', 'fail']),
          answer: z.string().max(4000).optional(),
          evidenceIds: z.array(id).optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      type: z.literal('RejectProposal'),
      payload: z
        .object({ decisionId: id, question: z.string().min(1), artifactRefs: z.array(ref).min(1) })
        .strict(),
    })
    .strict(),

  z
    .object({
      ...envelope,
      type: z.literal('CreateProject'),
      payload: z
        .object({
          propertyId: id,
          name: z.string().min(1).max(300),
          newProperty: z
            .object({ name: z.string().min(1).max(300) })
            .strict()
            .optional(),
          spaces: z.array(z.object({ id, name: z.string().min(1).max(300) }).strict()),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      type: z.literal('AttachEvidence'),
      payload: z
        .object({ scope: z.enum(['project', 'property']), evidence: evidenceInputSchema })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      type: z.literal('RecordFact'),
      payload: z
        .object({
          factId: id,
          subjectId: id,
          key: id,
          scope: z.enum(['project', 'property']),
          supersedesRevision: revision,
          value: valueSchema,
          assertion: assertionSchema,
          evidenceIds: z.array(id).min(1),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      type: z.literal('ProposeArtifact'),
      payload: z
        .object({
          artifactId: id,
          supersedesRevision: revision,
          inputRefs: z.array(ref),
          evidenceIds: z.array(id),
          content: artifactPayloadSchema,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      type: z.literal('AcceptDecision'),
      payload: z
        .object({ decisionId: id, question: z.string().min(1), artifactRefs: z.array(ref).min(1) })
        .strict(),
    })
    .strict(),
]);
export type Command = z.infer<typeof commandSchema>;
export type CommandContext = { ownerId: string; now: string };
export type ErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'IDEMPOTENCY'
  | 'STALE'
  | 'STORAGE';
export class DomainError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
