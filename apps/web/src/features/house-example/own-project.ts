import type { HouseProject, Masks, StudioRoom } from './paint-floor.js';

// An owner's own paint-and-floor project, built from their photos and, when
// they have one, a floor plan. Muse Spark names each photo's room and reads
// the plan's printed sizes; this file only matches the two up and keeps the
// project in the browser. Images live in the owner's server image store.

export type ReadPhoto = { sha256: string; kind: string; title: string; floor: string };
export type PlanRoom = { name: string; widthFt: number; lengthFt: number };

export const imageUrl = (sha256: string) => `/api/workspace/design-images/${sha256}`;

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w && w !== 'room' && w !== 'area'),
  );

// Pairs each photo with at most one printed plan room: exact names first,
// then the most shared words, in photo order. Unmatched photos stay sizeless
// until the owner picks a plan room or types a size.
export function matchPlanRooms(photos: ReadPhoto[], plans: PlanRoom[]): (number | null)[] {
  const taken = new Set<number>();
  const result: (number | null)[] = photos.map(() => null);
  const score = (p: ReadPhoto, r: PlanRoom) => {
    const a = words(`${p.title} ${p.kind}`),
      b = words(r.name);
    let shared = 0;
    for (const w of b) if (a.has(w)) shared++;
    return p.title.toLowerCase() === r.name.toLowerCase() ? 100 : shared;
  };
  for (const pass of [100, 1]) {
    photos.forEach((p, i) => {
      if (result[i] !== null) return;
      let best = -1,
        bestScore = 0;
      plans.forEach((r, j) => {
        if (taken.has(j)) return;
        const s = score(p, r);
        if (s >= pass && s > bestScore) {
          best = j;
          bestScore = s;
        }
      });
      if (best >= 0) {
        result[i] = best;
        taken.add(best);
      }
    });
  }
  return result;
}

const FLOOR_NAMES: Record<string, string> = {
  carpet: 'carpet',
  'vinyl plank': 'vinyl plank',
  hardwood: 'hardwood',
  tile: 'tile',
  concrete: 'concrete',
  other: 'floor',
};

export function ownProject(input: {
  id: string;
  address: string;
  listing?: string;
  ceilingFt: number | null;
  photos: ReadPhoto[];
  plans: PlanRoom[];
  walls: Record<string, Masks | null>;
}): HouseProject {
  const matches = matchPlanRooms(input.photos, input.plans);
  const rooms: StudioRoom[] = input.photos.map((p, i) => {
    const plan = matches[i] === null ? undefined : input.plans[matches[i]!];
    return {
      id: p.sha256.slice(0, 12),
      title: p.title || p.kind,
      existingFloor: FLOOR_NAMES[p.floor] ?? 'floor',
      photo: { src: imageUrl(p.sha256), walls: input.walls[p.sha256] ?? null },
      floors: {},
      ...(plan ? { size: { xFt: plan.widthFt, yFt: plan.lengthFt } } : {}),
    };
  });
  return {
    id: input.id,
    address: input.address || 'Your project',
    ...(input.listing ? { listing: input.listing } : {}),
    ceilingFt: input.ceilingFt,
    rooms,
  };
}

// The room's photo hash, from its image URL.
export const photoSha = (room: StudioRoom) => room.photo.src.split('/').pop()!;
