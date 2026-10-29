import { z } from 'zod';
import { id, ref, stamp } from './common.js';
export const workKindSchema = z.enum([
  'brief',
  'options',
  'technical',
  'plan',
  'procurement',
  'execution',
  'handover',
]);
export const runStateSchema = z.enum([
  'queued',
  'running',
  'waiting_for_input',
  'waiting_for_approval',
  'succeeded',
  'failed',
  'cancelled',
]);
export const runSchema = z
  .object({
    id,
    projectId: id,
    revision: z.number().int().positive(),
    mode: z.literal('simulated'),
    fixtureVersion: z.literal(1),
    kind: workKindSchema,
    state: runStateSchema,
    checkpoint: z.number().int().nonnegative(),
    attempt: z.number().int().positive(),
    inputSignature: z.string(),
    answerEvidenceId: id.nullable(),
    inputRefs: z.array(ref),
    targetArtifactId: id,
    targetRevision: z.number().int().nonnegative(),
    outputRef: ref.nullable(),
    answer: z.string().max(4000),
    question: z.string(),
    error: z.string().nullable(),
    history: z.array(z.object({ state: runStateSchema, at: stamp, detail: z.string() }).strict()),
  })
  .strict();
export const messageSchema = z
  .object({
    id,
    projectId: id,
    role: z.enum(['user', 'assistant', 'system']),
    mode: z.enum(['user', 'simulated', 'system', 'muse']),
    text: z.string().min(1).max(8000),
    evidenceIds: z.array(id),
    artifactRefs: z.array(ref),
    runId: id.nullable(),
    at: stamp,
  })
  .strict();
export const photoReplySchema = z
  .object({
    researchId: id,
    researchRevision: z.number().int().positive(),
    questionIndex: z.number().int().min(0).max(5),
    expectedAnswerRevision: z.number().int().nonnegative(),
    disposition: z.enum(['direction', 'unsure', 'deferred']),
  })
  .strict();
export const draftSchema = z
  .object({
    text: z.string().max(4000),
    photoReply: photoReplySchema.optional(),
    evidenceIds: z.array(id),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export const viewSchema = z
  .object({
    artifactRef: ref.nullable(),
    stage: workKindSchema.default('brief'),
    surface: z.enum(['overview', 'artifact', 'sources', 'activity']),
    tab: z.enum(['work', 'conversation']),
  })
  .strict();
export type WorkKind = z.infer<typeof workKindSchema>;
export type Run = z.infer<typeof runSchema>;
export type Message = z.infer<typeof messageSchema>;
export type Draft = z.infer<typeof draftSchema>;
export type ProjectView = z.infer<typeof viewSchema>;
