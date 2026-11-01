import {
  bomFromRequirements,
  outlineRoomModel,
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
// A room traced on its listing plan image, in that image's pixels. Each
// opening sits on wall `wall` (points[wall] → points[wall + 1]) and spans
// `from`–`to` along that wall's axis. The traced box is scaled to the
// listing's stated dimensions on each axis.
type TracedPlan = {
  image: string;
  points: [number, number][];
  xFt: number;
  yFt: number;
  openings: { wall: number; kind: 'door' | 'window' | 'opening'; from: number; to: number }[];
};
export type HouseRoom = {
  id: string;
  title: string;
  level: 'Ground floor' | 'Upper floor';
  photoId: string;
  lengthFt: number;
  widthFt: number;
  existingFloor: 'carpet' | 'vinyl plank';
  plan: TracedPlan;
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
    plan: {
      image: 'photo-20',
      // The stair block is cut out of the front corner by the kitchen.
      points: [
        [590, 362],
        [799, 362],
        [799, 837],
        [534, 837],
        [534, 605],
        [590, 605],
      ],
      xFt: ft(13, 1),
      yFt: ft(23, 2),
      openings: [
        { wall: 0, kind: 'opening', from: 600, to: 693 },
        { wall: 2, kind: 'window', from: 639, to: 766 },
        { wall: 2, kind: 'door', from: 537, to: 602 },
        { wall: 4, kind: 'opening', from: 538, to: 586 },
      ],
    },
  },
  {
    id: 'kitchen',
    title: 'Kitchen',
    level: 'Ground floor',
    photoId: 'photo-05',
    lengthFt: ft(15, 3),
    widthFt: ft(9, 6),
    existingFloor: 'vinyl plank',
    plan: {
      image: 'photo-20',
      points: [
        [534, 43],
        [724, 43],
        [724, 349],
        [534, 349],
      ],
      xFt: ft(9, 6),
      yFt: ft(15, 3),
      openings: [
        { wall: 0, kind: 'window', from: 576, to: 641 },
        { wall: 0, kind: 'door', from: 669, to: 720 },
        { wall: 1, kind: 'window', from: 155, to: 256 },
        { wall: 2, kind: 'opening', from: 600, to: 693 },
      ],
    },
  },
  {
    id: 'primary',
    title: 'Primary bedroom',
    level: 'Upper floor',
    photoId: 'photo-12',
    lengthFt: ft(11, 4),
    widthFt: ft(10, 3),
    existingFloor: 'carpet',
    plan: {
      image: 'photo-21',
      points: [
        [531, 628],
        [766, 628],
        [766, 839],
        [531, 839],
      ],
      xFt: ft(11, 4),
      yFt: ft(10, 3),
      openings: [
        { wall: 0, kind: 'door', from: 570, to: 624 },
        { wall: 1, kind: 'door', from: 636, to: 729 },
        { wall: 1, kind: 'door', from: 743, to: 832 },
        { wall: 2, kind: 'window', from: 566, to: 625 },
        { wall: 2, kind: 'window', from: 699, to: 758 },
      ],
    },
  },
  {
    id: 'middle',
    title: 'Middle bedroom',
    level: 'Upper floor',
    photoId: 'photo-11',
    lengthFt: ft(12, 7),
    widthFt: ft(8, 1),
    existingFloor: 'carpet',
    plan: {
      image: 'photo-21',
      // A closet takes the corner beside the window wall.
      points: [
        [637, 407],
        [735, 407],
        [735, 362],
        [801, 362],
        [801, 622],
        [637, 622],
      ],
      xFt: ft(8, 1),
      yFt: ft(12, 7),
      openings: [
        { wall: 0, kind: 'door', from: 672, to: 731 },
        { wall: 2, kind: 'window', from: 743, to: 796 },
        { wall: 5, kind: 'door', from: 416, to: 470 },
      ],
    },
  },
  {
    id: 'rear',
    title: 'Rear bedroom',
    level: 'Upper floor',
    photoId: 'photo-08',
    lengthFt: ft(9, 6),
    widthFt: ft(9, 3),
    existingFloor: 'carpet',
    plan: {
      image: 'photo-21',
      points: [
        [531, 40],
        [728, 40],
        [728, 140],
        [685, 140],
        [685, 231],
        [531, 231],
      ],
      xFt: ft(9, 6),
      yFt: ft(9, 3),
      openings: [
        { wall: 0, kind: 'window', from: 605, to: 657 },
        { wall: 3, kind: 'door', from: 167, to: 217 },
        { wall: 4, kind: 'door', from: 535, to: 588 },
      ],
    },
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

// Plans give no door or window heights; these are display heights for the
// 3D view only and never feed a quantity.
const SHOWN = {
  door: { heightM: 2.03, sillM: 0 },
  opening: { heightM: 2.1, sillM: 0 },
  window: { heightM: 1.3, sillM: 0.85 },
};
export function roomModel(room: HouseRoom) {
  const { points, xFt, yFt, openings } = room.plan;
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  const sx = (xFt * 0.3048) / (Math.max(...xs) - x0),
    sy = (yFt * 0.3048) / (Math.max(...ys) - y0);
  return outlineRoomModel({
    points: points.map(([x, y]) => [(x - x0) * sx, (y - y0) * sy]),
    heightM: CEILING_FT * 0.3048,
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
