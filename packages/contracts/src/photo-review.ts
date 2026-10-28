import { z } from 'zod';
export const httpsSourceUrl = z
  .string()
  .url()
  .max(2000)
  .refine((v) => new URL(v).protocol === 'https:', 'Use an HTTPS source');
export const photoInspectionSchema = z
  .object({
    id: z.string().min(1).max(100),
    status: z.enum(['reviewed', 'unreadable']),
    roomType: z.enum([
      'kitchen',
      'bathroom',
      'basement',
      'utility',
      'circulation',
      'exterior',
      'living',
      'dining',
      'bedroom',
      'other',
      'uncertain',
    ]),
    confidence: z.enum(['high', 'medium', 'low']),
    observations: z.array(z.string().min(1).max(300)).max(4),
    uncertainties: z.array(z.string().min(1).max(300)).max(4),
    questions: z.array(z.string().min(1).max(300)).max(3),
    nextSteps: z.array(z.string().min(1).max(300)).max(3),
  })
  .strict();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const planningEntry = z
  .object({
    photoIds: z.array(z.string().min(1).max(100)).min(1).max(12),
    text: z.string().min(1).max(300),
  })
  .strict();
export const photoPlanningSchema = z
  .object({
    runId: z.string().min(1).max(100),
    model: z.string().min(1).max(200),
    goal: z.string().min(1).max(4000),
    questions: z.array(planningEntry).min(1).max(6),
    nextSteps: z
      .array(
        planningEntry
          .extend({ kind: z.enum(['user-choice', 'site-measurement', 'qualified-review']) })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict();
export const photoReviewSchema = z
  .object({
    method: z.literal('muse-attached-images'),
    goal: z.string().min(1).max(4000).optional(),
    planning: photoPlanningSchema.optional(),
    reviewedAt: z.string().datetime(),
    manifestHash: hash,
    batches: z
      .array(
        z
          .object({
            runId: z.string().min(1).max(100),
            model: z.string().min(1).max(200),
            photoIds: z.array(z.string().min(1).max(100)).min(1).max(8),
          })
          .strict(),
      )
      .min(1)
      .max(48),
    photos: z
      .array(
        photoInspectionSchema
          .extend({
            sourceId: z.string().min(1).max(100),
            pageUrl: httpsSourceUrl,
            imageUrl: httpsSourceUrl,
            locator: z.string().min(1).max(300),
            sha256: hash,
          })
          .strict(),
      )
      .min(1)
      .max(48),
  })
  .strict();
export type PhotoInspection = z.infer<typeof photoInspectionSchema>;
export type PhotoReview = z.infer<typeof photoReviewSchema>;
export function validatePhotoReview(raw: unknown) {
  const review = photoReviewSchema.parse(raw);
  const ids = review.photos.map((p) => p.id),
    attached = review.batches.flatMap((b) => b.photoIds);
  if (
    new Set(ids).size !== ids.length ||
    new Set(attached).size !== attached.length ||
    new Set(review.batches.map((b) => b.runId)).size !== review.batches.length ||
    ids.length !== attached.length ||
    ids.some((id) => !attached.includes(id))
  )
    throw Error('Photo receipt must cover each unique photo exactly once');
  if (review.photos.some((p) => p.status === 'reviewed' && !p.observations.length))
    throw Error('Reviewed photos need visible observations');
  if (
    review.photos.some(
      (p) => p.status === 'unreadable' && (p.roomType !== 'uncertain' || p.observations.length),
    )
  )
    throw Error('Unreadable photos cannot claim a room or observations');
  if (
    review.planning &&
    [...review.planning.questions, ...review.planning.nextSteps].some((entry) =>
      entry.photoIds.some(
        (id) => !review.photos.some((photo) => photo.id === id && photo.status === 'reviewed'),
      ),
    )
  )
    throw Error('Visual planning references a missing or unreadable photo');
  return review;
}
