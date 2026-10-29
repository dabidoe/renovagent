import type {
  BomItem,
  BomPayload,
  Offer,
  PlanLine,
  PriceObservation,
  Product,
  PurchasePlanPayload,
  RejectedCandidate,
  Tier,
} from '@renovagent/contracts';
import { matchConstraints } from './matching.js';
import { lineTotalMinor, purchaseUnits } from './pricing.js';

export type PricedOffer = { offer: Offer; product: Product; observation: PriceObservation };
export type BuiltPlan = Omit<PurchasePlanPayload, 'kind' | 'bomRef' | 'builtAt'> & {
  tier: Tier;
};

const TIERS: Tier[] = ['builder', 'mid', 'high'];

// One plan per tier from matching offers. Cheapest acceptable line wins each
// item; everything else is kept as an explicit rejection with reasons.
export function buildTierPlans(bom: BomPayload, priced: PricedOffer[]): BuiltPlan[] {
  return TIERS.map((tier) =>
    buildTierPlan(
      tier,
      bom,
      priced.filter((p) => p.offer.tier === tier),
    ),
  );
}

type Option = {
  priced: PricedOffer;
  units: number;
  total: number;
  // null when a shipping-only offer has no estimate: unknown, never $0.
  shipping: number | null;
};

// Shipping applies only when the offer must ship. Pickup-capable offers carry
// no surcharge; a shipping-only offer without an estimate has unknown cost.
export function shippingMinor(priced: PricedOffer): number | null {
  if (priced.offer.fulfillment !== 'shipping') return 0;
  return priced.observation.shippingEstimate?.amountMinor ?? null;
}

const UNIT_ALIASES: Record<string, string> = {
  ea: 'ea',
  each: 'ea',
  unit: 'ea',
  units: 'ea',
  pc: 'ea',
  pcs: 'ea',
  piece: 'ea',
  pieces: 'ea',
};

// Explicit aliases only; anything else must match exactly after normalizing.
export function sameUnit(a: string, b: string): boolean {
  const norm = (unit: string) => {
    const key = unit.trim().toLowerCase().replace(/\.$/, '');
    return UNIT_ALIASES[key] ?? key;
  };
  return norm(a) === norm(b);
}

function rank(a: Option, b: Option): number {
  const unknownA = a.shipping === null ? 1 : 0;
  const unknownB = b.shipping === null ? 1 : 0;
  return (
    unknownA - unknownB ||
    a.total + (a.shipping ?? 0) - (b.total + (b.shipping ?? 0)) ||
    (a.priced.offer.id < b.priced.offer.id ? -1 : a.priced.offer.id > b.priced.offer.id ? 1 : 0)
  );
}

