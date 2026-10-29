import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCheckoutReview, buildTierPlans, type PricedOffer } from '@renovagent/core';
import {
  purchasePlanPayloadSchema,
  type BomPayload,
  type CheckoutReviewPayload,
  type Offer,
  type PriceObservation,
  type Product,
  type PurchasePlanPayload,
} from '@renovagent/contracts';
import { vanityCatalog, vanityTemplate } from '../../fixtures/catalog/vanity-philadelphia.js';
import { Scenario } from '../foundation-helpers.js';

// Synthetic records for regression cases only; not catalog data.
const product = (id: string, specs: Product['specs'] = {}): Product => ({
  schemaVersion: 1,
  id,
  manufacturer: 'Test',
  model: id,
  name: `Product ${id}`,
  category: 'test',
  identifiers: {},
  specs,
  certifications: [],
});
const offer = (id: string, productId: string, extra: Partial<Offer> = {}): Offer => ({
  schemaVersion: 1,
  id,
  productId,
  retailer: 'Test Retailer',
  sku: `SKU-${id}`,
  fulfillmentRegion: '00000',
  fulfillment: 'both',
  tier: 'builder',
  packQuantity: 1,
  packUnit: 'ea',
  ...extra,
});
const observation = (
  offerId: string,
  amountMinor: number,
  extra: Partial<PriceObservation> = {},
): PriceObservation => ({
  schemaVersion: 1,
  id: `obs-${offerId}`,
  offerId,
  observedAt: '2026-10-01T00:00:00.000Z',
  unitPrice: { amountMinor, currency: 'USD' },
  stock: 'in_stock',
  source: 'example-import',
  freshness: 'historical',
  ...extra,
});
const priced = (o: Offer, p: Product, obs: PriceObservation): PricedOffer => ({
  offer: o,
  product: p,
  observation: obs,
});
const bom = (unit = 'ea', quantity = 1): BomPayload => ({
  kind: 'bom',
  templateId: 'test-template',
  templateVersion: 1,
  items: [
    {
      id: 'item-a',
      category: 'test',
      description: 'Test item',
      quantity,
      unit,
      constraints: [],
      codeTopics: [],
      candidateProductIds: ['p1', 'p2'],
    },
  ],
});
const builderOf = (b: BomPayload, offers: PricedOffer[]) => buildTierPlans(b, offers)[0];

test('every offer for one product competes, independent of input order', () => {
  const p1 = product('p1');
  const cheap = priced(offer('o-cheap', 'p1'), p1, observation('o-cheap', 100));
  const dear = priced(offer('o-dear', 'p1'), p1, observation('o-dear', 99900));
  const forward = builderOf(bom(), [cheap, dear]);
  const reverse = builderOf(bom(), [dear, cheap]);
  assert.deepEqual(forward, reverse);
  assert.equal(forward.lines[0].offerId, 'o-cheap');
  assert.equal(forward.totals.subtotalMinor, 100);
  assert.ok(forward.rejected.some((r) => r.offerId === 'o-dear'));
});

test('offers rank by delivered cost, and shipping totals use the chosen offers', () => {
  const p1 = product('p1');
  const shipped = priced(
    offer('o-ship', 'p1', { fulfillment: 'shipping' }),
    p1,
    observation('o-ship', 10000, { shippingEstimate: { amountMinor: 5000, currency: 'USD' } }),
  );
  const pickup = priced(
    offer('o-pickup', 'p1', { fulfillment: 'pickup' }),
    p1,
    observation('o-pickup', 12000),
  );
  const plan = builderOf(bom(), [shipped, pickup]);
  assert.equal(plan.lines[0].offerId, 'o-pickup');
  assert.equal(plan.totals.shippingMinor, 0);
  assert.equal(plan.totals.subtotalMinor, 12000);
});

test('unknown shipping never wins by omission, but remains usable with a note', () => {
  const p1 = product('p1');
  const unknownShipping = priced(
    offer('o-unknown', 'p1', { fulfillment: 'shipping' }),
    p1,
    observation('o-unknown', 5000),
  );
  const known = priced(
    offer('o-known', 'p1', { fulfillment: 'shipping' }),
    p1,
    observation('o-known', 8000, { shippingEstimate: { amountMinor: 1000, currency: 'USD' } }),
  );
  assert.equal(builderOf(bom(), [unknownShipping, known]).lines[0].offerId, 'o-known');
  const only = builderOf(bom(), [unknownShipping]);
  assert.equal(only.lines[0].offerId, 'o-unknown');
  assert.match(only.notes.join(' '), /shipping .*unknown/i);
});

