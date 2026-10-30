import type { PurchasePlanPayload, ScopeDraft, ScopeRequirement } from '@renovagent/contracts';
import { floorOutline, shoelace } from '../scope/floor-plan.js';
import type { RoomModel } from './room-model.js';

// What each surface of the room model is linked to in the scope. Geometry and
// quantities stay separate: geometry is what the model measures for this
// surface (labelled as such), while quantities come only from the scope draft,
// which reads recorded facts. Requirements are package totals; nothing is
// split per wall. Fixtures are scanned, existing items: a fixture links to a
// package only when that package is in the draft, as work on it, not as a
// claim that it is being replaced by a particular product.

export type SurfaceKind = 'wall' | 'floor' | 'ceiling' | 'fixture';
export type SurfaceLink = {
  requirementId: string;
  purpose: string;
  quantity: number | null;
  unit: string;
  quantityBasis: string;
  status: ScopeRequirement['status'];
  product: {
    name: string;
    retailer: string;
    sku: string;
    lineTotalMinor: number;
    currency: string;
    freshness: string;
  } | null;
};
export type RoomSurface = {
  id: string;
  kind: SurfaceKind;
  label: string;
  geometry: {
    lengthM?: number;
    heightM?: number | null;
    grossAreaM2?: number | null;
    openingsAreaM2?: number;
    areaM2?: number | null;
    widthM?: number;
    depthM?: number;
  };
  links: SurfaceLink[];
  notes: string[];
};

// Work packages by the surface they act on, across recipes.
const PACKAGES: Record<Exclude<SurfaceKind, 'fixture'>, string[]> = {
  wall: ['paint', 'wall-paint'],
  floor: ['floor-tile', 'hardwood-floor', 'lvp-floor', 'carpet-removal'],
  ceiling: ['exhaust-fan'],
};
const FIXTURE_PACKAGES: Record<string, string> = { toilet: 'toilet', sink: 'vanity' };
const round2 = (n: number) => Math.round(n * 100) / 100;

export function roomSurfaces(
  model: RoomModel,
  draft: ScopeDraft | null,
  plan: PurchasePlanPayload | null = null,
): RoomSurface[] {
  const lines = new Map(plan?.lines.map((l) => [l.bomItemId, l]));
  const links = (packageIds: string[]): SurfaceLink[] =>
    (draft?.requirements ?? [])
      .filter((r) => packageIds.includes(r.packageId))
      .map((r) => {
        const line = lines.get(r.id);
        return {
          requirementId: r.id,
          purpose: r.purpose,
          quantity: r.quantity,
          unit: r.unit,
          quantityBasis: r.quantityBasis,
          status: r.status,
          product: line
            ? {
                name: line.productName,
                retailer: line.retailer,
                sku: line.sku,
                lineTotalMinor: line.lineTotalMinor,
                currency: line.currency,
                freshness: line.freshness,
              }
            : null,
        };
      });
  const whole =
    model.spaces.length > 1
      ? [
          `This plan covers ${model.spaces.length} spaces; its geometry is not this room's quantity.`,
        ]
      : [];

  const walls: RoomSurface[] = model.walls.map((w, i) => {
    const openingsAreaM2 = round2(w.openings.reduce((s, o) => s + o.widthM * o.heightM, 0));
    return {
      id: `wall:${w.id}`,
      kind: 'wall',
      label: `Wall ${i + 1}`,
      geometry: {
        lengthM: w.lengthM,
        heightM: w.heightM,
        grossAreaM2: w.heightM === null ? null : round2(w.lengthM * w.heightM),
        openingsAreaM2,
      },
      links: links(PACKAGES.wall),
      notes: [
        ...whole,
        ...(w.heightM === null ? ['Height not established by the plan.'] : []),
        ...(w.openings.length
          ? [`${w.openings.length} opening(s) on this wall; paint quantities stay gross.`]
          : []),
      ],
    };
  });
  const outline = floorOutline(model);
  const floor: RoomSurface = {
    id: 'floor',
    kind: 'floor',
    label: 'Floor',
    geometry: { areaM2: outline ? round2(shoelace(outline).area) : null },
    links: links(PACKAGES.floor),
    notes: [
      ...whole,
      ...(model.format === 'measured-box' ? ['Rectangle from measured length × width.'] : []),
    ],
  };
  const ceiling: RoomSurface = {
    id: 'ceiling',
    kind: 'ceiling',
    label: 'Ceiling',
    geometry: { areaM2: floor.geometry.areaM2 },
    links: links(PACKAGES.ceiling),
    notes: whole,
  };
  const fixtures: RoomSurface[] = model.fixtures.map((f) => {
    const pkg = FIXTURE_PACKAGES[f.category];
    return {
      id: `fixture:${f.id}`,
      kind: 'fixture',
      label: `Existing ${f.category} (scanned)`,
      geometry: { widthM: f.widthM, depthM: f.depthM, heightM: f.heightM },
      links: pkg ? links([pkg]) : [],
      notes: ['Existing item as captured; not a proposed product.'],
    };
  });
  return [...walls, floor, ceiling, ...fixtures];
}
