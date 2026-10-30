import { z } from 'zod';
import { id, stamp } from './common.js';
import { designDirectionSchema, scopeInputKeySchema, scopeInputSchema } from './scope-draft.js';

// Same-room design options. Each option is a recipe package set plus a design
// direction; its requirements are recomputed from the recipe and the stored
// inputs, so prices are never frozen into the options themselves. Previews are
// generated concept images tied to one option revision; they never establish
// fit, materials or feasibility.

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);

export const designImageSchema = z
  .object({
    sha256,
    mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    width: z.number().int().positive().max(10000),
    height: z.number().int().positive().max(10000),
    bytes: z
      .number()
      .int()
      .positive()
      .max(12 * 1024 * 1024),
  })
  .strict();
export type DesignImage = z.infer<typeof designImageSchema>;

export const designPreviewSchema = z
  .object({
    status: z.enum(['pending', 'generated', 'failed']),
    // The option revision (its direction) this preview was requested for.
    forDirection: designDirectionSchema,
    image: designImageSchema.optional(),
    provenance: z
      .object({
        kind: z.literal('generated-concept'),
        sourcePhotoSha256: sha256,
        prompt: z.string().min(1).max(2000),
        provider: z.string().min(1).max(120),
        model: z.string().min(1).max(120),
        runId: z.string().min(1).max(160).optional(),
        generatedAt: stamp,
      })
      .strict()
      .optional(),
    error: z.string().min(1).max(500).optional(),
  })
  .strict();
export type DesignPreview = z.infer<typeof designPreviewSchema>;

export const designOptionSchema = z
  .object({
    id,
    title: z.string().min(1).max(120),
    summary: z.string().min(1).max(400),
    retained: z.array(z.string().min(1).max(160)).max(10),
    packageIds: z.array(id).min(1).max(10),
    direction: designDirectionSchema,
    preview: designPreviewSchema,
  })
  .strict();
export type DesignOption = z.infer<typeof designOptionSchema>;

export const designOptionsSchema = z
  .object({
    kind: z.literal('design-options'),
    recipe: z
      .object({ id: z.string().min(1).max(80), version: z.number().int().positive() })
      .strict(),
    request: z.string().min(1).max(2000),
    sourcePhoto: z
      .object({
        image: designImageSchema,
        label: z.string().min(1).max(200),
        originalName: z.string().min(1).max(200),
        originalSha256: sha256,
        permission: z.string().min(1).max(300),
      })
      .strict(),
    inputs: z.array(scopeInputSchema).max(10),
    options: z.array(designOptionSchema).min(2).max(3),
    selectedOptionId: id.nullable(),
    limits: z.array(z.string().min(1).max(400)).min(1).max(10),
  })
  .strict();
export type DesignOptions = z.infer<typeof designOptionsSchema>;

const reportedSchema = z
  .array(
    z
      .object({
        key: scopeInputKeySchema,
        amount: z.number().positive().finite().max(10000).nullable(),
        unit: z.enum(['ft', 'in', 'm', 'cm']),
      })
      .strict(),
  )
  .max(10);

export const buildDesignOptionsPayloadSchema = z
  .object({
    recipeId: z.string().min(1).max(80),
    request: z.string().trim().min(1).max(2000),
    sourcePhoto: designOptionsSchema.shape.sourcePhoto,
    reported: reportedSchema,
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();

// The person's preference or a revised direction ("make it blue"). Selection
// records a proposed preference and drafts the chosen scope; it is not an
// accepted decision.
export const reviseDesignOptionsPayloadSchema = z
  .object({
    optionId: id,
    direction: designDirectionSchema.partial().optional(),
    select: z.boolean(),
    // Re-queue a failed preview for the option's current direction.
    retryPreview: z.boolean().optional(),
    expectedRevision: z.number().int().positive(),
  })
  .strict();

// Server-only: a preview produced for an exact option direction.
export const recordDesignPreviewPayloadSchema = z
  .object({
    optionId: id,
    expectedRevision: z.number().int().positive(),
    preview: designPreviewSchema,
  })
  .strict();
