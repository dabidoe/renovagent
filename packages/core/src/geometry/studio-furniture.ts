import type { StudioAssetId, StudioPlacement } from '@renovagent/contracts';
import type { RoomModel } from './room-model.js';
import { floorOutline } from '../scope/floor-plan.js';

export type StudioAsset = {
  id: StudioAssetId;
  name: string;
  file: string;
  category: 'furniture' | 'lighting' | 'decor';
  // Deliberate starting sizes for a concept layout, not measurements of a product.
  size: [number, number, number]; // width, depth, height in metres
  color: string;
};
export const STUDIO_ASSETS: readonly StudioAsset[] = [
  {
    id: 'sofa',
    name: 'Lounge sofa',
    file: 'loungeSofa',
    category: 'furniture',
    size: [2.1, 0.9, 0.85],
    color: '#e0d6c5',
  },
  {
    id: 'chair',
    name: 'Lounge chair',
    file: 'loungeChair',
    category: 'furniture',
    size: [0.8, 0.85, 0.85],
    color: '#b98c67',
  },
  {
    id: 'coffee-table',
    name: 'Coffee table',
    file: 'tableCoffee',
    category: 'furniture',
    size: [1.1, 0.6, 0.42],
    color: '#78513b',
  },
  {
    id: 'rug',
    name: 'Area rug',
    file: 'rugRectangle',
    category: 'decor',
    size: [2.4, 1.8, 0.015],
    color: '#b7aa91',
  },
  {
    id: 'floor-lamp',
    name: 'Floor lamp',
    file: 'lampRoundFloor',
    category: 'lighting',
    size: [0.4, 0.4, 1.65],
    color: '#d8bb7b',
  },
  {
    id: 'plant',
    name: 'Potted plant',
    file: 'pottedPlant',
    category: 'decor',
    size: [0.5, 0.5, 1.1],
    color: '#789475',
  },
  {
    id: 'bed',
    name: 'Double bed',
    file: 'bedDouble',
    category: 'furniture',
    size: [1.55, 2.1, 0.85],
    color: '#d9cdbb',
  },
  {
    id: 'desk',
    name: 'Writing desk',
    file: 'desk',
    category: 'furniture',
    size: [1.2, 0.6, 0.75],
    color: '#b29370',
  },
  {
    id: 'bookcase',
    name: 'Open bookcase',
    file: 'bookcaseOpen',
    category: 'furniture',
    size: [0.9, 0.35, 1.8],
    color: '#a28565',
  },
  {
    id: 'dining-table',
    name: 'Round dining table',
    file: 'tableRound',
    category: 'furniture',
    size: [1.2, 1.2, 0.75],
    color: '#a7825a',
  },
  {
    id: 'dining-chair',
    name: 'Dining chair',
    file: 'chairCushion',
    category: 'furniture',
    size: [0.5, 0.55, 0.85],
    color: '#c3b499',
  },
  {
    id: 'media-console',
    name: 'Media console',
    file: 'cabinetTelevision',
    category: 'furniture',
    size: [1.5, 0.4, 0.5],
    color: '#8a6b4e',
  },
];
export const studioAsset = (id: StudioAssetId) => STUDIO_ASSETS.find((a) => a.id === id)!;

export function studioPlacementStart(assetId: StudioAssetId, model: RoomModel) {
  const b = studioRoomBounds(model),
    a = studioAsset(assetId),
    cx = (b.minX + b.maxX) / 2,
    cz = (b.minZ + b.maxZ) / 2;
  let xM = cx,
    zM = cz,
    rotationDeg = 0;
  if (['sofa', 'bed'].includes(assetId)) zM = b.minZ + a.size[1] / 2 + 0.15;
  if (assetId === 'chair') {
    xM = cx + (b.maxX - b.minX) * 0.27;
    zM = cz + 0.35;
    rotationDeg = -25;
  }
  if (assetId === 'floor-lamp') {
    xM = b.minX + 0.4;
    zM = b.minZ + 0.45;
  }
  if (assetId === 'plant') {
    xM = b.maxX - 0.4;
    zM = b.minZ + 0.5;
  }
  if (['bookcase', 'media-console'].includes(assetId)) {
    xM = b.maxX - a.size[0] / 2 - 0.1;
    zM = b.minZ + a.size[1] / 2 + 0.1;
  }
  if (assetId === 'desk') {
    xM = b.minX + a.size[0] / 2 + 0.1;
    zM = cz;
  }
  return {
    xM: Math.round(xM * 100) / 100,
    zM: Math.round(zM * 100) / 100,
    rotationDeg,
    widthM: a.size[0],
    depthM: a.size[1],
    heightM: a.size[2],
    color: a.color,
  };
}

export function studioRoomBounds(model: RoomModel) {
  const points = model.walls.flatMap((w) => [w.a, w.b]);
  return {
    minX: Math.min(...points.map((p) => p[0])),
    maxX: Math.max(...points.map((p) => p[0])),
    minZ: Math.min(...points.map((p) => p[1])),
    maxZ: Math.max(...points.map((p) => p[1])),
  };
}

export function placementFootprint(p: StudioPlacement): [number, number][] {
  const a = (p.rotationDeg * Math.PI) / 180;
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([x, z]) => [
    p.xM + ((x! * p.widthM) / 2) * Math.cos(a) + ((z! * p.depthM) / 2) * Math.sin(a),
    p.zM - ((x! * p.widthM) / 2) * Math.sin(a) + ((z! * p.depthM) / 2) * Math.cos(a),
  ]);
}
// Geometry-only warnings. No passage, door-swing, product or electrical clearance approval.
export function studioPlacementWarnings(model: RoomModel, placements: StudioPlacement[]) {
  const outline = floorOutline(model) ?? model.walls.map((w) => w.a);
  const inside = ([x, z]: [number, number]) => {
    let yes = false;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const [xi, zi] = outline[i]!,
        [xj, zj] = outline[j]!;
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) yes = !yes;
    }
    return yes;
  };
  return placements
    .filter((p) => placementFootprint(p).some((point) => !inside(point)))
    .map((p) => ({
      id: p.id,
      message: `${studioAsset(p.assetId).name} extends beyond the room outline. Move or resize it.`,
    }));
}
