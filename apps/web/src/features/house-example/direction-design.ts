import { studioDesignSchema, type StudioItem, type StudioPlacement } from '@renovagent/contracts';
import { studioAsset, studioPlacementStart, studioRoomBounds } from '@renovagent/core';
import { PRESET_COLORS, roomModel, type HouseProject, type RoomPick } from './paint-floor.js';
import { studioFinishSignature, studioStylingSignature } from './studio-signatures.js';
import type { StudioDirection } from './studio-directions.js';

// These are deliberately arranged starters, not positions recovered from the photo.
export function directionDesign(source: HouseProject, direction: StudioDirection) {
  const original = source.rooms[0];
  if (source.id !== 'oakland' || original?.photo.src !== './examples/oakland/image-01.jpg')
    throw Error('This direction needs its original Oakland source room.');
  const room = {
    ...original,
    sizeNote: original.sizeNote ?? 'Example dimensions · verify on site',
  };
  const pick: RoomPick = {
    color: PRESET_COLORS.find((c) => c.code === 'SW 7008')!,
    floor: 'lvp',
    floorStyle: 'light-oak',
    included: true,
  };
  const project: HouseProject = {
    id: direction.id,
    ceilingFt: source.ceilingFt,
    ...(source.listing ? { listing: source.listing } : {}),
    address: direction.title,
    rooms: [room],
    place: 'Oakland room · design example',
    ceilingNote: source.ceilingNote ?? 'Example height · verify on site',
    starting: { [room.id]: pick },
  };
  // Do not copy project.idea: the legacy automatic Imagine effect would spend a
  // provider call on opening a prepared, already rendered example.
  delete project.idea;
  const model = roomModel(room, project.ceilingFt);
  const items: StudioItem[] = direction.pieces.map((p) => ({
    id: `${direction.id}:${p.asset}`,
    name: p.name,
    category: studioAsset(p.asset).category,
    action: 'add',
    quantity: p.count,
    unitAllowanceMinor: null,
  }));
  const placements: StudioPlacement[] = [];
  if (model) {
    const b = studioRoomBounds(model),
      w = b.maxX - b.minX,
      d = b.maxZ - b.minZ;
    const positions: Record<string, [number, number, number][]> =
      direction.id === 'studio-lounge'
        ? {
            sofa: [[0.16, 0.52, 90]],
            chair: [[0.74, 0.28, -25]],
            'coffee-table': [[0.53, 0.53, 0]],
            rug: [[0.52, 0.53, 0]],
            'floor-lamp': [[0.88, 0.12, 0]],
            plant: [[0.14, 0.12, 0]],
          }
        : direction.id === 'studio-office'
          ? {
              desk: [[0.5, 0.13, 0]],
              'dining-chair': [[0.5, 0.31, 0]],
              bookcase: [[0.91, 0.56, 90]],
              rug: [[0.48, 0.38, 0]],
              'floor-lamp': [[0.88, 0.12, 0]],
              plant: [[0.14, 0.12, 0]],
            }
          : {
              'dining-table': [[0.5, 0.52, 0]],
              'dining-chair': [
                [0.5, 0.31, 180],
                [0.5, 0.73, 0],
                [0.22, 0.52, -90],
                [0.78, 0.52, 90],
              ],
              'media-console': [[0.5, 0.07, 0]],
              rug: [[0.5, 0.52, 0]],
              plant: [[0.14, 0.12, 0]],
            };
    for (const p of direction.pieces) {
      for (let i = 0; i < p.count; i++) {
        const pos = positions[p.asset]?.[i];
        const start = studioPlacementStart(p.asset, model);
        placements.push({
          ...start,
          id: `${direction.id}:${p.asset}:${i}`,
          itemId: `${direction.id}:${p.asset}`,
          assetId: p.asset,
          ...(pos ? { xM: b.minX + w * pos[0], zM: b.minZ + d * pos[1], rotationDeg: pos[2] } : {}),
          ...(p.asset === 'rug' ? { color: direction.palette[1]!, widthM: 2.4, depthM: 2.5 } : {}),
          ...(p.asset === 'dining-chair' ? { color: direction.palette[1]! } : {}),
        });
      }
    }
  }
  const finishSignature = studioFinishSignature(pick);
  const keep = 'Bay windows, doorway, trim and pendant. Keep access clear.';
  const signature = studioStylingSignature({
    inspo: null,
    borrow: [],
    paint: null,
    mode: 'furnish',
    keep,
    brief: direction.brief,
    finishSignature,
    items,
  });
  const changes = direction.pieces.map((p) => ({
    target: 'available room space',
    becomes: `${p.count} × ${p.name}`,
  }));
  return studioDesignSchema.parse({
    kind: 'studio-design',
    basis: 'listing-example',
    project,
    picks: { [room.id]: pick },
    tier: 'mid',
    inspired: { [room.id]: direction.image },
    renderSignatures: { [room.id]: finishSignature },
    items: { [room.id]: items },
    placements: { [room.id]: placements },
    styling: {
      [room.id]: {
        source: room.photo.src,
        inspo: null,
        colours: [],
        paint: null,
        borrow: [],
        changes,
        mode: 'furnish',
        keep,
        brief: direction.brief,
        resultSignature: signature,
        versions: [
          {
            id: `${direction.id}:prepared`,
            image: direction.image,
            title: direction.title,
            createdAt: '2026-11-02T13:58:16.786Z',
            signature,
            finishSignature,
            changes,
          },
        ],
        selectedVersionId: `${direction.id}:prepared`,
      },
    },
  });
}
