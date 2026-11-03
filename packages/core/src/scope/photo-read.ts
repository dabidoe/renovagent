import type { ScopeDraft, StudioAssetId } from '@renovagent/contracts';

// What a vision model reported about one of the owner's room photos, and what
// code makes of it: pins for the planned work and suggested changes to the
// plan. The model only observes (probabilities, boxes); thresholds, the
// mapping to work packages and every suggestion are decided here, and a
// suggestion changes nothing until the owner approves it.

export type PhotoBox = { top: number; bottom: number; left: number; right: number };
export type FloorKind = 'carpet' | 'sheet-vinyl' | 'tile' | 'wood' | 'lvp' | 'not-visible';
export type PhotoRead = {
  model: string;
  room: { kind: 'bathroom' | 'kitchen' | 'living' | 'bedroom' | 'other'; confidence: number };
  floor: { kind: FloorKind; confidence: number };
  // Probability each thing is visible / true in the photo.
  seen: {
    toilet: number;
    vanity: number;
    shower: number;
    tub: number;
    fan: number;
    window: number;
    damage: number;
  };
  // 0 (current) to 2 (clearly dated), with the model's confidence.
  vanityDated: { score: number; confidence: number } | null;
  boxes: Partial<
    Record<'toilet' | 'vanity' | 'shower' | 'floor' | 'wall' | 'fan' | 'window', PhotoBox>
  >;
  // Detected furniture by catalog id: visibility probability plus an image box
  // when Jev also placed one. Absent on reads from before furniture detection.
  furniture?: Partial<Record<StudioAssetId, { p: number; box?: PhotoBox }>>;
};

const FLOOR_LABEL: Record<FloorKind, string> = {
  carpet: 'carpet',
  'sheet-vinyl': 'sheet vinyl',
  tile: 'tile',
  wood: 'wood',
  lvp: 'vinyl or laminate plank',
  'not-visible': 'not visible',
};
const pct = (p: number) => `${Math.round(p * 100)}%`;
const SEEN = 0.6;
const ABSENT = 0.2;

// Which box a planned package is pinned to.
const PIN_TARGET: Record<string, keyof PhotoRead['boxes']> = {
  toilet: 'toilet',
  vanity: 'vanity',
  'floor-tile': 'floor',
  'lvp-floor': 'floor',
  'hardwood-floor': 'floor',
  'carpet-removal': 'floor',
  paint: 'wall',
  'wall-paint': 'wall',
  'exhaust-fan': 'fan',
};

export type PhotoPin = {
  packageId: string;
  title: string;
  x: number;
  y: number;
  box: PhotoBox;
};

export function photoPins(read: PhotoRead, draft: ScopeDraft | null): PhotoPin[] {
  if (!draft) return [];
  const pins: PhotoPin[] = [];
  for (const p of draft.packages.filter((x) => x.included)) {
    const target = PIN_TARGET[p.id];
    const box = target ? read.boxes[target] : undefined;
    if (!box) continue;
    // Several packages on one surface (carpet out, new floor) fan out sideways.
    const same = pins.filter((q) => q.box === box).length;
    pins.push({
      packageId: p.id,
      title: p.title,
      x: Math.min(0.95, (box.left + box.right) / 2 + same * 0.08),
      y: (box.top + box.bottom) / 2,
      box,
    });
  }
  return pins;
}

export type PhotoNote = {
  id: string;
  kind: 'observation' | 'suggest-add' | 'check';
  text: string;
  // A package the owner can add to the plan (after approval).
  packageId?: string;
};

export type FurnitureSpotting = {
  assetId: StudioAssetId;
  p: number;
  box?: PhotoBox;
};

// Suggestions only: furniture at or above the SEEN threshold. Nothing here
// places anything — the owner confirms each piece in the Furniture tab.
export function photoFurnitureSpotted(read: PhotoRead): FurnitureSpotting[] {
  const found = read.furniture ?? {};
  return (Object.entries(found) as [StudioAssetId, { p: number; box?: PhotoBox }][]).flatMap(
    ([assetId, spot]) =>
      spot && spot.p >= SEEN ? [{ assetId, p: spot.p, ...(spot.box ? { box: spot.box } : {}) }] : [],
  );
}

