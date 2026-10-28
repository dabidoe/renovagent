import { z } from 'zod';
import { id } from './common.js';
import { lengthSchema } from './planning.js';
export const candidateSurveySchema = z
  .object({
    locationId: id,
    label: z.string().trim().min(1).max(160),
    shape: z.enum(['unknown', 'rectangular', 'irregular']),
    measurement: z.enum(['unknown', 'rough', 'finished', 'conflicting']),
    measuredAt: z.string().date().nullable(),
    method: z.string().trim().min(1).max(500),
    notes: z.string().max(2000),
    doorSwing: z.enum(['unknown', 'reported-clear', 'reported-conflict']),
    values: z
      .object({
        width: lengthSchema.nullable(),
        length: lengthSchema.nullable(),
        minimumHeadroom: lengthSchema.nullable(),
        clearDoorWidth: lengthSchema.nullable(),
        approachWidth: lengthSchema.nullable(),
        drainRun: lengthSchema.nullable(),
        drainFall: lengthSchema.nullable(),
      })
      .strict(),
  })
  .strict();
export const candidateMeasurementsSchema = z
  .object({
    kind: z.literal('candidate-measurements'),
    role: id,
    basis: z.enum(['user-reported', 'example']),
    survey: candidateSurveySchema,
  })
  .strict();
export const candidateChecksSchema = z
  .object({
    kind: z.literal('candidate-checks'),
    role: id,
    locationId: id,
    shape: z.enum(['unknown', 'rectangular', 'irregular']),
    surveyBasis: z.enum(['unknown', 'rough', 'finished', 'conflicting']),
    label: z.string().min(1),
    algorithm: z.literal('candidate-survey/1'),
    basis: z.enum(['user-reported', 'example']),
    constructionRelease: z.literal('blocked'),
    feasibility: z.literal('blocked'),
    traces: z.array(
      z
        .object({
          label: z.string(),
          formula: z.string(),
          value: z.number().finite().nullable(),
          unit: z.string(),
        })
        .strict(),
    ),
    checks: z.array(
      z
        .object({
          id,
          title: z.string(),
          status: z.enum(['reported', 'needs-input', 'needs-review', 'not-supported', 'blocked']),
          detail: z.string(),
        })
        .strict(),
    ),
    missing: z.array(z.string()),
    limitations: z.array(z.string()),
  })
  .strict();
export type CandidateSurvey = z.infer<typeof candidateSurveySchema>;
export const emptyCandidateSurvey = (locationId: string, label: string): CandidateSurvey => ({
  locationId,
  label,
  shape: 'unknown',
  measurement: 'unknown',
  measuredAt: null,
  method: '',
  notes: '',
  doorSwing: 'unknown',
  values: {
    width: null,
    length: null,
    minimumHeadroom: null,
    clearDoorWidth: null,
    approachWidth: null,
    drainRun: null,
    drainFall: null,
  },
});
