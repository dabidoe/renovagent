import { z } from 'zod';
export const localityInputSchema = z
  .object({
    countryCode: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .nullable(),
    regionCode: z.string().max(12).nullable(),
    municipality: z.string().max(200).nullable(),
    postalCode: z.string().max(20).nullable(),
    propertyReference: z.string().max(300).nullable(),
    boundaryBasis: z.enum(['unknown', 'user-reported']),
  })
  .strict();
export const unknownLocality = () => ({
  countryCode: null,
  regionCode: null,
  municipality: null,
  postalCode: null,
  propertyReference: null,
  boundaryBasis: 'unknown' as const,
});
export const localContextSchema = z
  .object({
    profileVersion: z.string(),
    jurisdictionId: z.string().nullable(),
    status: z.enum(['needs_input', 'needs_review', 'candidate']),
    reported: localityInputSchema,
    authority: z.string().nullable(),
    sourceIds: z.array(z.string()),
    unresolved: z.array(z.string()),
    uses: z.array(
      z
        .object({
          purpose: z.enum(['code', 'pricing', 'shopping', 'contractors']),
          status: z.literal('not-verified'),
          requiredEvidence: z.array(z.string()),
        })
        .strict(),
    ),
  })
  .strict();
export type LocalContext = z.infer<typeof localContextSchema>;