export type RoomBoundsXZ = { minX: number; maxX: number; minZ: number; maxZ: number };

// Rough position from the image box: horizontal center picks the left/center/
// right third of the width; the box bottom (lower in the photo is nearer the
// camera, which views from the +Z side) picks the far/mid/near third of depth.
// Approximate by design — the owner drags to adjust.
export function furnitureRoughPosition(
  box: PhotoBox | undefined,
  bounds: RoomBoundsXZ,
): { xM: number; zM: number } | null {
  if (!box) return null;
  const third = (v: number) => (v < 1 / 3 ? 0 : v < 2 / 3 ? 1 : 2);
  const cx = third((box.left + box.right) / 2);
  const depth = third(box.bottom);
  return {
    xM: bounds.minX + ((bounds.maxX - bounds.minX) * (cx * 2 + 1)) / 6,
    zM: bounds.minZ + ((bounds.maxZ - bounds.minZ) * (depth * 2 + 1)) / 6,
  };
}

export function photoNotes(read: PhotoRead, draft: ScopeDraft | null): PhotoNote[] {
  const notes: PhotoNote[] = [];
  const included = new Set(draft?.packages.filter((p) => p.included).map((p) => p.id));
  const offered = new Set(draft?.packages.map((p) => p.id));
  const bath = read.room.kind === 'bathroom';
  const newFloor = ['lvp-floor', 'hardwood-floor', 'floor-tile'].some((id) => included.has(id));

  if (read.floor.kind !== 'not-visible')
    notes.push({
      id: 'floor',
      kind: 'observation',
      text: `Existing floor looks like ${FLOOR_LABEL[read.floor.kind]} (${pct(read.floor.confidence)} confident). Confirm before ordering.`,
    });
  if (
    newFloor &&
    read.floor.kind === 'carpet' &&
    read.floor.confidence >= SEEN &&
    !included.has('carpet-removal')
  )
    notes.push({
      id: 'carpet-out',
      kind: offered.has('carpet-removal') ? 'suggest-add' : 'check',
      text: 'Carpet is visible under a planned new floor; it has to come up first.',
      ...(offered.has('carpet-removal') ? { packageId: 'carpet-removal' } : {}),
    });
  if (
    newFloor &&
    ['tile', 'sheet-vinyl'].includes(read.floor.kind) &&
    read.floor.confidence >= SEEN
  )
    notes.push({
      id: 'old-floor',
      kind: 'check',
      text: `The existing ${FLOOR_LABEL[read.floor.kind]} may need removing or a flat underlayment before the new floor; the plan does not price that yet.`,
    });
  if (bath && read.seen.fan < ABSENT)
    notes.push({
      id: 'no-fan',
      kind: offered.has('exhaust-fan') && !included.has('exhaust-fan') ? 'suggest-add' : 'check',
      text: `No exhaust fan visible (${pct(read.seen.fan)}). Bathrooms need a fan unless a window ventilates them; local code sets the rate.`,
      ...(offered.has('exhaust-fan') && !included.has('exhaust-fan')
        ? { packageId: 'exhaust-fan' }
        : {}),
    });
  if (
    bath &&
    read.seen.vanity >= SEEN &&
    read.vanityDated &&
    read.vanityDated.score >= 1.5 &&
    offered.has('vanity') &&
    !included.has('vanity')
  )
    notes.push({
      id: 'dated-vanity',
      kind: 'suggest-add',
      packageId: 'vanity',
      text: 'The vanity looks clearly dated; replacing it is often the biggest visual change for the money.',
    });
  if (read.seen.damage >= SEEN)
    notes.push({
      id: 'damage',
      kind: 'check',
      text: `Possible water stains, peeling or mold (${pct(read.seen.damage)}). Have it checked before new finishes go on.`,
    });
  if (bath && read.seen.toilet >= SEEN && read.seen.vanity >= SEEN)
    notes.push({
      id: 'layout',
      kind: 'observation',
      text: 'Toilet and vanity are both visible; replacing them in the same spots keeps plumbing work (and permits) minimal.',
    });
  return notes;
}
