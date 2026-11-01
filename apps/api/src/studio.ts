import { z } from 'zod';
import { DomainError } from '@renovagent/contracts';
import {
  imageMediaType,
  museEditImage,
  museJson,
  samSegmentText,
} from '../../../scripts/muse-provider.js';
import { fitImage, normalizeImage, sha256Of, type DesignImageStore } from './design-images.js';
import { parseSegmentation, type PhotoSegmentation } from './segmentation.js';

// The paint-and-floor studio for an owner's own photos. Photos are kept in
// the owner-scoped image store by hash; SAM 3.1 outlines the walls, Muse
// Image lays one of a fixed set of floors (the server owns the prompts), and
// Muse Spark reads which room each photo shows and what a floor plan says.
// Every model call counts against the caller's per-owner limits.

export const STUDIO_FLOORS = {
  lvp: 'light natural oak wood-look luxury vinyl plank flooring',
  hardwood: 'wide-plank white oak engineered hardwood flooring with a matte finish',
} as const;
export type StudioFloor = keyof typeof STUDIO_FLOORS;
export const floorPrompt = (floor: StudioFloor) =>
  `Edit this photo of a room. Replace only the floor covering of this room with ${STUDIO_FLOORS[floor]}, laid straight, meeting the existing baseboards. Remove the existing room carpet or floor covering only. Keep everything else exactly as it is: the same camera, framing and perspective, walls and wall color, ceiling, windows, doors, closets, radiators, stairs, furniture and lighting. Photorealistic.`;

const ROOM_KINDS = [
  'living room',
  'dining room',
  'kitchen',
  'bedroom',
  'bathroom',
  'hallway',
  'basement',
  'office',
  'exterior',
  'other',
] as const;
const FLOORS = ['carpet', 'vinyl plank', 'hardwood', 'tile', 'concrete', 'other'] as const;

export const readSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['photos', 'plans'],
  properties: {
    photos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['index', 'kind', 'title', 'floor'],
        properties: {
          index: { type: 'integer' },
          kind: { type: 'string', enum: [...ROOM_KINDS] },
          title: { type: 'string' },
          floor: { type: 'string', enum: [...FLOORS] },
        },
      },
    },
    plans: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'widthFt', 'lengthFt'],
        properties: {
          name: { type: 'string' },
          widthFt: { type: 'number' },
          lengthFt: { type: 'number' },
        },
      },
    },
  },
} as const;

const readResult = z.object({
  photos: z.array(
    z.object({
      index: z.number().int(),
      kind: z.enum(ROOM_KINDS),
      title: z.string().max(60),
      floor: z.enum(FLOORS),
    }),
  ),
  plans: z.array(z.object({ name: z.string().max(60), widthFt: z.number(), lengthFt: z.number() })),
});
export type StudioRead = z.infer<typeof readResult>;

// Ceiling height by eye: a standard interior door (about 80 in, 6'8") is the
// ruler. Close enough to size paint, never a measurement; shown as an
// estimate and the owner can type the real height over it.
export const ceilingSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['estimateFt', 'basis'],
  properties: {
    estimateFt: { type: 'number' },
    basis: { type: 'string', enum: ['door', 'other cue', 'none'] },
  },
} as const;
export const ceilingPrompt = (photos: number) =>
  `These ${photos} photo(s) show rooms in one home. Estimate the typical ceiling height in feet. Use a standard interior door as the scale: its opening is about 80 inches (6 ft 8 in) tall, so compare the door's height with the wall from floor to ceiling. Round to the nearest half foot. Give basis "door" if you used a door, "other cue" if you used something else of known size, and "none" if nothing in the photos gives a scale.`;
export type CeilingEstimate = { ft: number; basis: 'door' | 'other cue' | 'none' };
const ceilingResult = z.object({
  estimateFt: z.number(),
  basis: z.enum(['door', 'other cue', 'none']),
});
// Without a usable cue, the owner's rule of thumb: about 8 ft.
export function ceilingFrom(raw: unknown): CeilingEstimate {
  const parsed = ceilingResult.safeParse(raw);
  if (!parsed.success || parsed.data.basis === 'none') return { ft: 8, basis: 'none' };
  const ft = Math.round(parsed.data.estimateFt * 2) / 2;
  return ft >= 7 && ft <= 14 ? { ft, basis: parsed.data.basis } : { ft: 8, basis: 'none' };
}
export const ceilingNote = (c: CeilingEstimate) =>
  c.basis === 'door'
    ? 'Ceiling estimated from the door height in the photos'
    : c.basis === 'other cue'
      ? 'Ceiling estimated from the photos'
      : 'Ceiling assumed at about 8 ft; nothing in the photos gives a scale';

