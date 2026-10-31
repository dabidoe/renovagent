import test from 'node:test';
import assert from 'node:assert/strict';
import type { Command, ScopeDraft } from '@renovagent/contracts';
import {
  bomFromScopeDraft,
  priceLook,
  scopeDraftId,
  validateCatalogImport,
  type PricedOffer,
} from '@renovagent/core';
import { retailReferenceCatalog as catalog } from '../../fixtures/catalog/retail-reference-2026-10.js';
import { retailInspoCatalog as inspo } from '../../fixtures/catalog/retail-inspo-2026-10.js';
import { curatedLooks, lookBadges } from '../../fixtures/catalog/looks-2026-10.js';
import { Scenario } from '../foundation-helpers.js';

const pricedFrom = (c: typeof catalog): PricedOffer[] =>
  c.offers.map((offer) => ({
    offer,
    product: c.products.find((p) => p.id === offer.productId)!,
    observation: c.observations.find((o) => o.offerId === offer.id)!,
  }));
const priced = pricedFrom(catalog);
const everything = [...priced, ...pricedFrom(inspo)];

function vanityBom() {
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
  const bom = bomFromScopeDraft(draft, catalog.products).bom!;
  // As if the list were built before these products were in the catalog: a
  // look matches by category and constraints, not the saved candidates.
  return { ...bom, items: bom.items.map((i) => ({ ...i, candidateProductIds: [] })) };
}

test('a look prices what fits, explains what doesn’t, and never drops a product', () => {
  const bom = vanityBom();
  const look = priceLook(bom, priced, [
    'rr-van-fd-kent-30',
    'rr-van-homeibro-plywood-30',
    'rr-top-transolid-quartz-31',
    'rr-fau-delta-trinsic',
    'rr-paint-bm-regal-select-matte',
  ]);
  const line = (id: string) => look.lines.find((l) => l.itemId === id)!;

  const cabinet = line('vanity:cabinet');
  assert.equal(cabinet.status, 'priced');
  // Two cabinets in the look; only the one with a published freestanding mount fits.
  assert.equal(cabinet.status === 'priced' && cabinet.pick.priced.product.id, 'rr-van-fd-kent-30');

  const faucet = line('vanity:faucet');
  assert.equal(faucet.status, 'does-not-fit');
  assert.match(faucet.status === 'does-not-fit' ? faucet.rejected[0]!.reason : '', /out of stock/);

  assert.equal(line('vanity:drain').status, 'not-in-look');
  assert.deepEqual(
    look.notInPlan.map((p) => p.productId),
    ['rr-paint-bm-regal-select-matte'],
  );
  // Kent base $641 + Transolid quartz top $888.30, one each.
  assert.equal(look.totalMinor, 64100 + 88830);
});

test('an unpublished spec is a stated reason, not a silent pass', () => {
  const look = priceLook(vanityBom(), priced, ['rr-van-homeibro-plywood-30']);
  const cabinet = look.lines.find((l) => l.itemId === 'vanity:cabinet')!;
  assert.equal(cabinet.status, 'does-not-fit');
  assert.match(cabinet.status === 'does-not-fit' ? cabinet.rejected[0]!.reason : '', /mount/);
  assert.equal(look.totalMinor, 0);
});

test('curated looks reference real catalog records, with the same honesty rules', () => {
  validateCatalogImport(inspo);
  const ids = new Set(everything.map((p) => p.product.id));
  for (const look of curatedLooks)
    for (const id of look.productIds) assert.ok(ids.has(id), `${look.id}: ${id}`);
  for (const badge of lookBadges) {
    assert.ok(ids.has(badge.productId), badge.productId);
    assert.match(badge.url, /^https:\/\//);
  }
  for (const o of inspo.observations) {
    assert.equal(o.source, 'manual-entry');
    assert.equal(o.freshness, 'recent');
    assert.match(
      o.note!,
      /^Checked 2026-10-30, (fetched product page|search result only|price from a review site)/,
    );
  }
  // Frozen reference IDs are never reused by the inspo set.
  assert.ok(inspo.products.every((p) => p.id.startsWith('ri-')));
});

test('every bathroom look prices for a 30 in vanity plan, and explains what doesn’t fit', () => {
  const bom = vanityBom();
  const look = (id: string) =>
    priceLook(bom, everything, curatedLooks.find((l) => l.id === id)!.productIds);
  for (const l of curatedLooks.filter((x) => x.room === 'bathroom'))
    assert.ok(
      look(l.id).lines.some((line) => line.status === 'priced'),
      l.id,
    );

  // A vanity sold with its top covers the top line instead of pricing it twice.
  const spa = look('bath-spa-modern');
  const top = spa.lines.find((l) => l.itemId === 'vanity:top')!;
  assert.equal(top.status, 'included');

  // IKEA: the wall-hung cabinet and the unstated mount both say why.
  const ikea = look('bath-ikea-scandi');
  const cabinet = ikea.lines.find((l) => l.itemId === 'vanity:cabinet')!;
  assert.equal(cabinet.status, 'does-not-fit');
  const reasons = cabinet.status === 'does-not-fit' ? cabinet.rejected.map((r) => r.reason) : [];
  assert.ok(
    reasons.some((r) => /mount is wall-hung/.test(r)),
    reasons.join(' | '),
  );
  assert.ok(
    reasons.some((r) => /mount is unknown/.test(r)),
    reasons.join(' | '),
  );
});
