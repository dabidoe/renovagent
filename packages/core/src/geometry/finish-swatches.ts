// Approximate display swatches for named wall colours, shared by the web 3D
// view and the Blender render. Illustrative only: not a paint product match.
const SWATCHES: Record<string, string> = {
  white: '#f4f2ec',
  'warm white': '#f3ede0',
  'soft blue': '#9fb6cd',
  blue: '#6f8fb3',
  navy: '#2c3e5c',
  sage: '#a7b59a',
  green: '#7f9a74',
  grey: '#b7b9b8',
  gray: '#b7b9b8',
  greige: '#c9c0b1',
  beige: '#d9cbb2',
  charcoal: '#4a4d50',
  black: '#2b2b2b',
  yellow: '#e8d58a',
  terracotta: '#c47a5a',
  pink: '#e4b9b4',
};

export function wallSwatch(name: string): { hex: string; exact: boolean } {
  const key = name.trim().toLowerCase();
  const hit = Object.keys(SWATCHES)
    .sort((a, b) => b.length - a.length)
    .find((k) => key.includes(k));
  return hit ? { hex: SWATCHES[hit], exact: key === hit } : { hex: '#e9e6df', exact: false };
}

export type FloorFinishKind = 'wood' | 'vinyl-plank' | 'tile' | 'carpet' | 'plain';
export function floorFinishKind(finish: string): FloorFinishKind {
  const f = finish.toLowerCase();
  if (/(vinyl|lvp)/.test(f)) return 'vinyl-plank';
  if (/(oak|hardwood|wood)/.test(f)) return 'wood';
  if (/tile/.test(f)) return 'tile';
  if (/carpet/.test(f)) return 'carpet';
  return 'plain';
}
