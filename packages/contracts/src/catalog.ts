import { z } from 'zod';
import { id, ref, stamp } from './common.js';

// Three purchasing tiers. Labels are provisional product language.
export const tierSchema = z.enum(['builder', 'mid', 'high']);
export type Tier = z.infer<typeof tierSchema>;
export const tierLabels: Record<Tier, string> = {
  builder: 'Builder grade',
  mid: 'Mid-tier',
  high: 'High-end',
};

export const moneySchema = z
  .object({ amountMinor: z.number().int().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/) })
  .strict();
export type Money = z.infer<typeof moneySchema>;

const specValue = z.union([z.string().max(300), z.number().finite(), z.boolean()]);

export const productSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    manufacturer: z.string().min(1).max(200),
    model: z.string().min(1).max(200),
    name: z.string().min(1).max(300),
    category: z.string().min(1).max(120),
    identifiers: z
      .object({ upc: z.string().max(30).optional(), mpn: z.string().max(60).optional() })
      .strict(),
    specs: z.record(specValue),
    certifications: z.array(z.string().max(120)).max(20),
  })
  .strict();
export type Product = z.infer<typeof productSchema>;

export const offerSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    productId: id,
    retailer: z.string().min(1).max(200),
    sku: z.string().min(1).max(120),
    fulfillmentRegion: z.string().min(1).max(120),
    storeId: z.string().min(1).max(60).optional(),
    storeName: z.string().min(1).max(200).optional(),
    url: z.string().url().max(2000).optional(),
    fulfillment: z.enum(['pickup', 'shipping', 'both']),
    tier: tierSchema,
    packQuantity: z.number().positive().finite(),
    packUnit: z.string().min(1).max(40),
  })
  .strict();
export type Offer = z.infer<typeof offerSchema>;

export const observationSourceSchema = z.enum([
  'example-import',
  'retailer-api',
  'manual-entry',
  'receipt',
]);
export type ObservationSource = z.infer<typeof observationSourceSchema>;
export const freshnessSchema = z.enum(['live', 'recent', 'historical']);
export type Freshness = z.infer<typeof freshnessSchema>;

export const priceObservationSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    offerId: id,
    observedAt: stamp,
    unitPrice: moneySchema,
    stock: z.enum(['in_stock', 'limited', 'out_of_stock', 'unknown']),
    shippingEstimate: moneySchema.optional(),
    source: observationSourceSchema,
    freshness: freshnessSchema,
    note: z.string().max(500).optional(),
  })
  .strict();
export type PriceObservation = z.infer<typeof priceObservationSchema>;

export const constraintSchema = z
  .object({
    attribute: z.string().min(1).max(120),
    operator: z.enum(['eq', 'neq', 'lte', 'gte', 'oneOf', 'exists']),
    value: z
      .union([
        z.string().max(300),
        z.number().finite(),
        z.boolean(),
        z.array(z.string().max(300)).max(50),
      ])
      .optional(),
  })
  .strict();
export type SpecConstraint = z.infer<typeof constraintSchema>;

export const bomItemSchema = z
  .object({
    id,
    category: z.string().min(1).max(120),
    description: z.string().min(1).max(500),
    quantity: z.number().positive().finite(),
    unit: z.string().min(1).max(40),
    constraints: z.array(constraintSchema).max(30),
    codeTopics: z.array(z.string().min(1).max(120)).max(20),
    candidateProductIds: z.array(id).min(1).max(40),
  })
  .strict();
export type BomItem = z.infer<typeof bomItemSchema>;

// 'bom' is distinct from the older 'material-plan': items carry matchable
// constraints, code topics, and candidate products for catalog matching.
export const bomPayloadSchema = z
  .object({
    kind: z.literal('bom'),
    templateId: z.string().min(1).max(160),
    templateVersion: z.number().int().positive(),
    items: z.array(bomItemSchema).min(1).max(200),
  })
  .strict();
export type BomPayload = z.infer<typeof bomPayloadSchema>;

