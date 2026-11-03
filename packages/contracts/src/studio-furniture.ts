import { z } from 'zod';

export const studioAssetIds = [
  'sofa',
  'chair',
  'coffee-table',
  'rug',
  'floor-lamp',
  'plant',
  'bed',
  'desk',
  'bookcase',
  'dining-table',
  'dining-chair',
  'media-console',
  'toilet',
  'vanity',
  'shower',
  'tub',
  'sink',
  'mirror',
] as const;
export const studioAssetIdSchema = z.enum(studioAssetIds);
export type StudioAssetId = z.infer<typeof studioAssetIdSchema>;
// Proposed display geometry only: never a measurement or a product specification.
export const studioPlacementSchema = z
  .object({
    id: z.string().min(1).max(100),
    itemId: z.string().min(1).max(100),
    assetId: studioAssetIdSchema,
    xM: z.number().finite().min(-10000).max(10000),
    yM: z.number().finite().min(0).max(10).optional(),
    wallId: z.string().min(1).max(100).optional(),
    zM: z.number().finite().min(-10000).max(10000),
    rotationDeg: z.number().finite().min(-360).max(360),
    widthM: z.number().positive().max(20),
    depthM: z.number().positive().max(20),
    heightM: z.number().positive().max(10),
    color: z.string().regex(/^#[a-f0-9]{6}$/i),
  })
  .strict();
export type StudioPlacement = z.infer<typeof studioPlacementSchema>;
export const studioDirectionSchema = z
  .object({
    id: z.string().min(1).max(60),
    title: z.string().trim().min(1).max(60),
    description: z.string().trim().min(1).max(180),
    why: z.string().trim().min(1).max(240),
    brief: z.string().trim().min(1).max(1000),
    palette: z
      .array(z.string().regex(/^#[a-f0-9]{6}$/i))
      .min(3)
      .max(5),
    assets: z.array(studioAssetIdSchema).min(1).max(6),
  })
  .strict();
export const studioIdeasSchema = z
  .object({
    observations: z.array(z.string().trim().min(1).max(200)).max(4),
    directions: z.array(studioDirectionSchema).length(3),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Set(value.directions.map((d) => d.id)).size !== 3)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Design directions need unique identities',
      });
  });
export type StudioIdeas = z.infer<typeof studioIdeasSchema>;
