import { DomainError, type FloorPlanSummary } from '@renovagent/contracts';

// Reads Apple RoomPlan CapturedRoom JSON and OpenPlan3D's RoomPlan-shaped
// export into a summary the person reviews before anything is recorded.
// Geometry conventions (Y-up metres, column-major 4×4 transforms, a wall's
// direction in the transform's first column, floor polygons in the surface's
// local plane) follow OpenPlan3D's MIT-licensed importer
// (github.com/laanlabs/openPlan3D). Nothing here supplies a dimension the file
// does not establish: it stays null with a note.

type Surface = {
  dimensions: number[];
  transform?: number[];
  polygonCorners?: number[][];
  confidence?: unknown;
  story?: number;
};
type Pt = [number, number];

const SNAP_M = 0.05; // wall endpoints closer than this are one corner
const HEIGHT_AGREEMENT_M = 0.05; // wall heights within this are one ceiling height
const round2 = (n: number) => Math.round(n * 100) / 100;

function surfaces(file: Record<string, unknown>, key: string): Surface[] {
  const list = file[key];
  if (!Array.isArray(list)) return [];
  return list.filter(
    (s): s is Surface =>
      !!s &&
      typeof s === 'object' &&
      Array.isArray((s as Surface).dimensions) &&
      (s as Surface).dimensions
        .slice(0, 2)
        .every((n) => typeof n === 'number' && Number.isFinite(n)),
  );
}

function shoelace(points: Pt[]) {
  let twiceArea = 0;
  let length = 0;
  points.forEach(([x1, y1], i) => {
    const [x2, y2] = points[(i + 1) % points.length];
    twiceArea += x1 * y2 - x2 * y1;
    length += Math.hypot(x2 - x1, y2 - y1);
  });
  return { area: Math.abs(twiceArea) / 2, perimeter: length };
}

// Walls that close exactly one loop (every corner shared by two walls) give the
// room outline. Anything else (open runs, interior walls) returns null.
function wallLoop(walls: Surface[]): Pt[] | null {
  const corners: Pt[] = [];
  const edges: [number, number][] = [];
  const cornerOf = (p: Pt) => {
    const i = corners.findIndex((c) => Math.hypot(c[0] - p[0], c[1] - p[1]) <= SNAP_M);
    if (i >= 0) return i;
    corners.push(p);
    return corners.length - 1;
  };
  for (const w of walls) {
    const t = w.transform;
    if (!t || t.length < 16) return null;
    const norm = Math.hypot(t[0], t[2]);
    if (!norm) return null;
    const [dx, dz] = [t[0] / norm, t[2] / norm];
    const half = w.dimensions[0] / 2;
    edges.push([
      cornerOf([t[12] - dx * half, t[14] - dz * half]),
      cornerOf([t[12] + dx * half, t[14] + dz * half]),
    ]);
  }
  const degree = corners.map((_, i) => edges.filter((e) => e.includes(i)).length);
  if (corners.length < 3 || degree.some((d) => d !== 2)) return null;
  const loop = [edges[0][0]];
  const used = new Set<number>();
  let at = edges[0][0];
  for (let step = 0; step < edges.length; step++) {
    const next = edges.findIndex((e, i) => !used.has(i) && e.includes(at));
    if (next < 0) return null;
    used.add(next);
    at = edges[next][0] === at ? edges[next][1] : edges[next][0];
    if (step < edges.length - 1) loop.push(at);
  }
  return at === loop[0] && used.size === edges.length ? loop.map((i) => corners[i]) : null;
}

function confidenceOf(s: Surface): 'high' | 'medium' | 'low' | null {
  const c = s.confidence;
  const key = typeof c === 'string' ? c : c && typeof c === 'object' ? Object.keys(c)[0] : null;
  return key === 'high' || key === 'medium' || key === 'low' ? key : null;
}

