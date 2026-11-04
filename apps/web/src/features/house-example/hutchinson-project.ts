import { EXAMPLE_ADDRESS } from './example-privacy.js';
import type { HouseProject, RoomPick, StudioRoom, TracedPlan } from './paint-floor.js';
import { PRESET_COLORS } from './paint-floor.js';
import {
  studioDesignSchema,
  type StudioAssetId,
  type StudioItem,
  type StudioPlacement,
} from '@renovagent/contracts';
import { studioAsset } from '@renovagent/core';

// Philadelphia rowhouse, shown under a privacy alias, from its public
// listing. Five rooms, each with a hero listing photo, its SAM 3.1 wall
// masks and Muse Image floor variants (scripts/hutchinson-rooms.ts), and its
// outline traced from the listing floor plans (CubiCasa, "deemed highly
// reliable but not guaranteed"). Ceiling height is the owner's report.

const asset = (name: string) => `./examples/hutchinson/${name}`;
const ft = (feet: number, inches = 0) => Math.round((feet + inches / 12) * 1000) / 1000;
type ListingRoom = Omit<StudioRoom, 'photo' | 'floors'> & {
  photoId: string;
  size: { xFt: number; yFt: number };
  plan: TracedPlan;
};

const ROOMS: ListingRoom[] = [
  {
    id: 'living',
    title: 'Living & dining',
    photoId: 'photo-04',
    existingFloor: 'carpet',
    size: { xFt: ft(13, 1), yFt: ft(23, 2) },
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
    photoId: 'photo-05',
    existingFloor: 'vinyl plank',
    size: { xFt: ft(9, 6), yFt: ft(15, 3) },
    plan: {
      image: 'photo-20',
      points: [
        [534, 43],
        [724, 43],
        [724, 349],
        [534, 349],
      ],
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
    photoId: 'photo-12',
    existingFloor: 'carpet',
    size: { xFt: ft(11, 4), yFt: ft(10, 3) },
    plan: {
      image: 'photo-21',
      points: [
        [531, 628],
        [766, 628],
        [766, 839],
        [531, 839],
      ],
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
    photoId: 'photo-11',
    existingFloor: 'carpet',
    size: { xFt: ft(8, 1), yFt: ft(12, 7) },
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
    photoId: 'photo-08',
    existingFloor: 'carpet',
    size: { xFt: ft(9, 6), yFt: ft(9, 3) },
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
      openings: [
        { wall: 0, kind: 'window', from: 605, to: 657 },
        { wall: 3, kind: 'door', from: 167, to: 217 },
        { wall: 4, kind: 'door', from: 535, to: 588 },
      ],
    },
  },
];

const image = (name: string) => ({
  src: asset(`${name}.jpg`),
  walls: asset(`rooms/${name}-walls.json`),
});
const variant = (name: string) => ({
  src: asset(`rooms/${name}.jpg`),
  walls: asset(`rooms/${name}-walls.json`),
});

const starting: Record<string, RoomPick> = {
  living: { color: PRESET_COLORS[0]!, floor: 'lvp', included: true },
  kitchen: { color: PRESET_COLORS[2]!, floor: 'keep', included: true },
  primary: { color: PRESET_COLORS[2]!, floor: 'hardwood', included: true },
  middle: { color: PRESET_COLORS[3]!, floor: 'lvp', included: true },
  rear: { color: PRESET_COLORS[0]!, floor: 'lvp', included: true },
};

export const HUTCHINSON: HouseProject = {
  id: 'hutchinson',
  address: EXAMPLE_ADDRESS,
  place: 'Philadelphia rowhouse',
  ceilingFt: 9,
  starting,
  rooms: ROOMS.map(({ photoId, ...room }) => ({
    ...room,
    plan: { ...room.plan, image: asset(`${room.plan.image}.jpg`) },
    photo: image(photoId),
    // Light and white oak were made first, as "lvp" and "hardwood"; the
    // other styles by scripts/fill-floor-styles.ts.
    floors: {
      lvp: variant(`${photoId}-lvp`),
      hardwood: variant(`${photoId}-hardwood`),
      ...Object.fromEntries(
        ['honey-oak', 'walnut', 'gray-oak'].map((s) => [s, variant(`${photoId}-${s}`)]),
      ),
    },
  })),
};

// Manually arranged from photo-04 relative to the traced plan: kitchen at z=0,
// front windows at +z, sofa/cabinet along +x. Dimensions are editable library
// approximations, not measured furniture or a reconstruction of the photograph.
const livingFurniture: {
  id: string;
  asset: StudioAssetId;
  name: string;
  positions: [number, number, number][]; // x, z metres; yaw degrees
  size?: [number, number, number]; // width, depth, height
}[] = [
  {
    id: 'sofa',
    asset: 'sofa',
    name: 'Existing sofa · photo approximation',
    positions: [[3.43, 4.25, -90]],
  },
  {
    id: 'loveseat',
    asset: 'sofa',
    name: 'Existing loveseat · photo approximation',
    positions: [[2.85, 6.45, 180]],
    size: [1.7, 0.9, 0.85],
  },
  {
    id: 'table',
    asset: 'dining-table',
    name: 'Existing dining table · library approximation',
    positions: [[2.45, 1.65, 0]],
    size: [1.15, 1.55, 0.75],
  },
  {
    id: 'chairs',
    asset: 'dining-chair',
    name: 'Existing dining chairs · photo approximation',
    positions: [
      [1.57, 1.25, 90],
      [1.57, 2.05, 90],
      [3.33, 1.25, -90],
      [3.33, 2.05, -90],
    ],
  },
  {
    id: 'cabinet',
    asset: 'bookcase',
    name: 'Existing china cabinet · bookcase stand-in',
    positions: [[3.72, 0.62, -90]],
    size: [1.05, 0.4, 1.9],
  },
  {
    id: 'lamp',
    asset: 'floor-lamp',
    name: 'Existing floor lamp · photo approximation',
    positions: [[3.72, 5.65, 0]],
  },
];
const livingItems: StudioItem[] = livingFurniture.map((piece) => ({
  id: `hutchinson:existing:${piece.id}`,
  name: piece.name,
  category: studioAsset(piece.asset).category,
  action: 'keep',
  quantity: piece.positions.length,
  unitAllowanceMinor: null,
}));
const livingPlacements: StudioPlacement[] = livingFurniture.flatMap((piece) => {
  const asset = studioAsset(piece.asset);
  const [widthM, depthM, heightM] = piece.size ?? asset.size;
  return piece.positions.map(([xM, zM, rotationDeg], index) => ({
    id: `hutchinson:existing:${piece.id}:${index}`,
    itemId: `hutchinson:existing:${piece.id}`,
    assetId: piece.asset,
    xM,
    zM,
    rotationDeg,
    widthM,
    depthM,
    heightM,
    color: asset.color,
  }));
});

export const HUTCHINSON_DESIGN = studioDesignSchema.parse({
  kind: 'studio-design',
  basis: 'listing-example',
  project: HUTCHINSON,
  picks: starting,
  tier: 'mid',
  inspired: {},
  renderSignatures: {},
  styling: {},
  items: { living: livingItems },
  placements: { living: livingPlacements },
});
