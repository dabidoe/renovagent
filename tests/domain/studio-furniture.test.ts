import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  studioPlacementSchema,
  studioIdeasSchema,
  type StudioPlacement,
} from '@renovagent/contracts';
import {
  STUDIO_ASSETS,
  boxRoomModel,
  outlineRoomModel,
  studioPlacementStart,
  studioPlacementWarnings,
  placementFootprint,
  studioItemAsset,
  studioItemModelSuggestions,
  STUDIO_ROOM_PRESETS,
  studioPresetStarts,
} from '@renovagent/core';
import type { StudioItem } from '@renovagent/contracts';

test('room presets use editable library geometry, distinct study seats and no measured-fit claim', () => {
  const model = boxRoomModel({ lengthM: 5, widthM: 4, heightM: 2.4 });
  const before = structuredClone(model);
  for (const preset of STUDIO_ROOM_PRESETS) {
    const starts = studioPresetStarts(preset.id, model);
    assert.deepEqual(
      starts.map((p) => p.assetId),
      preset.assets,
    );
    for (const start of starts) {
      studioPlacementSchema.parse({
        ...start,
        id: `preset-${start.assetId}`,
        itemId: `item-${start.assetId}`,
      });
      assert.equal(start.widthM, STUDIO_ASSETS.find((a) => a.id === start.assetId)!.size[0]);
    }
  }
  const study = studioPresetStarts('study', model);
  assert.notDeepEqual([study[0]!.xM, study[0]!.zM], [study[1]!.xM, study[1]!.zM]);
  assert.deepEqual(studioPresetStarts('unknown', model), []);
  assert.deepEqual(model, before);
});

test('room-list starters preserve quantities, skip placed pieces and reject ambiguous names', () => {
  assert.equal(studioItemAsset('Cream linen couch'), 'sofa');
  assert.equal(studioItemAsset('Walnut coffee-table'), 'coffee-table');
  assert.equal(studioItemAsset('Four dining chairs'), 'dining-chair');
  assert.equal(studioItemAsset('sofa cushions'), null);
  assert.equal(studioItemAsset('sofa and coffee table'), null);
  assert.equal(studioItemAsset('pendant light'), null);
  const items: StudioItem[] = [
    {
      id: 'sofa',
      name: 'Cream sofa',
      category: 'furniture',
      action: 'replace',
      quantity: null,
      unitAllowanceMinor: 12500,
    },
    {
      id: 'chairs',
      name: 'Dining chairs',
      category: 'furniture',
      action: 'keep',
      quantity: 4,
      unitAllowanceMinor: null,
    },
    {
      id: 'art',
      name: 'Artwork',
      category: 'decor',
      action: 'add',
      quantity: 1,
      unitAllowanceMinor: null,
    },
  ];
  const original = structuredClone(items);
  const model = boxRoomModel({ lengthM: 4, widthM: 5, heightM: 2.4 });
  const placed: StudioPlacement[] = [
    {
      id: 'chair-1',
      itemId: 'chairs',
      assetId: 'dining-chair',
      ...studioPlacementStart('dining-chair', model),
    },
  ];
  const suggestions = studioItemModelSuggestions(items, placed);
  assert.deepEqual(
    suggestions.map((s) => [s.itemId, s.count, s.quantityUnknown]),
    [
      ['sofa', 1, true],
      ['chairs', 3, false],
    ],
  );
  const completed = [
    ...placed,
    ...suggestions.flatMap((s) =>
      Array.from({ length: s.count }, (_, i) => ({
        id: `${s.itemId}-${i}`,
        itemId: s.itemId,
        assetId: s.assetId,
        ...studioPlacementStart(s.assetId, model),
      })),
    ),
  ];
  assert.deepEqual(studioItemModelSuggestions(items, completed), []);
  assert.deepEqual(items, original, 'suggestions never assign quantities, prices or actions');
});

test('furniture is explicit concept geometry, and rotated/outside footprints are warned', () => {
  const model = boxRoomModel({ lengthM: 4, widthM: 5, heightM: 2.4 });
  const p: StudioPlacement = {
    id: 'sofa',
    itemId: 'sofa',
    assetId: 'sofa',
    ...studioPlacementStart('sofa', model),
  };
  assert.deepEqual(studioPlacementWarnings(model, [p]), []);
  assert.equal(studioPlacementWarnings(model, [{ ...p, xM: 0 }]).length, 1);
  const rotated = { ...p, widthM: 3, depthM: 1, rotationDeg: 90, xM: 2, zM: 2.5 };
  const footprint = placementFootprint(rotated);
  assert.ok(
    Math.abs(
      Math.max(...footprint.map((n) => n[0])) - Math.min(...footprint.map((n) => n[0])) - 1,
    ) < 0.001,
  );
  assert.equal(studioPlacementSchema.safeParse({ ...p, widthM: 0 }).success, false);
  assert.equal(studioPlacementSchema.safeParse({ ...p, assetId: 'remote-url' }).success, false);
  const l = outlineRoomModel({
    points: [
      [0, 0],
      [4, 0],
      [4, 2],
      [2, 2],
      [2, 4],
      [0, 4],
    ],
    heightM: 2.4,
    openings: [],
  });
  assert.equal(
    studioPlacementWarnings(l, [{ ...p, xM: 3, zM: 3, widthM: 0.5, depthM: 0.5 }]).length,
    1,
    'bounding box alone cannot validate a concave room',
  );
  assert.ok(studioIdeasSchema.safeParse({ observations: [], directions: [] }).success === false);
});

test('bundled CC0 furniture is self-contained GLB with pinned hashes and a license', () => {
  const provenance = JSON.parse(
    readFileSync(new URL('../../public/furniture/kenney/provenance.json', import.meta.url), 'utf8'),
  );
  assert.equal(provenance.license, 'CC0-1.0');
  for (const asset of STUDIO_ASSETS.filter((a) => !a.url)) {
    const file = `${asset.file}.glb`;
    const data = readFileSync(new URL(`../../public/furniture/kenney/${file}`, import.meta.url));
    assert.equal(data.toString('utf8', 0, 4), 'glTF');
    assert.equal(createHash('sha256').update(data).digest('hex'), provenance.files[file].sha256);
    const json = JSON.parse(data.toString('utf8', 20, 20 + data.readUInt32LE(12)));
    assert.ok((json.buffers ?? []).every((b: { uri?: string }) => !b.uri));
    assert.ok(
      (json.images ?? []).every((i: { uri?: string }) => !i.uri),
      'no external texture requests',
    );
  }
  assert.match(
    readFileSync(
      new URL('../../public/furniture/kenney/furniture-kit-License.txt', import.meta.url),
      'utf8',
    ),
    /Creative Commons Zero/,
  );
});
