import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import catalog from '../../packages/core/src/geometry/bathroom-assets.json';
import {
  boxRoomModel,
  studioAsset,
  studioPlacementAtWall,
  studioPresetStarts,
  studioPlacementWarnings,
  withDemoFurnitureAllowances,
} from '@renovagent/core';
import { studioPlacementSchema, studioDesignSchema } from '@renovagent/contracts';

test('bathroom catalog records source bounds, mounting, provenance and unknown clearances/prices', () => {
  for (const asset of catalog.assets) {
    assert.equal(asset.clearanceEnvelope, null);
    assert.equal(asset.normalization.origin, 'bounds-base-center');
    assert.notEqual(asset.license, 'CC0-1.0');
    const [lo, hi] = [asset.sourceBounds.min, asset.sourceBounds.max];
    const size = [hi[0]! - lo[0]!, hi[2]! - lo[2]!, hi[1]! - lo[1]!];
    size.forEach((n, i) => assert.ok(Math.abs(n - asset.size[i]!) < 0.000002));
  }
  const room = boxRoomModel({ lengthM: 4, widthM: 3, heightM: 2.5 });
  const starts = studioPresetStarts('bathroom', room).map((p, i) =>
    studioPlacementSchema.parse({ ...p, id: String(i), itemId: String(i) }),
  );
  assert.equal(starts.length, 4);
  assert.deepEqual(studioPlacementWarnings(room, starts), []);
  assert.ok(starts.find((p) => p.assetId === 'mirror')!.yM! > 1);
  assert.ok(starts.every((p) => room.walls.some((w) => w.id === p.wallId)));
  const side = studioPlacementAtWall('toilet', room, 'wall-2');
  assert.equal(side.rotationDeg, -90);
  assert.ok(side.xM < 4 && side.xM > 3);
  assert.throws(() => studioPlacementAtWall('toilet', room, 'bad-wall'));
  assert.equal(studioPlacementSchema.safeParse({ ...starts[0], yM: -1 }).success, false);
  // The same schema is used by saved studio snapshots and the render API.
  assert.ok(studioDesignSchema.shape.placements);
  const item = {
    id: 't',
    name: 'Toilet',
    category: 'other' as const,
    action: 'add' as const,
    quantity: 1,
    unitAllowanceMinor: null,
  };
  assert.deepEqual(withDemoFurnitureAllowances([item]), [item]);
  assert.equal(studioAsset('toilet').size[0], 0.42);
});

test(
  'locally imported restricted meshes match source hashes (optional on clean checkouts)',
  { skip: !existsSync('public/furniture/bathroom/toilet.glb') },
  () => {
    for (const asset of catalog.assets) {
      const data = readFileSync(`public${asset.url}`);
      assert.equal(createHash('sha256').update(data).digest('hex'), asset.sha256);
      assert.equal(data.toString('utf8', 0, 4), 'glTF');
    }
  },
);
