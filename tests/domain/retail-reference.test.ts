import test from 'node:test';
import assert from 'node:assert/strict';
import type { Command, ScopeDraft } from '@renovagent/contracts';
import {
  bomFromScopeDraft,
  scopeDraftId,
  validateCatalogImport,
  valueCandidates,
  type PricedOffer,
} from '@renovagent/core';
import { retailReferenceCatalog as catalog } from '../../fixtures/catalog/retail-reference-2026-10.js';
import { Scenario } from '../foundation-helpers.js';

const priced: PricedOffer[] = catalog.offers.map((offer) => ({
  offer,
  product: catalog.products.find((p) => p.id === offer.productId)!,
  observation: catalog.observations.find((o) => o.offerId === offer.id)!,
}));

test('the retail reference is a valid import of hand-checked prices, never demo or live', () => {
  validateCatalogImport(catalog);
  for (const o of catalog.observations) {
    assert.equal(o.source, 'manual-entry', o.id);
    assert.equal(o.freshness, 'recent', o.id);
    // Every price names the page it came from and how it was seen.
    assert.match(o.note!, /^Checked 2026-10-30, (fetched product page|search result only)/, o.id);
    assert.match(o.note!, /https:\/\//, o.id);
  }
  for (const offer of catalog.offers) assert.ok(offer.url?.startsWith('https://'), offer.id);
  for (const p of catalog.products) assert.doesNotMatch(p.manufacturer, /demo/i, p.id);
});

test('every bathroom vanity item has a real product that clears the recipe’s hard rules', () => {
  const s = new Scenario();
  s.create();
  s.apply(
    s.command('DraftScope', {
      recipeId: 'bathroom-refresh',
      packageIds: ['vanity'],
      request: 'Replace the vanity',
      reported: [{ key: 'vanityWidthIn', amount: 30, unit: 'in' }],
      expectedDraftRevision: 0,
    } satisfies Extract<Command, { type: 'DraftScope' }>['payload']),
  );
  const draft = s.state.artifacts[scopeDraftId('project-a')].at(-1)!.payload as ScopeDraft;
  const { bom } = bomFromScopeDraft(draft, catalog.products);
  assert.ok(bom);
  const candidates = valueCandidates(bom, priced);
  for (const item of bom.items)
    assert.ok(
      candidates.some((c) => c.itemId === item.id),
      `${item.id} has no qualifying retail product`,
    );
  // Unpublished or mismatched specs keep a product out instead of guessing.
  const faucets = candidates.filter((c) => c.itemId === 'vanity:faucet');
  assert.deepEqual(
    faucets.map((c) => c.priced.product.id),
    ['rr-fau-pfister-pfirst-modern'],
  );
  assert.ok(
    !candidates.some((c) => c.priced.product.id === 'rr-van-homeibro-plywood-30'),
    'mount not published',
  );
});

test('living-room categories each carry at least two real products to compare', () => {
  for (const category of ['interior-paint', 'vinyl-plank', 'floor-underlayment', 'quarter-round'])
    assert.ok(catalog.products.filter((p) => p.category === category).length >= 2, category);
  assert.ok(catalog.products.some((p) => p.category === 'engineered-hardwood'));
});
