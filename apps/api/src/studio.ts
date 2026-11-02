import { z } from 'zod';
import {
  DomainError,
  studioAssetIds,
  studioIdeasSchema,
  studioPlacementSchema,
} from '@renovagent/contracts';
import { readFile } from 'node:fs/promises';
import {
  FLOOR_STYLES,
  floorStyle,
  namedPaint,
  nearestPaint,
  type FloorStyle,
  type PaintColor,
  studioAsset,
} from '@renovagent/core';
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

// A floor style laid in a room photo: the style's swatch goes in as Muse
// Image's second image, so the floor shown is the style chosen, not the
// model's idea of the words. The server owns both the prompt and the swatch.
export const floorPrompt = (style: FloorStyle) =>
  `Edit the first image, a photo of a room. Replace only the floor covering of this room with the flooring shown in the second image, ${style.description}: the same tone, board width and straight lay, in the room's perspective, meeting the existing baseboards. Remove the existing room carpet or floor covering only. Keep everything else exactly as it is: the same camera, framing and perspective, walls and wall color, ceiling, windows, doors, closets, radiators, stairs, furniture and lighting. Photorealistic.`;
const STYLE_IDS = FLOOR_STYLES.map((f) => f.id) as [string, ...string[]];

export const roomIdeasSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['observations', 'directions'],
  properties: {
    observations: { type: 'array', items: { type: 'string' } },
    directions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'description', 'why', 'brief', 'palette', 'assets'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          why: { type: 'string' },
          brief: { type: 'string' },
          palette: { type: 'array', items: { type: 'string' } },
          assets: { type: 'array', items: { type: 'string', enum: [...studioAssetIds] } },
        },
      },
    },
  },
} as const;
export const roomIdeasPrompt = (brief: string, keep: string) =>
  `You are a thoughtful interior designer looking at the owner's actual room photo. Suggest exactly three distinct, achievable design directions in the form "you know what would look good here". Ground each why in visible room features. Observations are tentative visual readings, never measurements. Do not invent unseen furniture, room dimensions, prices, stock, structural feasibility or verified fit. Keep the architecture, openings, stairs and camera. Work with the existing floor unless the owner asks otherwise. Respect these owner instructions: brief=${JSON.stringify(brief)}; keep unchanged=${JSON.stringify(keep)}. Offer different palettes and furniture/decor approaches, not three synonyms. Each direction needs a short title (60 chars max), description (180 max), why (240 max), an actionable editable image-design brief (1000 max) which states what to add/change and preserve, 3–5 hex palette colors, and 1–6 matching library asset IDs from ${studioAssetIds.join(', ')}. IDs unique. Return at most four concise observations. No purchasing or construction approval.`;
