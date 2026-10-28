import { z } from 'zod';
import { localityInputSchema, unknownLocality, localContextSchema } from './locality.js';
import { id, stamp } from './common.js';
export const unknownSystems = () => ({
  dwellingForm: 'unknown' as const,
  circuitAmps: null,
  circuitServes: 'unknown' as const,
  gfci: 'unknown' as const,
  basinReceptacleDistanceInches: null,
  electricalRecord: '',
  exhaustStrategy: 'unknown' as const,
  exhaustOperation: 'unknown' as const,
  exhaustRatedCfm: null,
  exhaustRatingPressureInWg: null,
  exhaustDischarge: 'unknown' as const,
  exhaustRecord: '',
});
export const unknownElectrical = () => ({
  designBasis: 'unknown' as const,
  serviceVoltage: 'unknown' as const,
  servicePhase: 'unknown' as const,
  serviceAmps: null,
  basinMeasurement: 'unknown' as const,
  basinMount: 'unknown' as const,
  basinBelowTopInches: null,
  countertopAssemblyListed: 'unknown' as const,
});
const n = z.number().finite().nonnegative().max(1e9);
export const lengthSchema = z
  .object({ amount: n, unit: z.enum(['mm', 'cm', 'm', 'in', 'ft']) })
  .strict();
const optionalLength = lengthSchema.nullable();
export const planningInputsSchema = z
  .object({
    site: z
      .object({
        width: optionalLength,
        length: optionalLength,
        measurement: z.enum(['unknown', 'rough', 'finished', 'conflicting']),
        drainRun: optionalLength,
        drainFall: optionalLength,
      })
      .strict(),
    layout: z
      .object({
        toiletModel: z.string().max(200),
        toiletWidth: optionalLength,
        toiletProjection: optionalLength,
        toiletCenterX: optionalLength,
        basinModel: z.string().max(200),
        basinWidth: optionalLength,
        basinDepth: optionalLength,
        basinX: optionalLength,
        minimumSide: optionalLength,
        minimumFront: optionalLength,
        door: z.enum(['unknown', 'surveyed-clear', 'conflict']),
      })
      .strict(),
    finish: z
      .object({
        specification: z.string().max(300),
        wasteBasis: z.string().max(500),
        wasteBps: z.number().int().min(0).max(10000).nullable(),
        packageAreaM2: n.positive().nullable(),
        inventoryAreaM2: n.nullable(),
        inventorySpecification: z.string().max(300),
        packagePriceMinor: z.number().int().nonnegative().safe().nullable(),
        currency: z.enum(['USD', 'CAD', 'EUR', 'GBP']),
        priceSource: z.string().max(500),
        priceDate: z.string().date().nullable(),
      })
      .strict(),
    context: z
      .object({
        electrical: z
          .object({
            designBasis: z.enum(['unknown', 'irc-part-viii', 'nec-alternative']),
            serviceVoltage: z.enum(['unknown', '120-240', 'other']),
            servicePhase: z.enum(['unknown', 'single', 'other']),
            serviceAmps: z.number().finite().positive().max(10000).nullable(),
            basinMeasurement: z.enum(['unknown', 'outside-edge']),
            basinMount: z.enum([
              'unknown',
              'adjacent-wall-partition',
              'countertop',
              'cabinet-side-face',
              'other',
            ]),
            basinBelowTopInches: z.number().finite().min(-1000).max(1000).nullable(),
            countertopAssemblyListed: z.enum(['unknown', 'reported-listed', 'reported-not-listed']),
          })
          .strict()
          .default(unknownElectrical),
        systems: z
          .object({
            dwellingForm: z.enum([
              'unknown',
              'detached',
              'twin-or-duplex',
              'rowhouse-townhouse',
              'other',
            ]),
            circuitAmps: z.number().finite().positive().max(1000).nullable(),
            circuitServes: z.enum(['unknown', 'single-bathroom', 'multiple-bathrooms', 'other']),
            gfci: z.enum(['unknown', 'reported-present', 'reported-absent']),
            basinReceptacleDistanceInches: n.nullable(),
            electricalRecord: z.string().max(500),
            exhaustStrategy: z.enum(['unknown', 'window', 'mechanical']),
            exhaustOperation: z.enum(['unknown', 'intermittent', 'continuous']),
            exhaustRatedCfm: n.nullable(),
            exhaustRatingPressureInWg: n.nullable(),
            exhaustDischarge: z.enum(['unknown', 'outdoors', 'attic', 'crawlspace', 'interior']),
            exhaustRecord: z.string().max(500),
          })
          .strict()
          .default(unknownSystems),
        jurisdiction: z.enum(['unknown', 'philadelphia', 'other']),
        applicationDate: z.string().date().nullable(),
        building: z.enum(['unknown', 'one-two-family-townhouse', 'other']),
        scope: z.enum(['unknown', 'new-half-bath', 'replacement-only', 'other']),
        accessibility: z.enum(['unknown', 'requires-review', 'not-established']),
        sourceAvailability: z.enum(['available', 'unavailable']),
        unavailableSourceIds: z.array(id).default([]),
        locality: localityInputSchema.default(unknownLocality),
        filing: z
          .object({
            kind: z.enum(['unknown', 'new', 'issued-permit-amendment', 'expired-resubmission']),
            completeness: z.enum(['unknown', 'reported-complete', 'incomplete']),
            selectedEdition: z.enum(['unknown', 'not-specified', '2018', '2021']),
            originalEdition: z.enum(['unknown', '2018', '2021']),
            withinOriginalScope: z.enum(['unknown', 'yes', 'no']),
            originalPermitReference: z.string().max(300),
          })
          .strict()
          .default({
            kind: 'unknown',
            completeness: 'unknown',
            selectedEdition: 'unknown',
            originalEdition: 'unknown',
            withinOriginalScope: 'unknown',
            originalPermitReference: '',
          }),
        stories: z.number().int().positive().max(200).nullable().default(null),
        dwellingUnits: z.number().int().positive().max(10000).nullable().default(null),
        separateEgress: z.enum(['unknown', 'yes', 'no']).default('unknown'),
        roomUse: z
          .enum(['unknown', 'private-dwelling', 'public-or-employee', 'common-area'])
          .default('unknown'),
        drainageMethod: z
          .enum(['unknown', 'philadelphia-single-stack', 'other'])
          .default('unknown'),
        drainDiameterInches: z.number().finite().positive().max(100).nullable().default(null),
        ventMethod: z
          .enum([
            'unknown',
            'outdoor-vent',
            'aav-for-water-closet',
            'aav-for-lavatory',
            'mixed-methods',
          ])
          .default('unknown'),
      })
      .strict(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.finish.packagePriceMinor !== null &&
      (!v.finish.priceSource.trim() || !v.finish.priceDate)
    )
      ctx.addIssue({ code: 'custom', message: 'A price requires its source and date' });
    if (v.finish.wasteBps !== null && !v.finish.wasteBasis.trim())
      ctx.addIssue({ code: 'custom', message: 'Waste allowance needs an explicit basis' });
    if (
      (v.finish.inventoryAreaM2 || 0) > 0 &&
      v.finish.inventorySpecification !== v.finish.specification
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Inventory specification must match the finish specification',
      });
  });
