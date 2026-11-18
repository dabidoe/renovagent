import { z } from 'zod';
import { lineTotalMinor, purchaseUnits } from '../../packages/core/src/commerce/pricing.js';

const coordinate = z.number().finite().min(-500).max(500);
const point = z.object({ x: coordinate, y: coordinate, z: coordinate });
const part = z.object({
  name: z.string().trim().min(1).max(160),
  quantity: z.number().int().min(1).max(10000),
  packQuantity: z.number().int().min(1).max(10000),
  priceMinor: z.number().int().min(0).max(10000000).nullable(),
  source: z.string().trim().max(500),
});
const input = z.object({
  proposed: z.array(point).min(2).max(100),
  pipe: part.omit({ quantity: true, packQuantity: true }).extend({
    stockFeet: z.number().positive().max(1000),
  }),
  parts: z.array(part).max(50),
});

// This is a planning subtotal. A segment may need several sticks. Offcuts
// aren't credited across segments, and couplings remain an explicit part line.
export function takeoff(raw: unknown) {
  const { proposed, pipe, parts } = input.parse(raw);
  const runsFeet = proposed.slice(1).map((next, index) => {
    const start = proposed[index];
    return Math.hypot(next.x - start.x, next.y - start.y, next.z - start.z) / 0.3048;
  });
  if (runsFeet.some((feet) => feet < 0.001)) throw Error('Separate adjacent route points.');
  const lines = [
    {
      ...pipe,
      packs: runsFeet.reduce((count, feet) => count + purchaseUnits(feet, pipe.stockFeet), 0),
    },
    ...parts.map((part) => ({ ...part, packs: purchaseUnits(part.quantity, part.packQuantity) })),
  ].map(({ name, packs, priceMinor, source }) => ({
    name,
    packs,
    source,
    totalMinor: priceMinor !== null && source ? lineTotalMinor(packs, priceMinor) : null,
  }));
  return {
    feet: runsFeet.reduce((sum, feet) => sum + feet, 0),
    lines,
    subtotalMinor: lines.reduce((sum, line) => sum + (line.totalMinor ?? 0), 0),
  };
}

(globalThis as typeof globalThis & { drainTakeoff: (json: string) => string }).drainTakeoff = (
  json,
) => {
  try {
    return JSON.stringify(takeoff(JSON.parse(json)));
  } catch (error) {
    return JSON.stringify({
      error:
        error instanceof z.ZodError
          ? 'Check the route, part quantities, and stock length.'
          : (error as Error).message,
    });
  }
};
