import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { register } from 'node:module';
// The viewer's camera controls import CSS; Node's render test needs only the component tree.
register(
  'data:text/javascript,' +
    encodeURIComponent(
      `export async function load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context); }`,
    ),
  import.meta.url,
);
const { HutchinsonStudio } = await import(
  '../../apps/web/src/features/house-example/hutchinson-studio.js'
);
import { HUTCHINSON } from '../../apps/web/src/features/house-example/hutchinson-project.js';
import { roomModel } from '../../apps/web/src/features/house-example/paint-floor.js';
import { hutchinsonStagedFurnishings } from '../../apps/web/src/features/house-example/hutchinson-furnishings.js';
import {
  studioItemSchema,
  studioPlacementSchema,
  type StudioAssetId,
} from '@renovagent/contracts';
import {
  placementFootprint,
  studioPlacementWarnings,
  studioRoomBounds,
} from '@renovagent/core';

// The living-room listing photo shows two sofas, a dining table and four
// chairs; the example's 3D opens with those seven pieces staged as existing.
test('Hutchinson living room stages its photo furniture as existing', () => {
  const seed = hutchinsonStagedFurnishings(HUTCHINSON);
  assert.deepEqual(Object.keys(seed.items), ['living']);
  assert.deepEqual(Object.keys(seed.placements), ['living']);
  const items = seed.items.living!;
  assert.equal(items.length, 3);
  assert.ok(
    items.every((i) => studioItemSchema.safeParse(i).success && i.action === 'keep'),
  );
  assert.deepEqual(
    items.map((i) => [i.name, i.quantity]),
    [
      ['Lounge sofa', 2],
      ['Round dining table', 1],
      ['Dining chair', 4],
    ],
  );
  const placements = seed.placements.living!;
  assert.equal(placements.length, 7);
  assert.deepEqual(
    placements.map((p) => p.assetId).sort(),
    (
      ['sofa', 'sofa', 'dining-table', 'dining-chair', 'dining-chair', 'dining-chair', 'dining-chair'] as StudioAssetId[]
    ).sort(),
  );
  assert.ok(placements.every((p) => studioPlacementSchema.safeParse(p).success));
  for (const item of items)
    assert.equal(
      placements.filter((p) => p.itemId === item.id).length,
      item.quantity,
    );
  const room = HUTCHINSON.rooms.find((r) => r.id === 'living')!;
  const model = roomModel(room, HUTCHINSON.ceilingFt)!;
  const b = studioRoomBounds(model);
  for (const p of placements) {
    for (const [x, z] of placementFootprint(p)) {
      assert.ok(x >= b.minX - 0.01 && x <= b.maxX + 0.01);
      assert.ok(z >= b.minZ - 0.01 && z <= b.maxZ + 0.01);
    }
  }
  assert.deepEqual(studioPlacementWarnings(model, placements), []);
});

test('Hutchinson studio opens with the staged pieces placed and listed', () => {
  const html = renderToStaticMarkup(createElement(HutchinsonStudio, {}));
  const select = html.match(
    /<select aria-label="Selected furniture piece"[\s\S]*?<\/select>/,
  )![0];
  const options = [...select.matchAll(/<option value="[^"]*">([^<]*)<\/option>/g)]
    .map((m) => m[1])
    .filter((name) => name !== 'Choose a piece');
  assert.deepEqual(options, [
    'Lounge sofa',
    'Lounge sofa',
    'Round dining table',
    'Dining chair',
    'Dining chair',
    'Dining chair',
    'Dining chair',
  ]);
  assert.equal((html.match(/pf-item-existing/g) ?? []).length, 3);
  assert.doesNotMatch(html, /pf-plan-empty/);
});
