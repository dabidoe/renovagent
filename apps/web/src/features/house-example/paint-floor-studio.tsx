import { sampleForPhoto, type SampleRoom } from '../project-start/sample-rooms.js';
import { thumbnailUrl } from './ui-thumbnails.js';
import { StudioError } from './studio-error.js';
import { studioFinishSignature as lookSignature } from './studio-signatures.js';
import { StudioSync, pendingStudioSave, type StudioSaveMeta } from './studio-sync.js';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

// Desktop puts Plan & budget under the photo; phones keep it as an inspector tab.
const WIDE_STUDIO = '(min-width: 761px)';
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const sync = () => setMatches(list.matches);
    sync();
    list.addEventListener('change', sync);
    return () => list.removeEventListener('change', sync);
  }, [query]);
  return matches;
}
import {
  DomainError,
  studioDesignSchema,
  studioItemSchema,
  type StudioDesign,
  type StudioItem,
} from '@renovagent/contracts';
import { nearestPaint, roomSurfaces, studioItemBudget } from '@renovagent/core';
import { workspaceRequest } from '../../adapters/http/project-repository.js';
import { Glyph } from '../../components/glyph.js';
import { SignInChoices } from '../connect/sign-in.js';
// The 3D engine (three.js) loads only when a 3D view opens.
import type { RoomScene } from '../room3d/room-scene.js';
import { PaintPicker, brandColorLink } from '../room3d/photo-outlines.js';
import { InspiredView, InspoPanel, stylingDraft, type StylingDraft } from './inspo-panel.js';
import { RoomPlan, type StudioHandoff } from './room-plan.js';
import { RollingNumber } from '../../components/rolling-number.js';
import { FurniturePanel } from './furniture-panel.js';
import {
  studioPlacementSchema,
  type StudioPlacement,
  type StudioAssetId,
} from '@renovagent/contracts';
import { studioAsset, studioPlacementStart } from '@renovagent/core';
import type { StudioModelRenderContext } from '../room3d/photoreal.js';
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
  shoppingList,
  shoppingText,
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
export type SavedStudioDesign = { projectId: string; revision: number; snapshot: StudioDesign };
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
// Old failed SAM results used a 0×0 sentinel. It is unavailable, not a valid
// segmentation to carry into an otherwise saveable studio revision.
const validMasks = (walls: RoomImage['walls']) =>
  typeof walls === 'object' && walls && (walls.width <= 0 || walls.height <= 0) ? null : walls;
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
  maxEdge = Infinity,
) {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
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

// Interactive previews do not need camera-resolution pixel processing on every
// room click. Keep a small, bounded cache; exports still render the original size.
const paintedPreviews = new Map<
  HTMLImageElement,
  {
    masks: Masks | null;
    hex: string | null;
    canvas: HTMLCanvasElement;
  }
>();
function paintPreview(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  masks: Masks | null,
  hex: string | null,
) {
  let cached = paintedPreviews.get(img);
  if (!cached || cached.masks !== masks || cached.hex !== hex) {
    const preview = document.createElement('canvas');
    paintWalls(preview, img, masks, hex, 1280);
    cached = { masks, hex, canvas: preview };
  }
  paintedPreviews.delete(img);
  paintedPreviews.set(img, cached);
  if (paintedPreviews.size > 8) paintedPreviews.delete(paintedPreviews.keys().next().value!);
  canvas.width = cached.canvas.width;
  canvas.height = cached.canvas.height;
  canvas.getContext('2d')!.drawImage(cached.canvas, 0, 0);
}

export function BeforeAfter({
  room,
  pick,
  pending,
  floorUnavailable = false,
  allowDownload = false,
}: {
  room: StudioRoom;
  pick: RoomPick;
  pending: string | null;
  floorUnavailable?: boolean;
  allowDownload?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [split, setSplit] = useState(50);
  const [ratio, setRatio] = useState<string>('3 / 2');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [paintAvailable, setPaintAvailable] = useState(false);
  const download = async () => {
    if (!canvas.current || !ready || pending || floorUnavailable) return;
    setDownloadError('');
    try {
      const [img, masks] = await Promise.all([loadImage(shown.src), loadMasks(shown.walls)]);
      const source = document.createElement('canvas');
      paintWalls(source, img, masks, pick.color?.hex ?? null);
      const output = document.createElement('canvas');
      output.width = source.width;
      const labelHeight = Math.max(52, Math.round(source.width / 22));
      output.height = source.height + labelHeight;
      const ctx = output.getContext('2d')!;
      ctx.drawImage(source, 0, 0);
      ctx.fillStyle = '#142038';
      ctx.fillRect(0, source.height, output.width, labelHeight);
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.max(12, Math.round(labelHeight / 3))}px sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText(
        paintAvailable || !pick.color
          ? 'Renovagent · generated finish preview · concept only'
          : 'Renovagent · wall color preview unavailable · concept only',
        16,
        source.height + labelHeight / 2,
        output.width - 32,
      );
      output.toBlob((blob) => {
        if (!blob) {
          setDownloadError('Could not export this preview. Please try again.');
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `renovagent-${
          room.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'room'
        }-preview.png`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }, 'image/png');
    } catch {
      setDownloadError('Could not export this preview. Please try again.');
    }
  };
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
        paintPreview(canvas.current, img, masks, hex);
        setPaintAvailable(!!masks?.segments.length);
        setReady(true);
        setError('');
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [shown.src, shown.walls, hex]);
  return (
    <>
      <div
        className="pf-compare"
        style={{ ['--split' as string]: `${split}%`, aspectRatio: ratio }}
      >
        <img className="pf-before" src={room.photo.src} alt={`${room.title} as it is`} />
        <canvas
          ref={canvas}
          className={`pf-after${ready ? ' is-ready' : ''}`}
          role="img"
          aria-label={
            floorUnavailable
              ? `${room.title} preview with the original floor; chosen floor unavailable`
              : ready && hex && !paintAvailable
                ? `${room.title} preview; wall color unavailable`
                : `${room.title} with the chosen paint and floor`
          }
        />
        <span className="pf-tag pf-tag-before">Before</span>
        <span className="pf-tag pf-tag-after">
          {floorUnavailable
            ? 'Original floor'
            : ready && hex && !paintAvailable
              ? 'Preview'
              : 'After'}
        </span>
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
      {ready && hex && !paintAvailable && (
        <p className="pf-sub" role="status">
          Wall-color preview unavailable for this photo. The selected paint remains in your plan.
        </p>
      )}
      {allowDownload && (
        <div className="pf-preview-export">
          <button
            type="button"
            disabled={!ready || !!pending || !!error || floorUnavailable}
            onClick={download}
          >
            Download preview
          </button>
          {downloadError && <p role="alert">{downloadError}</p>}
        </div>
      )}
    </>
  );
}

// A photo-less room's thumbnail: its wall colour over its floor style.
function LookThumb({ pick }: { pick: RoomPick }) {
  const style = styleOf(pick);
  return (
    <span className="pf-look" aria-hidden="true">
      <i style={{ background: pick.color?.hex ?? '#e7e1d6' }} />
      {style ? (
        <img src={thumbnailUrl(swatchUrl(style))} alt="" loading="lazy" />
      ) : (
        <i className="pf-look-none" />
      )}
    </span>
  );
}

export function Room3D({
  room,
  ceilingFt,
  pick,
  renderActions = true,
  placements = [],
  selectedPlacement,
  onPlacementSelect,
  onPlacementMove,
  modelRender,
}: {
  room: StudioRoom;
  ceilingFt: number | null;
  pick: RoomPick;
  renderActions?: boolean;
  placements?: StudioPlacement[];
  selectedPlacement?: string | null;
  onPlacementSelect?: (id: string | null) => void;
  onPlacementMove?: (id: string, xM: number, zM: number) => void;
  modelRender?: StudioModelRenderContext;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<RoomScene | null>(null);
  const [error, setError] = useState('');
  const live = useRef({ onPlacementSelect, onPlacementMove, modelRender });
  live.current = { onPlacementSelect, onPlacementMove, modelRender };
  const look = {
    wallColor: pick.color?.hex ?? '#d9cfbf',
    floorFinish: floorFinish(room, pick),
    ...(styleOf(pick) ? { floorTexture: swatchUrl(styleOf(pick)!) } : {}),
    label: pick.color ? pick.color.name : 'Existing',
  };
  const sizeKey = `${room.size?.xFt}x${room.size?.yFt}x${ceilingFt}`;
  // Latest view state, applied once the lazily loaded scene mounts.
  const latest = useRef({ look, placements, selectedPlacement });
  latest.current = { look, placements, selectedPlacement };
  useEffect(() => {
    const model = roomModel(room, ceilingFt);
    if (!host.current || !model) return;
    let disposed = false;
    const mount = (mountRoomScene: typeof import('../room3d/room-scene.js').mountRoomScene) => {
      if (disposed || !host.current) return;
      scene.current = mountRoomScene(
        host.current,
        model,
        roomSurfaces(model, null),
        look,
        () => {},
        {
          sourceEvidenceId: null,
          title: room.title,
          renderActions,
          placements,
          onPlacementSelect: onPlacementSelect
            ? (id) => live.current.onPlacementSelect?.(id)
            : undefined,
          onPlacementMove: onPlacementMove
            ? (id, x, z) => live.current.onPlacementMove?.(id, x, z)
            : undefined,
          modelRender: modelRender
            ? {
                current: () => live.current.modelRender!.current(),
                initial: modelRender.initial,
                onRendered: modelRender.onRendered,
              }
            : undefined,
          onFurnitureError: setError,
        },
      );
      const now = latest.current;
      scene.current.setLook(now.look);
      scene.current.setPlacements(now.placements);
      scene.current.selectPlacement(now.selectedPlacement ?? null);
      setError('');
    };
    import('../room3d/room-scene.js')
      .then(({ mountRoomScene }) => mount(mountRoomScene))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : '3D needs WebGL in this browser.'),
      );
    return () => {
      disposed = true;
      scene.current?.dispose();
      scene.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, sizeKey, renderActions]);
  useEffect(() => {
    scene.current?.setLook(look);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [look.wallColor, look.floorFinish, look.floorTexture]);
  useEffect(() => {
    scene.current?.setPlacements(placements);
  }, [placements]);
  useEffect(() => {
    scene.current?.selectPlacement(selectedPlacement ?? null);
  }, [selectedPlacement]);
  return (
    <div className="pf-3d">
      <div ref={host} className="pf-3d-host" />
      <p className="pf-3d-basis">
        {room.sizeNote
          ? 'Room shell uses an estimated size.'
          : 'Room shell uses the entered dimensions.'}{' '}
        Furniture sizes and positions are editable concepts; openings and fit need checking.
      </p>
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
      <div className="pf-swatches" role="group" aria-label="Wall color">
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
          {browsing ? 'Close' : 'All colors'}
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
  sample,
  onFurnish,
}: {
  room: StudioRoom;
  busy: boolean;
  error: string;
  onImagine: (text: string) => void;
  sample?: SampleRoom;
  onFurnish?: () => void;
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
      <label htmlFor="pf-imagine-text">Paint & floors · {room.title}</label>
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
      {sample && (
        <div className="sample-room-suggestions" aria-label="Sample room suggestions">
          {sample.suggestions.map((suggestion) => (
            <button
              type="button"
              key={suggestion}
              disabled={busy}
              onClick={() => {
                setText(suggestion);
                document.getElementById('pf-imagine-text')?.focus();
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      {sample?.furnishingSuggestions?.length && onFurnish ? (
        <button type="button" className="sample-room-furnish" onClick={onFurnish}>
          Try furniture ideas <Glyph name="right" />
        </button>
      ) : null}
      {error && <StudioError message={error} />}
    </form>
  );
}

function ShoppingSheet({
  project,
  picks,
  items,
  takeoffs,
  tier,
  onClose,
  onPlan,
}: {
  project: HouseProject;
  picks: Record<string, RoomPick>;
  items: Record<string, StudioItem[]>;
  takeoffs: Record<string, ReturnType<typeof roomTakeoff>>;
  tier: TierKey;
  onClose: () => void;
  onPlan: () => void;
}) {
  const list = shoppingList(
    project,
    Object.fromEntries(Object.entries(picks).map(([id, pick]) => [id, { ...pick, ideas: [] }])),
    takeoffs,
  );
  const itemRooms = project.rooms.filter(
    (r) => (picks[r.id] ?? DEFAULT_PICK).included && items[r.id]?.length,
  );
  const itemText = itemRooms
    .map(
      (r) =>
        `${r.title} · furniture & decor\n${items[r.id]!.map((item) => {
          const total = studioItemBudget([item]).lines[0]!.totalMinor;
          return `- ${item.name}: ${item.action === 'keep' ? 'Keep mine' : `${item.quantity ?? '?'} × ${item.unitAllowanceMinor == null ? 'not priced' : money(item.unitAllowanceMinor)} · ${total == null ? 'not priced' : `${money(total)} owner allowance`}`}${item.url ? ` · ${item.url}` : ''}`;
        }).join('\n')}`,
    )
    .join('\n\n');
  const [copied, setCopied] = useState(false);
  const listText = `${shoppingText(project, list, tier)}\n\n${itemText}\nOwner allowances are not retailer prices. Confirm products, dimensions and fit.`;
  return (
    <div className="pf-list-backdrop" role="presentation" onClick={onClose}>
      <section
        className="pf-list"
        role="dialog"
        aria-modal="true"
        aria-label="Shopping list"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <p className="pf-kicker">Shopping list</p>
            <h2>{project.address}</h2>
            <p className="pf-sub">
              Paint & floor materials, {TIER_LABELS[tier].toLowerCase()} ·{' '}
              <b>{money(list.totalMinor)}</b>
            </p>
          </div>
          <div className="pf-list-actions">
            <button
              type="button"
              onClick={() => {
                const url = URL.createObjectURL(new Blob([listText], { type: 'text/plain' }));
                const link = document.createElement('a');
                link.href = url;
                link.download = 'renovagent-shopping-list.txt';
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 60_000);
              }}
            >
              Download list
            </button>
            <button type="button" onClick={onPlan}>
              Work plan & export
            </button>
            <button
              type="button"
              onClick={() =>
                void navigator.clipboard
                  ?.writeText(
                    `${shoppingText(project, list, tier)}\n\n${itemText}\nOwner allowances are not retailer prices. Confirm products, dimensions and fit.`,
                  )
                  .then(() => setCopied(true))
              }
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" onClick={() => window.print()}>
              Print
            </button>
            <button type="button" aria-label="Close" onClick={onClose}>
              <Glyph name="close" />
            </button>
          </div>
        </header>
        {list.rooms.length ? (
          <>
            <ol className="pf-list-rooms">
              {list.rooms.map((r) => (
                <li key={r.title}>
                  <div className="pf-list-room">
                    <b>{r.title}</b>
                    <span>{money(r.totalMinor)}</span>
                  </div>
                  {r.paint && <p>Walls · {r.paint}</p>}
                  {r.floor && <p>Floor · {r.floor}</p>}
                  {r.sizeBasis && <p>Planning estimate · {r.sizeBasis}</p>}
                  {r.ideas.length > 0 && (
                    <p className="pf-list-ideas">Not priced · {r.ideas.join(', ')}</p>
                  )}
                </li>
              ))}
            </ol>
            <h3>To buy</h3>
            <table className="pf-list-buy">
              <tbody>
                {list.buy.map((b) => (
                  <tr key={`${b.item}${b.unitPriceMinor}`}>
                    <td>{b.units} ×</td>
                    <td>
                      {b.item}
                      <small>{money(b.unitPriceMinor)} each</small>
                    </td>
                    <td>{money(b.totalMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="pf-empty">
            {project.rooms.some((r) => !r.size)
              ? 'Add each room’s size to price it, then the list fills in.'
              : 'Pick a color or a floor for a room to start the list.'}
          </p>
        )}
        {!!itemRooms.length && (
          <>
            <h3>Furniture & décor · your allowances</h3>
            {itemRooms.map((r) => (
              <div key={r.id}>
                <h4>{r.title}</h4>
                <ul className="pf-lines">
                  {items[r.id]!.map((item) => {
                    const total = studioItemBudget([item]).lines[0]!.totalMinor;
                    return (
                      <li key={item.id}>
                        <span>
                          {item.name}
                          <small>
                            {item.action === 'keep'
                              ? 'Keep mine'
                              : `${item.quantity ?? '?'} × ${item.unitAllowanceMinor == null ? 'not priced' : money(item.unitAllowanceMinor)}`}
                            {item.url && (
                              <>
                                {' '}
                                ·{' '}
                                <a href={item.url} target="_blank" rel="noreferrer">
                                  Product link ↗
                                </a>
                              </>
                            )}
                          </small>
                        </span>
                        <b>
                          {item.action === 'keep'
                            ? 'Keeping'
                            : total == null
                              ? 'Not priced'
                              : money(total)}
                        </b>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <p className="pf-fine">
              Owner allowances, not retailer quotes. Confirm products, dimensions and fit.
            </p>
          </>
        )}
        <p className="pf-fine">
          Example prices for this demo, not live offers. Quantities: 2 coats plus 10% paint, rounded
          up; floors by the room's area. Labour is quoted separately.
        </p>
      </section>
    </div>
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
  editSize = false,
  editCeiling = false,
  onSize,
  onCeiling,
}: {
  room: StudioRoom;
  ceilingFt: number | null;
  // Asks for the size even when one is known (an estimate being corrected).
  editSize?: boolean;
  editCeiling?: boolean;
  onSize: (size: { xFt: number; yFt: number }) => void;
  onCeiling?: (ft: number) => void;
}) {
  const [x, setX] = useState(room.size ? String(room.size.xFt) : '');
  const [y, setY] = useState(room.size ? String(room.size.yFt) : '');
  const [c, setC] = useState(ceilingFt ? String(ceilingFt) : '');
  const [error, setError] = useState('');
  const showSize = !room.size || editSize;
  const showCeiling = (!ceilingFt || editCeiling) && !!onCeiling;
  return (
    <form
      className="pf-size"
      onSubmit={(e) => {
        e.preventDefault();
        const xFt = parseFeet(x),
          yFt = parseFeet(y),
          cFt = parseFeet(c);
        if ((showSize && (!xFt || !yFt)) || (showCeiling && !cFt)) {
          setError('Enter dimensions greater than 0 and less than 200 feet.');
          return;
        }
        setError('');
        if (showSize && xFt && yFt) onSize({ xFt, yFt });
        if (showCeiling && cFt && onCeiling) onCeiling(cFt);
      }}
    >
      <h3>Room size</h3>
      <div>
        {showSize && (
          <>
            <label>
              Width · ft
              <input
                aria-label="Width in feet"
                placeholder="12′"
                inputMode="decimal"
                value={x}
                onChange={(e) => setX(e.target.value)}
              />
            </label>
            <span aria-hidden="true">×</span>
            <label>
              Length · ft
              <input
                aria-label="Length in feet"
                placeholder="14′"
                inputMode="decimal"
                value={y}
                onChange={(e) => setY(e.target.value)}
              />
            </label>
          </>
        )}
        {showCeiling && (
          <label>
            Height · ft
            <input
              aria-label="Ceiling height in feet"
              placeholder="Ceiling 8′"
              inputMode="decimal"
              value={c}
              onChange={(e) => setC(e.target.value)}
            />
          </label>
        )}
        <button type="submit">Set</button>
      </div>
      {error && <p role="alert">{error}</p>}
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
  savedDesign,
  initialDesign,
  autoImagine = true,
  autoSave = false,
  intake,
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
  savedDesign?: SavedStudioDesign;
  // Validated bundled proposal, used only when this example has no browser draft.
  initialDesign?: StudioDesign;
  // Own photos open before analysis; defer automatic finish choices until sizes are ready.
  autoImagine?: boolean;
  autoSave?: boolean;
  intake?: StudioDesign['intake'];
}) {
  const localScope = savedDesign
    ? `${project.id}.saved.${savedDesign.projectId}.${savedDesign.revision}`
    : project.id;
  const [roomId, setRoomIdState] = useState(project.rooms[0]?.id ?? '');
  const setRoomId = (id: string) => {
    setApplied(false);
    setEditSize(false);
    setRoomIdState(id);
  };
  // A room with no photo (a plan an agent saved) is shown in 3D.
  const [view, setView] = useState<'photo' | '3d' | 'inspired'>(
    savedDesign?.snapshot.modelRenders?.[project.rooms[0]?.id ?? '']
      ? '3d'
      : savedDesign?.snapshot.inspired[project.rooms[0]?.id ?? '']
        ? 'inspired'
        : initialDesign?.inspired[project.rooms[0]?.id ?? '']
          ? 'inspired'
          : project.rooms[0]?.photo.src
            ? 'photo'
            : '3d',
  );
  // A room restyled from an inspiration photo, kept in this browser.
  const inspiredStore = `renovagent.studio.${localScope}.inspired.v1`;
  const [inspired, setInspired] = useState<Record<string, string>>(() => {
    if (savedDesign) return savedDesign.snapshot.inspired;
    try {
      return (JSON.parse(localStorage.getItem(inspiredStore) || 'null') ??
        initialDesign?.inspired ??
        {}) as Record<string, string>;
    } catch {
      return initialDesign?.inspired ?? {};
    }
  });
  const keepInspired = (id: string, src: string) =>
    setInspired((current) => {
      const next = { ...current, [id]: src };
      try {
        localStorage.setItem(inspiredStore, JSON.stringify(next));
      } catch {
        // Shown for this visit.
      }
      return next;
    });
  const [tier, setTier] = useState<TierKey>(() => {
    if (savedDesign) return savedDesign.snapshot.tier;
    try {
      const saved = localStorage.getItem(`renovagent.studio.${localScope}.tier.v1`);
      if (saved === 'builder' || saved === 'mid' || saved === 'high') return saved;
    } catch {
      /* Defaults work when storage is unavailable. */
    }
    return project.tier ?? 'mid';
  });
  useEffect(() => {
    try {
      localStorage.setItem(`renovagent.studio.${localScope}.tier.v1`, tier);
    } catch {
      /* Kept for this visit. */
    }
  }, [project.id, tier]);
  // Any style shows on a photo-less room (as the 3D floor); a photo needs its image.
  const canShow = (r: StudioRoom, style: string) =>
    !r.photo.src || !!floorImage(r, style) || !!renderFloor;
  const [picks, setPicks] = useState<Record<string, RoomPick>>(
    () => savedDesign?.snapshot.picks ?? loadPicks({ ...project, id: localScope }),
  );
  const itemStore = `renovagent.studio.${localScope}.items.v1`;
  const [items, setItems] = useState<Record<string, StudioItem[]>>(() => {
    if (savedDesign?.snapshot.items) return savedDesign.snapshot.items;
    try {
      const stored = JSON.parse(localStorage.getItem(itemStore) || '{}');
      return Object.fromEntries(
        project.rooms.map((r) => [
          r.id,
          Array.isArray(stored[r.id])
            ? stored[r.id].flatMap((i: unknown) => {
                const p = studioItemSchema.safeParse(i);
                return p.success ? [p.data] : [];
              })
            : (initialDesign?.items?.[r.id] ??
              (picks[r.id]?.ideas ?? []).map((name) => ({
                id: crypto.randomUUID(),
                name,
                category: 'other' as const,
                action: 'add' as const,
                quantity: null,
                unitAllowanceMinor: null,
              }))),
        ]),
      );
    } catch {
      return initialDesign?.items ?? {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(itemStore, JSON.stringify(items));
    } catch {
      /* Visible for this visit. */
    }
  }, [itemStore, items]);
  const addDesignItems = (id: string, names: string[]) =>
    setItems((current) => {
      const existing = current[id] ?? [];
      const seen = new Set(existing.map((i) => i.name.trim().toLowerCase()));
      const added = names
        .filter(
          (name) =>
            name.trim() &&
            !seen.has(name.trim().toLowerCase()) &&
            seen.add(name.trim().toLowerCase()),
        )
        .map(
          (name): StudioItem => ({
            id: crypto.randomUUID(),
            name: name.trim().slice(0, 200),
            category: /lamp|pendant|sconce|light|chandelier/i.test(name)
              ? 'lighting'
              : /rug|throw|curtain|plant|pillow|cushion|artwork/i.test(name)
                ? 'decor'
                : 'furniture',
            action: 'add',
            quantity: null,
            unitAllowanceMinor: null,
          }),
        );
      return added.length ? { ...current, [id]: [...existing, ...added].slice(0, 100) } : current;
    });
  const effectivePicks = Object.fromEntries(
    project.rooms.map((r) => [
      r.id,
      {
        ...(picks[r.id] ?? DEFAULT_PICK),
        ideas: (items[r.id] ?? []).filter((i) => i.action !== 'keep').map((i) => i.name),
      },
    ]),
  );
  const placementStore = `renovagent.studio.${localScope}.placements.v1`;
  const [placements, setPlacements] = useState<Record<string, StudioPlacement[]>>(() => {
    if (savedDesign) return savedDesign.snapshot.placements ?? {};
    try {
      const raw = JSON.parse(localStorage.getItem(placementStore) || '{}');
      return Object.fromEntries(
        project.rooms.map((r) => [
          r.id,
          Array.isArray(raw[r.id])
            ? raw[r.id].flatMap((p: unknown) => {
                const parsed = studioPlacementSchema.safeParse(p);
                return parsed.success ? [parsed.data] : [];
              })
            : (initialDesign?.placements?.[r.id] ?? []),
        ]),
      );
    } catch {
      return initialDesign?.placements ?? {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(placementStore, JSON.stringify(placements));
    } catch {
      /* Saved project remains available. */
    }
  }, [placementStore, placements]);
  const renderStore = `renovagent.studio.${localScope}.model-renders.v1`;
  const [modelRenders, setModelRenders] = useState<
    Record<string, { image: string; signature: string }>
  >(() => {
    if (savedDesign) return savedDesign.snapshot.modelRenders ?? {};
    try {
      const raw = JSON.parse(localStorage.getItem(renderStore) || '{}');
      return studioDesignSchema.shape.modelRenders.parse(raw) ?? {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(renderStore, JSON.stringify(modelRenders));
    } catch {
      /* Saved project remains available. */
    }
  }, [renderStore, modelRenders]);
  const [selectedPlacement, setSelectedPlacement] = useState<string | null>(null);
  const [inspector, setInspector] = useState<'design' | 'layout' | 'finishes' | 'plan'>('finishes');
  const [openedDesignRoom, setOpenedDesignRoom] = useState('');
  useEffect(() => {
    if (inspector === 'design') setOpenedDesignRoom(roomId);
  }, [inspector, roomId]);
  const wide = useMediaQuery(WIDE_STUDIO);
  const planRef = useRef<HTMLElement>(null);
  // On desktop the plan is always visible under the photo, so it is not a tab.
  const shownTab = wide && inspector === 'plan' ? 'finishes' : inspector;
  const showPlan = () => {
    if (wide) planRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else setInspector('plan');
  };
  const addAssets = (target: StudioRoom, ids: StudioAssetId[]) => {
    const model = roomModel(target, project.ceilingFt);
    if (!model) return;
    const existing = placements[target.id] ?? [];
    const nextItems = [...(items[target.id] ?? [])];
    const next = [...existing];
    for (const assetId of ids) {
      if (next.length >= 60 || nextItems.length >= 100) break;
      const asset = studioAsset(assetId);
      let item = nextItems.find(
        (i) =>
          !next.some((p) => p.itemId === i.id) &&
          assetId.split('-').every((word) => i.name.toLowerCase().includes(word)),
      );
      if (!item) {
        item = {
          id: crypto.randomUUID(),
          name: asset.name,
          category: asset.category,
          action: 'add',
          quantity: 1,
          unitAllowanceMinor: null,
        };
        nextItems.push(item);
      }
      next.push({
        id: crypto.randomUUID(),
        itemId: item.id,
        assetId,
        ...studioPlacementStart(assetId, model),
      });
    }
    setItems((current) => ({ ...current, [target.id]: nextItems }));
    setPlacements((current) => ({ ...current, [target.id]: next }));
    setSelectedPlacement(next.at(-1)?.id ?? null);
    setView('3d');
    setInspector('layout');
  };
  const [styling, setStyling] = useState<Record<string, StylingDraft>>(
    () =>
      savedDesign?.snapshot.styling ??
      Object.fromEntries(
        project.rooms.flatMap((r) => {
          const d = stylingDraft(localScope, r) ?? initialDesign?.styling[r.id];
          return d ? [[r.id, d]] : [];
        }),
      ),
  );
  const onStylingChange = useCallback(
    (id: string, draft: StylingDraft) =>
      setStyling((current) =>
        (!current[id] &&
          !draft.inspo &&
          !draft.paint &&
          !draft.keep.trim() &&
          !draft.brief?.trim() &&
          !draft.versions?.length &&
          !draft.ideas &&
          !draft.changes.length &&
          !draft.resultSignature) ||
        JSON.stringify(current[id]) === JSON.stringify(draft)
          ? current
          : { ...current, [id]: draft },
      ),
    [],
  );
  const [stylingStale, setStylingStale] = useState<Record<string, boolean>>({});
  const onStylingStale = useCallback(
    (id: string, stale: boolean) =>
      setStylingStale((current) => (current[id] === stale ? current : { ...current, [id]: stale })),
    [],
  );
  const [renderSignatures, setRenderSignatures] = useState<Record<string, string>>(() => {
    if (savedDesign) return savedDesign.snapshot.renderSignatures;
    try {
      return (JSON.parse(localStorage.getItem(`${inspiredStore}.looks`) || 'null') ??
        initialDesign?.renderSignatures ??
        {}) as Record<string, string>;
    } catch {
      return initialDesign?.renderSignatures ?? {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(`${inspiredStore}.looks`, JSON.stringify(renderSignatures));
    } catch {
      /* Kept for this visit. */
    }
  }, [inspiredStore, renderSignatures]);
  const saveKey = `renovagent.studio.${localScope}.saved.v1`;
  const [saveMeta, setSaveMeta] = useState<{ projectId: string; revision: number } | null>(() => {
    if (savedDesign) return { projectId: savedDesign.projectId, revision: savedDesign.revision };
    try {
      const m = JSON.parse(localStorage.getItem(saveKey) || 'null');
      return typeof m?.projectId === 'string' && Number.isInteger(m.revision) && m.revision > 0
        ? m
        : null;
    } catch {
      return null;
    }
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveAccess, setSaveAccess] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const snapshot = {
    kind: 'studio-design' as const,
    intake,
    basis:
      savedDesign?.snapshot.basis ??
      initialDesign?.basis ??
      (/example|prepared sample/i.test(kicker)
        ? ('listing-example' as const)
        : ('owner-studio' as const)),
    project: {
      id: project.id,
      address: project.address,
      place: project.place,
      listing: project.listing,
      ceilingFt: project.ceilingFt,
      ceilingNote: project.ceilingNote,
      idea: project.idea,
      rooms: project.rooms.map((r) => ({
        id: r.id,
        title: r.title,
        existingFloor: r.existingFloor,
        photo: { src: r.photo.src, walls: validMasks(r.photo.walls) },
        floors: Object.fromEntries(
          Object.entries(r.floors).flatMap(([style, f]) =>
            f ? [[style, { src: f.src, walls: validMasks(f.walls) }]] : [],
          ),
        ),
        size: r.size,
        sizeNote: r.sizeNote,
        plan: r.plan,
      })),
    },
    picks: effectivePicks,
    tier,
    inspired,
    renderSignatures,
    styling,
    items,
    placements,
    modelRenders,
  };
  const validatedSnapshot = studioDesignSchema.safeParse(snapshot);
  const snapshotJson = JSON.stringify(
    validatedSnapshot.success ? validatedSnapshot.data : snapshot,
  );
  const [savedJson, setSavedJson] = useState(() => {
    try {
      if (pendingStudioSave(JSON.parse(localStorage.getItem(`${saveKey}.pending`) || 'null')))
        return '';
    } catch {}
    if (savedDesign) return JSON.stringify(savedDesign.snapshot);
    try {
      const saved = JSON.parse(localStorage.getItem(saveKey) || 'null');
      if (typeof saved?.json === 'string') return saved.json;
    } catch {}
    return '';
  });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const writer = useRef<StudioSync | null>(null);
  const saveLocation = useRef({ autoSave, savedDesign: !!savedDesign });
  saveLocation.current = { autoSave, savedDesign: !!savedDesign };
  if (!writer.current) {
    let pending: unknown = null;
    try {
      pending = pendingStudioSave(JSON.parse(localStorage.getItem(`${saveKey}.pending`) || 'null'));
    } catch {}
    writer.current = new StudioSync({
      meta: saveMeta,
      acknowledged: savedJson,
      pending,
      requestId: () => crypto.randomUUID(),
      send: async (request) =>
        (await workspaceRequest('/studio-designs', request)) as StudioSaveMeta,
      persist: (request) => {
        try {
          if (request) localStorage.setItem(`${saveKey}.pending`, JSON.stringify(request));
          else localStorage.removeItem(`${saveKey}.pending`);
        } catch {}
      },
      onSaved: (meta, json) => {
        if (alive.current) {
          setSaveMeta(meta);
          setSavedJson(json);
        }
        // Keep new own studios on their recoverable browser route; saved links advance.
        if (alive.current && (!saveLocation.current.autoSave || saveLocation.current.savedDesign))
          window.history.replaceState(
            null,
            '',
            `#design/${encodeURIComponent(meta.projectId)}/${meta.revision}`,
          );
        try {
          localStorage.setItem(saveKey, JSON.stringify({ ...meta, json }));
        } catch {}
      },
    });
  }
  const save = async () => {
    if (saveMeta && savedJson === snapshotJson && !writer.current?.hasPending) return saveMeta;
    setSaving(true);
    setSaveError('');
    setSaveAccess(false);
    setLinkCopied(false);
    try {
      const parsed = validatedSnapshot;
      if (!parsed.success)
        throw new Error(
          `This design cannot be saved: ${parsed.error.issues[0]?.path.join('.')} ${parsed.error.issues[0]?.message}`,
        );
      return await writer.current!.sync(parsed.data);
    } catch (e) {
      if (e instanceof DomainError && e.code === 'FORBIDDEN') setSaveAccess(true);
      setSaveError(e instanceof Error ? e.message : 'Could not save the project');
      return null;
    } finally {
      setSaving(false);
    }
  };
  const latestSave = useRef(save);
  latestSave.current = save;
  useEffect(() => {
    if (!autoSave || saving || saveAccess || saveError || savedJson === snapshotJson) return;
    const timer = setTimeout(() => void latestSave.current(), 750);
    return () => clearTimeout(timer);
  }, [autoSave, snapshotJson, savedJson, saving, saveAccess, saveError]);
  const [working, setWorking] = useState<Record<string, string>>({});
  const [floorErrors, setFloorErrors] = useState<Record<string, string>>({});
  const [editCeiling, setEditCeiling] = useState(false);
  const [editSize, setEditSize] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const room = project.rooms.find((r) => r.id === roomId) ?? project.rooms[0];
  const pick = (room && picks[room.id]) ?? DEFAULT_PICK;
  const ceilingFt = project.ceilingFt;
  const updateRoom = (id: string, next: Partial<RoomPick>) =>
    setPicks((current) => {
      const all = { ...current, [id]: { ...(current[id] ?? DEFAULT_PICK), ...next } };
      try {
        localStorage.setItem(pickStore(localScope), JSON.stringify(all));
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
          const shows = !style || canShow(r, style);
          return [
            r.id,
            {
              ...own,
              color: look.color,
              paintLine: look.paintLine,
              sheen: look.sheen,
              ...(shows ? { floor: look.floor, floorStyle: look.floorStyle } : {}),
            } as RoomPick,
          ];
        }),
      );
      try {
        localStorage.setItem(pickStore(localScope), JSON.stringify(all));
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
      const style = idea.floorStyle && canShow(target, idea.floorStyle) ? idea.floorStyle : null;
      const current = picks[target.id] ?? DEFAULT_PICK;
      const material = idea.material ?? (current.floor === 'keep' ? 'lvp' : current.floor);
      updateRoom(target.id, {
        ...(color ? { color } : {}),
        ...(idea.sheen ? { sheen: idea.sheen } : {}),
        ...(style ? { floorStyle: style, floor: material } : {}),
        ideas: [...new Set([...(current.ideas ?? []), ...idea.extras])],
      });
      addDesignItems(target.id, idea.extras);
      setImagining({ busy: false, error: '' });
      return true;
    } catch (e) {
      setImagining({
        busy: false,
        error: e instanceof Error ? e.message.slice(0, 160) : 'That could not be read.',
      });
      return false;
    }
  };
  const ideaUsed = useRef(false);
  useEffect(() => {
    const first = project.rooms[0];
    if (!autoImagine || !project.idea || !first || ideaUsed.current) return;
    ideaUsed.current = true;
    // A description given for the whole project applies to every room.
    void imagine(project.idea, first)
      .then((ok) => ok && applyEverywhere(first))
      .finally(() => onIdeaUsed?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.idea, autoImagine]);
  // A floor that is picked but not made yet is rendered once, on demand.
  const pickedStyle = styleOf(pick);
  const missing =
    room?.photo.src && pickedStyle && !floorImage(room, pickedStyle) ? pickedStyle : null;
  const workKey = room && missing ? `${room.id}:${missing}` : '';
  useEffect(() => {
    if (!room || !missing || !renderFloor || working[workKey] || floorErrors[workKey]) return;
    const label = (FLOOR_STYLES.find((f) => f.id === missing)?.label ?? 'the floor').toLowerCase();
    setWorking((w) => ({ ...w, [workKey]: `Laying ${label}…` }));
    setFloorErrors((errors) => ({ ...errors, [workKey]: '' }));
    renderFloor(room.id, missing)
      .catch((e) =>
        setFloorErrors((errors) => ({
          ...errors,
          [workKey]: e instanceof Error ? e.message : 'The floor could not be made.',
        })),
      )
      .finally(() => setWorking((w) => ({ ...w, [workKey]: '' })));
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
  const sample = sampleForPhoto(room.photo.src);
  const takeoff = takeoffs[room.id]!;
  const included = project.rooms.filter((r) => (picks[r.id] ?? DEFAULT_PICK).included);
  const houseTotal = included.reduce((sum, r) => sum + takeoffs[r.id]!.totalMinor, 0);
  const itemBudget = studioItemBudget(included.flatMap((r) => items[r.id] ?? []));
  // Finishes are priced from the room size; an unsized room is unpriced, not $0.
  const unsized = included.filter((r) => !r.size).length;
  const estimated = included.filter((r) => r.sizeNote || project.ceilingNote).length;
  const headerTotal = houseTotal + itemBudget.allowanceMinor;
  const has3d = !!roomModel(room, ceilingFt);
  const photoless = !room.photo.src;
  const needsSize = !room.size || !ceilingFt;
  const shownImage = pickedStyle ? floorImage(room, pickedStyle) : room.photo;
  const pending = (workKey && working[workKey]) || null;
  const roomPlan = (
    <RoomPlan
      key={room.id}
      items={items[room.id] ?? []}
      onChange={(next) => {
        setItems((current) => ({ ...current, [room.id]: next }));
        setPlacements((current) => ({
          ...current,
          [room.id]: (current[room.id] ?? []).filter((p) => next.some((i) => i.id === p.itemId)),
        }));
      }}
      finishesMinor={takeoff.totalMinor}
      finishesIncomplete={needsSize && !!(pick.color || pick.floor)}
      estimateNote={
        room.sizeNote || project.ceilingNote
          ? 'Planning estimate · check room dimensions'
          : undefined
      }
      versionKey={snapshotJson}
      onPrepare={async () => {
        const meta = await save();
        if (!meta) throw new Error('Save the project before preparing its work plan.');
        return (await workspaceRequest('/studio-designs/prepare-scope', {
          ...meta,
          roomId: room.id,
          requestId: crypto.randomUUID(),
        })) as StudioHandoff;
      }}
    />
  );
  return (
    <section className="pf-studio" aria-label={`${project.address} room studio`}>
      <header className="pf-head">
        <div>
          <p className="pf-kicker">{kicker}</p>
          <h1>{project.address}</h1>
          {sample && (
            <details className="sample-room-info">
              <summary title={`${sample.source} · ${sample.license}`}>Sample room ⓘ</summary>
              <p>
                {sample.sourceUrl ? (
                  <a href={sample.sourceUrl} target="_blank" rel="noreferrer">
                    {sample.source}
                  </a>
                ) : (
                  sample.source
                )}
                <br />
                {sample.licenseUrl ? (
                  <a href={sample.licenseUrl} target="_blank" rel="noreferrer">
                    {sample.license}
                  </a>
                ) : (
                  sample.license
                )}
              </p>
            </details>
          )}

          {(project.place || project.listing) && (
            <p className="pf-sub">
              {project.place}
              {project.place && project.listing ? ' · ' : ''}
              {project.listing && (
                <a
                  className="pf-listing-link"
                  href={project.listing}
                  target="_blank"
                  rel="noreferrer"
                >
                  {project.id.startsWith('starter-') ? 'Photo source ↗' : 'View listing ↗'}
                </a>
              )}
            </p>
          )}
        </div>
        <div className="pf-head-side">
          <button type="button" className="pf-reset" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save project'}
          </button>
          <button type="button" className="pf-reset" onClick={() => setListOpen(true)}>
            Shopping list
          </button>
          {actions}
          <div className="pf-total" aria-live="polite">
            <span>
              Budget so far · {included.length} room{included.length === 1 ? '' : 's'}
            </span>
            <strong>
              {headerTotal || !unsized ? (
                <RollingNumber value={headerTotal} format={money} />
              ) : (
                'Not priced yet'
              )}
            </strong>
            <span>{estimated ? 'Estimated · demo prices' : 'Demo prices'}</span>
            <small>
              {unsized
                ? `${unsized} room${unsized === 1 ? ' needs' : 's need'} a size`
                : itemBudget.unpriced
                  ? `${itemBudget.unpriced} items to price`
                  : TIER_LABELS[tier]}
            </small>
          </div>
        </div>
      </header>
      {(autoSave || saveMeta || saveError) && (
        <div className="pf-save-status" role="status">
          {saveError ? (
            `Sync failed: ${saveError}`
          ) : !saveMeta ? (
            saving ? (
              'Saving your room to your workspace…'
            ) : (
              'Changes waiting to sync…'
            )
          ) : (
            <>
              <span>
                {saving
                  ? 'Syncing'
                  : savedJson === snapshotJson
                    ? 'Saved to your workspace'
                    : 'Changes waiting to sync'}{' '}
                · revision {saveMeta!.revision}
              </span>
              <a href={`#design/${encodeURIComponent(saveMeta!.projectId)}/${saveMeta!.revision}`}>
                Open saved revision
              </a>
              <small>Project {saveMeta!.projectId} · private to your account</small>
              <button
                type="button"
                onClick={() => {
                  const url = new URL(
                    `#design/${encodeURIComponent(saveMeta!.projectId)}/${saveMeta!.revision}`,
                    window.location.href,
                  ).href;
                  void navigator.clipboard.writeText(url).then(
                    () => setLinkCopied(true),
                    () => setSaveError(`Copy this private project link: ${url}`),
                  );
                }}
              >
                {linkCopied ? 'Link copied' : 'Copy project link'}
              </button>
            </>
          )}
        </div>
      )}
      {saveAccess && (
        <div className="pf-studio-access">
          <p>Continue as a guest to save this design. Your current choices stay here.</p>
          <SignInChoices
            onSignedIn={async () => {
              await save();
            }}
          />
        </div>
      )}

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
              {r.photo.src ? (
                <img src={thumbnailUrl(r.photo.src)} alt="" loading="lazy" decoding="async" />
              ) : (
                <LookThumb pick={p} />
              )}
              <span className="pf-room-name" title={r.title}>
                {r.title}
              </span>
              <span className="pf-room-meta">
                <i style={{ background: p.color?.hex ?? 'transparent' }} />
                {!p.included
                  ? 'Deferred'
                  : !r.size && !studioItemBudget(items[r.id] ?? []).allowanceMinor
                    ? 'Needs size'
                    : money(
                        takeoffs[r.id]!.totalMinor +
                          studioItemBudget(items[r.id] ?? []).allowanceMinor,
                      )}
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
              {needsSize && onEditRoom && (
                <button
                  type="button"
                  className="pf-ceiling"
                  onClick={() => {
                    setInspector('finishes');
                    setEditSize(!room.size);
                  }}
                >
                  Add room measurements
                </button>
              )}
              {room.size && (
                <span>
                  {onEditRoom ? (
                    <button
                      type="button"
                      className="pf-ceiling"
                      title={room.sizeNote ?? 'Change room measurements'}
                      aria-label="Edit room measurements"
                      onClick={() => {
                        setEditSize(true);
                        setInspector('finishes');
                      }}
                    >
                      {room.sizeNote ? '≈' : ''}
                      {feetInches(room.size.xFt)} × {feetInches(room.size.yFt)} · Edit
                    </button>
                  ) : (
                    `${feetInches(room.size.xFt)} × ${feetInches(room.size.yFt)}`
                  )}
                  {ceilingFt && ' · '}
                  {ceilingFt && onCeiling ? (
                    <button
                      type="button"
                      className="pf-ceiling"
                      title={project.ceilingNote ?? 'Change the ceiling height'}
                      onClick={() => {
                        setEditCeiling(true);
                        setInspector('finishes');
                      }}
                    >
                      {project.ceilingNote ? '≈' : ''}
                      {feetInches(ceilingFt)} ceilings
                    </button>
                  ) : ceilingFt ? (
                    `${feetInches(ceilingFt)} ceilings`
                  ) : null}
                </span>
              )}
              {(room.sizeNote || project.ceilingNote) && (
                <small className="pf-size-note">
                  {[room.sizeNote, project.ceilingNote].filter(Boolean).join(' · ')}
                </small>
              )}
            </div>
            {((has3d && !photoless) || inspired[room.id]) && (
              <div className="pf-views" role="tablist" aria-label="View">
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'photo'}
                  onClick={() => setView('photo')}
                >
                  <Glyph name="photo" /> Before / after
                </button>
                {has3d && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view === '3d'}
                    onClick={() => setView('3d')}
                  >
                    <Glyph name="layers" /> 3D room
                  </button>
                )}
                {inspired[room.id] && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view === 'inspired'}
                    onClick={() => setView('inspired')}
                  >
                    <Glyph name="paint" /> Room design
                  </button>
                )}
              </div>
            )}
          </div>
          {view === 'inspired' && inspired[room.id] && room.photo.src ? (
            <div>
              {(stylingStale[room.id] || renderSignatures[room.id] !== lookSignature(pick)) && (
                <p className="pf-styling-stale" role="status">
                  Previous design — choices have changed. Generate a new room design to apply them.
                </p>
              )}
              <InspiredView before={room.photo.src} after={inspired[room.id]!} />
            </div>
          ) : (view === '3d' || photoless) && has3d ? (
            <Room3D
              room={room}
              ceilingFt={ceilingFt}
              pick={pick}
              placements={(placements[room.id] ?? []).filter((p) =>
                (items[room.id] ?? []).some((i) => i.id === p.itemId),
              )}
              selectedPlacement={selectedPlacement}
              onPlacementSelect={(id) => {
                setSelectedPlacement(id);
                if (id) setInspector('layout');
              }}
              onPlacementMove={(id, xM, zM) =>
                setPlacements((all) => ({
                  ...all,
                  [room.id]: (all[room.id] ?? []).map((p) => (p.id === id ? { ...p, xM, zM } : p)),
                }))
              }
              modelRender={{
                current: () => ({
                  placements: (placements[room.id] ?? []).filter((p) =>
                    (items[room.id] ?? []).some((i) => i.id === p.itemId),
                  ),
                  signature: JSON.stringify({
                    model: roomModel(room, ceilingFt),
                    look: lookSignature(pick),
                    placements: placements[room.id] ?? [],
                  }),
                }),
                initial: modelRenders[room.id],
                onRendered: (image, signature) =>
                  setModelRenders((all) => ({ ...all, [room.id]: { image, signature } })),
              }}
            />
          ) : (
            <BeforeAfter
              room={room}
              pick={pick}
              pending={pending || null}
              floorUnavailable={!!(workKey && floorErrors[workKey])}
              allowDownload
            />
          )}
          {workKey && floorErrors[workKey] && <StudioError message={floorErrors[workKey]} />}
          {wide && (
            <section className="pf-stage-plan" ref={planRef} aria-label="Plan and budget">
              {roomPlan}
            </section>
          )}
        </div>

        <aside className="pf-panel" aria-label="Choices and materials">
          <div className="pf-inspector-tabs" role="tablist" aria-label="Studio tools">
            {(
              [
                { id: 'design', label: 'Restyle' },
                { id: 'layout', label: '3D layout' },
                { id: 'finishes', label: 'Paint & floor' },
                { id: 'plan', label: 'Plan & budget' },
              ] as const
            )
              .filter((tab) => !(wide && tab.id === 'plan'))
              .map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={shownTab === tab.id}
                  onClick={() => {
                    setInspector(tab.id);
                    if (tab.id === 'layout' && has3d) setView('3d');
                  }}
                >
                  {tab.label}
                </button>
              ))}
          </div>
          <div hidden={shownTab !== 'design'}>
            {(shownTab === 'design' || openedDesignRoom === room.id) && (
              <InspoPanel
                key={`${project.id}:${room.id}`}
                projectId={localScope}
                initialDraft={styling[room.id] ?? (savedDesign ? null : undefined)}
                finishSignature={lookSignature(pick)}
                onStale={onStylingStale}
                onDraftChange={onStylingChange}
                designItems={items[room.id] ?? []}
                initialBrief={project.idea}
                sampleRoom={sample}
                currentColor={pick.color}
                basePhotoSrc={shownImage?.src || room.photo.src}
                floorPending={!!missing && !!renderFloor}
                onDesignItems={(names) => addDesignItems(room.id, names)}
                onIdeaLayout={(ids) =>
                  addAssets(
                    room,
                    ids.filter((id) => !(placements[room.id] ?? []).some((p) => p.assetId === id)),
                  )
                }
                room={room}
                onPaint={(color) => update({ color })}
                onRestyled={(src, sourceFinishSignature) => {
                  keepInspired(room.id, src);
                  setRenderSignatures((current) => ({
                    ...current,
                    [room.id]: sourceFinishSignature ?? lookSignature(pick),
                  }));
                  setView('inspired');
                }}
              />
            )}
          </div>
          <div hidden={shownTab !== 'layout'}>
            {shownTab === 'layout' && (
              <FurniturePanel
                model={roomModel(room, ceilingFt)}
                placements={placements[room.id] ?? []}
                items={items[room.id] ?? []}
                selected={selectedPlacement}
                onSelect={(id) => {
                  setSelectedPlacement(id);
                  setView('3d');
                }}
                onChange={(next) => setPlacements((all) => ({ ...all, [room.id]: next }))}
                onAdd={(id) => addAssets(room, [id])}
              />
            )}
          </div>
          <div hidden={shownTab !== 'finishes'}>
            <Imagine
              key={`imagine-${room.id}`}
              room={room}
              sample={sample}
              onFurnish={() => setInspector('design')}
              busy={imagining.busy}
              error={imagining.error}
              onImagine={(text) => void imagine(text, room)}
            />
            {roomTools?.(room)}
            {((needsSize && onEditRoom) || editCeiling || editSize) && (
              <SizeEntry
                key={`size-${room.id}-${editSize}-${editCeiling}`}
                room={room}
                ceilingFt={ceilingFt}
                editSize={editSize}
                editCeiling={editCeiling}
                onSize={(size) => {
                  // A typed size is the owner's, no longer an estimate.
                  onEditRoom?.(room.id, { size, sizeNote: undefined });
                  setEditSize(false);
                }}
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
                  {photoless ? (
                    <span className="pf-look-none" />
                  ) : (
                    <img src={thumbnailUrl(room.photo.src)} alt="" />
                  )}
                  <span>Keep</span>
                </button>
                {FLOOR_STYLES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="pf-floor-style"
                    aria-pressed={pickedStyle === f.id}
                    disabled={!canShow(room, f.id)}
                    onClick={() =>
                      update({
                        floorStyle: f.id,
                        floor: pick.floor === 'keep' ? 'lvp' : pick.floor,
                      })
                    }
                  >
                    <img src={thumbnailUrl(swatchUrl(f.id))} alt="" loading="lazy" />
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
                  Paint & floor <span className="pf-badge">Demo prices</span>
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
                  {needsSize ? 'Add the room size to price it.' : 'Pick a color or a floor.'}
                </p>
              )}
              {effectivePicks[room.id]?.ideas?.length ? (
                <p className="pf-ideas">
                  <span>In your room list · allowances in Plan & budget</span>
                  {effectivePicks[room.id]!.ideas!.join(' · ')}
                </p>
              ) : null}
              <div className="pf-subtotal">
                <span>Materials</span>
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
          </div>
          {!wide && <div hidden={shownTab !== 'plan'}>{roomPlan}</div>}
        </aside>
      </div>

      {listOpen && (
        <ShoppingSheet
          project={project}
          picks={effectivePicks}
          items={items}
          takeoffs={takeoffs}
          tier={tier}
          onClose={() => setListOpen(false)}
          onPlan={() => {
            setListOpen(false);
            showPlan();
          }}
        />
      )}
      {sources && (
        <details className="pf-sources">
          <summary>Sources</summary>
          {sources}
        </details>
      )}
    </section>
  );
}
