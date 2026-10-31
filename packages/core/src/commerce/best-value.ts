import type { BomPayload, PlanLine } from '@renovagent/contracts';
import { matchConstraints } from './matching.js';
import { lineTotalMinor, purchaseUnits } from './pricing.js';
import { sameUnit, shippingMinor, type PricedOffer } from './plans.js';

// Best value across every tier: hard rules (constraints, stock, unit,
// currency) filter candidates exactly as tier plans do; a model then judges
// each survivor's fit for this project and its quality level; code picks the
// cheapest candidate judged a fit, and the cheapest real step up. Prices stay
// the dated observations they came from.

export type ValueCandidate = {
  key: string;
  itemId: string;
  priced: PricedOffer;
  units: number;
  // Line total with shipping when it is known; null shipping is unknown.
  totalMinor: number;
  shippingMinor: number | null;
};
export type ValueJudgment = { fit: number; quality: number };
export type ValueLine = {
  itemId: string;
  purpose: string;
  quantity: number;
  unit: string;
  pick: (ValueCandidate & ValueJudgment) | null;
  upgrade: (ValueCandidate & ValueJudgment) | null;
  // Cheaper candidates passed over, and why.
  passedOver: { key: string; productName: string; totalMinor: number; reason: string }[];
};

type BomItem = BomPayload['items'][number];

// The hard rules shared by tier plans, best value and looks: why this offer
// cannot fill this item, or null when it can.
export function hardRuleReason(item: BomItem, p: PricedOffer, currency = 'USD'): string | null {
  const match = matchConstraints(p.product.specs, item.constraints);
  if (!match.ok) return match.reasons.join('; ');
  if (p.observation.unitPrice.currency !== currency)
    return `priced in ${p.observation.unitPrice.currency}`;
  if (p.observation.stock === 'out_of_stock') return 'out of stock when checked';
  if (!sameUnit(p.offer.packUnit, item.unit))
    return `sold per ${p.offer.packUnit}, needs ${item.unit}`;
  return null;
}

export function candidateFor(item: BomItem, p: PricedOffer): ValueCandidate {
  const units = purchaseUnits(item.quantity, p.offer.packQuantity);
  return {
    key: `${item.id}|${p.offer.id}`,
    itemId: item.id,
    priced: p,
    units,
    totalMinor: lineTotalMinor(units, p.observation.unitPrice.amountMinor),
    shippingMinor: shippingMinor(p),
  };
}

export function valueCandidates(bom: BomPayload, priced: PricedOffer[], currency = 'USD') {
  const out: ValueCandidate[] = [];
  for (const item of bom.items)
    for (const p of priced) {
      if (!item.candidateProductIds.includes(p.product.id)) continue;
      if (hardRuleReason(item, p, currency) === null) out.push(candidateFor(item, p));
    }
  return out;
}

export const cost = (c: ValueCandidate) => c.totalMinor + (c.shippingMinor ?? 0);
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function bestValue(
  bom: BomPayload,
  candidates: ValueCandidate[],
  judged: Record<string, ValueJudgment>,
  minFit = 0.7,
): ValueLine[] {
  return bom.items.map((item) => {
    const mine = candidates
      .filter((c) => c.itemId === item.id && judged[c.key])
      .map((c) => ({ ...c, ...judged[c.key]! }))
      // Unknown shipping ranks after known costs, as in tier plans.
      .sort(
        (a, b) =>
          Number(a.shippingMinor === null) - Number(b.shippingMinor === null) ||
          cost(a) - cost(b) ||
          (a.key < b.key ? -1 : 1),
      );
    const fits = mine.filter((c) => c.fit >= minFit);
    const pick = fits[0] ?? null;
    const upgrade = pick
      ? (fits.find((c) => c.quality >= pick.quality + 0.75 && cost(c) > cost(pick)) ?? null)
      : null;
    const passedOver = pick
      ? mine
          .filter((c) => cost(c) < cost(pick))
          .map((c) => ({
            key: c.key,
            productName: c.priced.product.name,
            totalMinor: cost(c),
            reason: `judged ${pct(c.fit)} fit, below ${pct(minFit)}`,
          }))
      : [];
    return {
      itemId: item.id,
      purpose: item.description,
      quantity: item.quantity,
      unit: item.unit,
      pick,
      upgrade,
      passedOver,
    };
  });
}

// What the same items cost in an existing tier plan, for comparison.
export function planTotalFor(lines: PlanLine[], itemIds: string[]) {
  return lines
    .filter((l) => itemIds.includes(l.bomItemId))
    .reduce((n, l) => n + l.lineTotalMinor, 0);
}
