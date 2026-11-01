// Generates each floor style's swatch (packages/core floor-styles.ts): a
// straight-lay board layout drawn here from the style's spec, which Muse
// Image turns into a photoreal top-down floor, fitted back to 1024 px so the
// swatch covers SWATCH_FEET on each side. Illustrations of a style, not
// product photos. Existing swatches are kept; --style <id> redoes one.
//   node --import tsx scripts/floor-swatches.ts
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { FLOOR_STYLES, SWATCH_FEET, type FloorStyle } from '@renovagent/core';
import { museEditImage, imageMediaType } from './muse-provider.js';
import { fitImage, normalizeImage } from '../apps/api/src/design-images.js';

const SIZE = 1024;
const out = new URL('../public/finishes/', import.meta.url);
const only = process.argv.includes('--style')
  ? process.argv[process.argv.indexOf('--style') + 1]
  : null;
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

// The board layout as a 24-bit BMP: boards of random length in staggered
// rows, each a little lighter or darker, with dark joints.
function layout(style: FloorStyle) {
  const ppi = SIZE / (SWATCH_FEET * 12);
  const rgb = [1, 3, 5].map((i) => parseInt(style.tone.slice(i, i + 2), 16));
  const px = new Uint8Array(SIZE * SIZE * 3);
  let seed = 11;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const fill = (x0: number, y0: number, w: number, h: number, c: number[]) => {
    for (let y = Math.max(0, y0); y < Math.min(SIZE, y0 + h); y++)
      for (let x = Math.max(0, Math.round(x0)); x < Math.min(SIZE, Math.round(x0 + w)); x++)
        px.set(c, (y * SIZE + x) * 3);
  };
  const joint = rgb.map((v) => Math.round(v * 0.45));
  const rowH = Math.round(style.boardWidthIn * ppi);
  for (let y = 0; y < SIZE; y += rowH) {
    let x = -rnd() * 48 * ppi;
    while (x < SIZE) {
      const len = (36 + rnd() * 48) * ppi;
      const k = 0.9 + rnd() * 0.16;
      fill(
        x,
        y,
        len,
        rowH,
        rgb.map((v) => Math.min(255, Math.round(v * k))),
      );
      fill(x, y, 2, rowH, joint);
      x += len;
    }
    fill(0, y, SIZE, 1, joint);
  }
  const header = Buffer.alloc(54);
  header.write('BM', 0);
  header.writeUInt32LE(54 + px.length, 2);
  header.writeUInt32LE(54, 10);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(SIZE, 18);
  header.writeInt32LE(-SIZE, 22); // rows run top to bottom
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(24, 28);
  header.writeUInt32LE(px.length, 34);
  const bgr = Buffer.from(px);
  for (let i = 0; i < bgr.length; i += 3) [bgr[i], bgr[i + 2]] = [bgr[i + 2]!, bgr[i]!];
  return new Uint8Array(Buffer.concat([header, bgr]));
}

const swatchPrompt = (style: FloorStyle) =>
  `Turn this flat diagram into a photorealistic straight-down photograph of a floor of ${style.description}: real wood grain and natural colour variation within each board, subtle joints, even soft daylight with no shadows, glare, objects or walls. Keep exactly the same board layout, board widths, joints and overall colour. The floor fills the whole frame with no perspective.`;

await mkdir(out, { recursive: true });
const recordsFile = new URL('swatches.json', out);
const records: Record<string, unknown> = JSON.parse(
  await readFile(recordsFile, 'utf8').catch(() => '{}'),
);
await Promise.all(
  FLOOR_STYLES.filter((s) => (only ? s.id === only : true)).map(async (style) => {
    const file = new URL(`${style.id}.jpg`, out);
    const exists = await access(file).then(
      () => true,
      () => false,
    );
    if (exists && !only) return;
    const base = await normalizeImage(layout(style), SIZE);
    const edit = await museEditImage({
      image: { bytes: base.bytes, mediaType: imageMediaType(base.bytes) },
      prompt: swatchPrompt(style),
    });
    const fitted = await fitImage(edit.bytes, SIZE, SIZE);
    await writeFile(file, fitted.bytes);
    records[style.id] = {
      model: edit.model,
      prompt: swatchPrompt(style),
      layout: { tone: style.tone, boardWidthIn: style.boardWidthIn, feet: SWATCH_FEET },
      sha256: hash(fitted.bytes),
      status: 'generated illustration of a style, not a product photo',
    };
    console.log(`${style.id}: swatch`);
  }),
);
await writeFile(recordsFile, JSON.stringify(records, null, 2) + '\n');