const swatches = new Map<string, Promise<Uint8Array>>();
export const floorSwatch = (id: string) => {
  let found = swatches.get(id);
  if (!found) {
    found = readFile(new URL(`../../../public/finishes/${id}.jpg`, import.meta.url)).then(
      (b) => new Uint8Array(b),
    );
    swatches.set(id, found);
  }
  return found;
};
// Lays the style in the photo and fits Muse's answer back to the photo's frame.
export async function layFloor(
  repaint: typeof museEditImage,
  photo: { bytes: Uint8Array; width: number; height: number },
  style: FloorStyle,
) {
  const swatch = await floorSwatch(style.id);
  const edit = await repaint({
    image: { bytes: photo.bytes, mediaType: imageMediaType(photo.bytes) },
    references: [{ bytes: swatch, mediaType: imageMediaType(swatch) }],
    prompt: floorPrompt(style),
  });
  return { ...(await fitImage(edit.bytes, photo.width, photo.height)), model: edit.model };
}

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
        required: ['index', 'kind', 'title', 'floor', 'approxWidthFt', 'approxLengthFt'],
        properties: {
          index: { type: 'integer' },
          kind: { type: 'string', enum: [...ROOM_KINDS] },
          title: { type: 'string' },
          floor: { type: 'string', enum: [...FLOORS] },
          approxWidthFt: { type: 'number' },
          approxLengthFt: { type: 'number' },
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
      approxWidthFt: z.number(),
      approxLengthFt: z.number(),
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

// A room's size by eye: rounded to the half foot, and only when both sides
// are plausible for a room. Shown as an estimate the owner can correct.
export function roomSizeEstimate(widthFt: number, lengthFt: number) {
  const half = (v: number) => Math.round(v * 2) / 2;
  const [x, y] = [half(widthFt), half(lengthFt)];
  return x >= 5 && x <= 40 && y >= 5 && y <= 40 ? { xFt: x, yFt: y } : null;
}

export const readPrompt = (photos: number, plans: number) =>
  `You are helping a homeowner plan paint and flooring. The first ${photos} image(s) are photos of rooms, numbered 0 to ${photos - 1} in order.${plans ? ` The last ${plans} image(s) are floor plans.` : ''}
For each room photo, give its index, the kind of room, a short title a homeowner would use (for example "Living room", "Front bedroom", "Kitchen"), and what the floor is now covered with. If two photos show the same kind of room, make the titles distinct. List each photo once. Also estimate the room's floor size by eye as approxWidthFt and approxLengthFt, using things of known size as the scale (an interior door is about 3 ft wide and 6 ft 8 in tall; a queen bed is 5 ft by 6 ft 8 in; kitchen counters are 2 ft deep); 0 for both if the photo shows too little of the room to tell.
${plans ? 'From the floor plans, list every room whose dimensions are printed on the plan, with its printed name, and its two dimensions converted to decimal feet (13\' 1" is 13.083) as widthFt (the first printed number) and lengthFt (the second). Only use numbers printed on the plan; never estimate one.' : 'There are no floor plans; return an empty plans list.'}`;

// "Imagine your room": the owner's own words become the studio's choices —
// a wall colour snapped to a real loaded paint, one of the fixed floors —
// and whatever else they asked for, kept as ideas that are not priced.
export const imagineSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['walls', 'colorName', 'hex', 'sheen', 'floor', 'material', 'extras'],
  properties: {
    walls: { type: 'boolean' },
    colorName: { type: 'string' },
    hex: { type: 'string' },
    sheen: { type: 'string', enum: ['', 'matte', 'eggshell', 'satin'] },
    floor: { type: 'string', enum: ['keep', 'other', ...FLOOR_STYLES.map((f) => f.id)] },
    material: { type: 'string', enum: ['', 'vinyl', 'hardwood'] },
    extras: { type: 'array', items: { type: 'string' } },
  },
} as const;
export const imaginePrompt = (text: string, room: string, brands: string[]) =>
  `A homeowner describes how they imagine their ${room || 'room'}: ${JSON.stringify(text)}
Turn it into choices. walls: true if they want the walls a new colour. colorName: the paint colour they named; if they only describe a colour, the name of a well-known ${brands.length ? brands.join(' or ') : 'paint brand'} colour that matches it (for example "Naval" for navy); "" if walls is false. hex: the wall colour as #rrggbb, the way a real paint chip of it looks (paint colours are muted; never a pure screen colour such as #000080 for navy); "" if walls is false. sheen: the paint finish only if they name one (matte, eggshell or satin), otherwise "". floor: the wood floor style closest to what they describe, one of ${FLOOR_STYLES.map((f) => `"${f.id}" (${f.description})`).join(', ')}; "keep" if they do not ask for a new floor; "other" for any floor that is not wood-look planks (tile, carpet, concrete). material: "vinyl" if they say vinyl, LVP, laminate or wood-look, "hardwood" if they say real, solid or engineered wood, otherwise "". extras: everything else they ask for, each as a short noun phrase (for example "built-in bookshelf", "tile floor" when floor is "other"); at most four; [] if nothing else.`;
const imagineResult = z.object({
  walls: z.boolean(),
  colorName: z.string().max(60),
  hex: z.string().max(9),
  sheen: z.enum(['', 'matte', 'eggshell', 'satin']),
  floor: z.enum(['keep', 'other', ...STYLE_IDS]),
  material: z.enum(['', 'vinyl', 'hardwood']),
  extras: z.array(z.string().max(80)).max(8),
});
export type Imagined = {
  color: { name: string; code: string; hex: string; brand: string } | null;
  // The described colour when no paint is loaded to snap it to.
  hex: string | null;
  sheen: 'matte' | 'eggshell' | 'satin' | null;
  // A floor style, and its material only when they said which.
  floorStyle: string | null;
  material: 'lvp' | 'hardwood' | null;
  extras: string[];
};
export function imagined(raw: unknown, paint: PaintColor[]): Imagined {
  const r = imagineResult.parse(raw);
  const hex = r.walls && /^#[0-9a-f]{6}$/i.test(r.hex) ? r.hex.toLowerCase() : null;
  const found = r.walls
    ? (namedPaint(r.colorName, paint) ?? (hex ? nearestPaint(hex, paint) : null))
    : null;
  const extras = r.extras
    .map((e) => e.trim())
    .filter(Boolean)
    .slice(0, 4);
  return {
    color: found
      ? {
          name: found.name,
          code: found.code ?? '',
          hex: found.hex.toLowerCase(),
          brand: found.brand,
        }
      : null,
    hex: found ? null : hex,
    sheen: r.walls && r.sheen ? r.sheen : null,
    floorStyle: r.floor === 'keep' || r.floor === 'other' ? null : r.floor,
    material: r.material === 'vinyl' ? 'lvp' : r.material === 'hardwood' ? 'hardwood' : null,
    extras,
  };
}

