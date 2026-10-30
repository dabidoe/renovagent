import test from 'node:test';
import assert from 'node:assert/strict';
import { boxRoomModel, feetInches, floorPlanSvg, roomModelFromPlan } from '@renovagent/core';

// An asymmetric L-shaped room (OpenPlan3D project file, cm): 5 m along x,
// 5 m along y, with the (3..5, 3..5) corner cut out. Door on the east wall,
// window on the west wall, so any mirroring shows up.
const wall = (id: string, x1: number, y1: number, x2: number, y2: number) => ({
  id,
  start: { x: x1, y: y1 },
  end: { x: x2, y: y2 },
  thickness: 12,
  height: 250,
});
const lRoom = {
  id: 'p',
  name: 'L',
  activeFloorId: 'f',
  floors: [
    {
      id: 'f',
      level: 0,
      walls: [
        wall('north', 0, 0, 500, 0),
        wall('east', 500, 0, 500, 300),
        wall('notch-south', 500, 300, 300, 300),
        wall('notch-east', 300, 300, 300, 500),
        wall('south', 300, 500, 0, 500),
        wall('west', 0, 500, 0, 0),
      ],
      rooms: [{ id: 'r', name: 'Bath', walls: [], area: 21 }],
      doors: [{ id: 'd1', wallId: 'east', position: 0.5, width: 80, height: 203, type: 'single' }],
      windows: [
        { id: 'w1', wallId: 'west', position: 0.25, width: 120, height: 110, sillHeight: 90 },
      ],
      furniture: [
        {
          id: 'f1',
          catalogId: 'toilet',
          position: { x: 100, y: 100 },
          rotation: 90,
          width: 38,
          depth: 70,
          height: 76,
        },
        { id: 'f2', catalogId: 'sofa', position: { x: 200, y: 200 }, rotation: 0 },
      ],
    },
  ],
};

test('openings are placed along their walls, in metres, with sills', () => {
  const m = roomModelFromPlan(lRoom);
  const east = m.walls.find((w) => w.id === 'east')!;
  const west = m.walls.find((w) => w.id === 'west')!;
  assert.deepEqual(east.a, [5, 0]);
  assert.equal(east.lengthM, 3);
  assert.deepEqual(east.openings[0], {
    id: 'd1',
    kind: 'door',
    alongM: 1.5,
    widthM: 0.8,
    heightM: 2.03,
    sillM: 0,
  });
  assert.equal(west.openings[0].alongM, 1.25);
  assert.equal(west.openings[0].sillM, 0.9);
  assert.equal(east.thicknessM, 0.12);
  assert.equal(east.heightM, 2.5);
  // Sized fixtures only; the unsized sofa is reported, not invented.
  assert.deepEqual(
    m.fixtures.map((f) => [f.category, f.center, f.widthM, f.rotationRad]),
    [['toilet', [1, 1], 0.38, 1.571]],
  );
  assert.match(m.notes.join(' '), /1 furnishings without their own size/);
});