export const planLineSchema = z
  .object({
    bomItemId: id,
    offerId: id,
    productId: id,
    productName: z.string().min(1).max(300),
    retailer: z.string().min(1).max(200),
    sku: z.string().min(1).max(120),
    quantity: z.number().positive().finite(),
    packQuantity: z.number().positive().finite(),
    purchaseUnits: z.number().int().positive(),
    unitPriceMinor: z.number().int().nonnegative(),
    lineTotalMinor: z.number().int().nonnegative(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    observedAt: stamp,
    freshness: freshnessSchema,
    source: observationSourceSchema,
    codeTopics: z.array(z.string().max(120)).max(20),
  })
  .strict();
export type PlanLine = z.infer<typeof planLineSchema>;

export const rejectedCandidateSchema = z
  .object({ offerId: id, productId: id, reasons: z.array(z.string().min(1)).min(1).max(20) })
  .strict();
export type RejectedCandidate = z.infer<typeof rejectedCandidateSchema>;

export const purchasePlanPayloadSchema = z
  .object({
    kind: z.literal('purchase-plan'),
    tier: tierSchema,
    bomRef: ref,
    basis: z.enum(['fixture', 'verified', 'mixed']),
    lines: z.array(planLineSchema).min(1).max(200),
    rejected: z.array(rejectedCandidateSchema).max(200),
    totals: z
      .object({
        subtotalMinor: z.number().int().nonnegative(),
        shippingMinor: z.number().int().nonnegative(),
        currency: z.string().regex(/^[A-Z]{3}$/),
        taxExcluded: z.literal(true),
      })
      .strict(),
    builtAt: stamp,
    notes: z.array(z.string().max(500)).max(20),
  })
  .strict();
export type PurchasePlanPayload = z.infer<typeof purchasePlanPayloadSchema>;

export const priceSubmissionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    offerId: id,
    observerId: id,
    observedAt: stamp,
    unitPrice: moneySchema,
    stock: z.enum(['in_stock', 'limited', 'out_of_stock', 'unknown']),
    shippingEstimate: moneySchema.optional(),
    note: z.string().max(500).optional(),
    status: z.enum(['pending', 'approved', 'rejected']),
    reviewedAt: stamp.optional(),
    reason: z.string().max(500).optional(),
  })
  .strict();
export type PriceSubmission = z.infer<typeof priceSubmissionSchema>;

// Minimal normalized row for authorized affiliate/catalog feeds (Impact, CJ,
// retailer exports). Feed-specific fetching maps into this shape first.
export const affiliateRowSchema = z
  .object({
    retailer: z.string().min(1).max(200),
    sku: z.string().min(1).max(120),
    name: z.string().min(1).max(300),
    brand: z.string().max(200).optional(),
    model: z.string().max(200).optional(),
    upc: z.string().max(30).optional(),
    url: z.string().url().max(2000).optional(),
    price: z.number().nonnegative().finite().optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    availability: z.enum(['in_stock', 'limited', 'out_of_stock', 'unknown']).optional(),
    region: z.string().min(1).max(120).optional(),
    tier: tierSchema.optional(),
    productId: id.optional(),
  })
  .strict();
export type AffiliateRow = z.infer<typeof affiliateRowSchema>;

export const checkoutLineSchema = z
  .object({
    bomItemId: id,
    offerId: id,
    productId: id,
    productName: z.string().min(1).max(300),
    retailer: z.string().min(1).max(200),
    sku: z.string().min(1).max(120),
    url: z.string().url().max(2000).optional(),
    quantity: z.number().positive().finite(),
    purchaseUnits: z.number().int().positive(),
    unitPriceMinor: z.number().int().nonnegative(),
    lineTotalMinor: z.number().int().nonnegative(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    observedAt: stamp,
    freshness: freshnessSchema,
    source: observationSourceSchema,
  })
  .strict();
export type CheckoutLine = z.infer<typeof checkoutLineSchema>;

// The agent assembles; the human checks out. This artifact is the handoff:
// grouped retailer carts plus an explicit double-check list. Accepting it
// (via decision) records the customer's authorization to purchase.
export const checkoutReviewPayloadSchema = z
  .object({
    kind: z.literal('checkout-review'),
    purchasePlanRef: ref,
    groups: z
      .array(
        z
          .object({
            retailer: z.string().min(1).max(200),
            lines: z.array(checkoutLineSchema).min(1).max(200),
            subtotalMinor: z.number().int().nonnegative(),
            currency: z.string().regex(/^[A-Z]{3}$/),
            cartUrl: z.string().url().max(2000).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    totals: z
      .object({
        subtotalMinor: z.number().int().nonnegative(),
        currency: z.string().regex(/^[A-Z]{3}$/),
        taxExcluded: z.literal(true),
      })
      .strict(),
    checklist: z.array(z.string().min(1).max(500)).min(1).max(20),
    authorizationRequired: z.literal(true),
    builtAt: stamp,
    notes: z.array(z.string().max(500)).max(20),
  })
  .strict();
export type CheckoutReviewPayload = z.infer<typeof checkoutReviewPayloadSchema>;

export const catalogImportSchema = z
  .object({
    products: z.array(productSchema).max(2000),
    offers: z.array(offerSchema).max(5000),
    observations: z.array(priceObservationSchema).max(10000),
  })
  .strict();
export type CatalogImport = z.infer<typeof catalogImportSchema>;