// An inspiration photo: Muse Spark names the finishes and furnishings that
// make its look, and SAM 3.1 outlines each one. The colour of each is read
// from those outlines in the browser; nothing here is a product or a price.
const INSPO_KINDS = [
  'walls',
  'floor',
  'bedding',
  'textile',
  'furniture',
  'lighting',
  'decor',
] as const;
export const inspoSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['phrase', 'name', 'kind'],
        properties: {
          phrase: { type: 'string' },
          name: { type: 'string' },
          kind: { type: 'string', enum: [...INSPO_KINDS] },
        },
      },
    },
  },
} as const;
export const inspoPrompt = `This is an inspiration photo of a room someone likes. List the finishes and furnishings that most define its look, at most six, the largest first, and include the walls whenever they show.
For each item: phrase: one or two plain words naming the object as it appears, for an image segmenter (for example "wall", "bed", "rug", "curtains", "pillow", "ottoman", "chandelier", "sofa"); never a colour or material in the phrase. name: a short shopping description of that item, its colour, material and style, at most eight words (for example "cream wool rug with thin black stripes", "rust velvet square pillow"). kind: one of ${INSPO_KINDS.join(', ')}.`;
const inspoResult = z.object({
  items: z
    .array(
      z.object({
        phrase: z.string(),
        name: z.string(),
        kind: z.enum(INSPO_KINDS),
      }),
    )
    .max(12),
});
export function inspoItems(raw: unknown) {
  const seen = new Set<string>();
  return inspoResult
    .parse(raw)
    .items.map((i) => ({
      phrase: i.phrase.trim().toLowerCase().slice(0, 30),
      name: i.name.trim().slice(0, 80),
      kind: i.kind,
    }))
    .filter((i) => /^[a-z][a-z -]{1,29}$/.test(i.phrase) && i.name.length >= 2)
    .filter((i) => !seen.has(i.phrase) && seen.add(i.phrase))
    .slice(0, 6);
}
// Item names from someone else's room ("rust velvet ottoman pair") rarely exist in
// the owner's room, and Muse Image then changes nothing. Muse Spark first maps the
// borrowed look onto what the owner's photo actually shows.
export const restyleMapSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['changes'],
  properties: {
    changes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['target', 'becomes'],
        properties: { target: { type: 'string' }, becomes: { type: 'string' } },
      },
    },
  },
} as const;
type Paint = { name: string; code: string; hex: string };
type Styling = {
  mode?: 'refresh' | 'furnish';
  keep?: string;
  preserveFloor?: boolean;
  brief?: string;
  hasReference?: boolean;
};
const stylingRules = ({ mode = 'refresh', keep = '', preserveFloor = false }: Styling) =>
  `${mode === 'furnish' ? 'Furniture and lighting may be replaced, and selected furniture or decor may be added where there is visible space. Keep doors, windows, stairs and circulation clear. Do not change the architecture or camera. Do not claim that sizes, fit or electrical installation have been verified.' : 'Only change surfaces and objects clearly visible in the first photo, and map the borrowed look onto them: bedding, pillows, throws, rugs, curtains, lampshades, upholstery, wall paint. A rug, throw or pillows may be added; never add, remove or move furniture. Skip a borrowed item when the first photo has nothing it can apply to.'}${preserveFloor ? ' Keep the first photo’s flooring unchanged; only selected rugs may overlay it.' : ''}${keep ? ` The owner requires these existing items to remain unchanged and in place: ${JSON.stringify(keep)}. This takes priority over the inspiration selections.` : ''}`;
