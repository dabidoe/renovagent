import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { studioAsset } from '@renovagent/core';
import type { StudioAssetId, StudioPlacement } from '@renovagent/contracts';

const loader = new GLTFLoader();
const cache = new Map<StudioAssetId, Promise<THREE.Group>>();
function load(id: StudioAssetId) {
  let pending = cache.get(id);
  if (!pending) {
    pending = loader
      .loadAsync(`/furniture/kenney/${studioAsset(id).file}.glb`)
      .then((g) => g.scene);
    cache.set(id, pending);
    void pending.catch(() => cache.delete(id));
  }
  return pending;
}
export async function furnitureObject(p: StudioPlacement) {
  const root = (await load(p.assetId)).clone(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  root.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.castShadow = o.receiveShadow = true;
    const tint = (raw: THREE.MeshStandardMaterial) => {
      const m = raw.clone();
      // Recolour the main material while retaining legs, lamp shades and secondary details.
      if (
        /carpet$|carpetDarker/.test(m.name) ||
        (p.assetId === 'plant' && m.name === 'plant') ||
        (p.assetId === 'bed' && m.name === 'carpetWhite') ||
        (['coffee-table', 'desk', 'bookcase', 'dining-table', 'media-console'].includes(
          p.assetId,
        ) &&
          m.name === 'wood') ||
        (p.assetId === 'floor-lamp' && m.name === 'metal')
      ) {
        m.color.set(p.color);
        if (m.name === 'carpetDarker') m.color.multiplyScalar(0.72);
      }
      m.roughness = 0.8;
      return m;
    };
    o.material = Array.isArray(o.material) ? o.material.map((m) => tint(m)) : tint(o.material);
  });
  const sized = new THREE.Group();
  sized.add(root);
  sized.scale.set(
    1 / Math.max(size.x, 0.001),
    1 / Math.max(size.y, 0.001),
    1 / Math.max(size.z, 0.001),
  );
  const group = new THREE.Group();
  group.add(sized);
  group.userData.placementId = p.id;
  return group;
}
export function positionFurniture(group: THREE.Group, p: StudioPlacement) {
  group.position.set(p.xM, p.assetId === 'rug' ? 0.008 : 0, p.zM);
  group.rotation.y = (p.rotationDeg * Math.PI) / 180;
  group.scale.set(p.widthM, p.heightM, p.depthM);
  group.name = studioAsset(p.assetId).name;
  group.userData.renovagent = {
    kind: 'proposed-furniture',
    assetId: p.assetId,
    itemId: p.itemId,
    displayOnly: true,
    verified: false,
    dimensions: 'Owner-editable concept dimensions, not measured product sizes',
    license: 'CC0-1.0',
    creator: 'Kenney',
  };
}
export function disposeFurniture(group: THREE.Object3D) {
  group.traverse((o) => {
    if (o instanceof THREE.Mesh)
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
  }); // Cached geometry is shared; never dispose it per instance.
}

let thumbnailRenderer: THREE.WebGLRenderer | null = null;
const thumbnails = new Map<StudioAssetId, Promise<string>>();
export function furnitureThumbnail(id: StudioAssetId) {
  let promise = thumbnails.get(id);
  if (!promise) {
    promise = (async () => {
      const asset = studioAsset(id);
      const object = await furnitureObject({
        id: 'thumbnail',
        itemId: 'thumbnail',
        assetId: id,
        xM: 0,
        zM: 0,
        rotationDeg: 0,
        widthM: asset.size[0],
        depthM: asset.size[1],
        heightM: asset.size[2],
        color: asset.color,
      });
      positionFurniture(object, {
        id: 'thumbnail',
        itemId: 'thumbnail',
        assetId: id,
        xM: 0,
        zM: 0,
        rotationDeg: 0,
        widthM: asset.size[0],
        depthM: asset.size[1],
        heightM: asset.size[2],
        color: asset.color,
      });
      thumbnailRenderer ??= new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
      thumbnailRenderer.setSize(240, 180, false);
      thumbnailRenderer.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene();
      scene.add(object, new THREE.HemisphereLight('#ffffff', '#aca491', 2));
      const light = new THREE.DirectionalLight('#fff3dd', 3);
      light.position.set(3, 5, 4);
      scene.add(light);
      const extent = Math.max(...asset.size) * 1.9;
      const cam = new THREE.OrthographicCamera(
        -extent / 2,
        extent / 2,
        extent * 0.375,
        -extent * 0.375,
        0.01,
        40,
      );
      cam.position.set(4, 3, 5);
      cam.lookAt(0, asset.size[2] * 0.38, 0);
      thumbnailRenderer.render(scene, cam);
      const src = thumbnailRenderer.domElement.toDataURL('image/png');
      disposeFurniture(object);
      return src;
    })();
    thumbnails.set(id, promise);
    void promise.catch(() => thumbnails.delete(id));
  }
  return promise;
}
