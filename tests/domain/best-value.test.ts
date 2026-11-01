import test from 'node:test';
import assert from 'node:assert/strict';
import type { BomPayload } from '@renovagent/contracts';
import { bestValue, buildTierPlans, valueCandidates, type PricedOffer } from '@renovagent/core';
import { livingRoomCatalog } from '../../fixtures/catalog/living-room-philadelphia.js';

const priced: PricedOffer[] = livingRoomCatalog.offers.map((offer) => ({
  offer,
  product: livingRoomCatalog.products.find((p) => p.id === offer.productId)!,
  observation: livingRoomCatalog.observations.find((o) => o.offerId === offer.id)!,
}));
const bom: BomPayload = {
  kind: 'bom',
  templateId: 'test',
  templateVersion: 1,
  items: [
    {
      id: 'paint',
      category: 'interior-paint',
      description: 'Finish coats, matte',
      quantity: 832,
      unit: 'sq ft',
      constraints: [],
      codeTopics: [],
      candidateProductIds: ['lr-paint-b', 'lr-paint-m', 'lr-paint-h'],
    },
    {
      id: 'floor',
      category: 'engineered-hardwood',
      description: 'Floating engineered hardwood',
      quantity: 185,
      unit: 'sq ft',
      constraints: [{ attribute: 'install', operator: 'eq', value: 'floating' }],
      codeTopics: [],
      candidateProductIds: ['lr-hw-b', 'lr-hw-m', 'lr-hw-h'],
    },
  ],
};

test('candidates span every tier, priced from the dated observations', () => {
  const c = valueCandidates(bom, priced);
  assert.deepEqual(
    [...new Set(c.filter((x) => x.itemId === 'paint').map((x) => x.priced.offer.tier))].sort(),
    ['builder', 'high', 'mid'],
  );
  // 832 sq ft at 300 sq ft per gallon rounds up to 3 gallons of builder paint.
  const builder = c.find((x) => x.priced.offer.id === 'offer-lr-paint-b')!;
  assert.deepEqual([builder.units, builder.totalMinor], [3, 3 * 2498]);
});

test('the cheapest product judged a fit wins; a poor fit is passed over with a reason', () => {
  const c = valueCandidates(bom, priced);
  const judged = Object.fromEntries(
    c.map((x) => [
      x.key,
      {
        // Builder paint judged a poor fit; everything else fits.
        fit: x.priced.offer.id === 'offer-lr-paint-b' ? 0.3 : 0.9,
        quality: { builder: 0.4, mid: 1.2, high: 2 }[x.priced.offer.tier],
      },
    ]),
  );
  const [paint, floor] = bestValue(bom, c, judged);
  assert.equal(paint!.pick!.priced.offer.id, 'offer-lr-paint-m');
  assert.match(paint!.passedOver[0]!.reason, /30% fit, below 70%/);
  // Step up: the cheapest fitting candidate clearly better in quality.
  assert.equal(paint!.upgrade!.priced.offer.id, 'offer-lr-paint-h');
  // Floor: builder fits and is cheapest, so it wins across tiers.
  assert.equal(floor!.pick!.priced.offer.tier, 'builder');

  // Never more than the cheapest acceptable mid-tier line for the same item.
  const mid = buildTierPlans(bom, priced).find((p) => p.tier === 'mid')!;
  for (const line of [paint!, floor!])
    assert.ok(
      line.pick!.totalMinor <= mid.lines.find((l) => l.bomItemId === line.itemId)!.lineTotalMinor,
    );
});

test('nothing judged a fit means no pick, never a guess', () => {
  const c = valueCandidates(bom, priced);
  const judged = Object.fromEntries(c.map((x) => [x.key, { fit: 0.2, quality: 1 }]));
  const lines = bestValue(bom, c, judged);
  assert.ok(lines.every((l) => l.pick === null && l.upgrade === null));
});
