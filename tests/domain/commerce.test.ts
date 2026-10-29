import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCheckoutReview,
  buildTierPlans,
  checkCatalogReferences,
  lineTotalMinor,
  matchConstraints,
  normalizeAffiliateRows,
  purchaseUnits,
  sameRecord,
  validateCatalogImport,
  type PricedOffer,
} from '@renovagent/core';
import { vanityCatalog, vanityTemplate } from '../../fixtures/catalog/vanity-philadelphia.js';
import { Scenario } from '../foundation-helpers.js';

test('hard-constraint matching accepts fits and explains rejections', () => {
  assert.equal(
    matchConstraints({ width_in: 30 }, [{ attribute: 'width_in', operator: 'eq', value: 30 }]).ok,
    true,
  );
  assert.equal(
    matchConstraints({ depth_in: 21 }, [{ attribute: 'depth_in', operator: 'lte', value: 22 }]).ok,
    true,
  );
  assert.equal(
    matchConstraints({ material: 'quartz' }, [
      { attribute: 'material', operator: 'oneOf', value: ['quartz', 'granite'] },
    ]).ok,
    true,
  );
  const wrong = matchConstraints({ width_in: 36 }, [
    { attribute: 'width_in', operator: 'eq', value: 30 },
  ]);
  assert.equal(wrong.ok, false);
  assert.match(wrong.reasons.join(';'), /width_in is 36, needs 30/);
  const missing = matchConstraints({}, [{ attribute: 'holes', operator: 'eq', value: 1 }]);
  assert.equal(missing.ok, false);
  assert.match(missing.reasons.join(';'), /unknown/);
});

test('pack rounding rounds up to whole purchase units', () => {
  assert.equal(purchaseUnits(2, 1), 2);
  assert.equal(purchaseUnits(100, 20), 5);
  assert.equal(purchaseUnits(101, 20), 6);
  assert.equal(purchaseUnits(0.5, 1), 1);
  assert.equal(lineTotalMinor(6, 1250), 7500);
});

function pricedSeed(): PricedOffer[] {
  const products = new Map(vanityCatalog.products.map((p) => [p.id, p]));
  const observations = new Map(vanityCatalog.observations.map((o) => [o.offerId, o]));
  return vanityCatalog.offers.map((offer) => ({
    offer,
    product: products.get(offer.productId)!,
    observation: observations.get(offer.id)!,
  }));
}

test('tier plans build exact totals from the seed with explained rejections', () => {
  const [builder, mid, high] = buildTierPlans(vanityTemplate, pricedSeed());
  for (const plan of [builder, mid, high]) {
    assert.equal(plan.lines.length, 5);
    assert.equal(plan.basis, 'fixture');
    assert.equal(plan.totals.currency, 'USD');
    assert.equal(plan.totals.taxExcluded, true);
  }
  assert.equal(builder.totals.subtotalMinor, 30700);
  assert.equal(mid.totals.subtotalMinor, 77100);
  assert.equal(high.totals.subtotalMinor, 191200);
  const builderRejects = builder.rejected.find((r) => r.productId === 'van-cab-36')!;
  assert.match(builderRejects.reasons.join(';'), /width_in is 36, needs 30/);
  const midRejects = mid.rejected.find((r) => r.productId === 'van-fau-3hole')!;
  assert.match(midRejects.reasons.join(';'), /holes is 3, needs 1/);
  const supply = builder.lines.find((l) => l.bomItemId === 'supply-pair')!;
  assert.equal(supply.purchaseUnits, 2);
  assert.equal(supply.lineTotalMinor, 1800);
});

test('catalog import validation rejects duplicates and dangling references', () => {
  assert.doesNotThrow(() => validateCatalogImport(vanityCatalog));
  assert.throws(
    () =>
      validateCatalogImport({
        ...vanityCatalog,
        products: [...vanityCatalog.products, vanityCatalog.products[0]],
      }),
    /Duplicate products/,
  );
  assert.doesNotThrow(() =>
    checkCatalogReferences(vanityCatalog, { products: new Set(), offers: new Set() }),
  );
  assert.throws(
    () =>
      checkCatalogReferences(
        { ...vanityCatalog, products: [] },
        { products: new Set(), offers: new Set() },
      ),
    /unknown product/,
  );
  checkCatalogReferences(
    { products: [], offers: [], observations: [] },
    {
      products: new Set(vanityCatalog.products.map((p) => p.id)),
      offers: new Set(vanityCatalog.offers.map((o) => o.id)),
    },
  );
  assert.equal(sameRecord({ id: 'a' }, { id: 'a', _id: 'a' }), true);
  assert.equal(sameRecord({ id: 'a' }, { id: 'b' }), false);
});

