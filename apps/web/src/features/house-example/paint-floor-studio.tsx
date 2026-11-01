import { useEffect, useMemo, useRef, useState } from 'react';
import { roomSurfaces } from '@renovagent/core';
import { Glyph } from '../../components/glyph.js';
import { mountRoomScene, type RoomScene } from '../room3d/room-scene.js';
import { PaintPicker, brandColorLink } from '../room3d/photo-outlines.js';
import {
  CEILING_FT,
  DEFAULT_PICK,
  FLOOR_CHOICES,
  HOUSE_ROOMS,
  PRESET_COLORS,
  TIER_LABELS,
  floorFinish,
  money,
  roomModel,
  roomTakeoff,
  type FloorKey,
  type HouseRoom,
  type RoomPick,
  type TierKey,
  type WallColor,
} from './paint-floor.js';

const asset = (name: string) => `./examples/hutchinson/${name}`;
const LISTING =
  'https://www.southphillyrealestateteam.com/post/solid-bones-serious-upside-2440-s-hutchinson-st-philadelphia-pa-19148';
const STORE = 'renovagent.hutchinson.picks.v1';

type Segment = {
  confidence?: number;
  box: { left: number; top: number };
  path: string;
  scaleX: number;
  scaleY: number;
};
type Masks = { width: number; height: number; segments: Segment[]; runId?: string };

// The listing's photo with the chosen floor (a Muse Image edit) as the base.
const baseImage = (room: HouseRoom, floor: FloorKey) =>
  floor === 'keep' ? asset(`${room.photoId}.jpg`) : asset(`rooms/${room.photoId}-${floor}.jpg`);
const maskFile = (room: HouseRoom, floor: FloorKey) =>
  asset(`rooms/${floor === 'keep' ? room.photoId : `${room.photoId}-${floor}`}-walls.json`);

const feetInches = (feet: number) => {
  const whole = Math.floor(feet);
  return `${whole}′${Math.round((feet - whole) * 12)}″`;
};

// Starting picks so the first view already shows an "after".
const STARTING: Record<string, RoomPick> = {
  living: { color: PRESET_COLORS[0], floor: 'lvp', included: true },
  kitchen: { color: PRESET_COLORS[2], floor: 'keep', included: true },
  primary: { color: PRESET_COLORS[2], floor: 'hardwood', included: true },
  middle: { color: PRESET_COLORS[3], floor: 'lvp', included: true },
  rear: { color: PRESET_COLORS[0], floor: 'lvp', included: true },
};
function loadPicks(): Record<string, RoomPick> {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved && typeof saved === 'object') return { ...STARTING, ...saved };
  } catch {
    // Storage may be unavailable; the starting picks still work.
  }
  return STARTING;
}

