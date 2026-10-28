import { z } from 'zod';
import { httpsSourceUrl as https, photoReviewSchema, validatePhotoReview } from './photo-review.js';
export const propertyResearchSchema = z
  .object({
    kind: z.literal('property-research'),
    address: z.string().trim().min(3).max(300),
    jobId: z.string().min(1).max(300),
    method: z.enum(['city-records', 'muse', 'user-import']),
    verification: z.literal('unreviewed'),
    sources: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            title: z.string().min(1).max(300),
            url: https,
            retrievedAt: z.string().datetime(),
          })
          .strict(),
      )
      .max(30),
    findings: z
      .array(
        z
          .object({
            label: z.string().min(1).max(200),
            value: z.string().min(1).max(1000),
            sourceId: z.string().min(1).max(100),
            limit: z.string().max(500),
            blockedReason: z
              .string()
              .min(1)
              .max(1000)
              .nullable()
              .optional()
              .transform((v) => v ?? undefined),
          })
          .strict(),
      )
      .max(40),
    images: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            title: z.string().min(1).max(300),
            sourceId: z.string().min(1).max(100),
            pageUrl: https,
            previewUrl: https.nullable(),
            previewPermission: z.enum(['unknown', 'provider-embed', 'licensed']),
            capturedAt: z.string().max(100),
            locator: z
              .string()
              .min(1)
              .max(300)
              .nullable()
              .optional()
              .transform((v) => v ?? undefined),
            imageUrl: https
              .nullable()
              .optional()
              .transform((v) => v ?? undefined),
            observations: z
              .string()
              .min(1)
              .max(1000)
              .nullable()
              .optional()
              .transform((v) => v ?? undefined),
            planningUse: z
              .string()
              .min(1)
              .max(500)
              .nullable()
              .optional()
              .transform((v) => v ?? undefined),
            blockedReason: z
              .string()
              .min(1)
              .max(1000)
              .nullable()
              .optional()
              .transform((v) => v ?? undefined),
          })
          .strict(),
      )
      .max(12),
    nextQuestions: z.array(z.string().min(1).max(400)).max(8),
    photoReview: photoReviewSchema.optional(),
  })
  .strict();
export type PropertyResearch = z.infer<typeof propertyResearchSchema>;
export function validatePropertyResearch(raw: unknown): PropertyResearch {
  const p = propertyResearchSchema.parse(raw),
    ids = new Set(p.sources.map((s) => s.id));
  if (ids.size !== p.sources.length || new Set(p.images.map((i) => i.id)).size !== p.images.length)
    throw Error('Duplicate source or image identity');
  if ([...p.findings, ...p.images].some((x) => !ids.has(x.sourceId)))
    throw Error('Finding/image references a missing source');
  if (p.photoReview) {
    validatePhotoReview(p.photoReview);
    if (p.photoReview.photos.some((photo) => !ids.has(photo.sourceId)))
      throw Error('Reviewed photo references a missing source');
    if (
      p.images.some(
        (image) =>
          !p.photoReview!.photos.some(
            (photo) =>
              photo.id === image.id &&
              photo.status === 'reviewed' &&
              photo.imageUrl === image.imageUrl &&
              photo.pageUrl === image.pageUrl &&
              photo.sourceId === image.sourceId,
          ),
      )
    )
      throw Error('Selected visual references must match a reviewed attachment');
  }
  return p;
}
