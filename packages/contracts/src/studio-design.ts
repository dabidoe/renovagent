import { z } from 'zod';
import { id } from './common.js';
import { studioIdeasSchema, studioPlacementSchema } from './studio-furniture.js';

// A versioned proposal from the photo studio. Estimates remain estimates;
// this snapshot does not record physical facts or approve work.
const text = z.string().max(500);
const tier = z.enum(['builder', 'mid', 'high']);
const image = z
  .string()
  .max(500)
  .refine(
    (s) =>
      s === '' ||
      (!s.includes('\\') &&
        !s.split('/').includes('..') &&
        /^(?:\.?\/examples\/[^?#]+|\/api\/workspace\/design-images\/[a-f0-9]{64})$/.test(s)),
    'Use a studio image or bundled example',
  );
const color = z
  .object({ name: text, code: text, hex: z.string().regex(/^#[a-f0-9]{6}$/i), brand: text })
  .strict();
const segment = z
  .object({
    id: text.optional(),
    imageShare: z.number().finite().optional(),
    confidence: z.number().finite().optional(),
    box: z
      .object({
        left: z.number().finite(),
        top: z.number().finite(),
        right: z.number().finite().optional(),
        bottom: z.number().finite().optional(),
      })
      .strict(),
    path: z.string().max(300000),
    scaleX: z.number().finite(),
    scaleY: z.number().finite(),
  })
  .strict();
const masks = z
  .object({
    width: z.number().positive().max(20000),
    height: z.number().positive().max(20000),
    segments: z.array(segment).max(100),
    phrase: text.optional(),
    model: text.optional(),
    runId: text.optional(),
  })
  .strict();
const roomImage = z.object({ src: image, walls: z.union([image, masks, z.null()]) }).strict();
const pick = z
  .object({
    color: color.nullable(),
    floor: z.enum(['keep', 'lvp', 'hardwood']),
    included: z.boolean(),
    floorStyle: text.optional(),
    paintLine: tier.optional(),
    sheen: z.enum(['matte', 'eggshell', 'satin']).optional(),
    ideas: z.array(text).max(100).optional(),
  })
  .strict();
const change = z.object({ target: text, becomes: text }).strict();
export const studioItemSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(200),
    category: z.enum(['furniture', 'lighting', 'decor', 'other']),
    action: z.enum(['add', 'replace', 'keep']),
    quantity: z.number().int().positive().max(1000).nullable(),
    unitAllowanceMinor: z.number().int().nonnegative().max(100_000_000).nullable(),
    url: z
      .string()
      .url()
      .max(2000)
      .refine((s) => {
        const u = new URL(s);
        return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password;
      }, 'Use an http/https product page without credentials')
      .optional(),
  })
  .strict();
export type StudioItem = z.infer<typeof studioItemSchema>;
const designVersion = z
  .object({
    id: z.string().min(1).max(100),
    image,
    title: z.string().max(120),
    createdAt: z.string().datetime(),
    signature: z.string().max(20000),
    finishSignature: z.string().max(10000),
    changes: z.array(change).max(12),
  })
  .strict();
export const studioStylingDraftSchema = z
  .object({
    source: image,
    inspo: z
      .object({
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        width: z.number().positive(),
        height: z.number().positive(),
        items: z
          .array(
            z
              .object({
                phrase: text,
                name: text,
                kind: text,
                segments: z.array(segment).max(100),
                runId: text.optional(),
              })
              .strict(),
          )
          .max(12),
        model: text.optional(),
        runId: text.optional(),
      })
      .strict()
      .nullable(),
    colours: z.array(z.string().max(20)).max(12),
    paint: color.extend({ deltaE: z.number().finite() }).nullable(),
    borrow: z.array(text).max(12),
    changes: z.array(change).max(12),
    mode: z.enum(['refresh', 'furnish']),
    keep: z.string().max(300),
    resultSignature: z.string().max(20000),
    brief: z.string().max(1000).optional(),
    versions: z.array(designVersion).max(12).optional(),
    selectedVersionId: z.string().max(100).optional(),
    ideas: studioIdeasSchema.optional(),
  })
  .strict();
export const studioDesignSchema = z
  .object({
    kind: z.literal('studio-design'),
    basis: z.enum(['owner-studio', 'listing-example']),
    intake: z
      .object({
        analysis: z
          .object({
            photos: z
              .array(z.string().regex(/^[a-f0-9]{64}$/))
              .min(1)
              .max(8),
            plans: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(2),
            error: z.string().max(1000).optional(),
          })
          .strict()
          .optional(),
        planRooms: z
          .array(
            z
              .object({
                name: z.string().max(500),
                widthFt: z.number().positive().max(10000),
                lengthFt: z.number().positive().max(10000),
              })
              .strict(),
          )
          .max(100)
          .optional(),
      })
      .strict()
      .optional(),
    project: z
      .object({
        id: text,
        address: text,
        place: text.optional(),
        listing: z.string().url().max(2000).optional(),
        ceilingFt: z.number().positive().max(100).nullable(),
        ceilingNote: text.optional(),
        rooms: z
          .array(
            z
              .object({
                id: text,
                title: text,
                existingFloor: text,
                photo: roomImage,
                floors: z.record(z.string().max(50), roomImage),
                size: z
                  .object({
                    xFt: z.number().positive().max(10000),
                    yFt: z.number().positive().max(10000),
                  })
                  .strict()
                  .optional(),
                sizeNote: text.optional(),
                plan: z
                  .object({
                    image,
                    points: z
                      .array(z.tuple([z.number().finite(), z.number().finite()]))
                      .min(3)
                      .max(100),
                    openings: z
                      .array(
                        z
                          .object({
                            wall: z.number().int().nonnegative(),
                            kind: z.enum(['door', 'window', 'opening']),
                            from: z.number().finite(),
                            to: z.number().finite(),
                          })
                          .strict(),
                      )
                      .max(100),
                  })
                  .strict()
                  .optional(),
              })
              .strict(),
          )
          .min(1)
          .max(30),
        starting: z.record(z.string(), pick).optional(),
        tier: tier.optional(),
        idea: z.string().max(2000).optional(),
      })
      .strict(),
    picks: z.record(z.string(), pick),
    tier,
    inspired: z.record(z.string(), image),
    renderSignatures: z.record(z.string(), z.string().max(20000)),
    styling: z.record(z.string(), studioStylingDraftSchema),
    items: z.record(z.string(), z.array(studioItemSchema).max(100)).optional(),
    placements: z.record(z.string(), z.array(studioPlacementSchema).max(60)).optional(),
    modelRenders: z
      .record(z.string(), z.object({ image, signature: z.string().max(30000) }).strict())
      .optional(),
  })
  .strict();
export type StudioDesign = z.infer<typeof studioDesignSchema>;
export const studioDesignSaveRequestSchema = z
  .object({
    requestId: id,
    projectId: id.optional(),
    expectedRevision: z.number().int().nonnegative(),
    snapshot: studioDesignSchema,
  })
  .strict();
export type StudioDesignSaveRequest = z.infer<typeof studioDesignSaveRequestSchema>;
export type StudioStylingDraft = z.infer<typeof studioStylingDraftSchema>;