const loaded = new Map<string, Promise<HTMLImageElement>>();
function loadImage(src: string) {
  let found = loaded.get(src);
  if (!found) {
    found = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Could not load ${src}`));
      img.src = src;
    });
    loaded.set(src, found);
  }
  return found;
}
const masksLoaded = new Map<string, Promise<Masks | null>>();
function loadMasks(src: string) {
  let found = masksLoaded.get(src);
  if (!found) {
    found = fetch(src)
      .then((r) => (r.ok ? (r.json() as Promise<Masks>) : null))
      .catch(() => null);
    masksLoaded.set(src, found);
  }
  return found;
}

// Repaints the SAM 3.1 wall masks in the chosen colour, keeping the photo's
// own light and shadow: each wall pixel takes the colour scaled by its
// brightness relative to the wall average, with that contrast softened so
// old wallpaper patterns fade as fresh paint would. An instant sketch.
function paintWalls(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  masks: Masks | null,
  hex: string | null,
) {
  const { naturalWidth: w, naturalHeight: h } = img;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  if (!hex || !masks?.segments.length) return;
  const mask = document.createElement('canvas');
  mask.width = w;
  mask.height = h;
  const m = mask.getContext('2d', { willReadFrequently: true })!;
  m.filter = 'blur(1.5px)';
  m.fillStyle = '#fff';
  const sx = w / masks.width,
    sy = h / masks.height;
  for (const s of masks.segments) {
    if ((s.confidence ?? 1) < 0.5) continue;
    m.save();
    m.scale(sx, sy);
    m.translate(s.box.left, s.box.top);
    m.scale(s.scaleX, s.scaleY);
    m.fill(new Path2D(s.path));
    m.restore();
  }
  const alpha = m.getImageData(0, 0, w, h).data;
  const frame = ctx.getImageData(0, 0, w, h);
  const px = frame.data;
  let sum = 0,
    n = 0;
  for (let i = 0; i < px.length; i += 4)
    if (alpha[i + 3]! > 128) {
      sum += 0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!;
      n++;
    }
  if (!n) return;
  const mean = sum / n;
  const tr = parseInt(hex.slice(1, 3), 16),
    tg = parseInt(hex.slice(3, 5), 16),
    tb = parseInt(hex.slice(5, 7), 16);
  for (let i = 0; i < px.length; i += 4) {
    const a = alpha[i + 3]! / 255;
    if (!a) continue;
    const raw = (0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!) / mean;
    const l = Math.min(1.3, 1 + (raw - 1) * 0.6);
    px[i] = px[i]! * (1 - a) + Math.min(255, tr * l) * a;
    px[i + 1] = px[i + 1]! * (1 - a) + Math.min(255, tg * l) * a;
    px[i + 2] = px[i + 2]! * (1 - a) + Math.min(255, tb * l) * a;
  }
  ctx.putImageData(frame, 0, 0);
}

function BeforeAfter({ room, pick }: { room: HouseRoom; pick: RoomPick }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [split, setSplit] = useState(50);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const base = baseImage(room, pick.floor);
  const hex = pick.color?.hex ?? null;
  useEffect(() => {
    let live = true;
    setReady(false);
    Promise.all([loadImage(base), loadMasks(maskFile(room, pick.floor))])
      .then(([img, masks]) => {
        if (!live || !canvas.current) return;
        paintWalls(canvas.current, img, masks, hex);
        setReady(true);
        setError('');
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [base, hex, room, pick.floor]);
  return (
    <div className="pf-compare" style={{ ['--split' as string]: `${split}%` }}>
      <img
        className="pf-before"
        src={asset(`${room.photoId}.jpg`)}
        alt={`${room.title} as listed`}
      />
      <canvas
        ref={canvas}
        className={`pf-after${ready ? ' is-ready' : ''}`}
        role="img"
        aria-label={`${room.title} with the chosen paint and floor`}
      />
      <span className="pf-tag pf-tag-before">Before · listing photo</span>
      <span className="pf-tag pf-tag-after">After · your choices</span>
      <span className="pf-handle" aria-hidden="true" />
      <input
        className="pf-slider"
        type="range"
        min={0}
        max={100}
        value={split}
        aria-label="Drag to compare before and after"
        onChange={(e) => setSplit(Number(e.target.value))}
      />
      {error && <p className="pf-error">{error}</p>}
    </div>
  );
}

function Room3D({ room, pick }: { room: HouseRoom; pick: RoomPick }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<RoomScene | null>(null);
  const [error, setError] = useState('');
  const look = {
    wallColor: pick.color?.hex ?? '#d9cfbf',
    floorFinish: floorFinish(room, pick.floor),
    label: pick.color ? pick.color.name : 'Existing',
  };
  useEffect(() => {
    if (!host.current) return;
    const model = roomModel(room);
    try {
      scene.current = mountRoomScene(
        host.current,
        model,
        roomSurfaces(model, null),
        look,
        () => {},
        { sourceEvidenceId: null, title: room.title },
      );
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '3D needs WebGL in this browser.');
    }
    return () => {
      scene.current?.dispose();
      scene.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);
  useEffect(() => {
    scene.current?.setLook(look);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [look.wallColor, look.floorFinish]);
  return (
    <div className="pf-3d">
      <div ref={host} className="pf-3d-host" />
      {error && <p className="pf-error">{error}</p>}
      <p className="pf-3d-note">
        Box room from the listing plan, {feetInches(room.lengthFt)} × {feetInches(room.widthFt)} ×{' '}
        {CEILING_FT}′. Doors and windows are not modelled.
      </p>
    </div>
  );
}

function ColorChoice({
  pick,
  onColor,
}: {
  pick: RoomPick;
  onColor: (color: WallColor | null) => void;
}) {
  const [browsing, setBrowsing] = useState(false);
  const link = pick.color
    ? brandColorLink({ ...pick.color, family: familyOf(pick.color.hex) })
    : null;
  return (
    <div className="pf-group">
      <div className="pf-group-head">
        <h3>Walls</h3>
        <span>{pick.color ? `${pick.color.name} · ${pick.color.code}` : 'Current walls'}</span>
      </div>
      <div className="pf-swatches" role="group" aria-label="Wall colour">
        <button
          type="button"
          className="pf-swatch is-keep"
          aria-pressed={!pick.color}
          title="Keep the current walls"
          onClick={() => onColor(null)}
        >
          <span className="sr-only">Keep the current walls</span>
        </button>
        {PRESET_COLORS.map((c) => (
          <button
            key={c.code}
            type="button"
            className="pf-swatch"
            style={{ background: c.hex }}
            aria-pressed={pick.color?.code === c.code}
            title={`${c.name} · ${c.code}`}
            onClick={() => onColor(c)}
          >
            <span className="sr-only">
              {c.name} {c.code}
            </span>
          </button>
        ))}
        <button
          type="button"
          className="pf-more"
          aria-expanded={browsing}
          onClick={() => setBrowsing(!browsing)}
        >
          {browsing ? 'Close' : 'All colours'}
        </button>
      </div>
      {browsing && (
        <PaintPicker
          selected={pick.color ? `${pick.color.brand} ${pick.color.name} ${pick.color.code}` : null}
          onPick={(c) =>
            onColor({ name: c.name, code: c.code ?? '', hex: c.hex.toLowerCase(), brand: c.brand })
          }
        />
      )}
      {pick.color && (
        <p className="pf-fine">
          Screen colour; check a real chip before buying.{' '}
          {link && (
            <a href={link} target="_blank" rel="noreferrer">
              {pick.color.name} on sherwin-williams.com
            </a>
          )}
        </p>
      )}
    </div>
  );
}

// The brand page path needs the colour's family; the presets are all neutral
// or green/blue, so a coarse hue check is enough for the link.
function familyOf(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  if (max - min < 26) return max > 225 ? 'white' : 'neutral';
  if (b >= r && b >= g) return 'blue';
  if (g >= r) return 'green';
  return 'neutral';
}

export function PaintFloorStudio({ onRoomExample }: { onRoomExample?: () => void }) {
  const [roomId, setRoomId] = useState(HOUSE_ROOMS[0]!.id);
  const [view, setView] = useState<'photo' | '3d'>('photo');
  const [tier, setTier] = useState<TierKey>('mid');
  const [picks, setPicks] = useState<Record<string, RoomPick>>(loadPicks);
  const room = HOUSE_ROOMS.find((r) => r.id === roomId)!;
  const pick = picks[roomId] ?? DEFAULT_PICK;
  const update = (next: Partial<RoomPick>) => {
    const all = { ...picks, [roomId]: { ...pick, ...next } };
    setPicks(all);
    try {
      localStorage.setItem(STORE, JSON.stringify(all));
    } catch {
      // Picks still apply for this visit.
    }
  };
  const takeoffs = useMemo(
    () =>
      Object.fromEntries(
        HOUSE_ROOMS.map((r) => [r.id, roomTakeoff(r, picks[r.id] ?? DEFAULT_PICK, tier)]),
      ),
    [picks, tier],
  );
  const takeoff = takeoffs[roomId]!;
  const included = HOUSE_ROOMS.filter((r) => (picks[r.id] ?? DEFAULT_PICK).included);
  const houseTotal = included.reduce((sum, r) => sum + takeoffs[r.id]!.totalMinor, 0);
  return (
    <section className="pf-studio" aria-label="Hutchinson paint and floor plan">
      <header className="pf-head">
        <div>
          <p className="pf-kicker">Example · from a real listing</p>
          <h1>2440 S Hutchinson St</h1>
          <p className="pf-sub">
            Paint and floors, room by room. Philadelphia rowhouse ·{' '}
            <a href={LISTING} target="_blank" rel="noreferrer">
              Listing
            </a>
          </p>
        </div>
        <div className="pf-total" aria-live="polite">
          <span>
            Whole house · {included.length} room{included.length === 1 ? '' : 's'}
          </span>
          <strong>{money(houseTotal)}</strong>
          <span>materials, {TIER_LABELS[tier].toLowerCase()}</span>
        </div>
      </header>

      <nav className="pf-rooms" aria-label="Rooms">
        {HOUSE_ROOMS.map((r) => {
          const p = picks[r.id] ?? DEFAULT_PICK;
          return (
            <button
              key={r.id}
              type="button"
              aria-current={r.id === roomId}
              className={p.included ? '' : 'is-deferred'}
              onClick={() => setRoomId(r.id)}
            >
              <img src={asset(`${r.photoId}.jpg`)} alt="" loading="lazy" />
              <span className="pf-room-name">{r.title}</span>
              <span className="pf-room-meta">
                <i style={{ background: p.color?.hex ?? 'transparent' }} />
                {p.included ? money(takeoffs[r.id]!.totalMinor) : 'Deferred'}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="pf-body">
        <div className="pf-stage">
          <div className="pf-stage-bar">
            <div>
              <span>{room.level}</span>
              <strong>{room.title}</strong>
            </div>
            <div className="pf-views" role="tablist" aria-label="View">
              <button
                type="button"
                role="tab"
                aria-selected={view === 'photo'}
                onClick={() => setView('photo')}
              >
                <Glyph name="photo" /> Before / after
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === '3d'}
                onClick={() => setView('3d')}
              >
                <Glyph name="layers" /> 3D room
              </button>
            </div>
          </div>
          {view === 'photo' ? (
            <BeforeAfter room={room} pick={pick} />
          ) : (
            <Room3D room={room} pick={pick} />
          )}
          <p className="pf-fine">
            {view === 'photo'
              ? `Walls outlined by SAM 3.1 and recoloured in your browser${pick.floor === 'keep' ? '' : '; the new floor is a Muse Image edit of the listing photo'}. A visual direction, not a construction drawing.`
              : 'Drag to orbit. ✦ Photoreal renders this room with Muse Image; Blender HD renders it on a cloud GPU.'}
            {room.photoNote ? ` ${room.photoNote}` : ''}
          </p>
        </div>

        <aside className="pf-panel" aria-label="Choices and materials">
          <p className="pf-dims">
            {feetInches(room.lengthFt)} × {feetInches(room.widthFt)} · {CEILING_FT}′ ceiling ·{' '}
            {takeoff.floorSqFt} sq ft floor · {takeoff.wallSqFt} sq ft walls
          </p>
          <ColorChoice pick={pick} onColor={(color) => update({ color })} />
          <div className="pf-group">
            <div className="pf-group-head">
              <h3>Floor</h3>
              <span>Now: {room.existingFloor}</span>
            </div>
            <div className="pf-chips" role="group" aria-label="Floor">
              {FLOOR_CHOICES.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={pick.floor === f.key}
                  onClick={() => update({ floor: f.key })}
                >
                  {f.key === 'keep' ? `Keep ${room.existingFloor}` : f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pf-group">
            <div className="pf-group-head">
              <h3>Materials</h3>
              <div className="pf-tiers" role="group" aria-label="Price tier">
                {(Object.keys(TIER_LABELS) as TierKey[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={tier === t}
                    onClick={() => setTier(t)}
                  >
                    {TIER_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            {takeoff.plan?.lines.length ? (
              <ul className="pf-lines">
                {takeoff.plan.lines.map((line) => (
                  <li key={line.bomItemId}>
                    <span>
                      {line.productName}
                      <small>
                        {line.purchaseUnits} × {money(line.unitPriceMinor)} · {line.retailer}
                      </small>
                    </span>
                    <b>{money(line.lineTotalMinor)}</b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pf-fine">Pick a colour or a new floor to see what it takes.</p>
            )}
            <div className="pf-subtotal">
              <span>Room materials</span>
              <b>{money(takeoff.totalMinor)}</b>
            </div>
            <p className="pf-fine">
              Example catalog prices for this demo, not live offers. Labour is quoted separately.
            </p>
          </div>

          <label className="pf-include">
            <input
              type="checkbox"
              checked={pick.included}
              onChange={(e) => update({ included: e.target.checked })}
            />
            Include this room in the whole-house plan
          </label>
        </aside>
      </div>

      <details className="pf-sources">
        <summary>Sources and receipts</summary>
        <ul>
          <li>
            Photos and floor plans:{' '}
            <a href={LISTING} target="_blank" rel="noreferrer">
              the public listing
            </a>{' '}
            (Bright MLS photos; CubiCasa plans, “deemed highly reliable but not guaranteed”).
          </li>
          <li>Ceiling height 9′: reported by the owner.</li>
          <li>
            New floors: Muse Image edits of each listing photo;{' '}
            <a href={asset(`rooms/${room.photoId}-lvp.json`)} target="_blank" rel="noreferrer">
              prompt and hashes
            </a>
            .
          </li>
          <li>
            Wall outlines: SAM 3.1 masks of each image;{' '}
            <a href={maskFile(room, pick.floor)} target="_blank" rel="noreferrer">
              this view’s masks
            </a>
            .
          </li>
          <li>
            Quantities: the living-room recipe (2 coats; openings not deducted). Prices: the
            labelled demo catalog.
          </li>
        </ul>
        {onRoomExample && (
          <button type="button" className="link-button" onClick={onRoomExample}>
            Open the measured-room example (work steps, contractor quotes, Blender stages)
          </button>
        )}
      </details>
    </section>
  );
}
