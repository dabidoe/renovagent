import { DomainError } from '@renovagent/contracts';

// One measured room model that every view reads: the floor-plan summary, the
// dimensioned drawing, the 3D viewer, the GLB and the Blender render. Plan
// coordinates are metres, x to the right and y down the drawing, matching
// OpenPlan3D (RoomPlan x/z and project-file x/y both map to plan x/y). Values a
// file does not establish stay null: no default thickness or height is
// supplied here (OpenPlan3D's own 15 cm and 280 cm fallbacks are not used).
//
// Reads Apple RoomPlan CapturedRoom JSON, OpenPlan3D's RoomPlan-shaped export
// and OpenPlan3D project files. Conventions (Y-up metres, column-major 4×4
// transforms, wall direction in the first column, floor polygons local to
// their surface; project files in centimetres and degrees) follow OpenPlan3D's
// MIT-licensed code (github.com/laanlabs/openPlan3D).

export type Pt = [number, number];
export type Confidence = 'high' | 'medium' | 'low' | null;
export type OpeningKind = 'door' | 'window' | 'opening';

export type ModelOpening = {
  id: string;
  kind: OpeningKind;
  // Distance from the wall's start point to the opening's centre.
  alongM: number;
  widthM: number;
  heightM: number;
  sillM: number | null;
};
export type ModelWall = {
  id: string;
  a: Pt;
  b: Pt;
  lengthM: number;
  // Every height the file gives for this wall (two for a sloped wall).
  heightsM: number[];
  // One agreed height, or null when the file gives none or they disagree.
  heightM: number | null;
  thicknessM: number | null;
  curved: boolean;
  confidence: Confidence;
  openings: ModelOpening[];
};
export type ModelFixture = {
  id: string;
  // Scanned or drawn, existing: never a proposed product.
  category: string;
  center: Pt;
  rotationRad: number;
  widthM: number;
  depthM: number;
  heightM: number | null;
  confidence: Confidence;
};
export type RoomModel = {
  format: 'roomplan-capture' | 'openplan3d-export' | 'openplan3d-project' | 'measured-box';
  storey: number;
  storeyCount: number;
  walls: ModelWall[];
  // Openings on this storey whose wall is not in the file.
  looseOpenings: Omit<ModelOpening, 'alongM'>[];
  floorOutlines: { points: Pt[]; confidence: Confidence }[];
  rooms: { name: string; areaM2: number | null }[];
  spaces: string[];
  fixtures: ModelFixture[];
  notes: string[];
};

const HEIGHT_AGREEMENT_M = 0.05;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const list = (v: unknown) => (Array.isArray(v) ? v.filter(isObject) : []);
const pt = (x: number, y: number): Pt => [round3(x), round3(y)];
const id = (v: unknown, fallback: string) => (typeof v === 'string' && v ? v : fallback);

export function confidenceOf(c: unknown): Confidence {
  const key = typeof c === 'string' ? c : isObject(c) ? Object.keys(c)[0] : null;
  return key === 'high' || key === 'medium' || key === 'low' ? key : null;
}

function agreedHeight(heights: number[]): number | null {
  if (!heights.length) return null;
  const [lo, hi] = [Math.min(...heights), Math.max(...heights)];
  if (hi - lo > HEIGHT_AGREEMENT_M) return null;
  const sorted = [...heights].sort((a, b) => a - b);
  return round3(sorted[Math.floor(sorted.length / 2)]);
}

function wall(
  w: Omit<ModelWall, 'lengthM' | 'heightM' | 'openings'>,
  openings: ModelOpening[] = [],
): ModelWall {
  return {
    ...w,
    lengthM: round3(Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1])),
    heightM: agreedHeight(w.heightsM),
    openings,
  };
}

type Storeyed<T> = T & { story: number };

function finish(
  format: RoomModel['format'],
  walls: Storeyed<ModelWall>[],
  rest: {
    loose: Storeyed<Omit<ModelOpening, 'alongM'>>[];
    floors: Storeyed<RoomModel['floorOutlines'][number]>[];
    rooms: Storeyed<RoomModel['rooms'][number]>[];
    spaces: Storeyed<{ label: string }>[];
    fixtures: Storeyed<ModelFixture>[];
    notes: string[];
  },
): RoomModel {
  if (!walls.length)
    throw new DomainError(
      'VALIDATION',
      'No walls found: expected a RoomPlan scan or an OpenPlan3D plan file',
    );
  const stories = [...new Set(walls.map((w) => w.story))].sort((a, b) => a - b);
  const storey = stories[0];
  const on = <T extends { story: number }>(items: T[]) =>
    items.filter((i) => i.story === storey).map(({ story: _story, ...item }) => item);
  return {
    format,
    storey,
    storeyCount: stories.length,
    walls: on(walls),
    looseOpenings: on(rest.loose),
    floorOutlines: on(rest.floors),
    rooms: on(rest.rooms),
    spaces: on(rest.spaces).map((s) => s.label),
    fixtures: on(rest.fixtures),
    notes: rest.notes,
  };
}

