import {
  bomFromRequirements,
  boxRoomModel,
  buildTierPlans,
  livingRoomRefreshRecipe,
  outlineRoomModel,
  recipeRequirements,
  type BuiltPlan,
  type PricedOffer,
} from '@renovagent/core';
import { livingRoomCatalog } from '../../../../../fixtures/catalog/living-room-philadelphia.js';

// A paint-and-floor project: rooms, each with a photo, the photo's SAM wall
// masks, Muse Image floor variants as they are made, and the room's size
// when known. A prepared listing example and an owner's own project share
// this shape. Quantities and materials run through the same core recipe and
// tier-plan engine as a real project, priced against the labelled demo
// catalog — never live offers.

export type FloorKey = 'keep' | 'lvp' | 'hardwood';
export type NewFloor = Exclude<FloorKey, 'keep'>;
export type TierKey = 'builder' | 'mid' | 'high';

export type MaskSegment = {
  confidence?: number;
  box: { left: number; top: number };
  path: string;
  scaleX: number;
  scaleY: number;
};
export type Masks = { width: number; height: number; segments: MaskSegment[]; runId?: string };
// An image and its wall masks: a URL to the saved JSON, the masks
// themselves, or null while they are still being made.
export type RoomImage = { src: string; walls: string | Masks | null };

// A room traced on its listing plan image, in that image's pixels. Each
// opening sits on wall `wall` (points[wall] → points[wall + 1]) and spans
// `from`–`to` along that wall's axis. The traced box is scaled to the
// room's stated size on each axis.
export type TracedPlan = {
  image: string;
  points: [number, number][];
  openings: { wall: number; kind: 'door' | 'window' | 'opening'; from: number; to: number }[];
};

export type StudioRoom = {
  id: string;
  title: string;
  existingFloor: string;
  photo: RoomImage;
  floors: Partial<Record<NewFloor, RoomImage>>;
  // Plan width (x) and depth (y) in feet, when known.
  size?: { xFt: number; yFt: number };
  plan?: TracedPlan;
};

export type HouseProject = {
  id: string;
  address: string;
  place?: string;
  listing?: string;
  ceilingFt: number | null;
  // Set when the height is an estimate rather than reported or measured.
  ceilingNote?: string;
  rooms: StudioRoom[];
  starting?: Record<string, RoomPick>;
  // The owner's own description, applied to the first room when it opens.
  idea?: string;
};

export type WallColor = { name: string; code: string; hex: string; brand: string };
// A few starting colours; the full brand palette is in the picker.
export const PRESET_COLORS: WallColor[] = [
  { name: 'Agreeable Gray', code: 'SW 7029', hex: '#d1cbc1', brand: 'Sherwin-Williams' },
  { name: 'Alabaster', code: 'SW 7008', hex: '#edeae0', brand: 'Sherwin-Williams' },
  { name: 'Sea Salt', code: 'SW 6204', hex: '#cdd2ca', brand: 'Sherwin-Williams' },
  { name: 'Evergreen Fog', code: 'SW 9130', hex: '#95978a', brand: 'Sherwin-Williams' },
  { name: 'Urbane Bronze', code: 'SW 7048', hex: '#54504a', brand: 'Sherwin-Williams' },
  { name: 'Naval', code: 'SW 6244', hex: '#2f3d4c', brand: 'Sherwin-Williams' },
];

export const FLOOR_CHOICES: {
  key: FloorKey;
  label: string;
  finish: string;
  packageId: string | null;
}[] = [
  { key: 'keep', label: 'Keep floor', finish: '', packageId: null },
  { key: 'lvp', label: 'Oak vinyl plank', finish: 'oak vinyl plank', packageId: 'lvp-floor' },
  {
    key: 'hardwood',
    label: 'White oak hardwood',
    finish: 'white oak hardwood',
    packageId: 'hardwood-floor',
  },
];
export const TIER_LABELS: Record<TierKey, string> = {
  builder: 'Budget',
  mid: 'Mid-range',
  high: 'Premium',
};

export type RoomPick = {
  color: WallColor | null;
  floor: FloorKey;
  included: boolean;
  // What the owner described that the studio does not price.
  ideas?: string[];
};
export const DEFAULT_PICK: RoomPick = { color: null, floor: 'keep', included: true };

// Plans give no door or window heights; these are display heights for the
// 3D view only and never feed a quantity.
const SHOWN = {
  door: { heightM: 2.03, sillM: 0 },
  opening: { heightM: 2.1, sillM: 0 },
  window: { heightM: 1.3, sillM: 0.85 },
};

