import test from 'node:test';
import assert from 'node:assert/strict';
import { bomFromScopeDraft, buildTierPlans, scopeDraftId } from '@renovagent/core';
import type { Command, ScopeDraft } from '@renovagent/contracts';
import { vanityCatalog } from '../../fixtures/catalog/vanity-philadelphia.js';
import { Scenario } from '../foundation-helpers.js';

const ALL = ['vanity', 'toilet', 'floor-tile', 'paint', 'exhaust-fan', 'service-work'];

function draft(
  s: Scenario,
  packageIds = ALL,
  reported: Extract<Command, { type: 'DraftScope' }>['payload']['reported'] = [],
) {
  s.apply(
    s.command('DraftScope', {
      recipeId: 'bathroom-refresh',
      packageIds,
      request: 'How much to redo this bathroom?',
      reported,
      expectedDraftRevision: s.state.artifacts[scopeDraftId('project-a')]?.at(-1)?.revision ?? 0,
    }),
  );
  return s.state.artifacts[scopeDraftId('project-a')].at(-1)!;
}
const payload = (artifact: { payload: unknown }) => artifact.payload as ScopeDraft;
const byId = (d: ScopeDraft, id: string) => d.requirements.find((r) => r.id === id)!;

test('a casual request with nothing measured still yields the full scope', () => {
  const s = new Scenario();
  s.create();
  const d = payload(draft(s));
  const packages = new Set(d.requirements.map((r) => r.packageId));
  for (const id of ['removal-protection', ...ALL]) assert.ok(packages.has(id), id);
  // Count items need no measurements.
  assert.equal(byId(d, 'toilet:seal').quantity, 1);
  assert.equal(byId(d, 'toilet:seal').status, 'quantified');
  assert.equal(byId(d, 'vanity:supply').quantity, 2);
  // Area items show their basis and stay unquantified, blocked only by dimensions.
  const tile = byId(d, 'floor-tile:tile');
  assert.equal(tile.quantity, null);
  assert.equal(tile.status, 'needs-input');
  assert.deepEqual(tile.blockedBy, ['floorLengthFt', 'floorWidthFt']);
  assert.equal(byId(d, 'floor-tile:overage').status, 'needs-source');
  assert.equal(byId(d, 'floor-tile:mortar').status, 'needs-product-spec');
  assert.equal(byId(d, 'floor-tile:underlayment').status, 'conditional');
  assert.ok(
    d.requirements.every((r) => r.sourceIds.every((id) => d.sources.some((s) => s.id === id))),
  );
  // At most two questions, the most consequential first.
  assert.equal(d.questions.length, 2);
  assert.deepEqual(d.questions[0].inputKeys, ['floorLengthFt', 'floorWidthFt']);
  assert.ok(d.inputs.every((i) => i.source === 'not-provided' && i.amount === null));
  assert.ok(d.notPriced.includes('Labor and installation'));
});

test('relayed measurements quantify dependent items without becoming facts', () => {
  const s = new Scenario();
  s.create();
  const d = payload(
    draft(s, ALL, [
      { key: 'floorLengthFt', amount: 8, unit: 'ft' },
      { key: 'floorWidthFt', amount: 60, unit: 'in' },
      { key: 'ceilingHeightFt', amount: 8, unit: 'ft' },
      { key: 'vanityWidthIn', amount: 30, unit: 'in' },
      { key: 'toiletRoughInIn', amount: null, unit: 'in' },
    ]),
  );
  assert.equal(byId(d, 'floor-tile:tile').quantity, 40);
  assert.equal(byId(d, 'floor-tile:tile').status, 'quantified');
  assert.equal(byId(d, 'floor-tile:base-trim').quantity, 26);
  assert.equal(byId(d, 'paint:walls').quantity, 208);
  assert.match(byId(d, 'paint:walls').quantityBasis, /not deducted/);
  assert.equal(byId(d, 'vanity:cabinet').status, 'quantified');
  assert.ok(byId(d, 'vanity:cabinet').catalog);
  // "I don't know" is kept and not asked again.
  const roughIn = d.inputs.find((i) => i.key === 'toiletRoughInIn')!;
  assert.equal(roughIn.source, 'reported-unknown');
  assert.equal(byId(d, 'toilet:toilet').status, 'needs-input');
  assert.equal(d.questions.length, 0);
  assert.equal(d.inputs.find((i) => i.key === 'floorWidthFt')!.source, 'agent-relayed');
  assert.equal(Object.keys(s.state.facts).length, 0);
});

test('only declared packages appear, and questions follow what they need', () => {
  const s = new Scenario();
  s.create();
  const d = payload(draft(s, ['toilet']));
  assert.deepEqual([...new Set(d.requirements.map((r) => r.packageId))].sort(), [
    'removal-protection',
    'toilet',
  ]);
  assert.equal(d.packages.find((p) => p.id === 'paint')!.included, false);
  assert.deepEqual(
    d.questions.map((q) => q.inputKeys),
    [['toiletRoughInIn']],
  );
});

