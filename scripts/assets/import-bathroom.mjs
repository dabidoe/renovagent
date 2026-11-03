// Local, deterministic import. No downloads; restricted meshes are ignored by Git.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const source = resolve(process.argv[2] ?? 'LowPolyBathLaundry_v1.0');
const out = resolve('public/furniture/bathroom');
const entries = [
  ['toilet', 'Toilet', 'toilet', 'floor'],
  ['vanity', 'Double vanity', 'vanity_double', 'floor'],
  ['shower', 'Shower stall', 'shower_stall', 'floor'],
  ['tub', 'Bathtub', 'bathtub', 'floor'],
  ['sink', 'Pedestal sink', 'pedestal_sink', 'floor'],
  ['mirror', 'Vanity mirror', 'vanity_mirror', 'wall'],
];
const license = readFileSync(resolve(source, 'LICENSE.txt'), 'utf8');
if (!license.includes('reodesuxz') || !license.includes('personal and commercial projects'))
  throw new Error('Unexpected license; inspect this pack before importing');
mkdirSync(out, { recursive: true });
const assets = [];
for (const [id, name, file, mounting] of entries) {
  const data = readFileSync(resolve(source, `GLB/${file}.glb`));
  const gltf = JSON.parse(data.toString('utf8', 20, 20 + data.readUInt32LE(12)));
  if ((gltf.buffers ?? []).some((b) => b.uri) || (gltf.images ?? []).some((i) => i.uri))
    throw new Error(`${file}: external resources are not supported`);
  const { scene } = await new GLTFLoader().parseAsync(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    '',
  );
  scene.updateMatrixWorld(true);
  const box = new Box3().setFromObject(scene);
  const size = box.getSize(new Vector3());
  const round = (n) => Math.round(n * 1e6) / 1e6;
  if (![size.x, size.y, size.z].every((n) => Number.isFinite(n) && n > 0))
    throw new Error(`Invalid bounds: ${file}`);
  assets.push({
    id,
    name,
    file,
    category: 'other',
    semanticCategory: id,
    url: `/furniture/bathroom/${file}.glb`,
    size: [size.x, size.z, size.y].map(round),
    color: '#ece8e1',
    mounting,
    defaultElevationM: mounting === 'wall' ? 1.15 : 0,
    dimensionsBasis: 'source-mesh-bounds-metres-not-product-measurements',
    sourceBounds: { min: box.min.toArray().map(round), max: box.max.toArray().map(round) },
    normalization: {
      up: '+Y',
      front: '+Z',
      rotationDeg: 0,
      scale: 1,
      origin: 'bounds-base-center',
    },
    anchors: { base: [0, 0, 0], back: [0, 0, round(-size.z / 2)] },
    clearanceEnvelope: null,
    license: 'reodesuxz-project-use-restricted-redistribution',
    creator: 'reodesuxz',
    sha256: createHash('sha256').update(data).digest('hex'),
  });
  copyFileSync(resolve(source, `GLB/${file}.glb`), resolve(out, `${file}.glb`));
}
copyFileSync(resolve(source, 'LICENSE.txt'), resolve(out, 'LICENSE.txt'));
const catalog = { version: 1, units: 'metres', coordinates: 'right-handed-Y-up-XZ-floor', assets };
writeFileSync(
  'packages/core/src/geometry/bathroom-assets.json',
  JSON.stringify(catalog, null, 2) + '\n',
);
console.log(`Imported ${assets.length} bathroom meshes locally; no source files changed.`);
