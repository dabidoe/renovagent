import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { nearestPaint, roomSurfaces } from '@renovagent/core';
import { workspaceRequest } from '../../adapters/http/project-repository.js';
import { Glyph } from '../../components/glyph.js';
import { mountRoomScene, type RoomScene } from '../room3d/room-scene.js';
import { PaintPicker, brandColorLink } from '../room3d/photo-outlines.js';
import {
  DEFAULT_PICK,
  DEFAULT_SHEEN,
  FLOOR_CHOICES,
  FLOOR_STYLES,
  PAINT_LINES,
  SHEENS,
  PRESET_COLORS,
  TIER_LABELS,
  feetInches,
  floorFinish,
  floorImage,
  styleOf,
  swatchUrl,
  money,
  roomModel,
  roomTakeoff,
  type HouseProject,
  type Masks,
  type RoomImage,
  type RoomPick,
  type Sheen,
  type StudioRoom,
  type TierKey,
  type WallColor,
} from './paint-floor.js';

const pickStore = (projectId: string) => `renovagent.studio.${projectId}.picks.v1`;
function loadPicks(project: HouseProject): Record<string, RoomPick> {
  const starting = project.starting ?? {};
  try {
    const saved = JSON.parse(localStorage.getItem(pickStore(project.id)) || 'null');
    if (saved && typeof saved === 'object') return { ...starting, ...saved };
  } catch {
    // Storage may be unavailable; the starting picks still work.
  }
  return starting;
}

