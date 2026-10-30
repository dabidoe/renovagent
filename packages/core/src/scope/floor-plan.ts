import { DomainError, type FloorPlanSummary } from '@renovagent/contracts';

// Reads three floor plan files into a summary the person reviews before
// anything is recorded: Apple RoomPlan CapturedRoom JSON, OpenPlan3D's
// RoomPlan-shaped export, and OpenPlan3D's own project file. Geometry
// conventions (Y-up metres, column-major 4×4 transforms, a wall's direction in
// the transform's first column, floor polygons in the surface's local plane;
// project files in centimetres) follow OpenPlan3D's MIT-licensed code
// (github.com/laanlabs/openPlan3D). Nothing here supplies a dimension the file
// does not establish: it stays null with a note.

type Pt = [number, number];
type Segment = {
  a: Pt;
  b: Pt;
  heights: number[];
  story: number;
  confidence: Confidence;
  // Curved walls are not straight segments; their outline is not computed here.
  curved: boolean;
};
type Confidence = 'high' | 'medium' | 'low' | null;
type Plan = {
  format: FloorPlanSummary['format'];
  segments: Segment[];
  floors: { points: Pt[]; story: number; confidence: Confidence }[];
  // Named rooms from a project file, with their stored area in m².
  rooms: { name: string; areaM2: number | null; story: number }[];
  spaces: { label: string; story: number }[];
  openings: (FloorPlanSummary['openings'][number] & { story: number })[];
};

const SNAP_M = 0.05; // wall endpoints closer than this are one corner
const HEIGHT_AGREEMENT_M = 0.05; // wall heights within this are one ceiling height
const round2 = (n: number) => Math.round(n * 100) / 100;
const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const list = (v: unknown) => (Array.isArray(v) ? v.filter(isObject) : []);

function confidenceOf(c: unknown): Confidence {
  const key = typeof c === 'string' ? c : isObject(c) ? Object.keys(c)[0] : null;
  return key === 'high' || key === 'medium' || key === 'low' ? key : null;
}

// RoomPlan capture or OpenPlan3D's RoomPlan-shaped export (metres, transforms).
function fromRoomPlan(file: Record<string, unknown>): Plan {
  const dims = (s: Record<string, unknown>) =>
    Array.isArray(s.dimensions) && finite(s.dimensions[0]) && finite(s.dimensions[1])
      ? (s.dimensions as number[])
      : null;
  const story = (s: Record<string, unknown>) => (finite(s.story) ? s.story : 0);
  const segments: Segment[] = [];
  for (const w of list(file.walls)) {
    const d = dims(w);
    const t = w.transform as number[] | undefined;
    if (!d || d[0] <= 0.01 || !Array.isArray(t) || t.length < 16) continue;
    const norm = Math.hypot(t[0], t[2]);
    if (!norm) continue;
    const [dx, dz] = [t[0] / norm, t[2] / norm];
    const half = d[0] / 2;
    segments.push({
      a: [t[12] - dx * half, t[14] - dz * half],
      b: [t[12] + dx * half, t[14] + dz * half],
      heights: d[1] > 0 ? [d[1]] : [],
      story: story(w),
      confidence: confidenceOf(w.confidence),
      curved: w.curve !== undefined && w.curve !== null,
    });
  }
  const opening = (kind: 'door' | 'window' | 'opening') => (s: Record<string, unknown>) => {
    const d = dims(s);
    return d ? [{ kind, widthM: round2(d[0]), heightM: round2(d[1]), story: story(s) }] : [];
  };
  return {
    format:
      'stories' in file || 'openplanPrepared' in file ? 'openplan3d-export' : 'roomplan-capture',
    segments,
    floors: list(file.floors).flatMap((f) =>
      Array.isArray(f.polygonCorners) && f.polygonCorners.length >= 3
        ? [
            {
              points: (f.polygonCorners as number[][]).map(([x, y]) => [x, y] as Pt),
              story: story(f),
              confidence: confidenceOf(f.confidence),
            },
          ]
        : [],
    ),
    rooms: [],
    spaces: list(file.sections).flatMap((s) =>
      typeof s.label === 'string' ? [{ label: s.label, story: story(s) }] : [],
    ),
    openings: [
      ...list(file.doors).flatMap(opening('door')),
      ...list(file.openings).flatMap(opening('opening')),
      ...list(file.windows).flatMap(opening('window')),
    ],
  };
}

