import { workspaceRequest } from '../../adapters/http/project-repository.js';
import { ownProject, type PlanRoom, type ReadPhoto } from './own-project.js';
import type { HouseProject, Masks } from './paint-floor.js';

export type PendingOwnAnalysis = { photos: string[]; plans: string[]; error?: string };
export type OwnStudioDraft = {
  project: HouseProject;
  plans: PlanRoom[];
  analysis?: PendingOwnAnalysis;
};
type RoomAnalysis = {
  photos: ReadPhoto[];
  plans: PlanRoom[];
  ceiling: { ft: number | null; note: string };
  walls: Record<string, Masks | null>;
};

// Upload completion is enough to open the room. Unknowns stay unknown until
// analysis succeeds or the owner enters measurements.
export function uploadedOwnStudio(input: {
  id?: string;
  photos: string[];
  plans: string[];
  where: string;
  ceilingFt: number | null;
  idea: string;
}): OwnStudioDraft {
  const listing = /^https?:\/\//i.test(input.where.trim()) ? input.where.trim() : undefined;
  return {
    plans: [],
    analysis: { photos: input.photos, plans: input.plans },
    project: {
      ...ownProject({
        id: input.id ?? `own-${crypto.randomUUID()}`,
        address: listing ? 'Your listing' : input.where.trim() || 'Your project',
        ...(listing ? { listing } : {}),
        ceilingFt: input.ceilingFt,
        photos: input.photos.map((sha256, i) => ({
          sha256,
          kind: 'other',
          title: `Room ${i + 1}`,
          floor: 'other',
        })),
        plans: [],
        walls: {},
      }),
      ...(input.idea.trim().length >= 3 ? { idea: input.idea.trim() } : {}),
    },
  };
}

export async function analyzeUploadedRooms(
  input: PendingOwnAnalysis,
  request: (path: string, body: unknown) => Promise<unknown> = workspaceRequest,
): Promise<RoomAnalysis> {
  const read = (await request('/studio/read', {
    photos: input.photos,
    plans: input.plans,
  })) as Omit<RoomAnalysis, 'walls'>;
  const walls: RoomAnalysis['walls'] = {};
  await Promise.all(
    read.photos.map(async (photo) => {
      walls[photo.sha256] = await request('/studio/walls', { sha256: photo.sha256 })
        .then((result) => result as Masks)
        .catch(() => null);
    }),
  );
  return { ...read, walls };
}

// A late model result fills gaps; it must not undo edits made while it ran.
export function applyOwnAnalysis(current: OwnStudioDraft, read: RoomAnalysis): OwnStudioDraft {
  const incoming = ownProject({
    id: current.project.id,
    address: current.project.address,
    ceilingFt: read.ceiling.ft,
    photos: read.photos,
    plans: read.plans,
    walls: read.walls,
  });
  return {
    plans: read.plans,
    project: {
      ...current.project,
      ...(current.project.ceilingFt === null
        ? {
            ceilingFt: read.ceiling.ft,
            ceilingNote: read.ceiling.note,
          }
        : {}),
      rooms: current.project.rooms.map((room, i) => {
        const found = incoming.rooms.find((candidate) => candidate.id === room.id);
        if (!found) return room;
        return {
          ...room,
          ...(room.title === `Room ${i + 1}` ? { title: found.title } : {}),
          ...(room.existingFloor === 'floor' ? { existingFloor: found.existingFloor } : {}),
          ...(!room.size && found.size ? { size: found.size, sizeNote: found.sizeNote } : {}),
          photo: { ...room.photo, walls: room.photo.walls ?? found.photo.walls },
        };
      }),
    },
  };
}
