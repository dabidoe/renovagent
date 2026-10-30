import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bomFromRequirements,
  buildTierPlans,
  designOptionRequirements,
  designOptionsId,
  designPreviewPrompt,
  scopeDraftId,
} from '@renovagent/core';
import type { DesignOptions, ScopeDraft } from '@renovagent/contracts';
import { livingRoomCatalog } from '../../fixtures/catalog/living-room-philadelphia.js';
import { Scenario } from '../foundation-helpers.js';

const SHA = 'a'.repeat(64);
const sourcePhoto = {
  image: {
    sha256: SHA,
    mediaType: 'image/jpeg' as const,
    width: 1600,
    height: 1067,
    bytes: 400000,
  },
  label: 'Living room, owner photo',
  originalName: 'livingroom.avif',
  originalSha256: 'b'.repeat(64),
  permission: 'Owner confirmed permission to use and modify for the demo, 2026-10-29.',
};

function build(
  s: Scenario,
  reported = [] as {
    key: 'floorLengthFt' | 'floorWidthFt' | 'ceilingHeightFt';
    amount: number | null;
    unit: 'ft' | 'in';
  }[],
) {
  s.apply(
    s.command('BuildDesignOptions', {
      recipeId: 'living-room-refresh',
      request: 'I want to renovate my living room',
      sourcePhoto,
      reported,
      expectedRevision: s.state.artifacts[designOptionsId('project-a')]?.at(-1)?.revision ?? 0,
    }),
  );
  return latest(s);
}
const latest = (s: Scenario) => {
  const artifact = s.state.artifacts[designOptionsId('project-a')].at(-1)!;
  return { artifact, payload: artifact.payload as DesignOptions };
};
const revise = (s: Scenario, body: Record<string, unknown>) =>
  s.apply(
    s.command('ReviseDesignOptions', { expectedRevision: latest(s).artifact.revision, ...body }),
  );
const priced = () => {
  const products = new Map(livingRoomCatalog.products.map((p) => [p.id, p]));
  const observations = new Map(livingRoomCatalog.observations.map((o) => [o.offerId, o]));
  return livingRoomCatalog.offers.map((offer) => ({
    offer,
    product: products.get(offer.productId)!,
    observation: observations.get(offer.id)!,
  }));
};
const plan = {
  reported: [
    { key: 'floorLengthFt' as const, amount: 23.17, unit: 'ft' as const },
    { key: 'floorWidthFt' as const, amount: 13.08, unit: 'ft' as const },
  ],
};

test('a vague room request yields three same-room options with different scopes', () => {
  const s = new Scenario();
  s.create();
  const { payload } = build(s);
  assert.deepEqual(
    payload.options.map((o) => o.id),
    ['paint-refresh', 'hardwood', 'vinyl-plank'],
  );
  assert.ok(payload.options.every((o) => o.preview.status === 'pending'));
  const paint = designOptionRequirements(payload, 'paint-refresh');
  const hardwood = designOptionRequirements(payload, 'hardwood');
  assert.ok(!paint.some((r) => r.packageId === 'hardwood-floor'));
  assert.ok(hardwood.some((r) => r.id === 'hardwood-floor:underlayment'));
  assert.ok(hardwood.some((r) => r.id === 'carpet-removal:carpet'));
  assert.ok(hardwood.some((r) => r.id === 'hardwood-floor:quarter-round'));
  // No dimensions: area items wait, nothing is inferred from the photo.
  assert.equal(hardwood.find((r) => r.id === 'hardwood-floor:planks')!.quantity, null);
  assert.match(designPreviewPrompt(payload, 'hardwood'), /natural light oak engineered hardwood/);
  assert.match(designPreviewPrompt(payload, 'paint-refresh'), /keep the existing carpet/);
});

test('each option prices its own scope from the catalog', () => {
  const s = new Scenario();
  s.create();
  const { payload } = build(s, [
    ...plan.reported,
    { key: 'ceilingHeightFt', amount: 8, unit: 'ft' },
  ]);
  const totals = (id: string) => {
    const { bom, pricedIds } = bomFromRequirements(
      payload.recipe,
      designOptionRequirements(payload, id),
      livingRoomCatalog.products,
    );
    return { pricedIds, plans: buildTierPlans(bom!, priced()).map((p) => p.totals.subtotalMinor) };
  };
  const paint = totals('paint-refresh');
  const hardwood = totals('hardwood');
  const vinyl = totals('vinyl-plank');
  assert.deepEqual(paint.pricedIds, ['wall-paint:paint']);
  assert.deepEqual(hardwood.pricedIds.sort(), [
    'hardwood-floor:planks',
    'hardwood-floor:quarter-round',
    'hardwood-floor:underlayment',
    'wall-paint:paint',
  ]);
  assert.ok(vinyl.pricedIds.includes('lvp-floor:planks'));
  assert.ok(!vinyl.pricedIds.includes('lvp-floor:underlayment'));
  // Different scopes, different money; tiers ascend.
  for (const t of [paint, hardwood, vinyl])
    assert.ok(t.plans[0] <= t.plans[1] && t.plans[1] <= t.plans[2]);
  assert.ok(hardwood.plans[1] > vinyl.plans[1] && vinyl.plans[1] > paint.plans[1]);
});

