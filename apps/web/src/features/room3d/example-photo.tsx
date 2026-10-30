import { useEffect, useState, type ReactNode } from 'react';
import type { DesignDirection, ScopeDraft } from '@renovagent/contracts';

// The labelled example room, rendered in 3D from one fixed camera for every
// stage of the work and every finish (scripts/blender/example_room.py). Pins
// sit where that camera projects the work, so they line up with each image.

export type WallKey = 'warm-white' | 'sage' | 'soft-blue';
export type FloorKey = 'carpet' | 'lvp' | 'hardwood';
export type Pick = { wall: WallKey; floor: FloorKey };

export const WALL_OPTIONS: { key: WallKey; label: string; hex: string; spec: string }[] = [
  {
    key: 'warm-white',
    label: 'Warm white',
    hex: '#f1ebdd',
    spec: 'interior eggshell paint warm white',
  },
  { key: 'sage', label: 'Sage', hex: '#a9b79c', spec: 'interior eggshell paint sage green' },
  {
    key: 'soft-blue',
    label: 'Soft blue',
    hex: '#a3b8cc',
    spec: 'interior eggshell paint soft blue',
  },
];
export const FLOOR_OPTIONS: {
  key: FloorKey;
  label: string;
  packageId: string | null;
  spec: string;
  shopFor: string | null;
}[] = [
  {
    key: 'carpet',
    label: 'Keep carpet',
    packageId: null,
    spec: 'Existing carpet stays',
    shopFor: null,
  },
  {
    key: 'lvp',
    label: 'Vinyl plank',
    packageId: 'lvp-floor',
    spec: 'Oak-look click-lock vinyl plank, waterproof, 12–20 mil wear layer',
    shopFor: 'oak look waterproof click lock vinyl plank flooring',
  },
  {
    key: 'hardwood',
    label: 'Hardwood',
    packageId: 'hardwood-floor',
    spec: 'Dark-stained engineered hardwood, 5 in plank',
    shopFor: 'dark engineered hardwood flooring 5 in',
  },
];

export const packagesFor = (floor: FloorKey) => [
  'removal-protection',
  'wall-paint',
  ...(floor === 'carpet'
    ? []
    : ['carpet-removal', FLOOR_OPTIONS.find((f) => f.key === floor)!.packageId!]),
];
export const directionFor = (p: Pick): DesignDirection => ({
  wallColor: WALL_OPTIONS.find((w) => w.key === p.wall)!.label.toLowerCase(),
  floorFinish:
    p.floor === 'carpet'
      ? 'existing carpet'
      : FLOOR_OPTIONS.find((f) => f.key === p.floor)!.label.toLowerCase(),
});
// The request a pick records, in the owner's words rather than the old draft's.
export const requestFor = (p: Pick) => {
  const d = directionFor(p);
  return p.floor === 'carpet'
    ? `Repaint this living room ${d.wallColor} and keep the carpet`
    : `Repaint this living room ${d.wallColor} and put ${d.floorFinish} down`;
};
// What the saved draft already says, so the picker starts there.
export function savedPick(draft: ScopeDraft | null): Pick {
  const included = new Set(draft?.packages.filter((p) => p.included).map((p) => p.id));
  const color = draft?.direction?.wallColor.toLowerCase() ?? '';
  return {
    wall: color.includes('sage') ? 'sage' : color.includes('blue') ? 'soft-blue' : 'warm-white',
    floor: included.has('hardwood-floor')
      ? 'hardwood'
      : included.has('lvp-floor')
        ? 'lvp'
        : 'carpet',
  };
}

// The stage each step shows: carpet out, walls painted, then finished.
export function variantFor(stepId: string | null, pick: Pick, after: boolean) {
  if (!after) return 'before';
  if (stepId === 'carpet-removal') return 'carpet-out';
  if (stepId === 'wall-paint')
    return `painted-${pick.wall}-${pick.floor === 'carpet' ? 'carpet' : 'subfloor'}`;
  return `done-${pick.wall}-${pick.floor}`;
}

type Scene = { anchors: Record<string, [number, number]> };
const ANCHOR: Record<string, string> = {
  'wall-paint': 'wall-paint',
  'carpet-removal': 'carpet-removal',
  'lvp-floor': 'floor',
  'hardwood-floor': 'floor',
};
const src = (variant: string) => `./example-room/${variant}.jpg`;

