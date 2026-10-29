// Delivered-cost arithmetic in minor units. Tax is excluded everywhere and
// must stay labeled as excluded; shipping is an estimate, never a promise.
export function purchaseUnits(quantity: number, packQuantity: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(packQuantity) || packQuantity <= 0)
    throw new Error('Invalid quantity or pack size');
  return Math.max(1, Math.ceil(quantity / packQuantity));
}

export function lineTotalMinor(units: number, unitPriceMinor: number): number {
  return units * unitPriceMinor;
}
