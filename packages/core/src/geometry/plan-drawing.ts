import { floorOutline } from '../scope/floor-plan.js';
import type { ModelWall, Pt, RoomModel } from './room-model.js';

// A dimensioned plan drawing of the room model, as standalone SVG. Plan
// coordinates map straight to SVG (x right, y down), so the drawing is the
// view from above with nothing mirrored. Layers are named so trades can add
// theirs: the electrical layer stays empty because no capture records outlets,
// switches or circuits, and inventing them would be worse than leaving it blank.
//
// Only measured values are written as dimensions. Walls whose thickness or
// height the file does not give are drawn in a distinct style, never labelled
// with a display value. Door swings are not drawn: captures do not record them.

const PX_PER_M = 80;
const MARGIN_M = 1.1;
const DISPLAY_THICKNESS_M = 0.08; // drawing only; never a dimension

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot', "'": 'apos' }[c]};`,
  );
const n = (v: number) => Math.round(v * 1000) / 1000;

// 3.74 m → 12' 3¼" (to the nearest quarter inch).
export function feetInches(metres: number): string {
  const quarters = Math.round((metres / 0.0254) * 4);
  const feet = Math.floor(quarters / 48);
  const rest = quarters - feet * 48;
  const inches = Math.floor(rest / 4);
  const frac = ['', '¼', '½', '¾'][rest % 4];
  return `${feet}' ${inches}${frac}"`;
}
export const dimensionLabel = (metres: number) => `${feetInches(metres)} (${metres.toFixed(2)} m)`;

function along(w: ModelWall, d: number): Pt {
  const t = d / w.lengthM;
  return [w.a[0] + (w.b[0] - w.a[0]) * t, w.a[1] + (w.b[1] - w.a[1]) * t];
}