test('"make it blue" revises one option, re-queues only its preview, and keeps history', () => {
  const s = new Scenario();
  s.create();
  build(s);
  revise(s, { optionId: 'hardwood', direction: { wallColor: 'soft blue' }, select: false });
  const { payload, artifact } = latest(s);
  assert.equal(artifact.revision, 2);
  const hardwood = payload.options.find((o) => o.id === 'hardwood')!;
  assert.equal(hardwood.direction.wallColor, 'soft blue');
  assert.equal(hardwood.preview.forDirection.wallColor, 'soft blue');
  assert.match(designPreviewPrompt(payload, 'hardwood'), /soft blue/);
  assert.equal(s.state.artifacts[designOptionsId('project-a')][0].payload.kind, 'design-options');
  assert.equal(s.state.artifacts[scopeDraftId('project-a')], undefined);
});

test('selection is a proposed preference that drafts the chosen scope with its direction', () => {
  const s = new Scenario();
  s.create();
  build(s, plan.reported);
  revise(s, { optionId: 'hardwood', select: true });
  const draft = s.state.artifacts[scopeDraftId('project-a')].at(-1)!;
  const d = draft.payload as ScopeDraft;
  assert.equal(d.recipe.id, 'living-room-refresh');
  assert.equal(d.direction?.floorFinish, 'natural light oak');
  assert.equal(d.requirements.find((r) => r.id === 'hardwood-floor:planks')!.quantity, 303.1);
  assert.deepEqual(draft.inputRefs.at(-1), {
    kind: 'artifact',
    id: designOptionsId('project-a'),
    revision: 2,
  });
  assert.equal(Object.keys(s.state.decisions).length, 0);
  // Changing the selected option's color re-drafts; the old draft goes stale.
  revise(s, { optionId: 'hardwood', direction: { wallColor: 'soft blue' }, select: false });
  const drafts = s.state.artifacts[scopeDraftId('project-a')];
  assert.equal(drafts.length, 2);
  assert.match(
    (drafts[1].payload as ScopeDraft).requirements.find((r) => r.id === 'wall-paint:paint')!
      .specification,
    /soft blue/,
  );
  assert.notEqual(drafts[0].freshness, 'current');
});

test('previews attach only to the direction they were made for', () => {
  const s = new Scenario();
  s.create();
  const { payload } = build(s);
  const option = payload.options[1];
  const preview = {
    status: 'generated' as const,
    forDirection: option.direction,
    image: {
      sha256: 'c'.repeat(64),
      mediaType: 'image/jpeg' as const,
      width: 1536,
      height: 1024,
      bytes: 300000,
    },
    provenance: {
      kind: 'generated-concept' as const,
      sourcePhotoSha256: SHA,
      prompt: designPreviewPrompt(payload, option.id),
      provider: 'Muse CLI image_generation',
      model: 'muse-spark-1.3',
      generatedAt: '2026-10-29T20:00:00.000Z',
    },
  };
  // A revision in between makes the in-flight preview stale.
  revise(s, { optionId: option.id, direction: { wallColor: 'soft blue' }, select: false });
  assert.throws(
    () =>
      s.apply(
        s.command('RecordDesignPreview', {
          optionId: option.id,
          expectedRevision: latest(s).artifact.revision,
          preview,
        }),
      ),
    /earlier direction/,
  );
  const blue = { ...preview, forDirection: latest(s).payload.options[1].direction };
  s.apply(
    s.command('RecordDesignPreview', {
      optionId: option.id,
      expectedRevision: latest(s).artifact.revision,
      preview: blue,
    }),
  );
  assert.equal(latest(s).payload.options[1].preview.status, 'generated');
  assert.throws(
    () =>
      s.apply(
        s.command('RecordDesignPreview', {
          optionId: 'vinyl-plank',
          expectedRevision: latest(s).artifact.revision,
          preview: {
            ...blue,
            forDirection: latest(s).payload.options[2].direction,
            provenance: { ...blue.provenance, sourcePhotoSha256: 'd'.repeat(64) },
          },
        }),
      ),
    /source photo/,
  );
});

test('agents cannot hand-write design options', () => {
  const s = new Scenario();
  s.create();
  const { payload } = build(s);
  assert.throws(
    () => s.artifact(designOptionsId('project-a'), [], 'project-a', payload),
    /validated/,
  );
  assert.throws(() => s.artifact('project-a:fake-options', [], 'project-a', payload), /validated/);
});

test('new measurements rebuild costs but keep previews, directions and the preference', () => {
  const s = new Scenario();
  s.create();
  build(s, plan.reported);
  revise(s, { optionId: 'hardwood', direction: { wallColor: 'soft blue' }, select: true });
  build(s, [...plan.reported, { key: 'ceilingHeightFt', amount: 8, unit: 'ft' }]);
  const { payload } = latest(s);
  const hardwood = payload.options.find((o) => o.id === 'hardwood')!;
  assert.equal(hardwood.direction.wallColor, 'soft blue');
  assert.equal(hardwood.preview.forDirection.wallColor, 'soft blue');
  assert.equal(payload.selectedOptionId, 'hardwood');
  const draft = s.state.artifacts[scopeDraftId('project-a')].at(-1)!.payload as ScopeDraft;
  assert.equal(draft.requirements.find((r) => r.id === 'wall-paint:walls')!.quantity, 580);
});
