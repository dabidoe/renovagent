import type { PricedLook, PricedOffer, ValueCandidate } from '@renovagent/core';
import {
  curatedLooks,
  lookBadges,
  type CuratedLook,
  type LookRoom,
} from '../../../fixtures/catalog/looks-2026-10.js';

export { curatedLooks };

export function lookRoomFor(recipeId: string | undefined): LookRoom {
  return recipeId === 'bathroom-refresh' ? 'bathroom' : 'living-room';
}

const seenFrom = (note: string | undefined) =>
  note?.includes('fetched product page') ? 'page' : 'search result';

function pickView(c: ValueCandidate) {
  const { product, offer, observation } = c.priced;
  return {
    productId: product.id,
    productName: product.name,
    manufacturer: product.manufacturer,
    retailer: offer.retailer,
    url: offer.url ?? null,
    tier: offer.tier,
    units: c.units,
    packQuantity: offer.packQuantity,
    packUnit: offer.packUnit,
    unitPriceMinor: observation.unitPrice.amountMinor,
    totalMinor: c.totalMinor,
    shippingMinor: c.shippingMinor,
    observedAt: observation.observedAt,
    source: observation.source,
    seen: seenFrom(observation.note),
  };
}

// What the Looks panel shows: each plan line priced, unfit with reasons, or
// not part of the look, plus every look product with its link and badges.
export function lookView(look: CuratedLook, result: PricedLook, priced: PricedOffer[]) {
  const products = look.productIds.flatMap((id) => {
    const p = priced.find((x) => x.product.id === id);
    return p
      ? [
          {
            productId: id,
            productName: p.product.name,
            manufacturer: p.product.manufacturer,
            category: p.product.category,
            retailer: p.offer.retailer,
            url: p.offer.url ?? null,
            unitPriceMinor: p.observation.unitPrice.amountMinor,
            packQuantity: p.offer.packQuantity,
            packUnit: p.offer.packUnit,
            observedAt: p.observation.observedAt,
            seen: seenFrom(p.observation.note),
            badges: lookBadges.filter((b) => b.productId === id),
          },
        ]
      : [];
  });
  return {
    id: look.id,
    name: look.name,
    blurb: look.blurb,
    style: look.style,
    tips: look.tips,
    totalMinor: result.totalMinor,
    lines: result.lines.map((l) =>
      l.status === 'priced'
        ? {
            itemId: l.itemId,
            purpose: l.purpose,
            status: l.status,
            pick: pickView(l.pick),
            alternatives: l.alternatives.map(pickView),
          }
        : l,
    ),
    notInPlan: result.notInPlan,
    products,
    // Products the catalog doesn't hold (yet) are left out, never invented.
    missing: look.productIds.filter((id) => !priced.some((p) => p.product.id === id)),
  };
}
