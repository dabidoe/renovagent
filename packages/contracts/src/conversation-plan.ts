import { z } from 'zod';
import { id, stamp } from './common.js';
export const conversationOutputSchema = z
  .object({
    response: z.string().min(1).max(2400),
    summary: z.string().min(1).max(900),
    options: z
      .array(
        z
          .object({
            title: z.string().min(1).max(120),
            approach: z.string().min(1).max(450),
            dependsOn: z.array(z.string().min(1).max(180)).min(1).max(5),
            photoIds: z.array(id).max(4),
          })
          .strict(),
      )
      .max(3),
    sequence: z
      .array(
        z
          .object({
            title: z.string().min(1).max(160),
            blockedBy: z.array(z.string().min(1).max(180)).max(5),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    missingMeasurements: z
      .array(
        z
          .object({
            label: z.string().min(1).max(150),
            how: z.string().min(1).max(350),
            why: z.string().min(1).max(250),
            photoIds: z.array(id).max(4),
          })
          .strict(),
      )
      .max(5),
    observations: z
      .array(
        z
          .object({
            key: z.enum([
              'room-length',
              'room-width',
              'candidate-length',
              'candidate-width',
              'door-clear-width',
              'headroom',
            ]),
            location: z.string().trim().min(1).max(50),
            amount: z.number().positive().finite().max(100000),
            unit: z.enum(['mm', 'cm', 'm', 'in', 'ft']),
            basis: z.enum(['rough', 'finished', 'unknown']),
            quote: z.string().min(1).max(500),
            sourceMessageId: id,
          })
          .strict(),
      )
      .max(6),
    limitations: z.array(z.string().min(1).max(300)).min(1).max(6),
  })
  .strict();
export const conversationPlanSchema = conversationOutputSchema
  .extend({
    kind: z.literal('conversation-plan'),
    verification: z.literal('unreviewed'),
    feasibility: z.literal('blocked'),
    runId: id,
    model: z.string().min(1).max(160),
    generatedAt: stamp,
    inputPhotos: z
      .array(z.object({ id, sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict())
      .max(4),
  })
  .strict();
export type ConversationPlan = z.infer<typeof conversationPlanSchema>;
