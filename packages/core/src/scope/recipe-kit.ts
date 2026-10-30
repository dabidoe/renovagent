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

// A floor plan's measured area and perimeter win over length × width, which is
// exact only for rectangles. Either source unblocks the room-size items.
export function floorSizeMissing(v: RecipeValues): Need {
  return v.floorAreaSqFt !== undefined ? [] : missing(v, ['floorLengthFt', 'floorWidthFt']);
}

export function floorArea(v: RecipeValues): Quantity {
  if (v.floorAreaSqFt !== undefined)
    return {
      quantity: round(v.floorAreaSqFt),
      quantityBasis: `${round(v.floorAreaSqFt)} sq ft measured floor area (floor plan); fixtures and cabinet footprint not deducted.`,
      blockedBy: [],
    };
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

function perimeterFt(v: RecipeValues): { feet: number; basis: string } | Need {
  // Unrounded here; callers round only the final quantity.
  if (v.floorPerimeterFt !== undefined)
    return {
      feet: v.floorPerimeterFt,
      basis: `${round(v.floorPerimeterFt)} ft measured perimeter (floor plan)`,
    };
  const blocked = missing(v, ['floorLengthFt', 'floorWidthFt']);
  if (blocked.length) return blocked;
  return {
    feet: 2 * (v.floorLengthFt! + v.floorWidthFt!),
    basis: `2 × (${v.floorLengthFt} + ${v.floorWidthFt}) ft`,
  };
}

export function perimeter(v: RecipeValues): Quantity {
  const p = perimeterFt(v);
  if (Array.isArray(p))
    return {
      quantity: null,
      quantityBasis: '2 × (length + width); dimensions not yet provided.',
      blockedBy: p,
    };
  return {
    quantity: round(p.feet),
    quantityBasis: `${p.basis}; door openings and the vanity run not deducted.`,
    blockedBy: [],
  };
}

export function wallArea(v: RecipeValues): Quantity {
  const p = perimeterFt(v);
  const blocked = [...(Array.isArray(p) ? p : []), ...missing(v, ['ceilingHeightFt'])];
  if (Array.isArray(p) || blocked.length)
    return {
      quantity: null,
      quantityBasis: 'Room perimeter × ceiling height; dimensions not yet provided.',
      blockedBy: blocked,
    };
  return {
    quantity: round(p.feet * v.ceilingHeightFt!),
    quantityBasis: `Perimeter ${round(p.feet)} ft × ${v.ceilingHeightFt} ft height, gross; doors, windows, tile and the vanity backsplash not deducted.`,
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