export const readPrompt = (photos: number, plans: number) =>
  `You are helping a homeowner plan paint and flooring. The first ${photos} image(s) are photos of rooms, numbered 0 to ${photos - 1} in order.${plans ? ` The last ${plans} image(s) are floor plans.` : ''}
For each room photo, give its index, the kind of room, a short title a homeowner would use (for example "Living room", "Front bedroom", "Kitchen"), and what the floor is now covered with. If two photos show the same kind of room, make the titles distinct.
${plans ? 'From the floor plans, list every room whose dimensions are printed on the plan, with its printed name, and its two dimensions converted to decimal feet (13\' 1" is 13.083) as widthFt (the first printed number) and lengthFt (the second). Only use numbers printed on the plan; never estimate one.' : 'There are no floor plans; return an empty plans list.'}`;

const sha = z.string().regex(/^[a-f0-9]{64}$/);
const requests = {
  photo: z
    .object({
      data: z
        .string()
        .min(1)
        .max(30 * 1024 * 1024)
        .regex(/^[A-Za-z0-9+/]*={0,2}$/),
      name: z.string().max(200).default('photo'),
    })
    .strict(),
  walls: z.object({ sha256: sha }).strict(),
  floor: z.object({ sha256: sha, floor: z.enum(['lvp', 'hardwood']) }).strict(),
  read: z
    .object({ photos: z.array(sha).min(1).max(12), plans: z.array(sha).max(2).default([]) })
    .strict(),
};

export type StudioProviders = {
  segment: typeof samSegmentText;
  repaint: typeof museEditImage;
  read: typeof museJson;
};
export const studioProviders: StudioProviders = {
  segment: samSegmentText,
  repaint: museEditImage,
  read: museJson,
};

export function studioRoutes(deps: {
  images: DesignImageStore;
  providers: StudioProviders;
  // Throw when the owner is over the limit for that kind of model call.
  spend: (ownerId: string, kind: 'segment' | 'repaint' | 'read') => void;
}) {
  const wallCache = new Map<string, PhotoSegmentation & { model: string; runId: string }>();
  const stored = async (ownerId: string, sha256: string) => {
    const found = await deps.images.get(ownerId, sha256);
    if (!found) throw new DomainError('NOT_FOUND', 'Photo not found in this workspace');
    return found;
  };
  return async (path: string, ownerId: string, raw: unknown): Promise<unknown> => {
    if (path === '/studio/photo') {
      const input = requests.photo.parse(raw);
      const original = new Uint8Array(Buffer.from(input.data, 'base64'));
      const image = await normalizeImage(original);
      return deps.images.put(ownerId, image, {
        label: 'studio photo',
        originalName: input.name,
        originalSha256: sha256Of(original),
        permission: 'uploaded by the owner',
      });
    }
    if (path === '/studio/walls') {
      const { sha256 } = requests.walls.parse(raw);
      const key = `${ownerId}\n${sha256}`;
      let result = wallCache.get(key);
      if (!result) {
        const { bytes } = await stored(ownerId, sha256);
        deps.spend(ownerId, 'segment');
        const sam = await deps.providers.segment({
          image: { bytes, mediaType: imageMediaType(bytes) },
          phrase: 'wall',
        });
        result = {
          ...(await parseSegmentation('wall', sam.text)),
          model: sam.model,
          runId: sam.runId,
        };
        wallCache.set(key, result);
        if (wallCache.size > 400) wallCache.delete(wallCache.keys().next().value!);
      }
      return result;
    }
    if (path === '/studio/floor') {
      const { sha256, floor } = requests.floor.parse(raw);
      const { bytes, record } = await stored(ownerId, sha256);
      deps.spend(ownerId, 'repaint');
      const edit = await deps.providers.repaint({
        image: { bytes, mediaType: imageMediaType(bytes) },
        prompt: floorPrompt(floor),
      });
      const fitted = await fitImage(edit.bytes, record.width, record.height);
      const image = await deps.images.put(ownerId, fitted);
      return { ...image, model: edit.model, floor, sourceSha256: sha256 };
    }
    if (path === '/studio/read') {
      const input = requests.read.parse(raw);
      const all = [...input.photos, ...input.plans];
      const images = await Promise.all(
        all.map(async (s) => {
          const { bytes } = await stored(ownerId, s);
          return { bytes, mediaType: imageMediaType(bytes) };
        }),
      );
      deps.spend(ownerId, 'read');
      const n = input.photos.length;
      const [result, ceiling] = await Promise.all([
        deps.providers.read({
          schema: readSchema,
          images,
          prompt: readPrompt(n, input.plans.length),
        }),
        deps.providers
          .read({ schema: ceilingSchema, images: images.slice(0, n), prompt: ceilingPrompt(n) })
          .then((r) => ceilingFrom(r.result))
          .catch(() => ceilingFrom(null)),
      ]);
      const parsed = readResult.parse(result.result);
      return {
        photos: parsed.photos
          .filter((p) => p.index >= 0 && p.index < n)
          .map((p) => ({ ...p, sha256: input.photos[p.index]! })),
        plans: parsed.plans.filter(
          (p) => p.widthFt > 0 && p.widthFt < 100 && p.lengthFt > 0 && p.lengthFt < 100,
        ),
        ceiling: { ...ceiling, note: ceilingNote(ceiling) },
        model: result.model,
        runId: result.runId,
      };
    }
    return undefined;
  };
}