const paintName = (paint: Paint) =>
  `${JSON.stringify(`${paint.name} ${paint.code}`.trim())} (${paint.hex.toLowerCase()})`;
export const restyleMapPrompt = (items: string[], paint?: Paint, styling: Styling = {}) =>
  `The first photo is someone's own room. ${styling.hasReference === false ? 'There is no reference photo. Design from the owner’s brief and the actual room.' : 'The second photo is a room they like.'} They want these design elements: ${items
    .map((i) => JSON.stringify(i))
    .join(
      ', ',
    )}.${styling.brief ? ` Owner’s design brief: ${JSON.stringify(styling.brief)}.` : ''}${paint ? ` They chose the wall paint ${paintName(paint)}.` : ''}
List the changes to make to the FIRST photo, at most six, the largest first. ${stylingRules(styling)}${paint ? ' Include the walls, becoming the chosen paint.' : ''}
target: the thing or available space as it appears in the first photo, at most six words (for example "plaid duvet", "open floor by left wall", "white walls", "jute rug"). becomes: one specific proposed object or finish per entry, at most twelve words. Give a coffee table and a rug separate entries so the owner can budget each. A protected item not visible in the photo must not be invented or claimed to be verified.`;
const restyleMapResult = z.object({
  changes: z.array(z.object({ target: z.string(), becomes: z.string() })).max(12),
});
export function restyleChanges(raw: unknown) {
  return restyleMapResult
    .parse(raw)
    .changes.map((c) => ({
      target: c.target.trim().slice(0, 60),
      becomes: c.becomes.trim().slice(0, 120),
    }))
    .filter((c) => c.target.length >= 2 && c.becomes.length >= 2)
    .slice(0, 6);
}
// The owner's room keeps its frame and objects; only the mapped finishes change.
export const restylePrompt = (
  changes: { target: string; becomes: string }[],
  paint?: Paint,
  styling: Styling = {},
) =>
  `Edit the first photo. Keep it exactly as framed: the same camera, room shape, windows, doors${styling.mode === 'furnish' ? ' and stairs' : ', furniture, plants and every object in its place'}. ${stylingRules(styling)} Make only these changes, ${styling.hasReference === false ? 'following the owner’s brief' : 'taking colour and texture from the second photo'}: ${changes
    .map((c) => `the ${c.target} becomes ${c.becomes}`)
    .join(
      '; ',
    )}.${paint ? ` Paint the walls ${paintName(paint)}, matte to eggshell.` : ''} Leave everything else exactly as it is. Natural daylight. Photorealistic.`;

