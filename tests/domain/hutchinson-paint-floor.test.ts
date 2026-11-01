import test from 'node:test';
import assert from 'node:assert/strict';
import { wallSwatch } from '@renovagent/core';
import {
  CEILING_FT,
  HOUSE_ROOMS,
  PRESET_COLORS,
  roomModel,
  roomPackages,
  roomTakeoff,
} from '../../apps/web/src/features/house-example/paint-floor.js';

const room = (id: string) => HOUSE_ROOMS.find((r) => r.id === id)!;
const gray = PRESET_COLORS[0]!;

test('a picked paint colour reaches the 3D walls as its exact hex', () => {
  assert.deepEqual(wallSwatch('#2f3d4c'), { hex: '#2f3d4c', exact: true });
  assert.equal(wallSwatch('sage').exact, true);
  assert.equal(wallSwatch('#xyz').exact, false);
});

test('rooms use the listing plan dimensions and the owner-reported ceiling', () => {
  const living = room('living');
  assert.equal(CEILING_FT, 9);
  assert.equal(Math.round(living.lengthFt * 12), 23 * 12 + 2);
  assert.equal(Math.round(living.widthFt * 12), 13 * 12 + 1);
  const model = roomModel(living);
  assert.equal(model.walls.length, 4);
  assert.ok(model.walls.every((w) => Math.abs(w.heightM! - 9 * 0.3048) < 0.001));
});

test('the living room takeoff runs through the core recipe and demo catalog', () => {
  const t = roomTakeoff(room('living'), { color: gray, floor: 'lvp', included: true }, 'mid');
  assert.equal(t.wallSqFt, Math.round(2 * (room('living').lengthFt + room('living').widthFt) * 9));
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
