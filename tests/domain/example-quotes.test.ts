import test from 'node:test';
import assert from 'node:assert/strict';
import { exampleQuotes } from '@renovagent/core';

const steps = [
  { id: 'carpet-removal', title: 'Carpet removal', estimate: { materialMinor: 0, areaSqFt: 168 } },
  { id: 'wall-paint', title: 'Wall paint', estimate: { materialMinor: 8320, areaSqFt: 416 } },
  { id: 'lvp-floor', title: 'Vinyl plank', estimate: { materialMinor: 55440, areaSqFt: 168 } },
];

test('example quotes itemize materials plus labour from the measured areas', () => {
  const quotes = exampleQuotes(steps);
  const halden = quotes.find((q) => q.contractor.id === 'halden-street')!;
  const floor = halden.lines.find((l) => l.packageId === 'lvp-floor')!;
  // Same 168 sq ft as the DIY estimate; materials carry the contractor's markup.
  assert.deepEqual(
    [floor.areaSqFt, floor.labourMinor, floor.materialsMinor],
    [168, 300 * 168, 55440 * 1.2],
  );
  assert.equal(halden.totalMinor, halden.materialsMinor + halden.labourMinor);
  assert.deepEqual(halden.notQuoted, []);
});

test('a specialist quotes only its trade and says what it leaves out', () => {
  const quotes = exampleQuotes(steps);
  const ferro = quotes.find((q) => q.contractor.id === 'ferro-floor')!;
  assert.deepEqual(
    ferro.lines.map((l) => l.packageId),
    ['carpet-removal', 'lvp-floor'],
  );
  assert.deepEqual(ferro.notQuoted, ['Wall paint']);
  // Full-coverage quotes come first, cheapest first.
  assert.equal(quotes.at(-1), ferro);
  assert.ok(quotes[0]!.totalMinor <= quotes[1]!.totalMinor);
});

test('labour by area waits for a measurement instead of guessing', () => {
  const [q] = exampleQuotes([
    { id: 'lvp-floor', title: 'Vinyl plank', estimate: { materialMinor: 0, areaSqFt: null } },
    { id: 'exhaust-fan', title: 'Exhaust fan', estimate: null },
  ]);
  assert.deepEqual(q!.needsArea, ['Vinyl plank']);
  assert.deepEqual(
    q!.lines.map((l) => l.packageId),
    ['exhaust-fan'],
  );
});
