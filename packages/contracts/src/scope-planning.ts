import { z } from 'zod';
import { id, ref } from './common.js';
export const scopeDependencySchema = z
  .object({
    id,
    title: z.string().min(1),
    kind: z.enum(['direction', 'measurement', 'feasibility', 'code', 'permit', 'resources']),
    status: z.enum(['reported', 'missing', 'needs-review', 'unsupported']),
    detail: z.string().min(1),
    photoIds: z.array(id),
    inputRefs: z.array(ref),
  })
  .strict();
export const projectOptionsSchema = z
  .object({
    kind: z.literal('project-options'),
    recipe: z.string().min(1),
    basis: z.literal('deterministic-proposal'),
    constructionRelease: z.literal('blocked'),
    options: z
      .array(
        z
          .object({
            id,
            title: z.string().min(1),
            summary: z.string().min(1),
            scope: z.array(z.string().min(1)).min(1),
            exclusions: z.array(z.string().min(1)),
            fit: z.literal('needs-reconciliation'),
            feasibility: z.literal('blocked'),
            dependencies: z.array(scopeDependencySchema).min(1),
          })
          .strict(),
      )
      .min(2)
      .max(6),
  })
  .strict();
export const projectWorkPlanSchema = z
  .object({
    kind: z.literal('project-work-plan'),
    recipe: z.string().min(1),
    basis: z.literal('deterministic-proposal'),
    constructionRelease: z.literal('blocked'),
    optionId: id,
    optionTitle: z.string().min(1),
    steps: z
      .array(
        z
          .object({
            id,
            title: z.string().min(1),
            description: z.string().min(1),
            kind: z.enum([
              'scope',
              'survey',
              'qualified-review',
              'design',
              'preparation',
              'physical-work',
              'inspection',
              'handover',
            ]),
            dependsOn: z.array(id),
            status: z.enum(['needs-input', 'needs-review', 'blocked']),
            completion: z.literal('not-reported'),
            blockers: z.array(scopeDependencySchema).min(1),
            photoIds: z.array(id),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict();
