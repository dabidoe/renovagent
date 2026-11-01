import { type FloorPlanSummary } from '@renovagent/contracts';
import {
  roomModelFromPlan,
  type ModelWall,
  type Pt,
  type RoomModel,
} from '../geometry/room-model.js';

// What a floor plan file proposes for this room, before the person confirms
// any of it. Read from the shared room model; nothing here supplies a
// dimension the file does not establish: it stays null with a note.

const SNAP_M = 0.05; // wall endpoints closer than this are one corner
const round2 = (n: number) => Math.round(n * 100) / 100;

export function shoelace(points: Pt[]) {
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
export function wallLoop(walls: Pick<ModelWall, 'a' | 'b'>[]): Pt[] | null {
  const corners: Pt[] = [];
  const cornerOf = (p: Pt) => {
    const i = corners.findIndex((c) => Math.hypot(c[0] - p[0], c[1] - p[1]) <= SNAP_M);
    if (i >= 0) return i;
    corners.push(p);
    return corners.length - 1;
  };
  const edges = walls.map((s) => [cornerOf(s.a), cornerOf(s.b)] as [number, number]);
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

// The room's floor outline as the model establishes it, or null.
export function floorOutline(model: RoomModel): Pt[] | null {
  if (model.floorOutlines.length === 1) return model.floorOutlines[0].points;
  if (model.floorOutlines.length || model.walls.some((w) => w.curved)) return null;
  return wallLoop(model.walls);
}

export function summarizeFloorPlan(raw: unknown): FloorPlanSummary {
  const model = roomModelFromPlan(raw);
  const { walls, spaces } = model;
  const notes = ['Imported from a file; nothing here is verified until you save it.'];
  if (model.storeyCount > 1)
    notes.push(`The file has ${model.storeyCount} storeys; only the lowest one is used here.`);

  // Floor outline: scanned floor polygons first, else a closed loop of walls,
  // else a single named room's stored area (no perimeter).
  let floorAreaM2: number | null = null;
  let perimeterM: number | null = null;
  if (model.floorOutlines.length) {
    const shapes = model.floorOutlines.map((f) => shoelace(f.points));
    floorAreaM2 = shapes.reduce((sum, s) => sum + s.area, 0);
    perimeterM = shapes.reduce((sum, s) => sum + s.perimeter, 0);
  } else if (walls.some((w) => w.curved))
    notes.push('Floor area is unknown: curved walls are not measured here. Enter it yourself.');
  else {
    const loop = wallLoop(walls);
    if (loop) ({ area: floorAreaM2, perimeter: perimeterM } = shoelace(loop));
    else if (model.rooms.length === 1 && model.rooms[0].areaM2) {
      floorAreaM2 = model.rooms[0].areaM2;
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

  const heights = walls.flatMap((w) => w.heightsM);
  const range: [number, number] | null = heights.length
    ? [round2(Math.min(...heights)), round2(Math.max(...heights))]
    : null;
  let ceilingHeightM: number | null = null;
  if (!range) notes.push('Ceiling height is unknown: the walls have no height.');
  else if (range[1] - range[0] <= 0.05) {
    const sorted = [...heights].sort((a, b) => a - b);
    ceilingHeightM = sorted[Math.floor(sorted.length / 2)];
  } else
    notes.push(
      `Wall heights range from ${range[0]} to ${range[1]} m, so ceiling height is left for you to enter.`,
    );

  const openings = [...walls.flatMap((w) => w.openings), ...model.looseOpenings].map(
    ({ kind, widthM, heightM }) => ({ kind, widthM: round2(widthM), heightM: round2(heightM) }),
  );
  if (openings.length)
    notes.push('Doors and windows are listed but not deducted from paint area (gross quantities).');

  const confidence = { high: 0, medium: 0, low: 0 };
  for (const s of [...walls, ...model.floorOutlines]) if (s.confidence) confidence[s.confidence]++;
  if (confidence.low) notes.push(`${confidence.low} scanned surfaces have low confidence.`);

  return {
    format:
      model.format === 'measured-box' || model.format === 'listing-plan'
        ? 'openplan3d-project'
        : model.format,
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