test('out-of-stock offers are rejected; unknown stock is kept and flagged', () => {
  const p1 = product('p1');
  const out = priced(
    offer('o-out', 'p1'),
    p1,
    observation('o-out', 100, { stock: 'out_of_stock' }),
  );
  const unsure = priced(
    offer('o-unsure', 'p1'),
    p1,
    observation('o-unsure', 500, { stock: 'unknown' }),
  );
  const plan = builderOf(bom(), [out, unsure]);
  assert.equal(plan.lines[0].offerId, 'o-unsure');
  assert.match(plan.rejected.find((r) => r.offerId === 'o-out')!.reasons.join(';'), /out of stock/);
  assert.match(plan.notes.join(' '), /stock/i);
});

test('pack units must be compatible with the BOM unit', () => {
  const p1 = product('p1');
  const p2 = product('p2');
  const sheet = priced(
    offer('o-sheet', 'p1', { packUnit: 'sheet' }),
    p1,
    observation('o-sheet', 100),
  );
  const each = priced(offer('o-each', 'p2', { packUnit: 'each' }), p2, observation('o-each', 900));
  const plan = builderOf(bom('ea'), [sheet, each]);
  assert.equal(plan.lines[0].offerId, 'o-each');
  assert.match(
    plan.rejected.find((r) => r.offerId === 'o-sheet')!.reasons.join(';'),
    /pack unit sheet/,
  );
});

test('the curated seed keeps its tier totals after ranking changes', () => {
  const products = new Map(vanityCatalog.products.map((p) => [p.id, p]));
  const observations = new Map(vanityCatalog.observations.map((o) => [o.offerId, o]));
  const seed = vanityCatalog.offers.map((o) =>
    priced(o, products.get(o.productId)!, observations.get(o.id)!),
  );
  const totals = buildTierPlans(vanityTemplate, seed).map((p) => p.totals.subtotalMinor);
  assert.deepEqual(totals, [30700, 77100, 191200]);
  assert.deepEqual(
    buildTierPlans(vanityTemplate, [...seed].reverse()).map((p) => p.totals.subtotalMinor),
    totals,
  );
});

// --- Proposal-grade semantic validation -----------------------------------

const BOM_REF = { kind: 'artifact' as const, id: 'project-a:bom', revision: 1 };
const PLAN_ID = 'project-a:purchase-plan:builder';

function seeded(): { s: Scenario; plan: PurchasePlanPayload } {
  const s = new Scenario();
  s.create();
  s.artifact('project-a:bom', [], 'project-a', vanityTemplate);
  const products = new Map(vanityCatalog.products.map((p) => [p.id, p]));
  const observations = new Map(vanityCatalog.observations.map((o) => [o.offerId, o]));
  const [built] = buildTierPlans(
    vanityTemplate,
    vanityCatalog.offers.map((o) => priced(o, products.get(o.productId)!, observations.get(o.id)!)),
  );
  return {
    s,
    plan: { kind: 'purchase-plan', ...built, bomRef: BOM_REF, builtAt: '2026-10-29T15:00:00.000Z' },
  };
}
const proposePlan = (s: Scenario, plan: PurchasePlanPayload, refs = [BOM_REF]) =>
  s.artifact(PLAN_ID, refs, 'project-a', plan);

test('a consistent purchase plan is accepted as a proposal', () => {
  const { s, plan } = seeded();
  assert.doesNotThrow(() => proposePlan(s, plan));
});

test('purchase-plan arithmetic cannot be asserted', () => {
  const tamper: ((plan: PurchasePlanPayload) => void)[] = [
    (p) => (p.totals.subtotalMinor -= 1),
    (p) => (p.lines[0].lineTotalMinor += 100),
    (p) => (p.lines[0].purchaseUnits += 1),
    (p) => (p.lines[0].quantity = 9),
    (p) => (p.lines[0].currency = 'CAD'),
    (p) => (p.basis = 'verified'),
    // Swapping in an incompatible *candidate* needs product specs: see the MCP catalog recheck.
    (p) => (p.lines[0].productId = 'not-a-candidate'),
    (p) => p.lines.push({ ...p.lines[0] }),
    (p) => (p.lines[0].bomItemId = 'not-in-bom'),
  ];
  for (const [index, change] of tamper.entries()) {
    const { s, plan } = seeded();
    change(plan);
    assert.throws(() => proposePlan(s, plan), /VALIDATION|purchase plan/i, `tamper case ${index}`);
  }
});

