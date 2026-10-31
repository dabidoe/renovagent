import type { BomPayload } from '@renovagent/contracts';
import { candidateFor, cost, hardRuleReason, type ValueCandidate } from './best-value.js';
import type { PricedOffer } from './plans.js';

// A look is a curated set of catalog products. Pricing it for a project uses
// the plan's own quantities and the same hard rules as tier plans: each plan
// item takes the look's cheapest product that passes them. A look product that
// fails is shown with its reason rather than dropped, so a product people came
// to see never silently disappears. Matching is by category and constraints,
// not the materials list's saved candidates, so products added to the catalog
// after the list was built still count.

export type LookLine =
  // The cheapest fitting look product, and the look's other fitting options.
  | {
      itemId: string;
      purpose: string;
      status: 'priced';
      pick: ValueCandidate;
      alternatives: ValueCandidate[];
    }
  | {
      itemId: string;
      purpose: string;
      status: 'does-not-fit';
      rejected: { productId: string; productName: string; reason: string }[];
    }
  | { itemId: string; purpose: string; status: 'not-in-look' }
  // Covered by another pick, such as a vanity sold with its top and sink.
  | { itemId: string; purpose: string; status: 'included'; withProductName: string };

// A picked product whose spec says it includes another item's category.
const INCLUDES: Record<string, string> = { includes_top: 'vanity-top' };

export type PricedLook = {
  lines: LookLine[];
  totalMinor: number;
  // Look products for work the plan doesn't include (hardwood when the plan
  // is vinyl plank, say).
  notInPlan: { productId: string; productName: string; category: string }[];
};

export function priceLook(
  bom: BomPayload,
  priced: PricedOffer[],
  productIds: string[],
  currency = 'USD',
): PricedLook {
  const mine = priced.filter((p) => productIds.includes(p.product.id));
  const lines: LookLine[] = bom.items.map((item): LookLine => {
    const inCategory = mine.filter((p) => p.product.category === item.category);
    if (!inCategory.length)
      return { itemId: item.id, purpose: item.description, status: 'not-in-look' };
    const passing = inCategory
      .filter((p) => hardRuleReason(item, p, currency) === null)
      .map((p) => candidateFor(item, p))
      .sort((a, b) => cost(a) - cost(b) || (a.key < b.key ? -1 : 1));
    return passing[0]
      ? {
          itemId: item.id,
          purpose: item.description,
          status: 'priced',
          pick: passing[0],
          alternatives: passing.slice(1),
        }
      : {
          itemId: item.id,
          purpose: item.description,
          status: 'does-not-fit',
          rejected: inCategory.map((p) => ({
            productId: p.product.id,
            productName: p.product.name,
            reason: hardRuleReason(item, p, currency)!,
          })),
        };
  });
  for (const [spec, category] of Object.entries(INCLUDES)) {
    const by = lines.find(
      (l) => l.status === 'priced' && l.pick.priced.product.specs[spec] === true,
    );
    if (by?.status !== 'priced') continue;
    lines.forEach((l, i) => {
      if (bom.items[i]!.category === category)
        lines[i] = {
          itemId: l.itemId,
          purpose: l.purpose,
          status: 'included',
          withProductName: by.pick.priced.product.name,
        };
    });
  }
  const planned = new Set(bom.items.map((i) => i.category));
  const seen = new Set<string>();
  const notInPlan = mine
    .filter((p) => !planned.has(p.product.category))
    .filter((p) => !seen.has(p.product.id) && !!seen.add(p.product.id))
    .map((p) => ({
      productId: p.product.id,
      productName: p.product.name,
      category: p.product.category,
    }));
  return {
    lines,
    totalMinor: lines.reduce((n, l) => n + (l.status === 'priced' ? cost(l.pick) : 0), 0),
    notInPlan,
  };
}
