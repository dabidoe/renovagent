import test from 'node:test';
import assert from 'node:assert/strict';
import { paintColorsFrom, paintFamily, parseAse, splitColorName } from '@renovagent/core';

// A swatch file built here (Adobe Swatch Exchange layout), not a brand's file.
export function aseFile(colors: [string, [number, number, number]][], cmyk = false) {
  const blocks = colors.map(([name, rgb]) => {
    const units = name.length + 1;
    const body = Buffer.alloc(2 + units * 2 + 4 + (cmyk ? 16 : 12) + 2);
    body.writeUInt16BE(units, 0);
    for (let i = 0; i < name.length; i++) body.writeUInt16BE(name.charCodeAt(i), 2 + i * 2);
    let at = 2 + units * 2;
    body.write(cmyk ? 'CMYK' : 'RGB ', at, 'ascii');
    at += 4;
    for (const v of cmyk ? [0, 0, 0, 0] : rgb) {
      body.writeFloatBE(v / 255, at);
      at += 4;
    }
    const head = Buffer.alloc(6);
    head.writeUInt16BE(0x0001, 0);
    head.writeUInt32BE(body.length, 2);
    return Buffer.concat([head, body]);
  });
  const header = Buffer.alloc(12);
  header.write('ASEF', 0, 'ascii');
  header.writeUInt16BE(1, 4);
  header.writeUInt32BE(blocks.length, 8);
  return new Uint8Array(Buffer.concat([header, ...blocks]));
}

test('swatch files become paint colours with codes, hex and a family', () => {
  const entries = parseAse(
    aseFile([
      ['Test Greige (XX 0001)', [209, 203, 193]],
      ['Test White (XX 0002)', [237, 234, 224]],
      ['Test Navy (XX 0003)', [47, 61, 76]],
      ['Test Navy (XX 0003)', [47, 61, 76]],
    ]),
  );
  assert.equal(entries.length, 4);
  const colors = paintColorsFrom('Test Paints', 'Fan deck', entries);
  assert.equal(colors.length, 3, 'a repeated code is one colour');
  assert.deepEqual(colors[0], {
    id: 'test-paints:xx-0001',
    brand: 'Test Paints',
    collection: 'Fan deck',
    code: 'XX 0001',
    name: 'Test Greige',
    hex: '#D1CBC1',
    family: 'neutral',
    lightness: 0.788,
  });
  assert.equal(colors[1]!.family, 'white');
  assert.equal(colors[2]!.family, 'blue');
  // Colours not in RGB are skipped rather than guessed.
  assert.equal(parseAse(aseFile([['Ink', [0, 0, 0]]], true)).length, 0);
  assert.throws(() => parseAse(new Uint8Array([1, 2, 3])), /Not a swatch file/);
});

test('colour names split into name and code either way round', () => {
  assert.deepEqual(splitColorName('Agreeable Gray (SW 7029)'), {
    name: 'Agreeable Gray',
    code: 'SW 7029',
  });
  assert.deepEqual(splitColorName('PPU18-06 Ultra Pure White'), {
    name: 'Ultra Pure White',
    code: 'PPU18-06',
  });
  assert.deepEqual(splitColorName('Just A Name'), { name: 'Just A Name', code: null });
});

test('families come from chroma first, then hue', () => {
  assert.equal(paintFamily([209, 199, 184]), 'neutral'); // pale greige
  assert.equal(paintFamily([250, 249, 245]), 'white');
  assert.equal(paintFamily([47, 47, 48]), 'neutral'); // near black
  assert.equal(paintFamily([180, 60, 50]), 'red');
  assert.equal(paintFamily([190, 120, 60]), 'orange');
  assert.equal(paintFamily([230, 200, 80]), 'yellow');
  assert.equal(paintFamily([90, 140, 90]), 'green');
  assert.equal(paintFamily([60, 90, 150]), 'blue');
  assert.equal(paintFamily([120, 80, 150]), 'purple');
});

test('a described colour becomes the closest loaded colour, a named one only on an exact name', async () => {
  const { nearestPaint, namedPaint } = await import('@renovagent/core');
  const colors = [
    { name: 'Alabaster', hex: '#EDEAE0' },
    { name: 'Evergreen Fog', hex: '#95978A' },
    { name: 'Rainforest', hex: '#2F4B3C' },
    { name: 'Naval', hex: '#2F3D4C' },
  ];
  assert.equal(nearestPaint('#2b4a36', colors)?.name, 'Rainforest', 'dark green, not navy');
  assert.equal(nearestPaint('#f4f1e8', colors)?.name, 'Alabaster');
  assert.equal(nearestPaint('green', colors), null);
  assert.equal(nearestPaint('#2b4a36', []), null);
  assert.equal(namedPaint(' naval ', colors)?.hex, '#2F3D4C');
  assert.equal(namedPaint('Evergreen Mist', colors), null, 'no made-up names');
});

test('an imagined room keeps only the choices the studio prices', async () => {
  const { imagined } = await import('../../apps/api/src/studio.js');
  const tile = imagined(
    {
      walls: false,
      colorName: '',
      hex: '#ffffff',
      sheen: 'satin',
      floor: 'other',
      material: '',
      extras: ['tile floor'],
    },
    [],
  );
  assert.deepEqual(tile, {
    color: null,
    hex: null,
    sheen: null,
    floorStyle: null,
    material: null,
    extras: ['tile floor'],
  });
  const unloaded = imagined(
    {
      walls: true,
      colorName: '',
      hex: '#2B4A36',
      sheen: '',
      floor: 'walnut',
      material: 'hardwood',
      extras: [],
    },
    [],
  );
  assert.deepEqual([unloaded.color, unloaded.hex], [null, '#2b4a36'], 'no paint loaded');
  assert.deepEqual([unloaded.floorStyle, unloaded.material], ['walnut', 'hardwood']);
});

test('a room size by eye is kept only when both sides are plausible', async () => {
  const { roomSizeEstimate } = await import('../../apps/api/src/studio.js');
  assert.deepEqual(roomSizeEstimate(11.2, 14.7), { xFt: 11, yFt: 14.5 });
  assert.equal(roomSizeEstimate(0, 0), null, 'too little of the room to tell');
  assert.equal(roomSizeEstimate(3, 12), null);
  assert.equal(roomSizeEstimate(12, 80), null);
});
