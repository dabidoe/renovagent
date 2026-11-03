import type { StudioItem, StudioPlacement } from '@renovagent/contracts';
import {
  studioAsset,
  studioPlacementStart,
  studioRoomBounds,
} from '@renovagent/core';
import { roomModel, type HouseProject } from './paint-floor.js';

// Staged starters for the Hutchinson example, arranged to echo the living-room
// listing photo (two sofas, dining table, four chairs). Positions are
// fractions of the room bounds, deliberately arranged, not measured.
const LIVING_PIECES: {
  asset: 'sofa' | 'dining-table' | 'dining-chair';
  name: string;
  at: [number, number, number][];
}[] = [
  {
    asset: 'sofa',
    name: 'Lounge sofa',
    at: [
      [0.865, 0.312, 90],
      [0.489, 0.092, 0],
    ],
  },
  { asset: 'dining-table', name: 'Round dining table', at: [[0.476, 0.765, 0]] },
  {
    asset: 'dining-chair',
    name: 'Dining chair',
    at: [
      [0.476, 0.637, 180],
      [0.476, 0.892, 0],
      [0.251, 0.765, -90],
      [0.702, 0.765, 90],
    ],
  },
];

export function hutchinsonStagedFurnishings(project: HouseProject): {
  items: Record<string, StudioItem[]>;
  placements: Record<string, StudioPlacement[]>;
} {
  const room = project.rooms.find((r) => r.id === 'living');
  const model = room ? roomModel(room, project.ceilingFt) : null;
  if (!room || !model) return { items: {}, placements: {} };
  const b = studioRoomBounds(model),
    w = b.maxX - b.minX,
    d = b.maxZ - b.minZ;
  const items: StudioItem[] = LIVING_PIECES.map((p) => ({
    id: `hutchinson:living:${p.asset}`,
    name: p.name,
    category: studioAsset(p.asset).category,
    action: 'keep',
    quantity: p.at.length,
    unitAllowanceMinor: null,
  }));
  const placements: StudioPlacement[] = LIVING_PIECES.flatMap((p) =>
    p.at.map(([fx, fz, rotationDeg], i) => ({
      ...studioPlacementStart(p.asset, model),
      id: `hutchinson:living:${p.asset}:${i}`,
      itemId: `hutchinson:living:${p.asset}`,
      assetId: p.asset,
      xM: Math.round((b.minX + w * fx) * 100) / 100,
      zM: Math.round((b.minZ + d * fz) * 100) / 100,
      rotationDeg,
    })),
  );
  return { items: { living: items }, placements: { living: placements } };
}