test('a purchase plan must depend on the exact BOM revision it names', () => {
  const { s, plan } = seeded();
  assert.throws(() => proposePlan(s, plan, []), /BOM/);
  s.artifact('project-a:brief', [], 'project-a');
  const notBom = { kind: 'artifact' as const, id: 'project-a:brief', revision: 1 };
  assert.throws(() => proposePlan(s, { ...plan, bomRef: notBom }, [notBom]), /BOM/);
});

function withCheckout() {
  const { s, plan } = seeded();
  proposePlan(s, plan);
  const offers = new Map(vanityCatalog.offers.map((o) => [o.id, o]));
  const review = buildCheckoutReview(plan, { id: PLAN_ID, revision: 1 }, offers, {
    builtAt: '2026-10-29T18:00:00.000Z',
  });
  return { s, review };
}
const proposeReview = (
  s: Scenario,
  review: CheckoutReviewPayload,
  refs = [review.purchasePlanRef],
) => s.artifact('project-a:checkout-review:builder', refs, 'project-a', review);

test('a checkout review must match its current purchase plan', () => {
  const { s, review } = withCheckout();
  assert.doesNotThrow(() => proposeReview(s, structuredClone(review)));

  const priceChanged = structuredClone(review);
  priceChanged.groups[0].lines[0].unitPriceMinor = 1;
  assert.throws(() => proposeReview(withCheckout().s, priceChanged), /checkout/i);

  const dropped = structuredClone(review);
  dropped.groups[0].lines.pop();
  assert.throws(() => proposeReview(withCheckout().s, dropped), /checkout/i);

  const total = structuredClone(review);
  total.totals.subtotalMinor += 1;
  assert.throws(() => proposeReview(withCheckout().s, total), /checkout/i);

  assert.throws(
    () => proposeReview(withCheckout().s, structuredClone(review), []),
    /purchase plan/i,
  );
});

test('BOM revisions stale the plan and its checkout, and block a new checkout from the old plan', () => {
  const { s, review } = withCheckout();
  proposeReview(s, structuredClone(review));
  s.artifact('project-a:bom', [], 'project-a', { ...vanityTemplate, templateVersion: 2 });
  assert.notEqual(s.state.artifacts[PLAN_ID].at(-1)!.freshness, 'current');
  assert.notEqual(
    s.state.artifacts['project-a:checkout-review:builder'].at(-1)!.freshness,
    'current',
  );
  assert.throws(() => proposeReview(s, structuredClone(review)), /STALE|current/i);
});

test('large BOMs with many gaps still produce schema-valid plans', () => {
  const items = Array.from({ length: 60 }, (_, i) => ({
    ...bom().items[0],
    id: `item-with-a-deliberately-long-identifier-${String(i).padStart(3, '0')}`,
    candidateProductIds: i < 30 ? [`p${i}`] : ['missing-product'],
  }));
  const offers = Array.from({ length: 30 }, (_, i) => {
    const p = product(`p${i}`);
    return Array.from({ length: 8 }, (_, j) =>
      priced(
        offer(`o${i}-${j}`, p.id, { fulfillment: 'shipping' }),
        p,
        observation(`o${i}-${j}`, 1000 + j, { stock: 'unknown' }),
      ),
    );
  }).flat();
  const built = builderOf({ ...bom(), items }, offers);
  const parsed = purchasePlanPayloadSchema.safeParse({
    kind: 'purchase-plan',
    ...built,
    bomRef: BOM_REF,
    builtAt: '2026-10-29T15:00:00.000Z',
  });
  assert.equal(parsed.success, true, parsed.success ? '' : parsed.error.message);
  assert.match(built.notes.join(' '), /No acceptable builder offer for 30 items: .*\(\+24 more\)/);
  assert.match(built.notes.join(' '), /further rejected candidates are not listed/);
});

test('tiered slots hold only their own tier', () => {
  const { s, plan } = seeded();
  assert.throws(
    () => s.artifact('project-a:purchase-plan:mid', [BOM_REF], 'project-a', plan),
    /mid tier, not builder/,
  );
  const { s: s2, review } = withCheckout();
  assert.throws(
    () =>
      s2.artifact('project-a:checkout-review:high', [review.purchasePlanRef], 'project-a', review),
    /high tier, not builder/,
  );
});
