import test from 'node:test';
import assert from 'node:assert/strict';
import type { PurchasePlanPayload, ScopeDraft } from '@renovagent/contracts';
import {
  bomFromScopeDraft,
  boxRoomModel,
  buildTierPlans,
  roomAnnotations,
  roomDimensionCommands,
  type PricedOffer,
} from '@renovagent/core';
import { livingRoomCatalog } from '../../fixtures/catalog/living-room-philadelphia.js';
import { Scenario } from '../foundation-helpers.js';

// The example project's path, without HTTP: measured room → draft → demo
// catalog → tier plans → priced callouts on the walls and floor.
test('the example living room prices its pinned work from the demo catalog', () => {
  const s = new Scenario();
  s.create();
  let n = 0;
  const ids = {
    commandId: (step: string) => `room-${step}`,
    evidenceId: 'ev-room',
    factId: () => `fact-${++n}`,
  };
  const commands = roomDimensionCommands(
    s.state,
    'project-a',
    {
      length: { amount: 14, unit: 'ft' },
      width: { amount: 12, unit: 'ft' },
      height: { amount: 8, unit: 'ft' },
      method: 'tape-measure',
      notes: '[Example fixture] test',
      photoEvidenceIds: [],
    },
    ids,
  );
  for (const c of commands) s.apply({ ...c, baseRevision: s.state.projects['project-a'].revision });
  s.apply(
    s.command('DraftScope', {
      recipeId: 'living-room-refresh',
      packageIds: ['removal-protection', 'wall-paint', 'carpet-removal', 'lvp-floor'],
      request: 'Repaint and put vinyl plank down',
      reported: [],
      expectedDraftRevision: 0,
    }),
  );
  const draft = s.state.artifacts['project-a:scope-draft'].at(-1)!.payload as ScopeDraft;
  const { bom } = bomFromScopeDraft(draft, livingRoomCatalog.products);
  assert.ok(bom);
  const products = new Map(livingRoomCatalog.products.map((p) => [p.id, p]));
  const observations = new Map(livingRoomCatalog.observations.map((o) => [o.offerId, o]));
  const priced: PricedOffer[] = livingRoomCatalog.offers.flatMap((offer) => {
    const product = products.get(offer.productId);
    const observation = observations.get(offer.id);
    return product && observation ? [{ offer, product, observation }] : [];
  });
  const mid = buildTierPlans(bom!, priced).find((p) => p.tier === 'mid')!;
  const plan = { kind: 'purchase-plan', ...mid } as unknown as PurchasePlanPayload;
  const room = boxRoomModel({ lengthM: 4.2672, widthM: 3.6576, heightM: 2.4384 });
  const a = roomAnnotations(room, draft, plan);
  const pin = (id: string) => a.pins.find((p) => p.id === id)!;
  assert.equal(pin('wall-paint').surfaceIds.length, 4);
  assert.ok(pin('wall-paint').costMinor! > 0);
  assert.ok(pin('lvp-floor').costMinor! > 0);
  assert.deepEqual(pin('lvp-floor').surfaceIds, ['floor']);
  assert.equal(a.tier, 'mid');
  assert.ok(a.totalMinor! >= pin('wall-paint').costMinor! + pin('lvp-floor').costMinor!);
  // Order of operations: demo, paint, flooring. Moving furniture and covering
  // floors is folded into prep, not a step of its own, but still in the totals.
  assert.deepEqual(
    a.steps.map((s) => [s.id, s.guide?.phase, s.number]),
    [
      ['carpet-removal', 'Demo', 1],
      ['wall-paint', 'Paint', 2],
      ['lvp-floor', 'Flooring', 3],
    ],
  );
  assert.equal(a.prep?.id, 'removal-protection');
  // Template materials scale with the plan's measured base area, not 3D geometry:
  // 416 sq ft of wall at $0.20, 168 sq ft of floor at $3.30 (10% waste included).
  const paint = pin('wall-paint').estimate!;
  assert.deepEqual([paint.areaSqFt, paint.materialMinor], [416, 8320]);
  assert.equal(pin('lvp-floor').estimate!.materialMinor, Math.round(330 * 168));
  assert.equal(pin('lvp-floor').guide!.diy, 'Medium');
  assert.ok(pin('lvp-floor').guide!.kit.some((k) => /rubber mallet/i.test(k.name)));
  assert.equal(
    a.template!.toolsMinor,
    a.steps.reduce((n, s) => n + s.estimate!.kitMinor, 0),
  );
});
