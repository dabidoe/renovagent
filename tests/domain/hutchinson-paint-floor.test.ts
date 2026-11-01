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
  const lines = new Map(t.lines.map((l) => [l.bomItemId, l]));
  // Two coats over the gross wall area, at the mid paint's 400 sq ft per gallon.
  assert.equal(lines.get('wall-paint:paint')!.purchaseUnits, Math.ceil((t.wallSqFt * 2) / 400));
  assert.ok([...lines.keys()].some((id) => id.startsWith('lvp-floor:')));
  assert.equal(
    t.totalMinor,
    t.lines.reduce((sum, l) => sum + l.lineTotalMinor, 0),
  );
  assert.ok(t.lines.every((l) => l.source === 'example-import'));
});

test('nothing chosen costs nothing; the kitchen keeps its vinyl as the base', () => {
  const none = roomTakeoff(room('primary'), { color: null, floor: 'keep', included: true }, 'mid');
  assert.equal(none.totalMinor, 0);
  assert.deepEqual(none.lines, []);
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
  assert.ok(noCeiling.lines.some((l) => l.bomItemId.startsWith('lvp-floor:')));
  assert.ok(!noCeiling.lines.some((l) => l.bomItemId === 'wall-paint:paint'));
});

test('photos take the printed plan room that names them, each room once', async () => {
  const { matchPlanRooms, ownProject } = await import(
    '../../apps/web/src/features/house-example/own-project.js'
  );
  const plans = [
    { name: 'KITCHEN', widthFt: 9.5, lengthFt: 15.25 },
    { name: 'LIVING ROOM', widthFt: 13.083, lengthFt: 23.167 },
    { name: 'BEDROOM', widthFt: 9.5, lengthFt: 9.25 },
    { name: 'PRIMARY BEDROOM', widthFt: 11.333, lengthFt: 10.25 },
  ];
  const photo = (title: string, kind: string) => ({
    sha256: title.padEnd(64, '0'),
    kind,
    title,
    floor: 'carpet',
  });
  const photos = [
    photo('Primary bedroom', 'bedroom'),
    photo('Living room', 'living room'),
    photo('Back bedroom', 'bedroom'),
    photo('Office', 'office'),
  ];
  assert.deepEqual(matchPlanRooms(photos, plans), [3, 1, 2, null]);
  const project = ownProject({
    id: 'own',
    address: '',
    ceilingFt: 8,
    photos,
    plans,
    walls: {},
  });
  assert.equal(project.address, 'Your project');
  assert.deepEqual(project.rooms[1]!.size, { xFt: 13.083, yFt: 23.167 });
  assert.equal(project.rooms[3]!.size, undefined);
});

test('a ceiling estimate is rounded, bounded, and falls back to about 8 ft', async () => {
  const { ceilingFrom } = await import('../../apps/api/src/studio.js');
  assert.deepEqual(ceilingFrom({ estimateFt: 9.2, basis: 'door' }), { ft: 9, basis: 'door' });
  assert.deepEqual(ceilingFrom({ estimateFt: 22, basis: 'door' }), { ft: 8, basis: 'none' });
  assert.deepEqual(ceilingFrom({ estimateFt: 10, basis: 'none' }), { ft: 8, basis: 'none' });
  assert.deepEqual(ceilingFrom('nonsense'), { ft: 8, basis: 'none' });
});

test('paint is priced by its line and finish, never by its colour', () => {
  const pick = { color: gray, floor: 'keep' as const, included: true };
  const paintLine = (p: Parameters<typeof roomTakeoff>[1], tier: 'builder' | 'mid' | 'high') =>
    roomTakeoff(room('living'), p, tier).lines.find((l) => l.bomItemId === 'wall-paint:paint')!;
  // Eggshell unless chosen; the line follows the tier until chosen.
  assert.match(paintLine(pick, 'mid').productName, /Premium interior eggshell/);
  assert.match(paintLine({ ...pick, sheen: 'satin' }, 'mid').productName, /satin/);
  const designer = paintLine({ ...pick, paintLine: 'high' }, 'builder');
  assert.match(designer.productName, /Designer interior eggshell/);
  assert.ok(
    designer.unitPriceMinor > paintLine(pick, 'builder').unitPriceMinor,
    'a better line costs more per gallon',
  );
  const navy = { ...gray, name: 'Naval', code: 'SW 6244', hex: '#2f3d4c' };
  assert.equal(
    roomTakeoff(room('living'), { ...pick, color: navy }, 'mid').totalMinor,
    roomTakeoff(room('living'), pick, 'mid').totalMinor,
    'the colour does not change the price',
  );
  // The floor still follows the tier when the paint line is chosen.
  const floor = (tier: 'builder' | 'high') =>
    roomTakeoff(room('living'), { ...pick, floor: 'lvp', paintLine: 'mid' }, tier).lines.find((l) =>
      l.bomItemId.startsWith('lvp-floor:'),
    )!.unitPriceMinor;
  assert.ok(floor('high') > floor('builder'));
});
