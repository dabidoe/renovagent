import { z } from 'zod';
import { id, stamp, ref } from './common.js';
const point = z
  .object({ x: z.number().finite().min(0).max(1000), y: z.number().finite().min(0).max(1000) })
  .strict();
export const inventoryItemSchema = z
  .object({
    id,
    photoId: id,
    label: z.string().trim().min(1).max(100),
    category: z.enum([
      'floor',
      'wall',
      'cabinet',
      'countertop',
      'appliance',
      'fixture',
      'opening',
      'equipment',
      'other',
    ]),
    polygon: z
      .array(point)
      .min(3)
      .max(16)
      .refine(
        (points) =>
          Math.abs(
            points.reduce((area, p, i) => {
              const q = points[(i + 1) % points.length];
              return area + p.x * q.y - q.x * p.y;
            }, 0),
          ) > 1,
        'Region must have nonzero area',
      ),
    confidence: z.enum(['high', 'medium', 'low']),
    observation: z.string().min(1).max(400),
    unknowns: z.array(z.string().min(1).max(200)).min(1).max(5),
    nextAction: z.string().min(1).max(400),
  })
  .strict();
export const photoInventorySchema = z
  .object({
    kind: z.literal('photo-inventory'),
    method: z.literal('muse-vision-regions'),
    verification: z.literal('unreviewed'),
    analyzedAt: stamp,
    runId: id,
    model: z.string().min(1).max(200),
    photos: z
      .array(
        z
          .object({
            id,
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            width: z.number().int().positive().max(30000),
            height: z.number().int().positive().max(30000),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    items: z.array(inventoryItemSchema).min(1).max(80),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (new Set(p.items.map((i) => i.id)).size !== p.items.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate inventory item identity' });
    if (new Set(p.photos.map((i) => i.id)).size !== p.photos.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate inventory photo identity' });
    if (p.photos.some((photo) => !p.items.some((i) => i.photoId === photo.id)))
      ctx.addIssue({
        code: 'custom',
        message: 'Every annotated photo needs a localized observation',
      });
    if (p.items.some((i) => !p.photos.some((photo) => photo.id === i.photoId)))
      ctx.addIssue({ code: 'custom', message: 'Inventory item references a missing photo' });
  });
// Keep the discriminated object separate from cross-record checks for zod union compatibility.
export const photoInventoryPayloadSchema = photoInventorySchema.innerType();
export const inventoryDirectionSchema = z
  .object({
    kind: z.literal('inventory-direction'),
    itemId: id,
    disposition: z.enum(['retain', 'replace', 'investigate', 'exclude']),
    identification: z.enum(['unconfirmed', 'confirmed', 'rejected']),
    correctedLabel: z.string().trim().min(1).max(100).nullable(),
    note: z.string().trim().max(1000),
    verification: z.literal('user-reported'),
  })
  .strict();
export type PhotoInventory = z.infer<typeof photoInventorySchema>;

export const inventoryImportSchema = z
  .object({ schemaVersion: z.literal(1), researchRef: ref, inventory: photoInventorySchema })
  .strict();
