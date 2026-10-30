import test from 'node:test';
import assert from 'node:assert/strict';
import { roomDimensionCommands, scopeDraftId, summarizeFloorPlan } from '@renovagent/core';
import type { ScopeDraft } from '@renovagent/contracts';
import { Scenario } from '../foundation-helpers.js';

// Synthetic files in the RoomPlan JSON shape: Y-up metres, column-major 4×4
// transforms whose first column is the wall direction and last the position.
const high = { high: {} };
const transform = (x: number, z: number, dx: number, dz: number) => [
  dx,
  0,
  dz,
  0,
  0,
  1,
  0,
  0,
  -dz,
  0,
  dx,
  0,
  x,
  0,
  z,
  1,
];
const wall = (x: number, z: number, dx: number, dz: number, length: number, height = 2.44) => ({
  identifier: `w${x},${z}`,
  dimensions: [length, height, 0],
  transform: transform(x, z, dx, dz),
  confidence: high,
  category: { wall: {} },
});
// A 4 m × 3 m room centred on the origin.
const rectangleWalls = (height = 2.44) => [
  wall(0, -1.5, 1, 0, 4, height),
  wall(0, 1.5, 1, 0, 4, height),
  wall(-2, 0, 0, 1, 3, height),
  wall(2, 0, 0, 1, 3, height),
];
const floor = (corners: number[][]) => ({
  identifier: 'floor',
  dimensions: [4, 3, 0],
  transform: transform(0, 0, 1, 0),
  polygonCorners: corners.map(([x, y]) => [x, y, 0]),
  confidence: high,
  category: { floor: {} },
});
const capture = (extra: Record<string, unknown> = {}) => ({
  version: 2,
  walls: rectangleWalls(),
  floors: [
    floor([
      [-2, 1.5],
      [2, 1.5],
      [2, -1.5],
      [-2, -1.5],
    ]),
  ],
  doors: [
    { dimensions: [0.8, 2.03, 0], transform: transform(0, -1.5, 1, 0), category: { door: {} } },
  ],
  windows: [
    { dimensions: [0.9, 1.2, 0], transform: transform(2, 0, 0, 1), category: { window: {} } },
  ],
  objects: [],
  sections: [{ label: 'bathroom', center: [0, 0, 0], story: 0 }],
  ...extra,
});

test('a single-room RoomPlan capture yields area, perimeter, height and openings', () => {
  const s = summarizeFloorPlan(capture());
  assert.equal(s.format, 'roomplan-capture');
  assert.equal(s.floorAreaM2, 12);
  assert.equal(s.perimeterM, 14);
  assert.equal(s.ceilingHeightM, 2.44);
  assert.equal(s.wallCount, 4);
  assert.deepEqual(
    s.openings.map((o) => o.kind),
    ['door', 'window'],
  );
  assert.deepEqual(s.confidence, { high: 5, medium: 0, low: 0 });
  assert.match(s.notes.join(' '), /not deducted/);
});

test('an L-shaped floor uses its true area, not the bounding length × width', () => {
  // 4 × 4 square minus a 2 × 2 corner: 12 m², while the bounding box is 16 m².
  const s = summarizeFloorPlan(
    capture({
      floors: [
        floor([
          [0, 0],
          [4, 0],
          [4, 2],
          [2, 2],
          [2, 4],
          [0, 4],
        ]),
      ],
    }),
  );
  assert.equal(s.floorAreaM2, 12);
  assert.equal(s.perimeterM, 16);
});

test('multi-space scans propose no area or perimeter for the room, only the scan total', () => {
  const s = summarizeFloorPlan(
    capture({
      sections: [
        { label: 'bedroom', center: [0, 0, 0] },
        { label: 'bathroom', center: [1, 0, 0] },
      ],
    }),
  );
  assert.equal(s.floorAreaM2, null);
  assert.equal(s.perimeterM, null);
  assert.match(s.notes.join(' '), /covers 2 spaces \(bedroom, bathroom\)/);
  assert.match(s.notes.join(' '), /Total 12 m²/);
});

test('disagreeing or missing wall heights leave ceiling height unknown, never a default', () => {
  const mixed = capture({ walls: [...rectangleWalls().slice(0, 3), wall(2, 0, 0, 1, 3, 2.99)] });
  const s = summarizeFloorPlan(mixed);
  assert.equal(s.ceilingHeightM, null);
  assert.deepEqual(s.wallHeightRangeM, [2.44, 2.99]);
  const flat = summarizeFloorPlan(capture({ walls: rectangleWalls(0) }));
  assert.equal(flat.ceilingHeightM, null);
  assert.match(flat.notes.join(' '), /no height/);
});

test('an OpenPlan3D export without floor polygons closes the outline from its walls', () => {
  const s = summarizeFloorPlan({
    walls: rectangleWalls(),
    doors: [],
    windows: [],
    openings: [],
    objects: [],
    sections: [],
    stories: [{ index: 0, name: 'Ground' }],
    floors: [],
  });
  assert.equal(s.format, 'openplan3d-export');
  assert.equal(s.floorAreaM2, 12);
  assert.equal(s.perimeterM, 14);
  // An open run of walls does not establish an outline.
  const open = summarizeFloorPlan({ walls: rectangleWalls().slice(0, 3), floors: [], stories: [] });
  assert.equal(open.floorAreaM2, null);
  assert.match(open.notes.join(' '), /do not close a single room outline/);
});

