import { z } from 'zod';
import { id, ref, stamp } from './common.js';
export const valueSchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('unknown') }).strict(),
    z.object({ kind: z.literal('text'), text: z.string().min(1).max(4000) }).strict(),
    z.object({ kind: z.literal('boolean'), value: z.boolean() }).strict(),
    z
      .object({
        kind: z.literal('quantity'),
        amount: z.number().finite().nonnegative(),
        dimension: z.enum(['length', 'area', 'count']),
        unit: z.enum(['mm', 'cm', 'm', 'in', 'ft', 'mm2', 'm2', 'ft2', 'ea']),
      })
      .strict(),
    z
      .object({
        kind: z.literal('money'),
        minorUnits: z.number().int().nonnegative().safe(),
        currency: z.string().regex(/^[A-Z]{3}$/),
      })
      .strict(),
  ])
  .superRefine((v, ctx) => {
    if (v.kind !== 'quantity') return;
    const units = {
      length: ['mm', 'cm', 'm', 'in', 'ft'],
      area: ['mm2', 'm2', 'ft2'],
      count: ['ea'],
    };
    if (!units[v.dimension].includes(v.unit))
      ctx.addIssue({ code: 'custom', message: 'Unit does not match quantity dimension' });
  });
export type FactValue = z.infer<typeof valueSchema>;
export const assertionSchema = z.enum(['unknown', 'user_reported', 'observed', 'assumed']);
export const evidenceInputSchema = z
  .object({
    id,
    kind: z.enum(['user-message', 'user-observation', 'document', 'attachment', 'legacy-import']),
    description: z.string().min(1).max(8000),
    attachment: z
      .object({
        blobId: id,
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        name: z.string().min(1).max(300),
        mediaType: z.string().min(1).max(120),
        role: z.enum(['original', 'derived']),
        originalEvidenceId: id.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((e, ctx) => {
    if ((e.kind === 'attachment') !== Boolean(e.attachment))
      ctx.addIssue({
        code: 'custom',
        message: 'Attachment metadata required only for attachment evidence',
      });
    if (e.attachment?.role === 'derived' && !e.attachment.originalEvidenceId)
      ctx.addIssue({
        code: 'custom',
        message: 'Derived attachment must reference original evidence',
      });
  });
export const evidenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    propertyId: id,
    projectId: id.nullable(),
    revision: z.literal(1),
    recordedAt: stamp,
    source: evidenceInputSchema,
  })
  .strict();
export const factSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    propertyId: id,
    projectId: id.nullable(),
    subjectId: id,
    key: id,
    revision: z.number().int().positive(),
    supersedesRevision: z.number().int().positive().nullable(),
    value: valueSchema,
    originalValue: valueSchema,
    assertion: assertionSchema,
    verification: z.null(),
    evidenceIds: z.array(id).min(1),
    inputRefs: z.array(ref),
    recordedAt: stamp,
  })
  .strict();
export type Fact = z.infer<typeof factSchema>;
export type EvidenceInput = z.infer<typeof evidenceInputSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
