import { photoInventoryPayloadSchema, inventoryDirectionSchema } from './home-inventory.js';
import { candidateMeasurementsSchema, candidateChecksSchema } from './candidate-measurements.js';
import { projectOptionsSchema, projectWorkPlanSchema } from './scope-planning.js';
import { z } from 'zod';
import { id, ref, stamp } from './common.js';
import { propertyResearchSchema } from './property-research.js';
import { planningPayloads } from './planning.js';
const line = z
  .object({
    description: z.string().min(1),
    quantity: z.number().finite().nonnegative(),
    unit: z.string().min(1),
    sourceTaskIds: z.array(id),
  })
  .strict();
const task = z
  .object({
    id,
    title: z.string().min(1),
    deps: z.array(id),
    progress: z.enum(['not_started', 'in_progress', 'completion_reported', 'completed']),
    readiness: z.enum(['ready', 'blocked', 'needs_review']),
  })
  .strict();
export const artifactPayloadSchema = z.discriminatedUnion('kind', [
  ...planningPayloads,
  photoInventoryPayloadSchema,
  inventoryDirectionSchema,
  candidateMeasurementsSchema,
  candidateChecksSchema,
  projectOptionsSchema,
  projectWorkPlanSchema,
  z
    .object({
      kind: z.literal('photo-planning-answer'),
      questionIndex: z.number().int().min(0).max(5),
      question: z.string().min(1).max(300),
      photoIds: z.array(id).min(1).max(12),
      answer: z.string().trim().min(1).max(4000),
      disposition: z.enum(['direction', 'unsure', 'deferred']),
      verification: z.literal('user-reported'),
    })
    .strict(),
  propertyResearchSchema,
  z
    .object({
      kind: z.literal('option-comparison'),
      basis: z.literal('fixture'),
      options: z
        .array(
          z
            .object({
              id,
              diagram: z.enum(['bathroom', 'zones', 'flooring']).optional(),
              title: z.string().min(1),
              approach: z.string(),
              tradeoff: z.string(),
              unknowns: z.array(z.string()),
            })
            .strict(),
        )
        .min(2),
    })
    .strict(),
  z
    .object({
      kind: z.literal('technical-check'),
      summary: z.string().min(1),
      result: z.enum(['not_evaluated', 'needs_input', 'needs_review']),
      basis: z.enum(['fixture', 'user-provided']),
    })
    .strict(),
  z.object({ kind: z.literal('material-plan'), lines: z.array(line) }).strict(),
  z
    .object({
      kind: z.literal('estimate'),
      currency: z.string().regex(/^[A-Z]{3}$/),
      lines: z.array(
        z
          .object({
            description: z.string().min(1),
            minorUnits: z.number().int().nonnegative().safe(),
          })
          .strict(),
      ),
      basis: z.enum(['fixture', 'user-provided']),
    })
    .strict(),
  z.object({ kind: z.literal('task-plan'), tasks: z.array(task) }).strict(),
  z.object({ kind: z.literal('evidence-index'), evidenceIds: z.array(id) }).strict(),
  z
    .object({
      kind: z.literal('project-brief'),
      sections: z.array(z.object({ title: z.string().min(1), text: z.string() }).strict()),
    })
    .strict(),
]);
export const artifactSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    projectId: id,
    revision: z.number().int().positive(),
    lifecycle: z.enum(['proposed', 'accepted', 'rejected']),
    freshness: z.enum(['current', 'stale', 'invalid']),
    contextSignature: z.string().optional(),
    factContext: z
      .object({ keys: z.array(z.string()), signature: z.string() })
      .strict()
      .optional(),
    inputRefs: z.array(ref),
    evidenceIds: z.array(id),
    payload: artifactPayloadSchema,
    createdAt: stamp,
    acceptedAt: stamp.nullable(),
  })
  .strict();
export const decisionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    projectId: id,
    question: z.string().min(1),
    artifactRefs: z.array(ref).min(1),
    outcome: z.enum(['accepted', 'rejected']).default('accepted'),
    actorId: id,
    acceptedAt: stamp.nullable(),
    decidedAt: stamp.optional(),
  })
  .strict();
export type Artifact = z.infer<typeof artifactSchema>;
export type ArtifactPayload = z.infer<typeof artifactPayloadSchema>;
