import { DomainError, type FactValue } from '@unpermitted/contracts';
export function canonicalValue(value: FactValue): FactValue {
  if (value.kind !== 'quantity') return value;
  const factors = {
    mm: 1,
    cm: 10,
    m: 1000,
    in: 25.4,
    ft: 304.8,
    mm2: 1,
    m2: 1e6,
    ft2: 92903.04,
    ea: 1,
  };
  const amount = value.amount * factors[value.unit];
  if (!Number.isFinite(amount) || amount > Number.MAX_SAFE_INTEGER)
    throw new DomainError('VALIDATION', 'Quantity exceeds supported precision');
  return {
    ...value,
    amount,
    unit: value.dimension === 'length' ? 'mm' : value.dimension === 'area' ? 'mm2' : 'ea',
  };
}
