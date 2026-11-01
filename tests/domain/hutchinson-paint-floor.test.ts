import test from 'node:test';
import assert from 'node:assert/strict';
import { wallSwatch } from '@renovagent/core';
import {
  PRESET_COLORS,
  roomModel as model,
  roomPackages,
  roomTakeoff as takeoff,
  type RoomPick,
  type StudioRoom,
  type TierKey,
} from '../../apps/web/src/features/house-example/paint-floor.js';
import { HUTCHINSON } from '../../apps/web/src/features/house-example/hutchinson-project.js';

const CEILING_FT = HUTCHINSON.ceilingFt!;
const HOUSE_ROOMS = HUTCHINSON.rooms;
const roomModel = (r: StudioRoom) => model(r, CEILING_FT)!;
const roomTakeoff = (r: StudioRoom, pick: RoomPick, tier: TierKey) =>
  takeoff(r, CEILING_FT, pick, tier);

const room = (id: string) => HOUSE_ROOMS.find((r) => r.id === id)!;
const gray = PRESET_COLORS[0]!;

test('a picked paint colour reaches the 3D walls as its exact hex', () => {
  assert.deepEqual(wallSwatch('#2f3d4c'), { hex: '#2f3d4c', exact: true });
  assert.equal(wallSwatch('sage').exact, true);
  assert.equal(wallSwatch('#xyz').exact, false);
});

test('3D rooms are traced from the listing plans at the stated size', () => {
  assert.equal(CEILING_FT, 9);
  for (const r of HOUSE_ROOMS) {
    const model = roomModel(r);
    const xs = model.walls.map((w) => w.a[0]),
      ys = model.walls.map((w) => w.a[1]);
    // The traced outline spans exactly the listing's stated dimensions.
    assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - r.size!.xFt * 0.3048) < 0.01, r.id);
    assert.ok(Math.abs(Math.max(...ys) - Math.min(...ys) - r.size!.yFt * 0.3048) < 0.01, r.id);
    assert.ok(model.walls.every((w) => Math.abs(w.heightM! - 9 * 0.3048) < 0.001));
    // Every opening fits inside its wall.
    for (const w of model.walls)
      for (const o of w.openings)
        assert.ok(
          o.alongM - o.widthM / 2 >= 0 && o.alongM + o.widthM / 2 <= w.lengthM + 1e-6,
          `${r.id} ${o.id}`,
        );
  }
  const living = roomModel(room('living'));
  assert.equal(living.walls.length, 6);
  // The front wall carries the front door and the front window.
  assert.deepEqual(living.walls[2]!.openings.map((o) => o.kind).sort(), ['door', 'window']);
});

test('the living room takeoff runs through the core recipe and demo catalog', () => {
  const t = roomTakeoff(room('living'), { color: gray, floor: 'lvp', included: true }, 'mid');
  assert.equal(
    t.wallSqFt,
    Math.round(2 * (room('living').size!.xFt + room('living').size!.yFt) * 9),
  );
  const lines = new Map(t.plan!.lines.map((l) => [l.bomItemId, l]));
  // Two coats over the gross wall area, at the mid paint's 400 sq ft per gallon.
  assert.equal(lines.get('wall-paint:paint')!.purchaseUnits, Math.ceil((t.wallSqFt * 2) / 400));
  assert.ok([...lines.keys()].some((id) => id.startsWith('lvp-floor:')));
  assert.equal(
    t.totalMinor,
    t.plan!.lines.reduce((sum, l) => sum + l.lineTotalMinor, 0),
  );
  assert.ok(t.plan!.lines.every((l) => l.source === 'example-import'));
});

test('nothing chosen costs nothing; the kitchen keeps its vinyl as the base', () => {
  const none = roomTakeoff(room('primary'), { color: null, floor: 'keep', included: true }, 'mid');
  assert.equal(none.totalMinor, 0);
  assert.equal(none.plan, null);
  assert.deepEqual(
    roomPackages(room('kitchen'), { color: null, floor: 'hardwood', included: true }),
    ['removal-protection', 'hardwood-floor'],
  );
  assert.ok(
    roomPackages(room('primary'), { color: null, floor: 'hardwood', included: true }).includes(
      'carpet-removal',
    ),
  );
});

test('a higher tier never prices the same room below a lower one', () => {
  const pick = { color: gray, floor: 'hardwood' as const, included: true };
  const [b, m, h] = (['builder', 'mid', 'high'] as const).map(
    (tier) => roomTakeoff(room('living'), pick, tier).totalMinor,
  );
  assert.ok(b! <= m! && m! <= h!);
});

test('a room without a size has no 3D and no price until the owner adds one', () => {
  const bare: StudioRoom = {
    id: 'r',
    title: 'Room',
    existingFloor: 'carpet',
    photo: { src: 'x', walls: null },
    floors: {},
  };
  const pick = { color: gray, floor: 'lvp' as const, included: true };
  assert.equal(model(bare, 8), null);
  assert.equal(takeoff(bare, 8, pick, 'mid').totalMinor, 0);
  const sized = { ...bare, size: { xFt: 12, yFt: 14 } };
  assert.ok(model(sized, 8));
  assert.equal(model(sized, null), null);
  // Without a ceiling the floor still prices; paint waits for the height.
  const noCeiling = takeoff(sized, null, pick, 'mid');
  assert.equal(noCeiling.wallSqFt, null);
  assert.ok(noCeiling.plan!.lines.some((l) => l.bomItemId.startsWith('lvp-floor:')));
  assert.ok(!noCeiling.plan!.lines.some((l) => l.bomItemId === 'wall-paint:paint'));
});