export type PlanningInputs = z.infer<typeof planningInputsSchema>;
export const planningGroups = ['site', 'layout', 'finish', 'context'] as const;
export type PlanningGroup = (typeof planningGroups)[number];
export const emptyPlanningInputs = (): PlanningInputs => ({
  site: { width: null, length: null, measurement: 'unknown', drainRun: null, drainFall: null },
  layout: {
    toiletModel: '',
    toiletWidth: null,
    toiletProjection: null,
    toiletCenterX: null,
    basinModel: '',
    basinWidth: null,
    basinDepth: null,
    basinX: null,
    minimumSide: null,
    minimumFront: null,
    door: 'unknown',
  },
  finish: {
    specification: '',
    wasteBasis: '',
    wasteBps: null,
    packageAreaM2: null,
    inventoryAreaM2: null,
    inventorySpecification: '',
    packagePriceMinor: null,
    currency: 'USD',
    priceSource: '',
    priceDate: null,
  },
  context: {
    electrical: unknownElectrical(),
    systems: unknownSystems(),
    jurisdiction: 'unknown',
    applicationDate: null,
    building: 'unknown',
    scope: 'unknown',
    accessibility: 'unknown',
    sourceAvailability: 'available',
    unavailableSourceIds: [],
    locality: unknownLocality(),
    filing: {
      kind: 'unknown',
      completeness: 'unknown',
      selectedEdition: 'unknown',
      originalEdition: 'unknown',
      withinOriginalScope: 'unknown',
      originalPermitReference: '',
    },
    stories: null,
    dwellingUnits: null,
    separateEgress: 'unknown',
    roomUse: 'unknown',
    drainageMethod: 'unknown',
    drainDiameterInches: null,
    ventMethod: 'unknown',
  },
});
export const sourceRecordSchema = z
  .object({
    id,
    version: z.string(),
    title: z.string(),
    url: z.string().url(),
    locator: z.string(),
    kind: z.enum(['adoption', 'provision']),
    coverageWindow: z
      .object({
        from: z.string().date(),
        through: z.string().date(),
        basis: z.literal('curated-conservative'),
      })
      .strict()
      .optional(),
    authority: z.string().optional(),
    jurisdictionId: z.string().optional(),
    publication: z
      .enum([
        'authority-bulletin',
        'codified-amendment',
        'enacted-redline',
        'publisher',
        'state-regulation',
        'official-service',
      ])
      .optional(),
    interpretation: z.enum(['usable-paraphrase', 'formatting-ambiguous', 'unavailable']).optional(),
    relatedSourceIds: z.array(id).optional(),
    reviewNeeded: z.array(z.string()).optional(),
    edition: z.string(),
    retrievedAt: stamp,
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    paraphrase: z.string(),
    access: z.enum(['retrieved', 'unavailable']),
    review: z.literal('unreviewed'),
  })
  .strict();
