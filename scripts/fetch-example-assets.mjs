// Download the Poly Haven CC0 models and floor textures the example-room render
// uses (about 15 MB, 1k) into .local/assets/polyhaven, which is gitignored.
// Only the finished renders in public/example-room are committed.
//
//   node scripts/fetch-example-assets.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const dest = '.local/assets/polyhaven';
const MODELS = [
  'Sofa_01',
  'ArmChair_01',
  'modern_coffee_table_01',
  'potted_plant_01',
  'throw_pillows_01',
];
const TEXTURES = ['laminate_floor_02', 'wood_floor_deck'];

const files = async (id) => (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
const list = [];
for (const id of MODELS) {
  const g = (await files(id)).gltf['1k'].gltf;
  list.push([g.url, `${id}/${id}.gltf`]);
  for (const [path, v] of Object.entries(g.include ?? {})) list.push([v.url, `${id}/${path}`]);
}
for (const id of TEXTURES) {
  const j = await files(id);
  for (const map of ['Diffuse', 'nor_gl', 'Rough'])
    list.push([j[map]['1k'].jpg.url, `${id}/${map}.jpg`]);
}
let bytes = 0;
for (const [url, path] of list) {
  if (!url.startsWith('https://dl.polyhaven.org/')) throw Error(`Unexpected host: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  bytes += buf.length;
  mkdirSync(dirname(join(dest, path)), { recursive: true });
  writeFileSync(join(dest, path), buf);
}
console.log(`${list.length} files, ${(bytes / 1e6).toFixed(1)} MB in ${dest}`);
