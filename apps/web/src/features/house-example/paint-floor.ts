import {
  bomFromRequirements,
  boxRoomModel,
  buildTierPlans,
  livingRoomRefreshRecipe,
  recipeRequirements,
  type BuiltPlan,
  type PricedOffer,
} from '@renovagent/core';
import { livingRoomCatalog } from '../../../../../fixtures/catalog/living-room-philadelphia.js';

// The Hutchinson paint-and-floor walkthrough: five rooms from the listing's
// own floor plans, each with a hero listing photo. Dimensions are the
// listing plan's (CubiCasa, "deemed highly reliable but not guaranteed");
// the 9 ft ceiling height is the owner's report. Quantities and materials run
// through the same core recipe and tier-plan engine as a real project, priced
// against the labelled demo catalog — never live offers.

export type FloorKey = 'keep' | 'lvp' | 'hardwood';
export type TierKey = 'builder' | 'mid' | 'high';
export type HouseRoom = {
  id: string;
  title: string;
  level: 'Ground floor' | 'Upper floor';
  photoId: string;
  lengthFt: number;
  widthFt: number;
  existingFloor: 'carpet' | 'vinyl plank';
  // Shown with the photo when the listing does not say which room it is.
  photoNote?: string;
};

export const CEILING_FT = 9;
const ft = (feet: number, inches = 0) => Math.round((feet + inches / 12) * 1000) / 1000;

export const HOUSE_ROOMS: HouseRoom[] = [
  {
    id: 'living',
    title: 'Living & dining',
    level: 'Ground floor',
    photoId: 'photo-04',
    lengthFt: ft(23, 2),
    widthFt: ft(13, 1),
    existingFloor: 'carpet',
  },
  {
    id: 'kitchen',
    title: 'Kitchen',
    level: 'Ground floor',
    photoId: 'photo-05',
    lengthFt: ft(15, 3),
    widthFt: ft(9, 6),
    existingFloor: 'vinyl plank',
  },
  {
    id: 'primary',
    title: 'Primary bedroom',
    level: 'Upper floor',
    photoId: 'photo-12',
    lengthFt: ft(11, 4),
    widthFt: ft(10, 3),
    existingFloor: 'carpet',
  },
  {
    id: 'middle',
    title: 'Middle bedroom',
    level: 'Upper floor',
    photoId: 'photo-11',
    lengthFt: ft(12, 7),
    widthFt: ft(8, 1),
    existingFloor: 'carpet',
  },
  {
    id: 'rear',
    title: 'Rear bedroom',
    level: 'Upper floor',
    photoId: 'photo-08',
    lengthFt: ft(9, 6),
    widthFt: ft(9, 3),
    existingFloor: 'carpet',
    photoNote: 'The listing does not name this photo’s room; matched to the rear bedroom.',
  },
];

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

export type RoomPick = { color: WallColor | null; floor: FloorKey; included: boolean };
export const DEFAULT_PICK: RoomPick = { color: null, floor: 'keep', included: true };

export const roomModel = (room: HouseRoom) =>
  boxRoomModel({
    lengthM: room.lengthFt * 0.3048,
    widthM: room.widthFt * 0.3048,
    heightM: CEILING_FT * 0.3048,
  });

// The finish shown in 3D for the floor choice.
export const floorFinish = (room: HouseRoom, floor: FloorKey) =>
  floor === 'keep'
    ? `existing ${room.existingFloor}`
    : FLOOR_CHOICES.find((f) => f.key === floor)!.finish;

const priced: PricedOffer[] = livingRoomCatalog.offers.flatMap((offer) => {
  const product = livingRoomCatalog.products.find((p) => p.id === offer.productId);
  const observation = livingRoomCatalog.observations.find((o) => o.offerId === offer.id);
  return product && observation ? [{ offer, product, observation }] : [];
});

// Work packages for a pick: paint only when a colour is chosen; a new floor
// removes carpet first (the kitchen's existing vinyl stays as the base).
export function roomPackages(room: HouseRoom, pick: RoomPick) {
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
  wallSqFt: number;
  floorSqFt: number;
  totalMinor: number;
};

export function roomTakeoff(room: HouseRoom, pick: RoomPick, tier: TierKey): RoomTakeoff {
  const values = {
    floorLengthFt: room.lengthFt,
    floorWidthFt: room.widthFt,
    ceilingHeightFt: CEILING_FT,
  };
  const wallSqFt = Math.round(2 * (room.lengthFt + room.widthFt) * CEILING_FT);
  const floorSqFt = Math.round(room.lengthFt * room.widthFt);
  const packages = roomPackages(room, pick);
  if (!packages.length) return { plan: null, wallSqFt, floorSqFt, totalMinor: 0 };
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