function buildTierPlan(tier: Tier, bom: BomPayload, priced: PricedOffer[]): BuiltPlan {
  const lines: PlanLine[] = [];
  const rejected: RejectedCandidate[] = [];
  const missing: string[] = [];
  const byProduct = new Map<string, PricedOffer[]>();
  for (const candidate of priced)
    byProduct.set(candidate.product.id, [
      ...(byProduct.get(candidate.product.id) ?? []),
      candidate,
    ]);
  // Single-currency plans: use the most common observation currency, ties broken alphabetically.
  const currencies = priced.map((p) => p.observation.unitPrice.currency).sort();
  const currency =
    currencies
      .slice()
      .sort(
        (a, b) =>
          currencies.filter((c) => c === b).length - currencies.filter((c) => c === a).length ||
          (a < b ? -1 : 1),
      )[0] ?? 'USD';
  let shipping = 0;
  const unknownShipping: string[] = [];
  const unverifiedStock: string[] = [];
  for (const item of bom.items) {
    const options: Option[] = [];
    for (const productId of item.candidateProductIds) {
      for (const candidate of byProduct.get(productId) ?? []) {
        const match = matchConstraints(candidate.product.specs, item.constraints);
        const reasons = [...match.reasons];
        const { observation, offer } = candidate;
        if (observation.unitPrice.currency !== currency)
          reasons.push(`priced in ${observation.unitPrice.currency}, plan uses ${currency}`);
        if (
          offer.fulfillment === 'shipping' &&
          observation.shippingEstimate &&
          observation.shippingEstimate.currency !== currency
        )
          reasons.push(`shipping priced in ${observation.shippingEstimate.currency}`);
        if (observation.stock === 'out_of_stock')
          reasons.push(`out of stock as of ${observation.observedAt.slice(0, 10)}`);
        if (!sameUnit(offer.packUnit, item.unit))
          reasons.push(`pack unit ${offer.packUnit} does not match BOM unit ${item.unit}`);
        if (reasons.length) {
          rejected.push({ offerId: offer.id, productId: candidate.product.id, reasons });
          continue;
        }
        const units = purchaseUnits(item.quantity, offer.packQuantity);
        options.push({
          priced: candidate,
          units,
          total: lineTotalMinor(units, observation.unitPrice.amountMinor),
          shipping: shippingMinor(candidate),
        });
      }
    }
    options.sort(rank);
    const [winner, ...losers] = options;
    for (const loser of losers)
      rejected.push({
        offerId: loser.priced.offer.id,
        productId: loser.priced.product.id,
        reasons: [
          winner.shipping === null || loser.shipping !== null
            ? `higher delivered cost than ${winner.priced.offer.sku}`
            : `shipping cost unknown; ${winner.priced.offer.sku} has a known delivered cost`,
        ],
      });
    if (!winner) {
      missing.push(item.id);
      continue;
    }
    if (winner.shipping === null) unknownShipping.push(item.id);
    else shipping += winner.shipping;
    if (winner.priced.observation.stock !== 'in_stock') unverifiedStock.push(item.id);
    lines.push(toLine(item, winner));
  }
  return {
    tier,
    basis: planBasis(lines),
    lines,
    rejected: rejected.slice(0, MAX_REJECTED),
    totals: {
      subtotalMinor: lines.reduce((sum, line) => sum + line.lineTotalMinor, 0),
      shippingMinor: shipping,
      currency,
      taxExcluded: true as const,
    },
    // One aggregated note per kind keeps any BOM size inside the schema limits.
    notes: [
      ...(missing.length
        ? [note(`No acceptable ${tier} offer for`, missing, '; these items are unpriced.')]
        : []),
      ...(unknownShipping.length
        ? [note('Shipping cost unknown for', unknownShipping, '; not included in totals.')]
        : []),
      ...(unverifiedStock.length
        ? [note('Stock not confirmed for', unverifiedStock, '; check before purchase.')]
        : []),
      ...(rejected.length > MAX_REJECTED
        ? [`${rejected.length - MAX_REJECTED} further rejected candidates are not listed.`]
        : []),
      'Prices are dated observations, not live checkout totals. Verify before purchase.',
      'Tax excluded; shipping is an estimate.',
    ],
  };
}

const MAX_REJECTED = 200;
const LISTED_ITEMS = 6;

function note(prefix: string, itemIds: string[], suffix: string): string {
  const listed = itemIds.slice(0, LISTED_ITEMS).join(', ');
  const more = itemIds.length > LISTED_ITEMS ? ` (+${itemIds.length - LISTED_ITEMS} more)` : '';
  const count = `${itemIds.length} ${itemIds.length === 1 ? 'item' : 'items'}`;
  return `${prefix} ${count}: ${listed}${more}${suffix}`.slice(0, 500);
}

// Basis is derived from line sources, never asserted.
export function planBasis(lines: Pick<PlanLine, 'source'>[]): PurchasePlanPayload['basis'] {
  const fixtureLines = lines.filter((line) => line.source === 'example-import').length;
  return fixtureLines === 0 ? 'verified' : fixtureLines === lines.length ? 'fixture' : 'mixed';
}

function toLine(item: BomItem, winner: Option): PlanLine {
  const { offer, product, observation } = winner.priced;
  return {
    bomItemId: item.id,
    offerId: offer.id,
    productId: product.id,
    productName: product.name,
    retailer: offer.retailer,
    sku: offer.sku,
    quantity: item.quantity,
    packQuantity: offer.packQuantity,
    purchaseUnits: winner.units,
    unitPriceMinor: observation.unitPrice.amountMinor,
    lineTotalMinor: winner.total,
    currency: observation.unitPrice.currency,
    observedAt: observation.observedAt,
    freshness: observation.freshness,
    source: observation.source,
    codeTopics: item.codeTopics,
  };
}