// RoomPlan capture or OpenPlan3D's RoomPlan-shaped export (metres, transforms).
function fromRoomPlan(file: Record<string, unknown>): RoomModel {
  const dims = (s: Record<string, unknown>) =>
    Array.isArray(s.dimensions) && s.dimensions.slice(0, 3).every((n) => finite(n ?? 0))
      ? (s.dimensions as number[])
      : null;
  const transform = (s: Record<string, unknown>) =>
    Array.isArray(s.transform) && s.transform.length >= 16 && s.transform.every(finite)
      ? (s.transform as number[])
      : null;
  const story = (s: Record<string, unknown>) => (finite(s.story) ? s.story : 0);
  const walls: Storeyed<ModelWall>[] = [];
  const floorY = new Map<number, number>();
  list(file.walls).forEach((w, i) => {
    const d = dims(w);
    const t = transform(w);
    if (!d || !t || d[0] <= 0.01) return;
    const norm = Math.hypot(t[0], t[2]);
    if (!norm) return;
    const [dx, dz] = [t[0] / norm, t[2] / norm];
    const half = d[0] / 2;
    const s = story(w);
    if (d[1] > 0) floorY.set(s, Math.min(floorY.get(s) ?? Infinity, t[13] - d[1] / 2));
    walls.push({
      ...wall({
        id: id(w.identifier, `wall-${i}`),
        a: pt(t[12] - dx * half, t[14] - dz * half),
        b: pt(t[12] + dx * half, t[14] + dz * half),
        heightsM: d[1] > 0 ? [round3(d[1])] : [],
        // RoomPlan often reports zero depth: unknown, not zero.
        thicknessM: d[2] > 0 ? round3(d[2]) : null,
        curved: w.curve !== undefined && w.curve !== null,
        confidence: confidenceOf(w.confidence),
      }),
      story: s,
    });
  });
  const byId = new Map(walls.map((w) => [w.id, w]));
  const loose: Storeyed<Omit<ModelOpening, 'alongM'>>[] = [];
  const kinds: [string, OpeningKind][] = [
    ['doors', 'door'],
    ['openings', 'opening'],
    ['windows', 'window'],
  ];
  for (const [key, kind] of kinds)
    list(file[key]).forEach((o, i) => {
      const d = dims(o);
      if (!d) return;
      const t = transform(o);
      const s = story(o);
      const base = floorY.get(s);
      const opening = {
        id: id(o.identifier, `${kind}-${i}`),
        kind,
        widthM: round3(d[0]),
        heightM: round3(d[1]),
        sillM: t && base !== undefined ? Math.max(0, round3(t[13] - d[1] / 2 - base)) : null,
      };
      const parent = byId.get(o.parentIdentifier as string);
      if (!parent || !t) return void loose.push({ ...opening, story: s });
      const [ux, uy] = [
        (parent.b[0] - parent.a[0]) / parent.lengthM,
        (parent.b[1] - parent.a[1]) / parent.lengthM,
      ];
      const along = (t[12] - parent.a[0]) * ux + (t[14] - parent.a[1]) * uy;
      parent.openings.push({ ...opening, alongM: round3(along) });
    });
  const floors = list(file.floors).flatMap((f) => {
    const t = transform(f);
    if (!t || !Array.isArray(f.polygonCorners) || f.polygonCorners.length < 3) return [];
    // Corners are local to the floor surface; place them in the plan.
    const points = (f.polygonCorners as number[][]).map(([x, y, z = 0]) =>
      pt(t[0] * x + t[4] * y + t[8] * z + t[12], t[2] * x + t[6] * y + t[10] * z + t[14]),
    );
    return [{ points, confidence: confidenceOf(f.confidence), story: story(f) }];
  });
  const fixtures = list(file.objects).flatMap((o, i) => {
    const d = dims(o);
    const t = transform(o);
    if (!d || !t || !isObject(o.category)) return [];
    return [
      {
        id: id(o.identifier, `object-${i}`),
        category: Object.keys(o.category)[0] ?? 'object',
        center: pt(t[12], t[14]),
        rotationRad: round3(Math.atan2(t[2], t[0])),
        widthM: round3(d[0]),
        depthM: round3(d[2]),
        heightM: d[1] > 0 ? round3(d[1]) : null,
        confidence: confidenceOf(o.confidence),
        story: story(o),
      },
    ];
  });
  return finish(
    'stories' in file || 'openplanPrepared' in file ? 'openplan3d-export' : 'roomplan-capture',
    walls,
    {
      loose,
      floors,
      rooms: [],
      spaces: list(file.sections).flatMap((s) =>
        typeof s.label === 'string' ? [{ label: s.label, story: story(s) }] : [],
      ),
      fixtures,
      notes: [],
    },
  );
}

