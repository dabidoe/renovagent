import { z } from 'zod';
import { id, ref } from './common.js';
import { constraintSchema } from './catalog.js';

// A scope draft is compiled by a versioned recipe from declared work packages,
// workspace facts and values relayed by an agent. It is a proposal: relayed
// values stay unverified, unknown inputs stay unknown, and missing information
// blocks only the requirements that depend on it.

export const scopeInputKeySchema = z.enum([
  'floorLengthFt',
  'floorWidthFt',
  'ceilingHeightFt',
  'vanityWidthIn',
  'toiletRoughInIn',
  // From a confirmed floor plan; read from recorded facts only, never relayed.
  'floorAreaSqFt',
  'floorPerimeterFt',
]);
export type ScopeInputKey = z.infer<typeof scopeInputKeySchema>;

// Design direction carried from a chosen design option into its scope.
export const designDirectionSchema = z
  .object({
    wallColor: z.string().trim().min(1).max(80),
    floorFinish: z.string().trim().min(1).max(80),
  })
  .strict();
export type DesignDirection = z.infer<typeof designDirectionSchema>;

export const scopeInputSchema = z
  .object({
    key: scopeInputKeySchema,
    label: z.string().min(1).max(120),
    amount: z.number().positive().finite().nullable(),
    unit: z.enum(['ft', 'in', 'sq ft']),
    // workspace-fact: a recorded fact revision (see factRef). agent-relayed: a
    // value the agent passed along, unverified. reported-unknown: the person
    // said "I don't know" (not asked again). not-provided: not yet asked.
    source: z.enum(['workspace-fact', 'agent-relayed', 'reported-unknown', 'not-provided']),
    factRef: ref.optional(),
  })
  .strict();
export type ScopeInput = z.infer<typeof scopeInputSchema>;

export const scopeRequirementSchema = z
  .object({
    id,
    packageId: id,
    category: z.enum(['material', 'task']),
    purpose: z.string().min(1).max(300),
    specification: z.string().min(1).max(500),
    kind: z.enum(['count', 'measured', 'allowance', 'conditional', 'spec-dependent']),
    quantity: z.number().positive().finite().nullable(),
    unit: z.string().min(1).max(40),
    quantityBasis: z.string().min(1).max(400),
    status: z.enum([
      'quantified',
      'needs-input',
      'needs-product-spec',
      'conditional',
      'needs-source',
    ]),
    blockedBy: z.array(scopeInputKeySchema).max(5),
    condition: z.string().min(1).max(300).optional(),
    sourceIds: z.array(id).min(1).max(5),
    catalog: z
      .object({
        category: z.string().min(1).max(120),
        constraints: z.array(constraintSchema).max(10),
      })
      .strict()
      .optional(),
    codeTopics: z.array(z.string().min(1).max(120)).max(10),
  })
  .strict();
export type ScopeRequirement = z.infer<typeof scopeRequirementSchema>;

export const scopeSourceSchema = z
  .object({
    id,
    title: z.string().min(1).max(300),
    publisher: z.string().min(1).max(200),
    url: z.string().url().max(2000).optional(),
    // search-excerpt: located and summarized by search, document not opened.
    retrieval: z.enum(['internal-recipe', 'search-excerpt', 'fetched']),
    retrievedOn: z.string().date().optional(),
    supports: z.string().min(1).max(600),
  })
  .strict();

export const scopeDraftSchema = z
  .object({
    kind: z.literal('scope-draft'),
    recipe: z
      .object({ id: z.string().min(1).max(80), version: z.number().int().positive() })
      .strict(),
    request: z.string().min(1).max(2000),
    direction: designDirectionSchema.optional(),
    packages: z
      .array(
        z
          .object({
            id,
            title: z.string().min(1).max(160),
            included: z.boolean(),
            summary: z.string().min(1).max(400),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    inputs: z.array(scopeInputSchema).max(10),
    requirements: z.array(scopeRequirementSchema).min(1).max(120),
    sources: z.array(scopeSourceSchema).min(1).max(20),
    questions: z
      .array(
        z
          .object({
            inputKeys: z.array(scopeInputKeySchema).min(1).max(3),
            question: z.string().min(1).max(300),
            unblocks: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .max(2),
    notPriced: z.array(z.string().min(1).max(200)).max(10),
    limits: z.array(z.string().min(1).max(400)).min(1).max(10),
  })
  .strict();
export type ScopeDraft = z.infer<typeof scopeDraftSchema>;

export const draftScopePayloadSchema = z
  .object({
    recipeId: z.string().min(1).max(80),
    packageIds: z.array(id).min(1).max(20),
    request: z.string().trim().min(1).max(2000),
    reported: z
      .array(
        z
          .object({
            key: scopeInputKeySchema,
            // null records an explicit "I don't know".
            amount: z.number().positive().finite().max(10000).nullable(),
            unit: z.enum(['ft', 'in', 'm', 'cm']),
          })
          .strict(),
      )
      .max(10),
    direction: designDirectionSchema.optional(),
    expectedDraftRevision: z.number().int().nonnegative(),
  })
  .strict();
export type DraftScopePayload = z.infer<typeof draftScopePayloadSchema>;