// The room in 3D: traced from its plan when there is one, else a box of its
// size. Needs the size and the ceiling height.
export function roomModel(room: StudioRoom, ceilingFt: number | null) {
  if (!room.size || !ceilingFt) return null;
  const heightM = ceilingFt * 0.3048;
  const { xFt, yFt } = room.size;
  if (!room.plan) return boxRoomModel({ lengthM: xFt * 0.3048, widthM: yFt * 0.3048, heightM });
  const { points, openings } = room.plan;
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  const sx = (xFt * 0.3048) / (Math.max(...xs) - x0),
    sy = (yFt * 0.3048) / (Math.max(...ys) - y0);
  return outlineRoomModel({
    points: points.map(([x, y]) => [(x - x0) * sx, (y - y0) * sy]),
    heightM,
    openings: openings.map((o, i) => {
      const a = points[o.wall]!,
        b = points[(o.wall + 1) % points.length]!;
      const horizontal = a[1] === b[1];
      const [start, scale] = horizontal ? [a[0], sx] : [a[1], sy];
      return {
        id: `${o.kind}-${i + 1}`,
        wall: o.wall,
        kind: o.kind,
        alongM: Math.abs((o.from + o.to) / 2 - start) * scale,
        widthM: (o.to - o.from) * scale,
        ...SHOWN[o.kind],
      };
    }),
  });
}

// The finish shown in 3D for the floor choice.
export const floorFinish = (room: StudioRoom, floor: FloorKey) =>
  floor === 'keep'
    ? `existing ${room.existingFloor}`
    : FLOOR_CHOICES.find((f) => f.key === floor)!.finish;

const priced: PricedOffer[] = livingRoomCatalog.offers.flatMap((offer) => {
  const product = livingRoomCatalog.products.find((p) => p.id === offer.productId);
  const observation = livingRoomCatalog.observations.find((o) => o.offerId === offer.id);
  return product && observation ? [{ offer, product, observation }] : [];
});

// Work packages for a pick: paint only when a colour is chosen; a new floor
// takes up carpet first, and goes over other existing floors as the base.
export function roomPackages(room: StudioRoom, pick: RoomPick) {
  const floor = FLOOR_CHOICES.find((f) => f.key === pick.floor)!;
  return [
    ...(pick.color || floor.packageId ? ['removal-protection'] : []),
    ...(pick.color ? ['wall-paint'] : []),
    ...(floor.packageId && room.existingFloor === 'carpet' ? ['carpet-removal'] : []),
    ...(floor.packageId ? [floor.packageId] : []),
  ];
}

export type RoomTakeoff = {
  plan: BuiltPlan | null;
  // Null until the room's size (and, for walls, the ceiling) is known.
  wallSqFt: number | null;
  floorSqFt: number | null;
  totalMinor: number;
};

export function roomTakeoff(
  room: StudioRoom,
  ceilingFt: number | null,
  pick: RoomPick,
  tier: TierKey,
): RoomTakeoff {
  const size = room.size;
  const wallSqFt = size && ceilingFt ? Math.round(2 * (size.xFt + size.yFt) * ceilingFt) : null;
  const floorSqFt = size ? Math.round(size.xFt * size.yFt) : null;
  const packages = roomPackages(room, pick);
  if (!packages.length || !size) return { plan: null, wallSqFt, floorSqFt, totalMinor: 0 };
  const values = {
    floorLengthFt: size.yFt,
    floorWidthFt: size.xFt,
    ...(ceilingFt ? { ceilingHeightFt: ceilingFt } : {}),
  };
  const requirements = recipeRequirements(livingRoomRefreshRecipe.id, packages, values, {
    wallColor: pick.color ? `${pick.color.name} (${pick.color.code})` : 'existing',
    floorFinish: floorFinish(room, pick.floor),
  });
  const { bom } = bomFromRequirements(
    livingRoomRefreshRecipe,
    requirements,
    livingRoomCatalog.products,
  );
  const plan = bom ? (buildTierPlans(bom, priced).find((p) => p.tier === tier) ?? null) : null;
  return {
    plan,
    wallSqFt,
    floorSqFt,
    totalMinor: plan?.lines.reduce((sum, line) => sum + line.lineTotalMinor, 0) ?? 0,
  };
}

export const money = (minor: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(minor / 100);

export const feetInches = (feet: number) => {
  const whole = Math.floor(feet);
  const inches = Math.round((feet - whole) * 12);
  if (inches === 12) return `${whole + 1}′`;
  return inches ? `${whole}′${inches}″` : `${whole}′`;
};