export function floorPlanSvg(
  model: RoomModel,
  options: { title: string; sourceLabel: string },
): string {
  const pts = [
    ...model.walls.flatMap((w) => [w.a, w.b]),
    ...model.floorOutlines.flatMap((f) => f.points),
  ];
  const [minX, maxX] = [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0]))];
  const [minY, maxY] = [Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1]))];
  const ox = minX - MARGIN_M;
  const oy = minY - MARGIN_M;
  const widthM = maxX - minX + 2 * MARGIN_M;
  const titleH = 70;
  const W = Math.ceil(widthM * PX_PER_M);
  const H = Math.ceil((maxY - minY + 2 * MARGIN_M) * PX_PER_M) + titleH;
  const X = (x: number) => n((x - ox) * PX_PER_M);
  const Y = (y: number) => n((y - oy) * PX_PER_M);
  const centroid: Pt = [(minX + maxX) / 2, (minY + maxY) / 2];

  const outline = floorOutline(model);
  const floor = outline
    ? `<polygon class="floor" points="${outline.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')}"/>`
    : '';

  const walls = model.walls
    .map((w) => {
      const cls = ['wall'];
      if (w.thicknessM === null) cls.push('thickness-unknown');
      if (w.heightM === null) cls.push('height-unknown');
      if (w.curved) cls.push('curved');
      const t = (w.thicknessM ?? DISPLAY_THICKNESS_M) * PX_PER_M;
      return `<line class="${cls.join(' ')}" data-id="${esc(w.id)}" x1="${X(w.a[0])}" y1="${Y(w.a[1])}" x2="${X(w.b[0])}" y2="${Y(w.b[1])}" stroke-width="${n(t)}"/>`;
    })
    .join('');

  const openings = model.walls
    .flatMap((w) =>
      w.openings.map((o) => {
        const [s, e] = [along(w, o.alongM - o.widthM / 2), along(w, o.alongM + o.widthM / 2)];
        const c = along(w, o.alongM);
        const t = (w.thicknessM ?? DISPLAY_THICKNESS_M) * PX_PER_M + 2;
        const gap = `<line class="opening-gap" x1="${X(s[0])}" y1="${Y(s[1])}" x2="${X(e[0])}" y2="${Y(e[1])}" stroke-width="${n(t)}"/>`;
        const mark =
          o.kind === 'window'
            ? `<line class="window" x1="${X(s[0])}" y1="${Y(s[1])}" x2="${X(e[0])}" y2="${Y(e[1])}"/>`
            : `<line class="door-jamb" x1="${X(s[0])}" y1="${Y(s[1])}" x2="${X(e[0])}" y2="${Y(e[1])}"/>`;
        const label = `<text class="opening-label" x="${X(c[0])}" y="${Y(c[1]) - 8}">${o.kind === 'window' ? 'W' : o.kind === 'door' ? 'D' : 'O'} ${esc(feetInches(o.widthM))}</text>`;
        return `<g class="opening ${o.kind}" data-id="${esc(o.id)}" data-x="${n(c[0])}" data-y="${n(c[1])}">${gap}${mark}${label}</g>`;
      }),
    )
    .join('');

  const fixtures = model.fixtures
    .map((f) => {
      const deg = n((f.rotationRad * 180) / Math.PI);
      // The outline rotates with the fixture; its label stays upright.
      return `<g class="fixture" data-id="${esc(f.id)}" data-x="${f.center[0]}" data-y="${f.center[1]}" transform="translate(${X(f.center[0])} ${Y(f.center[1])})"><rect transform="rotate(${deg})" x="${n((-f.widthM / 2) * PX_PER_M)}" y="${n((-f.depthM / 2) * PX_PER_M)}" width="${n(f.widthM * PX_PER_M)}" height="${n(f.depthM * PX_PER_M)}"/><text y="4">${esc(f.category)}</text></g>`;
    })
    .join('');

  // One dimension line per wall, offset away from the room's centre.
  const dims = model.walls
    .map((w) => {
      const [dx, dy] = [(w.b[0] - w.a[0]) / w.lengthM, (w.b[1] - w.a[1]) / w.lengthM];
      let [nx, ny] = [-dy, dx];
      const mid = along(w, w.lengthM / 2);
      if ((mid[0] - centroid[0]) * nx + (mid[1] - centroid[1]) * ny < 0) [nx, ny] = [-nx, -ny];
      const off = 0.45;
      const a: Pt = [w.a[0] + nx * off, w.a[1] + ny * off];
      const b: Pt = [w.b[0] + nx * off, w.b[1] + ny * off];
      const m: Pt = [mid[0] + nx * (off + 0.18), mid[1] + ny * (off + 0.18)];
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angle > 90 || angle < -90) angle += 180;
      return `<g class="dimension" data-wall="${esc(w.id)}"><line x1="${X(a[0])}" y1="${Y(a[1])}" x2="${X(b[0])}" y2="${Y(b[1])}"/><line class="tick" x1="${X(w.a[0])}" y1="${Y(w.a[1])}" x2="${X(a[0])}" y2="${Y(a[1])}"/><line class="tick" x1="${X(w.b[0])}" y1="${Y(w.b[1])}" x2="${X(b[0])}" y2="${Y(b[1])}"/><text transform="translate(${X(m[0])} ${Y(m[1])}) rotate(${n(angle)})">${esc(dimensionLabel(w.lengthM))}</text></g>`;
    })
    .join('');

  const heights = [...new Set(model.walls.map((w) => w.heightM).filter((h) => h !== null))];
  const heightNote =
    heights.length === 1
      ? `Ceiling ${dimensionLabel(heights[0]!)}`
      : 'Ceiling height not established by the file';
  const legend: string[] = [];
  if (model.walls.some((w) => w.thicknessM === null))
    legend.push('dashed walls: thickness not measured');
  if (model.walls.some((w) => w.heightM === null))
    legend.push('orange walls: height not established');
  const ty = H - titleH + 18;
  const title = `<g class="title-block"><text x="12" y="${ty}" class="title">${esc(options.title)}</text><text x="12" y="${ty + 18}">${esc(options.sourceLabel)} · ${esc(heightNote)}${legend.length ? ` · ${esc(legend.join('; '))}` : ''}</text><text x="12" y="${ty + 36}">Measured, not verified. Not for construction. Door swings and wiring not recorded.</text><g transform="translate(${W - 12 - PX_PER_M} ${ty + 30})"><line x1="0" y1="0" x2="${PX_PER_M}" y2="0"/><text x="${PX_PER_M / 2}" y="-6" text-anchor="middle">1 m</text></g></g>`;

  const style = `<style>
.ra-plan .floor{fill:#f3efe6;stroke:none}
.ra-plan .wall{stroke:#1f2933;stroke-linecap:square}
.ra-plan .wall.thickness-unknown{stroke-dasharray:6 3}
.ra-plan .wall.height-unknown{stroke:#c2410c}
.ra-plan .opening-gap{stroke:#fff}
.ra-plan line.window{stroke:#2563eb;stroke-width:3}
.ra-plan .door-jamb{stroke:#1f2933;stroke-width:1;stroke-dasharray:2 2}
.ra-plan .opening-label,.ra-plan .fixture text,.ra-plan .dimension text,.ra-plan .title-block text{font:11px ui-sans-serif,system-ui,sans-serif;fill:#1f2933}
.ra-plan .opening-label,.ra-plan .fixture text,.ra-plan .dimension text{text-anchor:middle}
.ra-plan .fixture rect{fill:#e5e7eb;stroke:#6b7280;stroke-width:1}
.ra-plan .dimension line,.ra-plan .title-block line{stroke:#475569;stroke-width:1}
.ra-plan .dimension .tick{stroke-dasharray:2 2}
.ra-plan .title-block .title{font-weight:600;font-size:13px}
</style>`;
  // Rules are scoped to .ra-plan: inline SVG styles apply to the whole page.
  return `<svg xmlns="http://www.w3.org/2000/svg" class="ra-plan" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" data-units="m" data-scale="${PX_PER_M}px-per-m"><rect width="100%" height="100%" fill="#fff"/>${style}<g id="layer-floor">${floor}</g><g id="layer-walls">${walls}</g><g id="layer-openings">${openings}</g><g id="layer-fixtures">${fixtures}</g><g id="layer-dimensions">${dims}</g><g id="layer-electrical" data-status="not-recorded"></g><g id="layer-title">${title}</g></svg>`;
}
