import bathroomCatalog from './bathroom-assets.json';
import type { StudioAssetId, StudioItem, StudioPlacement } from '@renovagent/contracts';
import type { RoomModel } from './room-model.js';
import { floorOutline } from '../scope/floor-plan.js';

export type StudioAsset = {
  id: StudioAssetId;
  name: string;
  file: string;
  category: 'furniture' | 'lighting' | 'decor' | 'other';
  url?: string;
  license?: string;
  creator?: string;
  mounting?: string;
  defaultElevationM?: number;
  // Source-mesh bounds for imported fixtures; deliberate concept sizes for legacy furniture.
  // Neither is a measured product specification.
  size: [number, number, number]; // width, depth, height in metres
  color: string;
};
export const STUDIO_ASSETS: readonly StudioAsset[] = [
  ...bathroomCatalog.assets.map((a) => ({
    ...a,
    id: a.id as StudioAssetId,
    category: 'other' as const,
    size: a.size as [number, number, number],
  })),
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

// Deliberate generic starters. These are arrangements to edit, never photo-derived fit.
export const STUDIO_ROOM_PRESETS: readonly {
  id: string;
  name: string;
  assets: readonly StudioAssetId[];
}[] = [
  { id: 'bathroom', name: 'Bathroom', assets: ['toilet', 'vanity', 'shower', 'mirror'] },
  {
    id: 'living-room',
    name: 'Living room',
    assets: ['sofa', 'coffee-table', 'rug', 'floor-lamp', 'plant'],
  },
  {
    id: 'study',
    name: 'Study',
    assets: ['desk', 'dining-chair', 'bookcase', 'floor-lamp', 'plant'],
  },
  { id: 'bedroom', name: 'Bedroom', assets: ['bed', 'rug', 'bookcase', 'floor-lamp', 'plant'] },
];
export function studioPresetStarts(id: string, model: RoomModel) {
  const preset = STUDIO_ROOM_PRESETS.find((entry) => entry.id === id);
  if (!preset) return [];
  const bounds = studioRoomBounds(model);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  return preset.assets.map((assetId) => {
    const start = studioPlacementStart(assetId, model);
    // Give the study chair its own place beside the desk instead of stacking it at centre.
    if (id === 'study' && assetId === 'dining-chair') {
      start.xM = Math.round((bounds.minX + 1.05) * 100) / 100;
      start.zM = Math.round((cz + 0.75) * 100) / 100;
      start.rotationDeg = 180;
    }
    if (id === 'bedroom' && assetId === 'rug') {
      start.xM = cx;
      start.zM = cz + 0.35;
    }
    return { assetId, ...start };
  });
}

// Library suggestions only. A name cannot establish product geometry or photo placement.
export function studioItemAsset(name: string): StudioAssetId | null {
  const text = name.toLowerCase().replace(/[-–]/g, ' ');
  // Avoid treating accessories mentioning furniture as the furniture itself.
  if (
    /\b(pillows?|cushions?|throws?|bedding|duvets?|curtains?|artwork|towels?|soap|brush(?:es)?|faucets?|toilet paper|shower heads?)\b/.test(
      text,
    )
  )
    return null;
  const matches: [StudioAssetId, RegExp][] = [
    ['toilet', /\btoilets?\b/],
    ['vanity', /\b(vanity|vanities)\b(?!\s+mirrors?)/],
    ['shower', /\bshower(?: stalls?| enclosures?)?\b/],
    ['tub', /\b(bathtubs?|tubs?)\b/],
    ['sink', /\b(?:pedestal )?sinks?\b/],
    ['mirror', /\bmirrors?\b/],
    ['sofa', /\b(sofas?|couch|couches|sectionals?|loveseats?)\b/],
    ['chair', /\b(armchairs?|lounge chairs?|accent chairs?|reading chairs?)\b/],
    ['coffee-table', /\bcoffee tables?\b/],
    ['rug', /\brugs?\b/],
    ['floor-lamp', /\b(floor|standing) lamps?\b/],
    ['plant', /\bplants?\b/],
    ['bed', /\b(double|queen|king|single|twin) beds?\b/],
    ['desk', /\bdesks?\b/],
    ['bookcase', /\b(bookcases?|bookshel(f|ves))\b/],
    ['dining-table', /\bdining tables?\b/],
    ['dining-chair', /\bdining chairs?\b/],
    ['media-console', /\b(media consoles?|tv stands?|television cabinets?)\b/],
  ];
  const found = matches.filter(([, pattern]) => pattern.test(text));
  return found.length === 1 ? found[0]![0] : null;
}

export function studioItemModelSuggestions(items: StudioItem[], placements: StudioPlacement[]) {
  return items.flatMap((item) => {
    const assetId = studioItemAsset(item.name);
    const placed = placements.filter((p) => p.itemId === item.id).length;
    const count = Math.max(0, (item.quantity ?? 1) - placed);
    return assetId && count
      ? [
          {
            itemId: item.id,
            name: item.name,
            assetId,
            count,
            quantityUnknown: item.quantity === null,
          },
        ]
      : [];
  });
}

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
  if (a.url) {
    const wall = model.walls.find((w) => w.a[1] === b.minZ && w.b[1] === b.minZ) ?? model.walls[0];
    if (wall) {
      const fraction = assetId === 'toilet' ? 0.18 : assetId === 'shower' ? 0.82 : 0.48;
      return {
        ...studioPlacementAtWall(assetId, model, wall.id, wall.lengthM * fraction),
        widthM: a.size[0],
        depthM: a.size[1],
        heightM: a.size[2],
        color: a.color,
      };
    }
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

// Snap the back anchor to a referenced wall. Offsets and elevations are concept inputs.
// Re-evaluate explicitly after changing room geometry; this does not establish plumbing or fit.
export function studioPlacementAtWall(
  assetId: StudioAssetId,
  model: RoomModel,
  wallId: string,
  alongM?: number,
  placement?: Pick<StudioPlacement, 'depthM' | 'yM'>,
) {
  const wall = model.walls.find((w) => w.id === wallId);
  if (!wall) throw new Error('Unknown room wall');
  const a = studioAsset(assetId),
    b = studioRoomBounds(model);
  const dx = wall.b[0] - wall.a[0],
    dz = wall.b[1] - wall.a[1];
  const length = Math.hypot(dx, dz);
  if (!length) throw new Error('Wall has no length');
  let nx = -dz / length,
    nz = dx / length;
  const mx = (wall.a[0] + wall.b[0]) / 2,
    mz = (wall.a[1] + wall.b[1]) / 2;
  if (nx * ((b.minX + b.maxX) / 2 - mx) + nz * ((b.minZ + b.maxZ) / 2 - mz) < 0) {
    nx *= -1;
    nz *= -1;
  }
  const along = alongM ?? length / 2;
  const offset = (placement?.depthM ?? a.size[1]) / 2 + (wall.thicknessM ?? 0.08) / 2 + 0.01;
  return {
    xM: wall.a[0] + (dx / length) * along + nx * offset,
    zM: wall.a[1] + (dz / length) * along + nz * offset,
    yM: placement?.yM ?? a.defaultElevationM ?? 0,
    wallId,
    rotationDeg: (Math.atan2(nx, nz) * 180) / Math.PI,
  };
}
