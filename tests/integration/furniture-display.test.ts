import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { positionFurniture } from '../../apps/web/src/features/room3d/furniture-assets.js';
import type { StudioPlacement } from '@renovagent/contracts';

test('furniture preserves native proportions and uses the largest uniform scale inside every size limit', () => {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 0.75));
  mesh.position.y = 0.5;
  group.add(mesh);
  group.userData.assetSize = new THREE.Vector3(2, 1, 0.75);
  const placement: StudioPlacement = {
    id: 'p',
    itemId: 'i',
    assetId: 'sofa',
    widthM: 3,
    heightM: 4,
    depthM: 2,
    xM: 5,
    zM: 7,
    rotationDeg: 0,
    color: '#ff0000',
  };
  for (const dimensions of [
    { widthM: 3, heightM: 4, depthM: 2 },
    { widthM: 3, heightM: 0.5, depthM: 2 },
    { widthM: 3, heightM: 4, depthM: 0.3 },
  ]) {
    positionFurniture(group, { ...placement, ...dimensions });
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    assert.ok(
      size.x <= dimensions.widthM + 1e-8 &&
        size.y <= dimensions.heightM + 1e-8 &&
        size.z <= dimensions.depthM + 1e-8,
    );
    assert.ok(
      Math.min(
        dimensions.widthM - size.x,
        dimensions.heightM - size.y,
        dimensions.depthM - size.z,
      ) < 1e-8,
    );
    assert.equal(group.scale.x, group.scale.y);
    assert.equal(group.scale.x, group.scale.z);
    assert.ok(Math.abs(size.x / size.y - 2) < 1e-8);
    assert.ok(Math.abs(size.z / size.y - 0.75) < 1e-8);
    assert.equal(box.min.y, 0);
    assert.equal(box.getCenter(new THREE.Vector3()).x, 5);
    assert.equal(box.getCenter(new THREE.Vector3()).z, 7);
  }
  mesh.geometry.dispose();
});