test('the plan drawing keeps east on the right and west on the left (not mirrored)', () => {
  const svg = floorPlanSvg(roomModelFromPlan(lRoom), { title: 'Bath', sourceLabel: 'Test plan' });
  // Door centre on the east wall at (5, 1.5); window on the west wall at (0, 3.75).
  assert.match(svg, /class="opening door" data-id="d1" data-x="5" data-y="1.5"/);
  assert.match(svg, /class="opening window" data-id="w1" data-x="0" data-y="3.75"/);
  // 5 m → 16' 4¾"; measured walls are solid (no unknown-thickness styling).
  assert.ok(svg.includes('16&apos; 4¾&quot; (5.00 m)'));
  assert.doesNotMatch(svg, /class="wall thickness-unknown/);
  assert.match(svg, /<polygon class="floor"/);
  assert.match(svg, /id="layer-electrical" data-status="not-recorded"/);
  assert.match(svg, /Ceiling 8&apos; 2½&quot; \(2.50 m\)/);
  assert.match(svg, /Not for construction/);
  // Inline SVG styles apply page-wide, so every selector is scoped to the drawing.
  const css = svg.match(/<style>([\s\S]*?)<\/style>/)![1];
  const selectors = [...css.matchAll(/([^{}]+)\{/g)].flatMap((m) => m[1].split(','));
  assert.ok(selectors.length > 10);
  for (const sel of selectors) assert.match(sel.trim(), /^\.ra-plan /);
  assert.match(svg, /<svg [^>]*class="ra-plan"/);
});

// RoomPlan capture: metres, column-major transforms, flat floor surface.
const T = (x: number, z: number, dx: number, dz: number, y = 0) => [
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
  y,
  z,
  1,
];
const rpWall = (id: string, x: number, z: number, dx: number, dz: number, len: number) => ({
  identifier: id,
  dimensions: [len, 2.4, 0],
  transform: T(x, z, dx, dz, 1.2),
  confidence: { high: {} },
});

test('a RoomPlan capture places openings, floor and fixtures in plan coordinates', () => {
  const m = roomModelFromPlan({
    version: 2,
    walls: [
      rpWall('n', 2, 0, 1, 0, 4),
      rpWall('e', 4, 1.5, 0, 1, 3),
      rpWall('s', 2, 3, 1, 0, 4),
      rpWall('w', 0, 1.5, 0, 1, 3),
    ],
    windows: [
      {
        identifier: 'win',
        parentIdentifier: 'e',
        dimensions: [1, 1.2, 0],
        transform: T(4, 2, 0, 1, 1.5),
      },
    ],
    doors: [{ identifier: 'door', dimensions: [0.8, 2, 0], transform: T(1, 3, 1, 0, 1) }],
    floors: [
      {
        dimensions: [4, 3, 0],
        // Local corners around the floor's own centre (2, 1.5).
        transform: [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 2, 0, 1.5, 1],
        polygonCorners: [
          [-2, 1.5, 0],
          [2, 1.5, 0],
          [2, -1.5, 0],
          [-2, -1.5, 0],
        ],
        confidence: { high: {} },
      },
    ],
    objects: [
      {
        identifier: 'wc',
        category: { toilet: {} },
        dimensions: [0.4, 0.75, 0.7],
        transform: T(3.5, 0.5, 0, 1, 0.375),
      },
    ],
    sections: [{ label: 'bathroom', center: [2, 0, 1.5] }],
  });
  const east = m.walls.find((w) => w.id === 'e')!;
  assert.deepEqual(east.openings[0], {
    id: 'win',
    kind: 'window',
    alongM: 2,
    widthM: 1,
    heightM: 1.2,
    sillM: 0.9,
  });
  // A door without its wall is kept as loose, not placed.
  assert.equal(m.looseOpenings[0].id, 'door');
  // Zero depth in a capture means unknown thickness, not zero.
  assert.equal(east.thicknessM, null);
  const xs = m.floorOutlines[0].points.map((p) => p[0]);
  const ys = m.floorOutlines[0].points.map((p) => p[1]);
  assert.deepEqual(
    [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)],
    [0, 4, 0, 3],
  );
  assert.deepEqual(m.fixtures[0].center, [3.5, 0.5]);
  assert.equal(m.fixtures[0].rotationRad, 1.571);
  assert.match(floorPlanSvg(m, { title: 't', sourceLabel: 's' }), /class="wall thickness-unknown/);
});

test('a measured box has no openings and marks an unknown height', () => {
  const m = boxRoomModel({ lengthM: 3.6576, widthM: 3.048, heightM: null });
  assert.deepEqual(
    m.walls.map((w) => w.lengthM),
    [3.658, 3.048, 3.658, 3.048],
  );
  assert.ok(m.walls.every((w) => w.heightM === null && w.thicknessM === null));
  const svg = floorPlanSvg(m, { title: 't', sourceLabel: 'Measured box' });
  assert.match(svg, /Ceiling height not established/);
  assert.match(svg, /class="wall thickness-unknown height-unknown"/);
  assert.ok(svg.includes('12&apos; 0&quot;'));
});

test('feet-and-inches labels round to the nearest quarter inch', () => {
  assert.equal(feetInches(2.4384), `8' 0"`);
  assert.equal(feetInches(0.0254), `0' 1"`);
  assert.equal(feetInches(3.74), `12' 3¼"`);
});
