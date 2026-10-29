import type { CheckoutReviewPayload, Offer, PurchasePlanPayload } from '@renovagent/contracts';

export const CHECKOUT_CHECKLIST = [
  'Confirm quantities and pack sizes match the plan lines.',
  'Confirm the delivery ZIP and dates at the retailer before paying.',
  'Confirm the final checkout price; dated observations may have moved.',
  'Confirm substitution and return terms for each retailer.',
  'Confirm the delivery or pickup recipient and contact details.',
  'Keep the receipt: it feeds project accounting.',
];

// The agent assembles retailer carts; the customer checks out. Cart URLs are
// built only for retailers with a documented add-to-cart link scheme (Amazon);
// every other line carries its product URL for manual checkout.
export function buildCheckoutReview(
  plan: PurchasePlanPayload,
  planRef: { id: string; revision: number },
  offers: Map<string, Offer>,
  options: { associateTag?: string; builtAt?: string } = {},
): CheckoutReviewPayload {
  const groups = new Map<string, CheckoutReviewPayload['groups'][number]>();
  for (const line of plan.lines) {
    const offer = offers.get(line.offerId);
    const entry = {
      bomItemId: line.bomItemId,
      offerId: line.offerId,
      productId: line.productId,
      productName: line.productName,
      retailer: line.retailer,
      sku: line.sku,
      ...(offer?.url ? { url: offer.url } : {}),
      quantity: line.quantity,
      purchaseUnits: line.purchaseUnits,
      unitPriceMinor: line.unitPriceMinor,
      lineTotalMinor: line.lineTotalMinor,
      currency: line.currency,
      observedAt: line.observedAt,
      freshness: line.freshness,
      source: line.source,
    };
    const group = groups.get(line.retailer) ?? {
      retailer: line.retailer,
      lines: [],
      subtotalMinor: 0,
      currency: plan.totals.currency,
    };
    group.lines.push(entry);
    group.subtotalMinor += line.lineTotalMinor;
    groups.set(line.retailer, group);
  }
  for (const group of groups.values()) {
    const cartUrl = buildCartUrl(group.retailer, group.lines, options.associateTag);
    if (cartUrl) group.cartUrl = cartUrl;
  }
  return {
    kind: 'checkout-review',
    purchasePlanRef: { kind: 'artifact', id: planRef.id, revision: planRef.revision },
    groups: [...groups.values()],
    totals: {
      subtotalMinor: plan.lines.reduce((sum, line) => sum + line.lineTotalMinor, 0),
      currency: plan.totals.currency,
      taxExcluded: true,
    },
    checklist: [...CHECKOUT_CHECKLIST],
    authorizationRequired: true,
    builtAt: options.builtAt ?? new Date().toISOString(),
    notes: [
      ...(plan.basis === 'verified'
        ? []
        : ['Plan prices include demo or unverified observations; verify every line at checkout.']),
      'Cart links open the retailer. Renovagent never completes purchases.',
    ],
  };
}

function buildCartUrl(
  retailer: string,
  lines: { sku: string; purchaseUnits: number }[],
  associateTag?: string,
): string | undefined {
  if (retailer.toLowerCase() !== 'amazon') return undefined;
  if (!lines.every((line) => /^[A-Z0-9]{10}$/.test(line.sku))) return undefined;
  const params = new URLSearchParams();
  lines.forEach((line, index) => {
    params.set(`ASIN.${index + 1}`, line.sku);
    params.set(`Quantity.${index + 1}`, String(line.purchaseUnits));
  });
  if (associateTag) params.set('AssociateTag', associateTag);
  return `https://www.amazon.com/gp/aws/cart/add.html?${params.toString()}`;
}