// OpenPlan3D project file: floors of walls with start/end points in cm.
function fromProject(file: Record<string, unknown>): Plan {
  const plan: Plan = {
    format: 'openplan3d-project',
    segments: [],
    floors: [],
    rooms: [],
    spaces: [],
    openings: [],
  };
  const point = (p: unknown): Pt | null =>
    isObject(p) && finite(p.x) && finite(p.y) ? [p.x / 100, p.y / 100] : null;
  list(file.floors).forEach((floor, index) => {
    const story = finite(floor.level) ? floor.level : index;
    for (const w of list(floor.walls)) {
      const [a, b] = [point(w.start), point(w.end)];
      if (!a || !b || Math.hypot(b[0] - a[0], b[1] - a[1]) <= 0.01) continue;
      // Endpoint heights (sloped walls) win over the single height. Missing
      // heights stay missing: OpenPlan3D's own 280 cm fallback is not used.
      const valid = (hs: unknown[]) => hs.filter((h): h is number => finite(h) && h > 0);
      const ends = valid([w.startHeight, w.endHeight]);
      const heights = (ends.length ? ends : valid([w.height])).map((h) => h / 100);
      plan.segments.push({
        a,
        b,
        heights,
        story,
        confidence: null,
        curved: isObject(w.curvePoint),
      });
    }
    for (const r of list(floor.rooms)) {
      if (r.floorOpening === true) continue;
      const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim() : 'Room';
      plan.rooms.push({ name, areaM2: finite(r.area) && r.area > 0 ? r.area : null, story });
      plan.spaces.push({ label: name, story });
    }
    const size = (kind: 'door' | 'window') => (o: Record<string, unknown>) =>
      finite(o.width) && finite(o.height)
        ? [{ kind, widthM: round2(o.width / 100), heightM: round2(o.height / 100), story }]
        : [];
    plan.openings.push(
      ...list(floor.doors).flatMap(size('door')),
      ...list(floor.windows).flatMap(size('window')),
    );
  });
  return plan;
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
function wallLoop(segments: Segment[]): Pt[] | null {
  const corners: Pt[] = [];
  const cornerOf = (p: Pt) => {
    const i = corners.findIndex((c) => Math.hypot(c[0] - p[0], c[1] - p[1]) <= SNAP_M);
    if (i >= 0) return i;
    corners.push(p);
    return corners.length - 1;
  };
  const edges = segments.map((s) => [cornerOf(s.a), cornerOf(s.b)] as [number, number]);
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

export function summarizeFloorPlan(raw: unknown): FloorPlanSummary {
  if (!isObject(raw)) throw new DomainError('VALIDATION', 'Not a floor plan file');
  const isProject = list(raw.floors).some((f) => Array.isArray(f.walls));
  const plan = isProject ? fromProject(raw) : fromRoomPlan(raw);
  if (!plan.segments.length)
    throw new DomainError(
      'VALIDATION',
      'No walls found: expected a RoomPlan scan or an OpenPlan3D plan file',
    );
  const notes = ['Imported from a file; nothing here is verified until you save it.'];

  // One storey at a time: the lowest one with walls.
  const stories = [...new Set(plan.segments.map((s) => s.story))].sort((a, b) => a - b);
  const story = stories[0];
  if (stories.length > 1)
    notes.push(`The file has ${stories.length} storeys; only the lowest one is used here.`);
  const on = <T extends { story: number }>(items: T[]) => items.filter((i) => i.story === story);
  const walls = on(plan.segments);
  const floors = on(plan.floors);
  const rooms = on(plan.rooms);
  const spaces = on(plan.spaces).map((s) => s.label);

  // Floor outline: scanned floor polygons first, else a closed loop of walls,
  // else a single named room's stored area (no perimeter).
  let floorAreaM2: number | null = null;
  let perimeterM: number | null = null;
  if (floors.length) {
    const shapes = floors.map((f) => shoelace(f.points));
    floorAreaM2 = shapes.reduce((sum, s) => sum + s.area, 0);
    perimeterM = shapes.reduce((sum, s) => sum + s.perimeter, 0);
  } else if (walls.some((w) => w.curved))
    notes.push('Floor area is unknown: curved walls are not measured here. Enter it yourself.');
  else {
    const loop = wallLoop(walls);
    if (loop) ({ area: floorAreaM2, perimeter: perimeterM } = shoelace(loop));
    else if (rooms.length === 1 && rooms[0].areaM2) {
      floorAreaM2 = rooms[0].areaM2;
      notes.push('Perimeter is unknown: the walls do not close a single outline.');
    } else
      notes.push(
        'Floor area is unknown: the walls do not close a single room outline. Enter it or edit the plan.',
      );
  }
  // A whole-home plan is not this room: its total area would price every floor
  // in it, and its outline perimeter omits interior walls.
  if (spaces.length > 1) {
    const total = floorAreaM2 ? ` Total ${round2(floorAreaM2)} m².` : '';
    floorAreaM2 = null;
    perimeterM = null;
    notes.push(
      `The plan covers ${spaces.length} spaces (${spaces.join(', ')}), so its area and perimeter are not this room's.${total} Scan or draw one room, or split the plan in OpenPlan3D.`,
    );
  }

  const heights = walls.flatMap((w) => w.heights);
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

  const openings = on(plan.openings).map(({ kind, widthM, heightM }) => ({
    kind,
    widthM,
    heightM,
  }));
  if (openings.length)
    notes.push('Doors and windows are listed but not deducted from paint area (gross quantities).');

  const confidence = { high: 0, medium: 0, low: 0 };
  for (const s of [...walls, ...floors]) if (s.confidence) confidence[s.confidence]++;
  if (confidence.low) notes.push(`${confidence.low} scanned surfaces have low confidence.`);

  return {
    format: plan.format,
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
