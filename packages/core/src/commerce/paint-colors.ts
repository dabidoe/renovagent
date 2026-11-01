// Paint colours from a brand's published swatch file (Adobe Swatch Exchange,
// .ase), as loaded by `npm run seed:paint`. A colour is a screen reference for
// choosing and previewing; the physical chip at the store is the reference
// for the paint.

export type PaintFamily =
  | 'white'
  | 'neutral'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple';
export const paintFamilies: PaintFamily[] = [
  'white',
  'neutral',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
];

export type PaintColor = {
  id: string;
  brand: string;
  collection: string;
  code: string | null;
  name: string;
  hex: string;
  family: PaintFamily;
  // HSL lightness 0–1, for ordering light to dark.
  lightness: number;
};

export type SwatchEntry = { name: string; rgb: [number, number, number] };

// ASE: "ASEF", version, block count, then blocks of type, length and body.
// Colour blocks hold a UTF-16BE name, a model and float32 values.
export function parseAse(bytes: Uint8Array): SwatchEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (from: number, units: number) => {
    let s = '';
    for (let i = 0; i < units; i++) s += String.fromCharCode(view.getUint16(from + i * 2));
    return s.replace(/\0+$/, '');
  };
  if (bytes.byteLength < 12 || String.fromCharCode(...bytes.subarray(0, 4)) !== 'ASEF')
    throw Error('Not a swatch file');
  const count = view.getUint32(8);
  const entries: SwatchEntry[] = [];
  let offset = 12;
  for (let i = 0; i < count; i++) {
    if (offset + 6 > bytes.byteLength) throw Error('Swatch file is truncated');
    const type = view.getUint16(offset),
      length = view.getUint32(offset + 2),
      start = offset + 6;
    offset = start + length;
    if (offset > bytes.byteLength) throw Error('Swatch file is truncated');
    if (type !== 0x0001) continue; // group start/end
    const units = view.getUint16(start);
    const name = text(start + 2, units).trim();
    const model = start + 2 + units * 2;
    if (String.fromCharCode(...bytes.subarray(model, model + 4)) !== 'RGB ') continue;
    const channel = (k: number) =>
      Math.max(0, Math.min(255, Math.round(view.getFloat32(model + 4 + k * 4) * 255)));
    if (name) entries.push({ name, rgb: [channel(0), channel(1), channel(2)] });
  }
  return entries;
}

const toHex = (rgb: [number, number, number]) =>
  '#' + rgb.map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join('');

function hsl([r, g, b]: [number, number, number]) {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb),
    min = Math.min(rr, gg, bb),
    l = (max + min) / 2,
    d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h =
    max === rr ? ((gg - bb) / d + 6) % 6 : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
  return { h: h * 60, s, l };
}

// A coarse family for browsing, from the colour's own values. Chroma (the
// spread between channels) decides neutral, since HSL saturation overstates
// pale greiges; the rest are grouped by hue.
export function paintFamily(rgb: [number, number, number]): PaintFamily {
  const { h, l } = hsl(rgb);
  const chroma = (Math.max(...rgb) - Math.min(...rgb)) / 255;
  if (chroma < 0.1) return l > 0.88 ? 'white' : 'neutral';
  if (h < 15 || h >= 335) return 'red';
  if (h < 45) return 'orange';
  if (h < 68) return 'yellow';
  if (h < 170) return 'green';
  if (h < 255) return 'blue';
  return 'purple';
}

// "Agreeable Gray (SW 7029)" or "SW 7029 Agreeable Gray" → code and name.
export function splitColorName(raw: string) {
  const trailing = /^(.*?)\s*\(([A-Z]{1,4}[ -]?[A-Z0-9][A-Z0-9-]*)\)$/.exec(raw);
  if (trailing) return { name: trailing[1]!.trim(), code: trailing[2]! };
  const leading = /^([A-Z]{1,4}[ -]?\d[A-Z0-9-]*)\s+(.+)$/.exec(raw);
  if (leading) return { name: leading[2]!.trim(), code: leading[1]! };
  return { name: raw.trim(), code: null };
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function paintColorsFrom(
  brand: string,
  collection: string,
  entries: SwatchEntry[],
): PaintColor[] {
  const seen = new Set<string>();
  const colors: PaintColor[] = [];
  for (const entry of entries) {
    const { name, code } = splitColorName(entry.name);
    const id = `${slug(brand)}:${slug(code ?? name)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    colors.push({
      id,
      brand,
      collection,
      code,
      name,
      hex: toHex(entry.rgb),
      family: paintFamily(entry.rgb),
      lightness: Math.round(hsl(entry.rgb).l * 1000) / 1000,
    });
  }
  return colors;
}

// CIE L*a*b* (D65) from a #rrggbb hex, so "closest" means closest to the eye.
function lab(hex: string): [number, number, number] {
  const lin = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
  }) as [number, number, number];
  const [r, g, b] = lin;
  const xyz = [
    (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047,
    0.2126 * r + 0.7152 * g + 0.0722 * b,
    (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883,
  ].map((t) => (t > 216 / 24389 ? Math.cbrt(t) : (t * 24389) / 27 / 116 + 16 / 116));
  const [x, y, z] = xyz as [number, number, number];
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

// The loaded colour closest to a described one: a description becomes a real
// colour with a name and code, never a code made up to fit.
export function nearestPaint<C extends { hex: string }>(hex: string, colors: C[]): C | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const [l, a, b] = lab(hex);
  let best: C | null = null,
    bestDistance = Infinity;
  for (const color of colors) {
    if (!/^#[0-9a-f]{6}$/i.test(color.hex)) continue;
    const [l2, a2, b2] = lab(color.hex);
    const distance = (l - l2) ** 2 + (a - a2) ** 2 + (b - b2) ** 2;
    if (distance < bestDistance) [best, bestDistance] = [color, distance];
  }
  return best;
}

// The k loaded colours closest to a described one, nearest first, with their
// distance: straight-line distance in CIELAB (CIE76 ΔE). Around 2 is hard to
// tell apart, 10 a clearly different chip; past FAR_MATCH_DE nothing loaded
// is a close match and the caller should say so.
export const FAR_MATCH_DE = 12;
export function nearestPaints<C extends { hex: string }>(
  hex: string,
  colors: C[],
  k = 3,
): { color: C; deltaE: number }[] {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return [];
  const [l, a, b] = lab(hex);
  return colors
    .filter((c) => /^#[0-9a-f]{6}$/i.test(c.hex))
    .map((color) => {
      const [l2, a2, b2] = lab(color.hex);
      return { color, deltaE: Math.hypot(l - l2, a - a2, b - b2) };
    })
    .sort((x, y) => x.deltaE - y.deltaE)
    .slice(0, Math.max(0, k));
}

// A colour the owner named, only when a loaded colour has that exact name.
export function namedPaint<C extends { name: string }>(name: string, colors: C[]): C | null {
  const key = name.trim().toLowerCase();
  return (key && colors.find((c) => c.name.toLowerCase() === key)) || null;
}