const loaded = new Map<string, Promise<HTMLImageElement>>();
function loadImage(src: string) {
  let found = loaded.get(src);
  if (!found) {
    found = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        loaded.delete(src);
        reject(new Error('The photo could not be loaded.'));
      };
      img.src = src;
    });
    loaded.set(src, found);
  }
  return found;
}
const masksLoaded = new Map<string, Promise<Masks | null>>();
function loadMasks(walls: RoomImage['walls']): Promise<Masks | null> {
  if (!walls) return Promise.resolve(null);
  if (typeof walls !== 'string') return Promise.resolve(walls);
  let found = masksLoaded.get(walls);
  if (!found) {
    found = fetch(walls)
      .then((r) => (r.ok ? (r.json() as Promise<Masks>) : null))
      .catch(() => null);
    masksLoaded.set(walls, found);
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

function BeforeAfter({
  room,
  pick,
  pending,
}: {
  room: StudioRoom;
  pick: RoomPick;
  pending: string | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [split, setSplit] = useState(50);
  const [ratio, setRatio] = useState<string>('3 / 2');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  // The chosen floor's image once it exists; the photo until then.
  const style = styleOf(pick);
  const shown = (style && floorImage(room, style)) || room.photo;
  const hex = pick.color?.hex ?? null;
  useEffect(() => {
    let live = true;
    setReady(false);
    Promise.all([loadImage(shown.src), loadMasks(shown.walls)])
      .then(([img, masks]) => {
        if (!live || !canvas.current) return;
        setRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
        paintWalls(canvas.current, img, masks, hex);
        setReady(true);
        setError('');
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [shown.src, shown.walls, hex]);
  return (
    <div className="pf-compare" style={{ ['--split' as string]: `${split}%`, aspectRatio: ratio }}>
      <img className="pf-before" src={room.photo.src} alt={`${room.title} as it is`} />
      <canvas
        ref={canvas}
        className={`pf-after${ready ? ' is-ready' : ''}`}
        role="img"
        aria-label={`${room.title} with the chosen paint and floor`}
      />
      <span className="pf-tag pf-tag-before">Before</span>
      <span className="pf-tag pf-tag-after">After</span>
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
      {pending && (
        <p className="pf-working" role="status">
          <span className="pf-spinner" aria-hidden="true" />
          {pending}
        </p>
      )}
      {error && <p className="pf-error">{error}</p>}
    </div>
  );
}

function Room3D({
  room,
  ceilingFt,
  pick,
}: {
  room: StudioRoom;
  ceilingFt: number | null;
  pick: RoomPick;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<RoomScene | null>(null);
  const [error, setError] = useState('');
  const look = {
    wallColor: pick.color?.hex ?? '#d9cfbf',
    floorFinish: floorFinish(room, pick),
    ...(styleOf(pick) ? { floorTexture: swatchUrl(styleOf(pick)!) } : {}),
    label: pick.color ? pick.color.name : 'Existing',
  };
  const sizeKey = `${room.size?.xFt}x${room.size?.yFt}x${ceilingFt}`;
  useEffect(() => {
    const model = roomModel(room, ceilingFt);
    if (!host.current || !model) return;
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
  }, [room.id, sizeKey]);
  useEffect(() => {
    scene.current?.setLook(look);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [look.wallColor, look.floorFinish, look.floorTexture]);
  return (
    <div className="pf-3d">
      <div ref={host} className="pf-3d-host" />
      {error && <p className="pf-error">{error}</p>}
    </div>
  );
}

// The brand page path needs the colour's family; a coarse hue check is
// enough to build the link.
function familyOf(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  if (max - min < 26) return max > 225 ? 'white' : 'neutral';
  if (b >= r && b >= g) return 'blue';
  if (g >= r) return 'green';
  return r > 200 && g > 160 ? 'yellow' : 'red';
}

function ColorChoice({
  pick,
  tier,
  onColor,
  onPaint,
}: {
  pick: RoomPick;
  tier: TierKey;
  onColor: (color: WallColor | null) => void;
  onPaint: (paint: { paintLine?: TierKey; sheen?: Sheen }) => void;
}) {
  const [browsing, setBrowsing] = useState(false);
  const link = pick.color
    ? brandColorLink({ ...pick.color, family: familyOf(pick.color.hex) })
    : null;
  return (
    <div className="pf-group">
      <div className="pf-group-head">
        <h3>Walls</h3>
        {pick.color && link ? (
          <a href={link} target="_blank" rel="noreferrer">
            {pick.color.name} · {pick.color.code}
          </a>
        ) : (
          <span>{pick.color ? `${pick.color.name} · ${pick.color.code}` : 'Current walls'}</span>
        )}
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
      {pick.color && (
        <div className="pf-paint">
          <div className="pf-chips" role="group" aria-label="Paint line">
            {PAINT_LINES.map((l) => (
              <button
                key={l.key}
                type="button"
                title={l.like}
                aria-pressed={(pick.paintLine ?? tier) === l.key}
                onClick={() => onPaint({ paintLine: l.key })}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="pf-chips" role="group" aria-label="Finish">
            {SHEENS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={(pick.sheen ?? DEFAULT_SHEEN) === f.key}
                onClick={() => onPaint({ sheen: f.key })}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {browsing && (
        <PaintPicker
          selected={pick.color ? `${pick.color.brand} ${pick.color.name} ${pick.color.code}` : null}
          onPick={(c) =>
            onColor({ name: c.name, code: c.code ?? '', hex: c.hex.toLowerCase(), brand: c.brand })
          }
        />
      )}
    </div>
  );
}

// Muse Spark's reading of the owner's words: a real loaded paint (or, with
// none loaded, the described hex, snapped here to a starting colour), one of
// the studio's floors, and the rest as ideas that are not priced.
type Idea = {
  color: WallColor | null;
  hex: string | null;
  sheen: Sheen | null;
  floorStyle: string | null;
  material: 'lvp' | 'hardwood' | null;
  extras: string[];
};

function Imagine({
  room,
  busy,
  error,
  onImagine,
}: {
  room: StudioRoom;
  busy: boolean;
  error: string;
  onImagine: (text: string) => void;
}) {
  const [text, setText] = useState('');
  return (
    <form
      className="pf-imagine"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim().length >= 3) onImagine(text.trim());
      }}
    >
      <label htmlFor="pf-imagine-text">Imagine the {room.title.toLowerCase()}</label>
      <div>
        <input
          id="pf-imagine-text"
          value={text}
          maxLength={300}
          disabled={busy}
          placeholder="Dark green walls, light oak floors…"
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" disabled={busy || text.trim().length < 3} aria-label="Apply">
          {busy ? <span className="pf-spinner" aria-hidden="true" /> : <Glyph name="right" />}
        </button>
      </div>
      {error && <p className="pf-intake-error">{error}</p>}
    </form>
  );
}

// Feet from a "12.5" or "12' 6"" style entry; null when unreadable.
export function parseFeet(text: string) {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:'|′|ft)?\s*(?:(\d+(?:\.\d+)?)\s*(?:"|″|in)?)?\s*$/.exec(text);
  if (!m) return null;
  const feet = Number(m[1]) + (m[2] ? Number(m[2]) / 12 : 0);
  return feet > 0 && feet < 200 ? Math.round(feet * 1000) / 1000 : null;
}

function SizeEntry({
  room,
  ceilingFt,
  onSize,
  onCeiling,
}: {
  room: StudioRoom;
  ceilingFt: number | null;
  onSize: (size: { xFt: number; yFt: number }) => void;
  onCeiling?: (ft: number) => void;
}) {
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  const [c, setC] = useState('');
  return (
    <form
      className="pf-size"
      onSubmit={(e) => {
        e.preventDefault();
        const xFt = parseFeet(x),
          yFt = parseFeet(y),
          cFt = parseFeet(c);
        if (xFt && yFt) onSize({ xFt, yFt });
        if (cFt && onCeiling) onCeiling(cFt);
      }}
    >
      <h3>Room size</h3>
      <div>
        {!room.size && (
          <>
            <input
              aria-label="Width in feet"
              placeholder="12′"
              inputMode="decimal"
              value={x}
              onChange={(e) => setX(e.target.value)}
            />
            <span aria-hidden="true">×</span>
            <input
              aria-label="Length in feet"
              placeholder="14′"
              inputMode="decimal"
              value={y}
              onChange={(e) => setY(e.target.value)}
            />
          </>
        )}
        {!ceilingFt && onCeiling && (
          <input
            aria-label="Ceiling height in feet"
            placeholder="Ceiling 8′"
            inputMode="decimal"
            value={c}
            onChange={(e) => setC(e.target.value)}
          />
        )}
        <button type="submit">Set</button>
      </div>
    </form>
  );
}

export function PaintFloorStudio({
  project,
  kicker,
  sources,
  actions,
  renderFloor,
  onEditRoom,
  onCeiling,
  roomTools,
  onIdeaUsed,
}: {
  project: HouseProject;
  kicker: string;
  sources?: ReactNode;
  actions?: ReactNode;
  // Lays a floor style in an owner's room photo (a Muse Image edit).
  renderFloor?: (roomId: string, style: string) => Promise<void>;
  onEditRoom?: (roomId: string, patch: Partial<StudioRoom>) => void;
  onCeiling?: (ft: number) => void;
  // Owner-only controls for the selected room (e.g. which plan room it is).
  roomTools?: (room: StudioRoom) => ReactNode;
  // Called once the project's own description has been applied.
  onIdeaUsed?: () => void;
}) {
  const [roomId, setRoomIdState] = useState(project.rooms[0]?.id ?? '');
  const setRoomId = (id: string) => {
    setApplied(false);
    setRoomIdState(id);
  };
  const [view, setView] = useState<'photo' | '3d'>('photo');
  const [tier, setTier] = useState<TierKey>('mid');
  const [picks, setPicks] = useState<Record<string, RoomPick>>(() => loadPicks(project));
  const [working, setWorking] = useState<Record<string, string>>({});
  const [editCeiling, setEditCeiling] = useState(false);
  const room = project.rooms.find((r) => r.id === roomId) ?? project.rooms[0];
  const pick = (room && picks[room.id]) ?? DEFAULT_PICK;
  const ceilingFt = project.ceilingFt;
  const updateRoom = (id: string, next: Partial<RoomPick>) =>
    setPicks((current) => {
      const all = { ...current, [id]: { ...(current[id] ?? DEFAULT_PICK), ...next } };
      try {
        localStorage.setItem(pickStore(project.id), JSON.stringify(all));
      } catch {
        // Picks still apply for this visit.
      }
      return all;
    });
  const update = (next: Partial<RoomPick>) => {
    setApplied(false);
    if (room) updateRoom(room.id, next);
  };
  // The current room's paint and floor, in every room that can show them.
  const [applied, setApplied] = useState(false);
  const applyEverywhere = (from: StudioRoom) =>
    setPicks((current) => {
      const look = current[from.id] ?? DEFAULT_PICK;
      const style = styleOf(look);
      const all = Object.fromEntries(
        project.rooms.map((r) => {
          const own = current[r.id] ?? DEFAULT_PICK;
          const canShow = !style || !!floorImage(r, style) || !!renderFloor;
          return [
            r.id,
            {
              ...own,
              color: look.color,
              paintLine: look.paintLine,
              sheen: look.sheen,
              ...(canShow ? { floor: look.floor, floorStyle: look.floorStyle } : {}),
            } as RoomPick,
          ];
        }),
      );
      try {
        localStorage.setItem(pickStore(project.id), JSON.stringify(all));
      } catch {
        // Picks still apply for this visit.
      }
      setApplied(true);
      return all;
    });
  const [imagining, setImagining] = useState<{ busy: boolean; error: string }>({
    busy: false,
    error: '',
  });
  const imagine = async (text: string, target: StudioRoom) => {
    setImagining({ busy: true, error: '' });
    try {
      const idea = (await workspaceRequest('/studio/imagine', {
        text,
        room: target.title,
      })) as Idea;
      const color = idea.color ?? (idea.hex ? nearestPaint(idea.hex, PRESET_COLORS) : null);
      // A style this room cannot show stays as it is, so the price matches the picture.
      const style =
        idea.floorStyle && (floorImage(target, idea.floorStyle) || renderFloor)
          ? idea.floorStyle
          : null;
      const current = picks[target.id] ?? DEFAULT_PICK;
      const material = idea.material ?? (current.floor === 'keep' ? 'lvp' : current.floor);
      updateRoom(target.id, {
        ...(color ? { color } : {}),
        ...(idea.sheen ? { sheen: idea.sheen } : {}),
        ...(style ? { floorStyle: style, floor: material } : {}),
        ideas: idea.extras,
      });
      setImagining({ busy: false, error: '' });
    } catch (e) {
      setImagining({
        busy: false,
        error: e instanceof Error ? e.message.slice(0, 160) : 'That could not be read.',
      });
    }
  };
  const ideaUsed = useRef(false);
  useEffect(() => {
    const first = project.rooms[0];
    if (!project.idea || !first || ideaUsed.current) return;
    ideaUsed.current = true;
    void imagine(project.idea, first).finally(() => onIdeaUsed?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.idea]);
  // A floor that is picked but not made yet is rendered once, on demand.
  const pickedStyle = styleOf(pick);
  const missing = room && pickedStyle && !floorImage(room, pickedStyle) ? pickedStyle : null;
  const workKey = room && missing ? `${room.id}:${missing}` : '';
  useEffect(() => {
    if (!room || !missing || !renderFloor || working[workKey]) return;
    const label = (FLOOR_STYLES.find((f) => f.id === missing)?.label ?? 'the floor').toLowerCase();
    setWorking((w) => ({ ...w, [workKey]: `Laying ${label}…` }));
    renderFloor(room.id, missing)
      .then(() => setWorking((w) => ({ ...w, [workKey]: '' })))
      .catch((e) =>
        setWorking((w) => ({
          ...w,
          [workKey]: e instanceof Error ? e.message.slice(0, 120) : 'The floor could not be made.',
        })),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workKey]);
  const takeoffs = useMemo(
    () =>
      Object.fromEntries(
        project.rooms.map((r) => [
          r.id,
          roomTakeoff(r, ceilingFt, picks[r.id] ?? DEFAULT_PICK, tier),
        ]),
      ),
    [project.rooms, ceilingFt, picks, tier],
  );
  if (!room) return null;
  const takeoff = takeoffs[room.id]!;
  const included = project.rooms.filter((r) => (picks[r.id] ?? DEFAULT_PICK).included);
  const houseTotal = included.reduce((sum, r) => sum + takeoffs[r.id]!.totalMinor, 0);
  const has3d = !!roomModel(room, ceilingFt);
  const needsSize = !room.size || !ceilingFt;
  const shownImage = pickedStyle ? floorImage(room, pickedStyle) : room.photo;
  const pending =
    (workKey && working[workKey]) ||
    (shownImage && !shownImage.walls && pick.color ? 'Finding the walls…' : null);
  return (
    <section className="pf-studio" aria-label={`${project.address} paint and floor plan`}>
      <header className="pf-head">
        <div>
          <p className="pf-kicker">{kicker}</p>
          <h1>{project.address}</h1>
          {(project.place || project.listing) && (
            <p className="pf-sub">
              {project.place}
              {project.place && project.listing ? ' · ' : ''}
              {project.listing && (
                <a href={project.listing} target="_blank" rel="noreferrer">
                  Listing
                </a>
              )}
            </p>
          )}
        </div>
        <div className="pf-head-side">
          {actions}
          <div className="pf-total" aria-live="polite">
            <span>
              Whole house · {included.length} room{included.length === 1 ? '' : 's'}
            </span>
            <strong>{money(houseTotal)}</strong>
            <span>materials, {TIER_LABELS[tier].toLowerCase()}</span>
          </div>
        </div>
      </header>

      <nav className="pf-rooms" aria-label="Rooms">
        {project.rooms.map((r) => {
          const p = picks[r.id] ?? DEFAULT_PICK;
          return (
            <button
              key={r.id}
              type="button"
              aria-current={r.id === room.id}
              className={p.included ? '' : 'is-deferred'}
              onClick={() => setRoomId(r.id)}
            >
              <img src={r.photo.src} alt="" loading="lazy" />
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
              <strong>{room.title}</strong>
              {room.size && (
                <span>
                  {feetInches(room.size.xFt)} × {feetInches(room.size.yFt)}
                  {ceilingFt && ' · '}
                  {ceilingFt && onCeiling ? (
                    <button
                      type="button"
                      className="pf-ceiling"
                      title={project.ceilingNote ?? 'Change the ceiling height'}
                      onClick={() => setEditCeiling(true)}
                    >
                      {project.ceilingNote ? '≈' : ''}
                      {feetInches(ceilingFt)} ceilings
                    </button>
                  ) : ceilingFt ? (
                    `${feetInches(ceilingFt)} ceilings`
                  ) : null}
                </span>
              )}
            </div>
            {has3d && (
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
            )}
          </div>
          {view === '3d' && has3d ? (
            <Room3D room={room} ceilingFt={ceilingFt} pick={pick} />
          ) : (
            <BeforeAfter room={room} pick={pick} pending={pending || null} />
          )}
        </div>

        <aside className="pf-panel" aria-label="Choices and materials">
          <Imagine
            key={room.id}
            room={room}
            busy={imagining.busy}
            error={imagining.error}
            onImagine={(text) => void imagine(text, room)}
          />
          {roomTools?.(room)}
          {((needsSize && onEditRoom) || editCeiling) && (
            <SizeEntry
              key={room.id}
              room={room}
              ceilingFt={editCeiling ? null : ceilingFt}
              onSize={(size) => onEditRoom?.(room.id, { size })}
              {...(onCeiling
                ? {
                    onCeiling: (ft: number) => {
                      onCeiling(ft);
                      setEditCeiling(false);
                    },
                  }
                : {})}
            />
          )}
          <ColorChoice
            pick={pick}
            tier={tier}
            onColor={(color) => update({ color })}
            onPaint={(paint) => update(paint)}
          />
          <div className="pf-group">
            <div className="pf-group-head">
              <h3>Floor</h3>
              <span>
                {pickedStyle
                  ? FLOOR_STYLES.find((f) => f.id === pickedStyle)?.label
                  : `Current ${room.existingFloor}`}
              </span>
            </div>
            <div className="pf-floor-styles" role="group" aria-label="Floor style">
              <button
                type="button"
                className="pf-floor-style is-keep"
                aria-pressed={pick.floor === 'keep'}
                onClick={() => update({ floor: 'keep' })}
              >
                <img src={room.photo.src} alt="" />
                <span>Keep</span>
              </button>
              {FLOOR_STYLES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="pf-floor-style"
                  aria-pressed={pickedStyle === f.id}
                  disabled={!floorImage(room, f.id) && !renderFloor}
                  onClick={() =>
                    update({ floorStyle: f.id, floor: pick.floor === 'keep' ? 'lvp' : pick.floor })
                  }
                >
                  <img src={swatchUrl(f.id)} alt="" loading="lazy" />
                  <span>{f.label}</span>
                </button>
              ))}
            </div>
            {pick.floor !== 'keep' && (
              <div className="pf-chips" role="group" aria-label="Floor material">
                {FLOOR_CHOICES.filter((f) => f.key !== 'keep').map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={pick.floor === f.key}
                    onClick={() => update({ floor: f.key, floorStyle: pickedStyle! })}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pf-group">
            <div className="pf-group-head">
              <h3>
                Materials <span className="pf-badge">Demo prices</span>
              </h3>
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
            {takeoff.lines.length ? (
              <ul className="pf-lines">
                {takeoff.lines.map((line) => (
                  <li key={line.bomItemId}>
                    <span>
                      {line.productName}
                      <small>
                        {line.purchaseUnits} × {money(line.unitPriceMinor)}
                      </small>
                    </span>
                    <b>{money(line.lineTotalMinor)}</b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pf-empty">
                {needsSize ? 'Add the room size to price it.' : 'Pick a colour or a floor.'}
              </p>
            )}
            {pick.ideas?.length ? (
              <p className="pf-ideas">
                <span>Not priced</span>
                {pick.ideas.join(' · ')}
              </p>
            ) : null}
            <div className="pf-subtotal">
              <span>Room materials</span>
              <b>{money(takeoff.totalMinor)}</b>
            </div>
          </div>

          {project.rooms.length > 1 && (pick.color || pick.floor !== 'keep') && (
            <button
              type="button"
              className="pf-apply-all"
              disabled={applied}
              onClick={() => applyEverywhere(room)}
            >
              {applied ? 'Every room has this look' : 'Use this look in every room'}
            </button>
          )}
          <label className="pf-include">
            <input
              type="checkbox"
              checked={pick.included}
              onChange={(e) => update({ included: e.target.checked })}
            />
            Include in the whole-house total
          </label>
        </aside>
      </div>

      {sources && (
        <details className="pf-sources">
          <summary>Sources</summary>
          {sources}
        </details>
      )}
    </section>
  );
}
