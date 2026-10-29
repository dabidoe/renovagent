import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTierPlans,
  checkCatalogReferences,
  lineTotalMinor,
  matchConstraints,
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