test('unknown packages and recipes are rejected', () => {
  const s = new Scenario();
  s.create();
  assert.throws(() => draft(s, ['vanity', 'hot-tub']), /Unknown work packages/);
  assert.throws(
    () =>
      s.apply(
        s.command('DraftScope', {
          recipeId: 'kitchen',
          packageIds: ['vanity'],
          request: 'x',
          reported: [],
          expectedDraftRevision: 0,
        }),
      ),
    /Unknown scope recipe/,
  );
});

test('agents cannot propose a scope draft directly', () => {
  const s = new Scenario();
  s.create();
  const real = payload(draft(new_scenario()));
  assert.throws(() => s.artifact(scopeDraftId('project-a'), [], 'project-a', real), /validated/);
  assert.throws(() => s.artifact('project-a:other', [], 'project-a', real), /validated/);
});
function new_scenario() {
  const s = new Scenario();
  s.create();
  return s;
}

test('recorded facts take precedence, are referenced, and stale the draft when corrected', () => {
  const s = new Scenario();
  s.create();
  s.evidence();
  s.apply(s.width(1524)); // 5 ft recorded fact
  const first = draft(
    s,
    ['floor-tile'],
    [
      { key: 'floorLengthFt', amount: 8, unit: 'ft' },
      { key: 'floorWidthFt', amount: 6, unit: 'ft' },
    ],
  );
  const d = payload(first);
  const width = d.inputs.find((i) => i.key === 'floorWidthFt')!;
  assert.equal(width.source, 'workspace-fact');
  assert.equal(width.amount, 5);
  assert.equal(byId(d, 'floor-tile:tile').quantity, 40);
  assert.match(d.limits.join(' '), /recorded fact \(5 ft\) was used instead of the relayed 6 ft/);
  assert.deepEqual(first.inputRefs, [{ kind: 'fact', id: 'fact-width', revision: 1 }]);
  s.apply(s.width(1829));
  assert.notEqual(s.state.artifacts[scopeDraftId('project-a')].at(-1)!.freshness, 'current');
});

test('revisions replay idempotently and reject a stale expected revision', () => {
  const s = new Scenario();
  s.create();
  draft(s);
  const command = s.command('DraftScope', {
    recipeId: 'bathroom-refresh',
    packageIds: ['toilet'],
    request: 'Just the toilet',
    reported: [],
    expectedDraftRevision: 1,
  });
  s.apply(command);
  s.apply(command);
  assert.equal(s.state.artifacts[scopeDraftId('project-a')].length, 2);
  // Same expected revision under a new command ID: the draft has moved on.
  assert.throws(() => s.apply({ ...command, commandId: 'again' }), /changed/);
});

test('the draft bridges to a BOM and tier plans; uncatalogued items stay unpriced', () => {
  const s = new Scenario();
  s.create();
  const d = payload(
    draft(s, ['vanity', 'toilet'], [{ key: 'vanityWidthIn', amount: 30, unit: 'in' }]),
  );
  const { bom, pricedIds, unpricedIds } = bomFromScopeDraft(d, vanityCatalog.products);
  assert.ok(bom);
  assert.deepEqual(pricedIds, [
    'vanity:cabinet',
    'vanity:top',
    'vanity:faucet',
    'vanity:drain',
    'vanity:supply',
  ]);
  assert.ok(unpricedIds.includes('toilet:toilet'));
  assert.ok(unpricedIds.includes('toilet:seal'));
  const products = new Map(vanityCatalog.products.map((p) => [p.id, p]));
  const observations = new Map(vanityCatalog.observations.map((o) => [o.offerId, o]));
  const plans = buildTierPlans(
    bom,
    vanityCatalog.offers.map((offer) => ({
      offer,
      product: products.get(offer.productId)!,
      observation: observations.get(offer.id)!,
    })),
  );
  // Same demo selections as the vanity template, so the same demo totals.
  assert.deepEqual(
    plans.map((p) => p.totals.subtotalMinor),
    [30700, 77100, 191200],
  );
  // Without a vanity width, the cabinet and top are not priced.
  const vague = payload(draft(new_scenario(), ['vanity']));
  assert.ok(!bomFromScopeDraft(vague, vanityCatalog.products).pricedIds.includes('vanity:cabinet'));
});

test('a BOM citing a scope draft cannot loosen or invent requirements', () => {
  const s = new Scenario();
  s.create();
  const artifact = draft(s, ['vanity'], [{ key: 'vanityWidthIn', amount: 30, unit: 'in' }]);
  const { bom } = bomFromScopeDraft(payload(artifact), vanityCatalog.products);
  const ref = { kind: 'artifact' as const, id: artifact.id, revision: artifact.revision };
  const loosened = structuredClone(bom!);
  loosened.items[0].constraints = loosened.items[0].constraints.filter(
    (c) => c.attribute !== 'width_in',
  );
  assert.throws(() => s.artifact('project-a:bom', [ref], 'project-a', loosened), /differs/);
  const invented = structuredClone(bom!);
  invented.items[0].id = 'vanity:gold-cabinet';
  assert.throws(
    () => s.artifact('project-a:bom', [ref], 'project-a', invented),
    /not a requirement/,
  );
  const doubled = structuredClone(bom!);
  doubled.items[0].quantity = 2;
  assert.throws(() => s.artifact('project-a:bom', [ref], 'project-a', doubled), /differs/);
  assert.doesNotThrow(() => s.artifact('project-a:bom', [ref], 'project-a', bom!));
});
