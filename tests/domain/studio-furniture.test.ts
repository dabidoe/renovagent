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
} from '@renovagent/core';

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
  for (const asset of STUDIO_ASSETS) {
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