// OpenPlan3D project file: floors of walls with start/end points in cm.
function fromProject(file: Record<string, unknown>): RoomModel {
  const walls: Storeyed<ModelWall>[] = [];
  const rest = {
    loose: [] as Storeyed<Omit<ModelOpening, 'alongM'>>[],
    floors: [],
    rooms: [] as Storeyed<RoomModel['rooms'][number]>[],
    spaces: [] as Storeyed<{ label: string }>[],
    fixtures: [] as Storeyed<ModelFixture>[],
    notes: [] as string[],
  };
  const point = (p: unknown): Pt | null =>
    isObject(p) && finite(p.x) && finite(p.y) ? pt(p.x / 100, p.y / 100) : null;
  const cm = (v: unknown) => (finite(v) && v > 0 ? round3(v / 100) : null);
  let undimensioned = 0;
  list(file.floors).forEach((floor, index) => {
    const story = finite(floor.level) ? floor.level : index;
    const floorWalls = new Map<string, ModelWall>();
    list(floor.walls).forEach((w, i) => {
      const [a, b] = [point(w.start), point(w.end)];
      if (!a || !b || Math.hypot(b[0] - a[0], b[1] - a[1]) <= 0.01) return;
      // Endpoint heights (sloped walls) win over the single height.
      const ends = [cm(w.startHeight), cm(w.endHeight)].filter((h): h is number => h !== null);
      const single = cm(w.height);
      const built = wall({
        id: id(w.id, `wall-${i}`),
        a,
        b,
        heightsM: ends.length ? ends : single !== null ? [single] : [],
        thicknessM: cm(w.thickness),
        curved: isObject(w.curvePoint),
        confidence: null,
      });
      floorWalls.set(built.id, built);
      walls.push({ ...built, story });
    });
    const place = (kind: OpeningKind, o: Record<string, unknown>, i: number) => {
      const [width, height] = [cm(o.width), cm(o.height)];
      if (width === null || height === null) return;
      const opening = {
        id: id(o.id, `${kind}-${i}`),
        kind,
        widthM: width,
        heightM: height,
        sillM: kind === 'door' ? 0 : finite(o.sillHeight) ? round3(o.sillHeight / 100) : null,
      };
      const parent = floorWalls.get(o.wallId as string);
      if (!parent || !finite(o.position)) return void rest.loose.push({ ...opening, story });
      parent.openings.push({ ...opening, alongM: round3(o.position * parent.lengthM) });
    };
    list(floor.doors).forEach((o, i) => place(o.type === 'opening' ? 'opening' : 'door', o, i));
    list(floor.windows).forEach((o, i) => place('window', o, i));
    for (const r of list(floor.rooms)) {
      if (r.floorOpening === true) continue;
      const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim() : 'Room';
      rest.rooms.push({ name, areaM2: finite(r.area) && r.area > 0 ? r.area : null, story });
      rest.spaces.push({ label: name, story });
    }
    list(floor.furniture).forEach((f, i) => {
      const center = point(f.position);
      const [width, depth] = [cm(f.width), cm(f.depth)];
      // Catalog default sizes are not measurements; skip what was not sized.
      if (!center || width === null || depth === null) return void undimensioned++;
      rest.fixtures.push({
        id: id(f.id, `furniture-${i}`),
        category: typeof f.catalogId === 'string' ? f.catalogId : 'object',
        center,
        rotationRad: round3(((finite(f.rotation) ? f.rotation : 0) * Math.PI) / 180),
        widthM: width,
        depthM: depth,
        heightM: cm(f.height),
        confidence: null,
        story,
      });
    });
  });
  if (undimensioned)
    rest.notes.push(`${undimensioned} furnishings without their own size are not shown.`);
  return finish('openplan3d-project', walls, rest);
}

export function roomModelFromPlan(raw: unknown): RoomModel {
  if (!isObject(raw)) throw new DomainError('VALIDATION', 'Not a floor plan file');
  return list(raw.floors).some((f) => Array.isArray(f.walls))
    ? fromProject(raw)
    : fromRoomPlan(raw);
}

// A rectangular room from measured length × width (× height). Exact only for
// rectangles; labelled as such wherever it is shown.
export function boxRoomModel(size: {
  lengthM: number;
  widthM: number;
  heightM: number | null;
}): RoomModel {
  const { lengthM: l, widthM: w } = size;
  const heightsM = size.heightM ? [round3(size.heightM)] : [];
  const corners: Pt[] = [pt(0, 0), pt(l, 0), pt(l, w), pt(0, w)];
  return {
    format: 'measured-box',
    storey: 0,
    storeyCount: 1,
    walls: corners.map((a, i) =>
      wall({
        id: `wall-${i + 1}`,
        a,
        b: corners[(i + 1) % 4],
        heightsM,
        thicknessM: null,
        curved: false,
        confidence: null,
      }),
    ),
    looseOpenings: [],
    floorOutlines: [{ points: corners, confidence: null }],
    rooms: [],
    spaces: [],
    fixtures: [],
    notes: ['Box room from measured length × width; doors, windows and fixtures are not known.'],
  };
}