export const checkSchema = z
  .object({
    id,
    title: z.string(),
    status: z.enum(['supported', 'not_supported', 'needs_input', 'needs_review']),
    applicability: z.enum(['candidate', 'unresolved', 'outside-coverage']),
    sourceIds: z.array(id),
    rationale: z.string(),
    missing: z.array(z.string()),
    requirementIds: z.array(id).optional(),
    referenceCriteria: z.array(z.string()).optional(),
    mapping: z
      .object({
        status: z.enum(['candidate-incorporation', 'local-replacement', 'unresolved']),
        locator: z.string(),
        edition: z.string(),
        sourceIds: z.array(id),
        finding: z.string(),
        review: z.literal('unreviewed'),
      })
      .strict()
      .optional(),
    evaluation: z
      .object({
        method: z.string(),
        observed: z.number().finite().nullable(),
        required: z.number().finite().nullable(),
        unit: z.string(),
        outcome: z.enum(['meets-threshold', 'does-not-meet', 'not-evaluated']),
        limitations: z.array(z.string()),
      })
      .strict()
      .optional(),
  })
  .strict();
export const requirementSchema = z
  .object({
    id,
    title: z.string(),
    sourceIds: z.array(id).min(1),
    edition: z.string(),
    relationship: z.enum([
      'adoption',
      'state-override',
      'local-replacement',
      'local-addition',
      'unresolved',
    ]),
    conditions: z.array(z.string()),
    exceptions: z.array(z.string()),
    review: z.literal('unreviewed'),
    coverage: z.enum(['retrieved', 'partial', 'unavailable']),
  })
  .strict();
const trace = z
  .object({
    label: z.string(),
    formula: z.string(),
    value: z.number().finite().nullable(),
    unit: z.string(),
  })
  .strict();
export const planningTaskSchema = z
  .object({
    id,
    title: z.string(),
    deps: z.array(id),
    gates: z.array(z.enum(['technical-review', 'permit', 'rough-inspection', 'final-inspection'])),
    completionEvidence: z.string(),
  })
  .strict();
export const planningPayloads = [
  z
    .object({
      kind: z.literal('planning-inputs'),
      group: z.enum(planningGroups),
      inputs: planningInputsSchema,
      basis: z.enum(['user-reported', 'example']),
    })
    .strict(),
  z
    .object({
      kind: z.literal('planning-sources'),
      version: z.string(),
      sources: z.array(sourceRecordSchema),
    })
    .strict(),
  z
    .object({
      kind: z.literal('measured-layout'),
      algorithm: z.string(),
      status: z.enum(['supported', 'not_supported', 'needs_input', 'needs_review']),
      traces: z.array(trace),
      issues: z.array(z.string()),
      limitations: z.array(z.string()),
    })
    .strict(),
  z
    .object({
      kind: z.literal('code-assessment'),
      assessmentArea: z.enum(['basis', 'drainage']).optional(),
      playbook: z.string(),
      reviewComplete: z.literal(false),
      locality: localContextSchema.optional(),
      codeBasis: z
        .object({
          generalEdition: z.enum(['2018', '2021']).nullable(),
          accessibilityEdition: z.literal('2018'),
          decision: z.string(),
          sourceIds: z.array(id),
          missing: z.array(z.string()),
        })
        .strict()
        .optional(),
      requirements: z.array(requirementSchema).optional(),
      checks: z.array(checkSchema),
      coverage: z.array(
        z
          .object({
            topic: z.string(),
            status: z.enum(['partial', 'unavailable']),
            reason: z.string(),
          })
          .strict(),
      ),
    })
    .strict(),
  z
    .object({
      kind: z.literal('quantity-takeoff'),
      algorithm: z.string(),
      status: z.enum(['calculated', 'needs_input', 'needs_review']),
      specification: z.string(),
      taskIds: z.array(id),
      traces: z.array(trace),
      missing: z.array(z.string()),
    })
    .strict(),
  z
    .object({
      kind: z.literal('cost-plan'),
      currency: z.enum(['USD', 'CAD', 'EUR', 'GBP']),
      totalMinor: z.number().int().safe().nonnegative().nullable(),
      packagePriceMinor: z.number().int().safe().nonnegative().nullable(),
      priceSource: z.string(),
      priceDate: z.string().date().nullable(),
      exclusions: z.array(z.string()),
      status: z.enum(['partial', 'needs_input']),
    })
    .strict(),
  z
    .object({
      kind: z.literal('gated-plan'),
      playbook: z.string(),
      tasks: z.array(planningTaskSchema),
    })
    .strict(),
] as const;
export type PlanningTask = z.infer<typeof planningTaskSchema>;