export function summarizeFloorPlan(raw: unknown): FloorPlanSummary {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new DomainError('VALIDATION', 'Not a floor plan file');
  const file = raw as Record<string, unknown>;
  const walls = surfaces(file, 'walls').filter((w) => w.dimensions[0] > 0.01);
  if (!walls.length)
    throw new DomainError('VALIDATION', 'No walls found: expected a RoomPlan or OpenPlan3D file');
  const format = 'stories' in file || 'defaults' in file ? 'openplan3d-export' : 'roomplan-capture';
  const notes = ['Imported from a file; nothing here is verified until you save it.'];

  const spaces = Array.isArray(file.sections)
    ? file.sections.flatMap((s) =>
        s && typeof s === 'object' && typeof (s as { label?: unknown }).label === 'string'
          ? [(s as { label: string }).label]
          : [],
      )
    : [];
  const stories = new Set(walls.map((w) => w.story ?? 0));
  if (stories.size > 1)
    notes.push(`The file spans ${stories.size} storeys; area totals cover all of them.`);

  // Floor outline: scanned floor polygons first, else a closed loop of walls.
  let floorAreaM2: number | null = null;
  let perimeterM: number | null = null;
  const polygons = surfaces(file, 'floors').filter((f) => (f.polygonCorners?.length ?? 0) >= 3);
  if (polygons.length) {
    const shapes = polygons.map((f) => shoelace(f.polygonCorners!.map(([x, y]) => [x, y] as Pt)));
    floorAreaM2 = shapes.reduce((sum, s) => sum + s.area, 0);
    perimeterM = shapes.reduce((sum, s) => sum + s.perimeter, 0);
  } else {
    const loop = wallLoop(walls);
    if (loop) ({ area: floorAreaM2, perimeter: perimeterM } = shoelace(loop));
    else
      notes.push(
        'Floor area is unknown: the walls do not close a single room outline. Enter it or edit the plan.',
      );
  }
  if (spaces.length > 1 && perimeterM !== null) {
    perimeterM = null;
    notes.push(
      `The scan covers ${spaces.length} spaces (${spaces.join(', ')}). Floor area is their total; the outline perimeter leaves out interior walls, so it is not used. Scan or draw one room for wall quantities.`,
    );
  }

  const heights = walls.map((w) => w.dimensions[1]).filter((h) => h > 0);
  const range: [number, number] | null = heights.length
    ? [round2(Math.min(...heights)), round2(Math.max(...heights))]
    : null;
  let ceilingHeightM: number | null = null;
  if (!range) notes.push('Ceiling height is unknown: the walls have no height.');
  else if (range[1] - range[0] <= HEIGHT_AGREEMENT_M) {
    const sorted = [...heights].sort((a, b) => a - b);
    ceilingHeightM = sorted[Math.floor(sorted.length / 2)];
  } else
    notes.push(
      `Wall heights range from ${range[0]} to ${range[1]} m, so ceiling height is left for you to enter.`,
    );

  const openings = [
    ...surfaces(file, 'doors').map((s) => ({ kind: 'door' as const, s })),
    ...surfaces(file, 'openings').map((s) => ({ kind: 'opening' as const, s })),
    ...surfaces(file, 'windows').map((s) => ({ kind: 'window' as const, s })),
  ].map(({ kind, s }) => ({
    kind,
    widthM: round2(s.dimensions[0]),
    heightM: round2(s.dimensions[1]),
  }));
  if (openings.length)
    notes.push('Doors and windows are listed but not deducted from paint area (gross quantities).');

  const confidence = { high: 0, medium: 0, low: 0 };
  for (const s of [...walls, ...polygons]) {
    const c = confidenceOf(s);
    if (c) confidence[c]++;
  }
  if (confidence.low) notes.push(`${confidence.low} scanned surfaces have low confidence.`);

  return {
    format,
    floorAreaM2: floorAreaM2 && floorAreaM2 > 0 ? round2(floorAreaM2) : null,
    perimeterM: perimeterM && perimeterM > 0 ? round2(perimeterM) : null,
    ceilingHeightM: ceilingHeightM ? round2(ceilingHeightM) : null,
    wallHeightRangeM: range,
    wallCount: walls.length,
    spaces,
    openings,
    confidence,
    notes,
  };
}