const sha = z.string().regex(/^[a-f0-9]{64}$/);
const requests = {
  photo: z
    .object({
      data: z
        .string()
        .min(1)
        .max(30 * 1024 * 1024)
        .regex(/^[A-Za-z0-9+/]*={0,2}$/),
      name: z.string().max(300).default('photo'),
      // A listing example's photo, sent so it can be restyled, is not the owner's.
      origin: z.enum(['owner', 'listing-example']).default('owner'),
    })
    .strict(),
  walls: z.object({ sha256: sha }).strict(),
  floor: z.object({ sha256: sha, style: z.enum(STYLE_IDS) }).strict(),
  imagine: z
    .object({ text: z.string().trim().min(3).max(300), room: z.string().max(60).default('') })
    .strict(),
  read: z
    .object({ photos: z.array(sha).min(1).max(12), plans: z.array(sha).max(2).default([]) })
    .strict(),
  inspo: z.object({ sha256: sha }).strict(),
  ideas: z
    .object({
      sha256: sha,
      brief: z.string().trim().max(1000).default(''),
      keep: z.string().trim().max(300).default(''),
    })
    .strict(),
  modelRender: z
    .object({
      image: z.string().min(1).max(8_000_000),
      wall: z.string().trim().min(1).max(80),
      floor: z.string().trim().min(1).max(80),
      placements: z.array(studioPlacementSchema).max(60),
    })
    .strict(),
  restyle: z
    .object({
      sha256: sha,
      inspo: sha.optional(),
      items: z.array(z.string().trim().min(2).max(240)).max(12).default([]),
      brief: z.string().trim().max(1000).default(''),
      mode: z.enum(['refresh', 'furnish']).default('refresh'),
      keep: z.string().trim().max(300).default(''),
      preserveFloor: z.boolean().default(false),
      paint: z
        .object({
          name: z.string().trim().max(60),
          code: z.string().trim().max(20),
          hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        })
        .strict()
        .optional(),
    })
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
  // The loaded brand paint colours, when the catalog is available.
  paint?: () => Promise<PaintColor[]>;
}) {
  let paintList: Promise<PaintColor[]> | null = null;
  const paint = () => {
    // Kept once loaded; an empty or failed load is retried (seed:paint may run later).
    paintList ??= (deps.paint?.() ?? Promise.resolve([])).then(
      (list) => {
        if (!list.length) paintList = null;
        return list;
      },
      () => {
        paintList = null;
        return [];
      },
    );
    return paintList;
  };
  const wallCache = new Map<string, PhotoSegmentation & { model: string; runId: string }>();
  const inspoCache = new Map<string, unknown>();
  const stored = async (ownerId: string, sha256: string) => {
    const found = await deps.images.get(ownerId, sha256);
    if (!found) throw new DomainError('NOT_FOUND', 'Photo not found in this workspace');
    return found;
  };
  const handle = async (path: string, ownerId: string, raw: unknown): Promise<unknown> => {
    if (path === '/studio/ideas') {
      const input = requests.ideas.parse(raw);
      const photo = await stored(ownerId, input.sha256);
      deps.spend(ownerId, 'read');
      const answer = await deps.providers.read({
        schema: roomIdeasSchema,
        images: [{ bytes: photo.bytes, mediaType: imageMediaType(photo.bytes) }],
        prompt: roomIdeasPrompt(input.brief, input.keep),
      });
      return studioIdeasSchema.parse(answer.result);
    }
    if (path === '/studio/model-render') {
      const input = requests.modelRender.parse(raw);
      const image = await normalizeImage(new Uint8Array(Buffer.from(input.image, 'base64')));
      deps.spend(ownerId, 'repaint');
      const objects = input.placements
        .map((p) => `${studioAsset(p.assetId).name}, color ${p.color}`)
        .join('; ');
      const result = await deps.providers.repaint({
        image: { bytes: image.bytes, mediaType: imageMediaType(image.bytes) },
        prompt: `Turn this 3D layout view into a photorealistic interior concept of the same furnished room. Keep the same camera, room shape, wall positions, ceiling height, openings, and every furniture object's location, orientation, silhouette and relative size. The illustrative furniture in the input is: ${objects || 'none; keep the room empty'}. Walls: ${JSON.stringify(input.wall)}. Floor: ${JSON.stringify(input.floor)}. Improve materials, soft daylight, fabric, wood grain and realistic shadows. Do not add or remove furniture, windows, doors or architectural features. This is an unverified concept layout, not measured furniture or verified products.`,
      });
      const normalized = await normalizeImage(result.bytes);
      const record = await deps.images.put(ownerId, normalized);
      return {
        sha256: record.sha256,
        model: result.model,
        note: 'Generated from your proposed 3D layout. Check dimensions and fit before buying.',
      };
    }
    if (path === '/studio/photo') {
      const input = requests.photo.parse(raw);
      const original = new Uint8Array(Buffer.from(input.data, 'base64'));
      const image = await normalizeImage(original);
      return deps.images.put(
        ownerId,
        image,
        input.origin === 'listing-example'
          ? {
              label: 'listing example photo',
              originalName: input.name,
              originalSha256: sha256Of(original),
              permission: 'public listing photo shown as a Renovagent example',
            }
          : {
              label: 'studio photo',
              originalName: input.name,
              originalSha256: sha256Of(original),
              permission: 'uploaded by the owner',
            },
      );
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
      const { sha256, style } = requests.floor.parse(raw);
      const { bytes, record } = await stored(ownerId, sha256);
      deps.spend(ownerId, 'repaint');
      const laid = await layFloor(
        deps.providers.repaint,
        { bytes, width: record.width, height: record.height },
        floorStyle(style)!,
      );
      const image = await deps.images.put(ownerId, laid);
      return { ...image, model: laid.model, style, sourceSha256: sha256 };
    }
    if (path === '/studio/imagine') {
      const { text, room } = requests.imagine.parse(raw);
      deps.spend(ownerId, 'read');
      const colors = await paint();
      const result = await deps.providers.read({
        schema: imagineSchema,
        prompt: imaginePrompt(text, room, [...new Set(colors.map((c) => c.brand))]),
      });
      return {
        ...imagined(result.result, colors),
        model: result.model,
        runId: result.runId,
      };
    }
    if (path === '/studio/inspo') {
      const { sha256 } = requests.inspo.parse(raw);
      const key = `${ownerId}\n${sha256}`;
      const cached = inspoCache.get(key);
      if (cached) return cached;
      const { bytes, record } = await stored(ownerId, sha256);
      const image = { bytes, mediaType: imageMediaType(bytes) };
      deps.spend(ownerId, 'read');
      const named = await deps.providers.read({
        schema: inspoSchema,
        images: [image],
        prompt: inspoPrompt,
      });
      const items = inspoItems(named.result);
      for (const _ of items) deps.spend(ownerId, 'segment');
      const outlined = await Promise.all(
        items.map(async (item) => {
          const sam = await deps.providers.segment({ image, phrase: item.phrase });
          const seg = await parseSegmentation(item.phrase, sam.text);
          return { ...item, segments: seg.segments, runId: sam.runId };
        }),
      );
      const result = {
        sha256,
        width: record.width,
        height: record.height,
        items: outlined,
        model: named.model,
        runId: named.runId,
      };
      inspoCache.set(key, result);
      if (inspoCache.size > 200) inspoCache.delete(inspoCache.keys().next().value!);
      return result;
    }
    if (path === '/studio/restyle') {
      const input = requests.restyle.parse(raw);
      const room = await stored(ownerId, input.sha256);
      if (!input.inspo && !input.brief && !input.items.length)
        throw new DomainError('VALIDATION', 'Describe the room you want or add inspiration first');
      const inspo = input.inspo ? await stored(ownerId, input.inspo) : null;
      deps.spend(ownerId, 'read');
      deps.spend(ownerId, 'repaint');
      const photos = [
        { bytes: room.bytes, mediaType: imageMediaType(room.bytes) },
        ...(inspo ? [{ bytes: inspo.bytes, mediaType: imageMediaType(inspo.bytes) }] : []),
      ];
      const mapped = await deps.providers.read({
        schema: restyleMapSchema,
        images: photos,
        prompt: restyleMapPrompt(input.items, input.paint, { ...input, hasReference: !!inspo }),
      });
      const changes = restyleChanges(mapped.result);
      if (!changes.length && !input.paint)
        throw new DomainError(
          'VALIDATION',
          'Nothing in this room matches what you chose to borrow. Pick a paint or other items.',
        );
      const edit = await deps.providers.repaint({
        image: photos[0]!,
        references: photos.slice(1),
        prompt: restylePrompt(changes, input.paint, { ...input, hasReference: !!inspo }),
      });
      const fitted = await fitImage(edit.bytes, room.record.width, room.record.height);
      const image = await deps.images.put(ownerId, fitted);
      return {
        ...image,
        model: edit.model,
        changes,
        sourceSha256: input.sha256,
        inspoSha256: input.inspo,
        mode: input.mode,
        keep: input.keep,
      };
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
      if (input.photos.some((_, index) => !parsed.photos.some((p) => p.index === index)))
        throw new DomainError(
          'STORAGE',
          'Muse did not return every room photo. Retry analysis or open the studio without analysis.',
        );
      return {
        photos: parsed.photos
          .filter((p) => p.index >= 0 && p.index < n)
          // Each photo is one room, even if the model lists it twice.
          .filter((p, i, all) => all.findIndex((q) => q.index === p.index) === i)
          .map(({ approxWidthFt, approxLengthFt, ...p }) => ({
            ...p,
            sha256: input.photos[p.index]!,
            approxSize: roomSizeEstimate(approxWidthFt, approxLengthFt),
          })),
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
  return async (path: string, ownerId: string, raw: unknown): Promise<unknown> => {
    try {
      return await handle(path, ownerId, raw);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      const labels: Record<string, string> = {
        '/studio/photo': 'Photo upload',
        '/studio/read': 'Room analysis',
        '/studio/walls': 'Wall outlines',
        '/studio/floor': 'Floor preview',
        '/studio/restyle': 'Room rendering',
        '/studio/model-render': '3D rendering',
        '/studio/imagine': 'Design request',
        '/studio/ideas': 'Room ideas',
        '/studio/inspo': 'Inspiration analysis',
      };
      if (error instanceof z.ZodError) {
        // Validate the request separately: provider output must not be reported as bad user input.
        const schema = Object.entries(requests).find(
          ([name]) => `/studio/${name === 'modelRender' ? 'model-render' : name}` === path,
        )?.[1];
        if (schema && !schema.safeParse(raw).success)
          throw new DomainError(
            'VALIDATION',
            `${labels[path] || 'Studio request'}: check the photo, text and file limits and try again.`,
          );
      }
      const detail = error instanceof Error ? error.message : '';
      const reason = /not configured|401|403/.test(detail)
        ? 'service configuration'
        : /429|limit reached/.test(detail)
          ? 'provider busy'
          : /timed out|TimeoutError/.test(detail)
            ? 'provider timeout'
            : error instanceof z.ZodError
              ? 'unexpected provider result'
              : 'service unavailable';
      // Never log upstream response text: it may contain private image data or credentials.
      console.warn(`[studio] ${path}: ${reason}`);
      throw new DomainError(
        'STORAGE',
        `${labels[path] || 'Studio request'} could not complete (${reason}). Please retry.${path === '/studio/read' ? ' You can also open the studio without analysis and enter measurements yourself.' : ''}`,
      );
    }
  };
}
