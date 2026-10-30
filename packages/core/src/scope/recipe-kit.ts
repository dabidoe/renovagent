import type { ScopeInputKey, ScopeRequirement } from '@renovagent/contracts';

// Shared quantity helpers for versioned scope recipes. None of them supplies a
// physical default: a missing input leaves the quantity null and names what
// it waits on.
export type RecipeValues = Partial<Record<ScopeInputKey, number>>;

export type Need = ScopeInputKey[];
export type Quantity = Pick<ScopeRequirement, 'quantity' | 'quantityBasis' | 'blockedBy'>;

export const round = (value: number, places = 1) => Math.round(value * 10 ** places) / 10 ** places;

export function missing(values: RecipeValues, keys: Need): Need {
  return keys.filter((key) => values[key] === undefined);
}

export function count(amount: number, basis: string): Quantity {
  return { quantity: amount, quantityBasis: basis, blockedBy: [] };
}

export function floorArea(v: RecipeValues): Quantity {
  const blocked = missing(v, ['floorLengthFt', 'floorWidthFt']);
  if (blocked.length)
    return {
      quantity: null,
      quantityBasis: 'Floor length × width; dimensions not yet provided.',
      blockedBy: blocked,
    };
  return {
    quantity: round(v.floorLengthFt! * v.floorWidthFt!),
    quantityBasis: `${v.floorLengthFt} ft × ${v.floorWidthFt} ft floor; fixtures and cabinet footprint not deducted.`,
    blockedBy: [],
  };
}

export function perimeter(v: RecipeValues): Quantity {
  const blocked = missing(v, ['floorLengthFt', 'floorWidthFt']);
  if (blocked.length)
    return {
      quantity: null,
      quantityBasis: '2 × (length + width); dimensions not yet provided.',
      blockedBy: blocked,
    };
  return {
    quantity: round(2 * (v.floorLengthFt! + v.floorWidthFt!)),
    quantityBasis: `2 × (${v.floorLengthFt} + ${v.floorWidthFt}) ft; door openings and the vanity run not deducted.`,
    blockedBy: [],
  };
}

export function wallArea(v: RecipeValues): Quantity {
  const blocked = missing(v, ['floorLengthFt', 'floorWidthFt', 'ceilingHeightFt']);
  if (blocked.length)
    return {
      quantity: null,
      quantityBasis: 'Room perimeter × ceiling height; dimensions not yet provided.',
      blockedBy: blocked,
    };
  const gross = 2 * (v.floorLengthFt! + v.floorWidthFt!) * v.ceilingHeightFt!;
  return {
    quantity: round(gross),
    quantityBasis: `Perimeter ${round(2 * (v.floorLengthFt! + v.floorWidthFt!))} ft × ${v.ceilingHeightFt} ft height, gross; doors, windows, tile and the vanity backsplash not deducted.`,
    blockedBy: [],
  };
}

export function req(
  packageId: string,
  id: string,
  fields: Omit<ScopeRequirement, 'id' | 'packageId' | 'status' | 'codeTopics' | keyof Quantity> & {
    codeTopics?: string[];
  },
  quantity: Quantity,
  status?: ScopeRequirement['status'],
): ScopeRequirement {
  const derived: ScopeRequirement['status'] =
    status ??
    (fields.kind === 'conditional'
      ? 'conditional'
      : fields.kind === 'spec-dependent'
        ? 'needs-product-spec'
        : quantity.blockedBy.length || quantity.quantity === null
          ? 'needs-input'
          : 'quantified');
  return {
    id: `${packageId}:${id}`,
    packageId,
    ...fields,
    codeTopics: fields.codeTopics ?? [],
    ...quantity,
    status: derived,
  };
}