export type PhotoPin = { id: string; number: number; title: string; price: string };
export type MuseRender =
  | { status: 'working' }
  | { status: 'done'; url: string; model: string }
  | { status: 'error'; message: string };

export function ExampleRoomPhoto({
  variant,
  pins,
  activeId,
  onPin,
  muse,
  showMuse,
  onShowMuse,
}: {
  variant: string;
  pins: PhotoPin[];
  activeId: string | null;
  onPin: (id: string) => void;
  muse: MuseRender | null;
  showMuse: boolean;
  onShowMuse: (v: boolean) => void;
}) {
  const [scene, setScene] = useState<Scene | null>(null);
  // The last two images stay stacked so a change crossfades instead of flashing.
  const [layers, setLayers] = useState<string[]>([variant]);
  useEffect(() => {
    let live = true;
    fetch('./example-room/scene.json')
      .then((r) => r.json())
      .then((s: Scene) => live && setScene(s))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  useEffect(
    () => setLayers((now) => (now.at(-1) === variant ? now : [...now.slice(-1), variant])),
    [variant],
  );
  const museShown = showMuse && muse?.status === 'done';
  return (
    <div className="room3d-photo">
      {layers.map((v, i) => (
        <img
          key={v}
          src={src(v)}
          alt={i === layers.length - 1 ? 'Example living room, 3D render' : ''}
          className={i === layers.length - 1 ? 'is-top' : ''}
          draggable={false}
        />
      ))}
      {museShown && (
        <img
          key="muse"
          src={muse.url}
          alt="Example living room, generated by Muse"
          className="is-top"
        />
      )}
      <span className="room3d-photo-label">
        <span className="room3d-tag">Example</span>{' '}
        {museShown ? 'Generated by Muse from the 3D render · concept, not a photo' : '3D render'}
      </span>
      {muse?.status === 'done' && (
        <button type="button" className="room3d-photo-toggle" onClick={() => onShowMuse(!showMuse)}>
          {showMuse ? 'Show 3D render' : 'Show Muse render'}
        </button>
      )}
      {scene &&
        !museShown &&
        pins.map((p) => {
          const at = scene.anchors[ANCHOR[p.id] ?? ''];
          if (!at) return null;
          return (
            <button
              key={p.id}
              type="button"
              className="room3d-photo-pin"
              aria-current={activeId === p.id || undefined}
              style={{ left: `${at[0] * 100}%`, top: `${at[1] * 100}%` }}
              onClick={() => onPin(p.id)}
            >
              <b>{p.number}</b>
              <span>
                {p.title}
                <small>{p.price}</small>
              </span>
            </button>
          );
        })}
    </div>
  );
}

// Walls and floor for the example: each choice changes the image and the price.
export function DesignPicker({
  pick,
  onPick,
  shop,
}: {
  pick: Pick;
  onPick: (p: Pick) => void;
  shop: (query: string) => ReactNode;
}) {
  const floor = FLOOR_OPTIONS.find((f) => f.key === pick.floor)!;
  const wall = WALL_OPTIONS.find((w) => w.key === pick.wall)!;
  return (
    <div className="room3d-picker">
      <div role="group" aria-label="Wall colour">
        <span className="eyebrow">Walls</span>
        {WALL_OPTIONS.map((w) => (
          <button
            key={w.key}
            type="button"
            aria-pressed={pick.wall === w.key}
            onClick={() => onPick({ ...pick, wall: w.key })}
          >
            <i style={{ background: w.hex }} /> {w.label}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Floor">
        <span className="eyebrow">Floor</span>
        {FLOOR_OPTIONS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={pick.floor === f.key}
            onClick={() => onPick({ ...pick, floor: f.key })}
          >
            {f.label}
          </button>
        ))}
      </div>
      <p className="room3d-picker-spec small-note">
        {floor.shopFor ? (
          <>
            {floor.spec} {shop(floor.shopFor)}
          </>
        ) : (
          floor.spec
        )}
        <br />
        {wall.label} paint, eggshell, two coats {shop(wall.spec)}
      </p>
    </div>
  );
}