// OpenPlan3D project file: centimetres, walls as start/end points.
const projectWall = (x1: number, y1: number, x2: number, y2: number, extra = {}) => ({
  id: `${x1},${y1}`,
  start: { x: x1, y: y1 },
  end: { x: x2, y: y2 },
  thickness: 15,
  color: '#444',
  ...extra,
});
const project = (walls: object[], rooms: object[] = [], level = 0) => ({
  id: 'p',
  name: 'Plan',
  activeFloorId: 'f',
  floors: [{ id: 'f', name: 'Ground', level, walls, rooms, doors: [], windows: [] }],
});
const box = (extra = {}) => [
  projectWall(0, 0, 400, 0, extra),
  projectWall(400, 0, 400, 300, extra),
  projectWall(400, 300, 0, 300, extra),
  projectWall(0, 300, 0, 0, extra),
];

test('an OpenPlan3D project file is read in centimetres, with no default wall height', () => {
  const s = summarizeFloorPlan(
    project(box({ height: 250 }), [{ id: 'r', name: 'Kitchen', walls: [], area: 12 }]),
  );
  assert.equal(s.format, 'openplan3d-project');
  assert.equal(s.floorAreaM2, 12);
  assert.equal(s.perimeterM, 14);
  assert.equal(s.ceilingHeightM, 2.5);
  assert.deepEqual(s.spaces, ['Kitchen']);
  // OpenPlan3D falls back to 280 cm; we leave a missing height unknown.
  const noHeight = summarizeFloorPlan(project(box()));
  assert.equal(noHeight.ceilingHeightM, null);
  assert.equal(noHeight.floorAreaM2, 12);
});

test('curved walls leave the outline unknown instead of reading them as straight', () => {
  const walls = box({ height: 250 });
  Object.assign(walls[0], { curvePoint: { x: 200, y: -100 } });
  const s = summarizeFloorPlan(project(walls));
  assert.equal(s.floorAreaM2, null);
  assert.match(s.notes.join(' '), /curved walls/);
});

test('only the lowest storey is measured when a file has several', () => {
  const upper = wall(0, 0, 1, 0, 2, 2.6);
  const s = summarizeFloorPlan(
    capture({ floors: [], stories: [], walls: [...rectangleWalls(), { ...upper, story: 1 }] }),
  );
  assert.equal(s.floorAreaM2, 12);
  assert.equal(s.ceilingHeightM, 2.44);
  assert.match(s.notes.join(' '), /2 storeys; only the lowest/);
});

test('files without walls are rejected', () => {
  assert.throws(() => summarizeFloorPlan({ walls: [] }), /No walls/);
  assert.throws(() => summarizeFloorPlan([1, 2]), /Not a floor plan/);
  assert.throws(() => summarizeFloorPlan(null), /Not a floor plan/);
});

test('a confirmed plan replaces length × width in the scope; area cannot be relayed', () => {
  const s = new Scenario();
  s.create();
  const plan = summarizeFloorPlan(capture());
  let n = 0;
  const commands = roomDimensionCommands(
    s.state,
    'project-a',
    {
      length: null,
      width: null,
      height: { amount: plan.ceilingHeightM!, unit: 'm' },
      area: { amount: plan.floorAreaM2!, unit: 'm2' },
      perimeter: { amount: plan.perimeterM!, unit: 'm' },
      method: 'floor-plan-file',
      notes: '',
      photoEvidenceIds: [],
    },
    { commandId: (x) => `c-${x}`, evidenceId: 'e-plan', factId: () => `f-${n++}` },
  );
  for (const c of commands) s.apply(c);
  const area = Object.values(s.state.facts)
    .find((v) => v.at(-1)!.key === 'floorArea')!
    .at(-1)!;
  assert.deepEqual(area.value, { kind: 'quantity', amount: 12e6, dimension: 'area', unit: 'mm2' });

  s.apply(
    s.command('DraftScope', {
      recipeId: 'bathroom-refresh',
      packageIds: ['floor-tile', 'paint', 'exhaust-fan'],
      request: 'Retile, paint and new fan',
      reported: [],
      expectedDraftRevision: 0,
    }),
  );
  const draft = s.state.artifacts[scopeDraftId('project-a')].at(-1)!.payload as ScopeDraft;
  const byId = (id: string) => draft.requirements.find((r) => r.id === id)!;
  assert.equal(byId('floor-tile:tile').quantity, 129.2); // 12 m² in sq ft
  assert.match(byId('floor-tile:tile').quantityBasis, /measured floor area \(floor plan\)/);
  assert.equal(byId('floor-tile:base-trim').quantity, 45.9); // 14 m in ft
  assert.equal(byId('paint:walls').quantity, 367.9); // 45.93 ft × 8.01 ft
  assert.deepEqual(byId('exhaust-fan:fan').blockedBy, []);
  assert.equal(draft.inputs.find((i) => i.key === 'floorAreaSqFt')!.source, 'workspace-fact');

  assert.throws(
    () =>
      s.apply(
        s.command('DraftScope', {
          recipeId: 'bathroom-refresh',
          packageIds: ['floor-tile'],
          request: 'Retile',
          reported: [{ key: 'floorAreaSqFt', amount: 100, unit: 'ft' }],
          expectedDraftRevision: 1,
        }),
      ),
    /comes only from a recorded floor plan/,
  );
});

test('drafts without a plan do not list floor-plan inputs', () => {
  const s = new Scenario();
  s.create();
  s.apply(
    s.command('DraftScope', {
      recipeId: 'bathroom-refresh',
      packageIds: ['paint'],
      request: 'Paint',
      reported: [],
      expectedDraftRevision: 0,
    }),
  );
  const draft = s.state.artifacts[scopeDraftId('project-a')].at(-1)!.payload as ScopeDraft;
  assert.ok(!draft.inputs.some((i) => i.key === 'floorAreaSqFt' || i.key === 'floorPerimeterFt'));
});
