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

function buildTierPlan(tier: Tier, bom: BomPayload, priced: PricedOffer[]): BuiltPlan {
  const lines: PlanLine[] = [];
  const rejected: RejectedCandidate[] = [];
  const notes: string[] = [];
  const byProduct = new Map(priced.map((p) => [p.product.id, p]));
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
  for (const item of bom.items) {
    const options: { priced: PricedOffer; units: number; total: number }[] = [];
    for (const productId of item.candidateProductIds) {
      const candidate = byProduct.get(productId);
      if (!candidate) continue;
      const match = matchConstraints(candidate.product.specs, item.constraints);
      const reasons = [...match.reasons];
      if (candidate.observation.unitPrice.currency !== currency)
        reasons.push(
          `priced in ${candidate.observation.unitPrice.currency}, plan uses ${currency}`,
        );
      if (reasons.length) {
        rejected.push({
          offerId: candidate.offer.id,
          productId: candidate.product.id,
          reasons,
        });
        continue;
      }
      const units = purchaseUnits(item.quantity, candidate.offer.packQuantity);
      options.push({
        priced: candidate,
        units,
        total: lineTotalMinor(units, candidate.observation.unitPrice.amountMinor),
      });
    }
    options.sort((a, b) => a.total - b.total || (a.priced.offer.id < b.priced.offer.id ? -1 : 1));
    const [winner, ...losers] = options;
    for (const loser of losers)
      rejected.push({
        offerId: loser.priced.offer.id,
        productId: loser.priced.product.id,
        reasons: [`higher line total than ${winner.priced.offer.sku}`],
      });
    if (!winner) {
      notes.push(`No acceptable ${tier} offer for ${item.id} (${item.description})`);
      continue;
    }
    lines.push(toLine(item, winner));
  }
  const fixtureLines = lines.filter((line) => line.source === 'example-import').length;
  return {
    tier,
    basis: fixtureLines === 0 ? 'verified' : fixtureLines === lines.length ? 'fixture' : 'mixed',
    lines,
    rejected,
    totals: {
      subtotalMinor: lines.reduce((sum, line) => sum + line.lineTotalMinor, 0),
      shippingMinor: lines.reduce(
        (sum, line) =>
          sum +
          (priced.find((p) => p.offer.id === line.offerId)?.observation.shippingEstimate
            ?.amountMinor ?? 0),
        0,
      ),
      currency,
      taxExcluded: true as const,
    },
    notes: [
      ...notes,
      'Prices are dated observations, not live checkout totals. Verify before purchase.',
      'Tax excluded; shipping is an estimate.',
    ],
  };
}

function toLine(
  item: BomItem,
  winner: { priced: PricedOffer; units: number; total: number },
): PlanLine {
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