test('affiliate rows normalize deterministically with priced observations', () => {
  const rows = [
    {
      retailer: 'Home Depot',
      sku: '1001234',
      name: 'Builder Single-Hole Faucet',
      brand: 'FixtureWorks',
      price: 39.98,
      currency: 'USD',
      availability: 'in_stock',
    },
    { retailer: 'Home Depot', sku: '1001235', name: 'Unpriced trim kit' },
  ];
  const first = normalizeAffiliateRows(rows, {
    region: '19148',
    observedAt: '2026-10-29T16:00:00Z',
  });
  const second = normalizeAffiliateRows(rows, {
    region: '19148',
    observedAt: '2026-10-29T16:00:00Z',
  });
  assert.deepEqual(first, second);
  assert.equal(first.products.length, 2);
  assert.equal(first.offers.length, 2);
  assert.equal(first.observations.length, 1);
  assert.equal(first.observations[0].unitPrice.amountMinor, 3998);
  assert.equal(first.observations[0].source, 'retailer-api');
  assert.equal(first.observations[0].freshness, 'recent');
  assert.doesNotThrow(() => validateCatalogImport(first));
  assert.throws(
    () =>
      normalizeAffiliateRows([{ retailer: 'x' }], {
        region: '19148',
        observedAt: '2026-10-29T16:00:00Z',
      }),
    /row 0 invalid/,
  );
  const multi = normalizeAffiliateRows(
    [
      {
        retailer: 'Amazon',
        sku: 'B0C1234567',
        name: 'Single-hole faucet',
        price: 42.5,
        currency: 'USD',
      },
      {
        retailer: 'Wayfair',
        sku: 'W00123456',
        name: 'Single-hole faucet',
        price: 45.0,
        currency: 'USD',
      },
      {
        retailer: "Lowe's",
        sku: '987654',
        name: 'Single-hole faucet',
        price: 41.98,
        currency: 'USD',
      },
    ],
    { region: '19148', observedAt: '2026-10-29T16:00:00Z' },
  );
  assert.equal(multi.products.length, 3);
  assert.equal(multi.offers.length, 3);
  assert.equal(multi.observations.length, 3);
  assert.doesNotThrow(() => validateCatalogImport(multi));
});

test('checkout review groups retailers and builds Amazon cart links only for ASINs', () => {
  const [builder] = buildTierPlans(vanityTemplate, pricedSeed());
  const plan = {
    kind: 'purchase-plan' as const,
    ...builder,
    bomRef: { kind: 'artifact' as const, id: 'project-a:bom', revision: 1 },
    builtAt: '2026-10-29T15:00:00.000Z',
  };
  const offers = new Map(vanityCatalog.offers.map((o) => [o.id, o]));
  const review = buildCheckoutReview(
    plan,
    { id: 'project-a:purchase-plan:builder', revision: 1 },
    offers,
    {
      builtAt: '2026-10-29T18:00:00.000Z',
    },
  );
  assert.equal(review.groups.length, 1);
  assert.equal(review.groups[0].cartUrl, undefined);
  assert.equal(review.totals.subtotalMinor, 30700);
  assert.equal(review.authorizationRequired, true);
  assert.ok(review.checklist.length >= 5);
  assert.match(review.notes.join(' '), /demo or unverified/);

  const amazonLines = plan.lines.map((line) => ({ ...line, retailer: 'Amazon' }));
  const amazonSkus = ['B0C1234567', 'B0C2345678', 'B0C3456789', 'B0C4567890', 'B0C5678901'];
  amazonLines.forEach((line, i) => (line.sku = amazonSkus[i]));
  const amazon = buildCheckoutReview(
    { ...plan, lines: amazonLines },
    { id: 'project-a:purchase-plan:builder', revision: 1 },
    offers,
    { associateTag: 'renovagent-20', builtAt: '2026-10-29T18:00:00.000Z' },
  );
  assert.ok(amazon.groups[0].cartUrl?.startsWith('https://www.amazon.com/gp/aws/cart/add.html?'));
  assert.match(amazon.groups[0].cartUrl!, /ASIN\.1=B0C1234567/);
  assert.match(amazon.groups[0].cartUrl!, /AssociateTag=renovagent-20/);

  amazonLines[0].sku = 'not-an-asin';
  const mixed = buildCheckoutReview(
    { ...plan, lines: amazonLines },
    { id: 'project-a:purchase-plan:builder', revision: 1 },
    offers,
    { builtAt: '2026-10-29T18:00:00.000Z' },
  );
  assert.equal(mixed.groups[0].cartUrl, undefined);
});

test('bom and purchase-plan artifacts flow through propose and accept', () => {
  const s = new Scenario();
  s.create();
  s.artifact('project-a:bom', [], 'project-a', vanityTemplate);
  const [builder] = buildTierPlans(vanityTemplate, pricedSeed());
  s.artifact(
    'project-a:purchase-plan:builder',
    [{ kind: 'artifact', id: 'project-a:bom', revision: 1 }],
    'project-a',
    {
      kind: 'purchase-plan',
      ...builder,
      bomRef: { kind: 'artifact', id: 'project-a:bom', revision: 1 },
      builtAt: '2026-10-29T15:00:00.000Z',
    },
  );
  s.accept('project-a:purchase-plan:builder');
  const plan = s.state.artifacts['project-a:purchase-plan:builder'].at(-1)!;
  assert.equal(plan.lifecycle, 'accepted');
  const decisions = Object.values(s.state.decisions);
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].outcome, 'accepted');
});
