import './shared-design.css';
import { studioAssetAvailable } from '../room3d/available-assets.js';
import { RoomDiagram } from './room-diagram.js';
import { useDesignHistory } from './use-design-history.js';
import { Modal } from '../../components/modal.js';
import { sampleForPhoto, type SampleRoom } from '../project-start/sample-rooms.js';
import { thumbnailUrl } from './ui-thumbnails.js';
import { StudioError } from './studio-error.js';
import { studioFinishSignature as lookSignature } from './studio-signatures.js';
import { StudioSync, pendingStudioSave, type StudioSaveMeta } from './studio-sync.js';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  DomainError,
  studioDesignSchema,
  studioItemSchema,
  type StudioDesign,
  type StudioItem,
} from '@renovagent/contracts';
import {
  DEMO_FURNITURE_ALLOWANCES,
  nearestPaint,
  roomSurfaces,
  studioItemBudget,
} from '@renovagent/core';
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
import {
  studioAsset,
  studioPlacementStart,
  studioItemModelSuggestions,
  studioPresetStarts,
} from '@renovagent/core';
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
  compare = true,
}: {
  room: StudioRoom;
  pick: RoomPick;
  pending: string | null;
  floorUnavailable?: boolean;
  allowDownload?: boolean;
  compare?: boolean;
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
        className={`pf-compare${compare ? '' : ' pf-design-only'}`}
        style={{ ['--split' as string]: `${compare ? split : 100}%`, aspectRatio: ratio }}
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
  onPlacementRotate,
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
  onPlacementRotate?: (id: string, degrees: number) => void;
  modelRender?: StudioModelRenderContext;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<RoomScene | null>(null);
  const [error, setError] = useState('');
  const live = useRef({ onPlacementSelect, onPlacementMove, onPlacementRotate, modelRender });
  live.current = { onPlacementSelect, onPlacementMove, onPlacementRotate, modelRender };
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
          onPlacementRotate: onPlacementRotate
            ? (id, degrees) => live.current.onPlacementRotate?.(id, degrees)
            : undefined,
          modelRender: modelRender
            ? {
                current: () => live.current.modelRender!.current(),
                onStyleChange: (style) => live.current.modelRender?.onStyleChange?.(style),
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
      <details className="pf-3d-basis">
        <summary>Room dimensions & fit</summary>
        <p>
          {room.sizeNote
            ? 'Room shell uses an estimated size.'
            : 'Room shell uses the entered dimensions.'}{' '}
          Furniture sizes and positions are editable concepts; openings and fit need checking.
        </p>
      </details>
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
  fullPicker = false,
  pick,
  tier,
  onColor,
  onPaint,
}: {
  fullPicker?: boolean;
  pick: RoomPick;
  tier: TierKey;
  onColor: (color: WallColor | null) => void;
  onPaint: (paint: { paintLine?: TierKey; sheen?: Sheen }) => void;
}) {
  const [browsing, setBrowsing] = useState(fullPicker);
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
        {!fullPicker && (
          <button
            type="button"
            className="pf-more"
            aria-expanded={browsing}
            onClick={() => setBrowsing(!browsing)}
          >
            {browsing ? 'Close' : 'All colors'}
          </button>
        )}
      </div>
      {pick.color && (
        <div className="pf-paint">
          <details className="pf-paint-cost-options">
            <summary>Paint cost assumptions</summary>
            <p className="pf-inspo-note">Example allowance levels, not branded product quotes.</p>
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
          </details>
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
      {(fullPicker || browsing) && (
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
          return `- ${item.name}: ${item.action === 'keep' ? 'Keep mine' : `${item.quantity ?? '?'} × ${item.unitAllowanceMinor == null ? 'not priced' : money(item.unitAllowanceMinor)} · ${total == null ? 'not priced' : `${money(total)} ${item.allowanceSource === 'demo' ? 'demo' : 'owner'} allowance`}`}${item.url ? ` · ${item.url}` : ''}`;
        }).join('\n')}`,
    )
    .join('\n\n');
  const [copied, setCopied] = useState(false);
  const listText = `${shoppingText(project, list, tier)}\n\n${itemText}\nDemo and owner allowances are not retailer prices. Confirm products, dimensions and fit.`;
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
                    `${shoppingText(project, list, tier)}\n\n${itemText}\nDemo and owner allowances are not retailer prices. Confirm products, dimensions and fit.`,
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
            <h3>Furniture & décor · planning allowances</h3>
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
                              : `${item.quantity ?? '?'} × ${item.unitAllowanceMinor == null ? 'not priced' : money(item.unitAllowanceMinor)}${item.allowanceSource === 'demo' ? ' · demo allowance' : ''}`}
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
              Demo and owner allowances, not retailer quotes. Confirm products, dimensions and fit.
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
    project.rooms[0]?.photo.src ? 'inspired' : '3d',
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
  const [renderStyles, setRenderStyles] = useState<Record<string, string>>(() => {
    if (savedDesign) return savedDesign.snapshot.renderStyles ?? {};
    try {
      return (
        studioDesignSchema.shape.renderStyles.parse(
          JSON.parse(localStorage.getItem(`${renderStore}.styles`) || '{}'),
        ) ?? {}
      );
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(`${renderStore}.styles`, JSON.stringify(renderStyles));
    } catch {
      /* Draft remains usable. */
    }
  }, [renderStore, renderStyles]);
  const [selectedPlacement, setSelectedPlacement] = useState<string | null>(null);
  const [inspector, setInspector] = useState<'design' | 'layout' | 'finishes'>(
    view === '3d' ? 'layout' : view === 'inspired' ? 'design' : 'finishes',
  );
  const [openedDesignRoom, setOpenedDesignRoom] = useState('');
  useEffect(() => {
    if (inspector === 'design') setOpenedDesignRoom(roomId);
  }, [inspector, roomId]);
  const planRef = useRef<HTMLElement>(null);
  const toolsRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const scrollTo = (element: HTMLElement | null) =>
    element?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  const [toolsOpen, setToolsOpen] = useState(false);
  const [finishTool, setFinishTool] = useState<'paint' | 'floor' | null>(null);
  const [comparisonTarget, setComparisonTarget] = useState('finishes');
  const [comparisonBase, setComparisonBase] = useState('original');
  const compareRendered = comparisonTarget !== 'finishes';
  const setCompareRendered = (rendered: boolean) =>
    setComparisonTarget(rendered ? 'rendered' : 'finishes');
  const [lookName, setLookName] = useState('');
  const [lookEditorOpen, setLookEditorOpen] = useState(false);
  const lookNameRef = useRef<HTMLInputElement>(null);
  const comparisonStore = `renovagent.studio.${localScope}.comparison-styles.v1`;
  const [comparisonStyles, setComparisonStyles] = useState<
    NonNullable<StudioDesign['comparisonStyles']>
  >(() => {
    if (savedDesign) return savedDesign.snapshot.comparisonStyles ?? {};
    try {
      return (
        studioDesignSchema.shape.comparisonStyles.parse(
          JSON.parse(localStorage.getItem(comparisonStore) || '{}'),
        ) ?? {}
      );
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(comparisonStore, JSON.stringify(comparisonStyles));
    } catch {
      /* Working choices remain in memory. */
    }
  }, [comparisonStore, comparisonStyles]);
  useEffect(() => {
    setComparisonBase('original');
    setComparisonTarget('finishes');
    setLookName('');
  }, [roomId]);
  const finishButtonRef = useRef<HTMLButtonElement>(null);
  const chooseFinish = (change: Partial<RoomPick>) => {
    update(change);
    setCompareRendered(false);
    setView('photo');
  };
  const controlsRef = useRef<HTMLButtonElement>(null);
  const [renderSource, setRenderSource] = useState<Record<string, 'photo' | 'model'>>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(`${renderStore}.selection`) || '{}');
      return Object.fromEntries(
        Object.entries(stored).filter(([, source]) => source === 'photo' || source === 'model'),
      ) as Record<string, 'photo' | 'model'>;
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(`${renderStore}.selection`, JSON.stringify(renderSource));
    } catch {
      /* Display preference only. */
    }
  }, [renderStore, renderSource]);
  const closeTools = () => {
    setToolsOpen(false);
    requestAnimationFrame(() => controlsRef.current?.focus({ preventScroll: true }));
  };
  const showTools = () => {
    setToolsOpen(true);
    requestAnimationFrame(() => {
      toolsRef.current?.focus({ preventScroll: true });
      scrollTo(toolsRef.current);
    });
  };
  const showRoom = () =>
    requestAnimationFrame(() => {
      stageRef.current?.focus({ preventScroll: true });
      scrollTo(stageRef.current);
    });
  const shownTab = inspector;
  const showPlan = () => {
    planRef.current?.focus({ preventScroll: true });
    planRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  };
  const openStudioTool = (tool: 'design' | 'layout' | 'finishes') => {
    setInspector(tool);
    setFinishTool(null);
    if (tool === 'design') setView('inspired');
    if (tool === 'layout') setView('3d');
    // Finish editing does not force the owner out of the selected canvas view.
  };
  const addRoomItemStarters = (target: StudioRoom) => {
    const model = roomModel(target, project.ceilingFt);
    if (!model) return;
    const existing = placements[target.id] ?? [];
    const suggestions = studioItemModelSuggestions(items[target.id] ?? [], existing).filter((s) =>
      studioAssetAvailable(s.assetId),
    );
    if (existing.length + suggestions.reduce((sum, s) => sum + s.count, 0) > 60) return;
    const added = suggestions.flatMap((s) =>
      Array.from({ length: s.count }, (_, index): StudioPlacement => {
        const start = studioPlacementStart(s.assetId, model);
        const slot = existing.filter((p) => p.itemId === s.itemId).length + index;
        return {
          id: crypto.randomUUID(),
          itemId: s.itemId,
          assetId: s.assetId,
          ...start,
          // Spread repeated models for selection; these are editable starters, not a fit solution.
          xM: start.xM + (slot % 3) * (start.widthM + 0.15),
          zM: start.zM + Math.floor(slot / 3) * (start.depthM + 0.15),
        };
      }),
    );
    setPlacements((current) => ({ ...current, [target.id]: [...existing, ...added] }));
    setSelectedPlacement(added.at(-1)?.id ?? null);
    openStudioTool('layout');
    showRoom();
  };
  const addAssets = (
    target: StudioRoom,
    ids: StudioAssetId[],
    starts = new Map<StudioAssetId, ReturnType<typeof studioPlacementStart>>(),
  ) => {
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
          unitAllowanceMinor: DEMO_FURNITURE_ALLOWANCES[assetId],
          ...(DEMO_FURNITURE_ALLOWANCES[assetId] !== null
            ? { allowanceSource: 'demo' as const }
            : {}),
        };
        nextItems.push(item);
      }
      next.push({
        id: crypto.randomUUID(),
        itemId: item.id,
        assetId,
        ...(starts.get(assetId) ?? studioPlacementStart(assetId, model)),
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
  const [resetOpen, setResetOpen] = useState(false);
  const baseline = useRef({
    picks: savedDesign?.snapshot.picks ?? initialDesign?.picks ?? project.starting ?? {},
    items: savedDesign?.snapshot.items ?? initialDesign?.items ?? {},
    placements: savedDesign?.snapshot.placements ?? initialDesign?.placements ?? {},
  });
  const editHistory = useDesignHistory({ picks, items, placements, tier }, (previous) => {
    setPicks(previous.picks);
    setItems(previous.items);
    setPlacements(previous.placements);
    setTier(previous.tier);
    setSelectedPlacement(null);
  });
  useEffect(() => {
    try {
      localStorage.setItem(pickStore(localScope), JSON.stringify(picks));
    } catch {
      /* Edits work for this visit. */
    }
  }, [localScope, picks]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveAccess, setSaveAccess] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [sharedLink, setSharedLink] = useState<{
    url: string;
    token: string;
    version: string;
  } | null>(null);
  const [shareError, setShareError] = useState('');
  const shareRequest = useRef<{ projectId: string; revision: number; requestId: string } | null>(
    null,
  );
  useEffect(() => {
    if (!saveMeta || sharing) return;
    let live = true;
    void workspaceRequest(`/studio-designs/shares/${encodeURIComponent(saveMeta.projectId)}`)
      .then((links) => {
        if (!live || !Array.isArray(links)) return;
        const latest = links[0];
        setSharedLink(
          latest
            ? {
                token: latest.token,
                url: new URL(`#share/${latest.token}`, window.location.href).href,
                version:
                  latest.revision === saveMeta.revision ? savedJson : 'previous-shared-revision',
              }
            : null,
        );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [saveMeta?.projectId, saveMeta?.revision, sharing]);

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
    renderStyles,
    ...(Object.keys(comparisonStyles).length ? { comparisonStyles } : {}),
  };
  const validatedSnapshot = studioDesignSchema.safeParse(snapshot);
  const snapshotJson = JSON.stringify(
    validatedSnapshot.success ? validatedSnapshot.data : snapshot,
  );
  const [browserSavedJson, setBrowserSavedJson] = useState('');
  const [browserSaveFailed, setBrowserSaveFailed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(`${saveKey}.draft`, snapshotJson);
        setBrowserSavedJson(snapshotJson);
        setBrowserSaveFailed(false);
      } catch {
        setBrowserSaveFailed(true);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [saveKey, snapshotJson]);
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
      if (!saveMeta) {
        const session = await workspaceRequest('/session').catch(() => null);
        if (session?.mode === 'account' && !session.signedIn && session.guests) {
          await workspaceRequest('/auth/guest', {});
          window.dispatchEvent(new Event('renovagent-session'));
        }
      }
      return await writer.current!.sync(parsed.data);
    } catch (e) {
      if (e instanceof DomainError && e.code === 'FORBIDDEN') setSaveAccess(true);
      setSaveError(e instanceof Error ? e.message : 'Could not save the project');
      return null;
    } finally {
      setSaving(false);
    }
  };
  const shareProject = async () => {
    setSharing(true);
    setShareError('');
    try {
      const meta = await save();
      if (!meta) throw new Error('Save this project before sharing.');
      if (
        shareRequest.current?.projectId !== meta.projectId ||
        shareRequest.current.revision !== meta.revision
      )
        shareRequest.current = {
          projectId: meta.projectId,
          revision: meta.revision,
          requestId: crypto.randomUUID(),
        };
      const shared = (await workspaceRequest('/studio-designs/share', shareRequest.current)) as {
        url: string;
        token: string;
      };
      setSharedLink({ ...shared, version: snapshotJson });
      await navigator.clipboard.writeText(shared.url).catch(() => {});
    } catch (e) {
      setShareError(e instanceof Error ? e.message : 'Could not share this project.');
    } finally {
      setSharing(false);
    }
  };
  const latestSave = useRef(save);
  latestSave.current = save;
  useEffect(() => {
    if ((!autoSave && !saveMeta) || saving || saveAccess || saveError || savedJson === snapshotJson)
      return;
    const timer = setTimeout(() => void latestSave.current(), 750);
    return () => clearTimeout(timer);
  }, [autoSave, saveMeta, snapshotJson, savedJson, saving, saveAccess, saveError]);
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
  const useModelImage =
    (renderSource[room.id] !== 'photo' && !!modelRenders[room.id]) || !inspired[room.id];
  const conceptImage = useModelImage ? modelRenders[room.id]?.image : inspired[room.id];
  const modelSignature = JSON.stringify({
    model: roomModel(room, ceilingFt),
    look: lookSignature(pick),
    placements: placements[room.id] ?? [],
    ...(renderStyles[room.id] ? { renderStyle: renderStyles[room.id] } : {}),
  });
  const conceptStale = useModelImage
    ? !!modelRenders[room.id] && modelRenders[room.id]?.signature !== modelSignature
    : stylingStale[room.id] || renderSignatures[room.id] !== lookSignature(pick);
  type ComparisonChoice = { key: string; label: string; image?: string; pick?: RoomPick };
  const comparisonChoices: ComparisonChoice[] = [
    { key: 'original', label: 'Original photo', image: room.photo.src },
    { key: 'finishes', label: 'Live finishes', pick },
    ...(conceptImage
      ? [{ key: 'rendered', label: 'Current generated design', image: conceptImage }]
      : []),
    ...(inspired[room.id] && inspired[room.id] !== conceptImage
      ? [{ key: 'photo', label: 'Latest photo design', image: inspired[room.id] }]
      : []),
    ...(modelRenders[room.id] && modelRenders[room.id]?.image !== conceptImage
      ? [{ key: 'model', label: 'Latest 3D render', image: modelRenders[room.id]!.image }]
      : []),
    ...(styling[room.id]?.versions ?? []).map((version, i) => ({
      key: `version:${version.id}`,
      label: version.title || `Photo design ${i + 1}`,
      image: version.image,
    })),
    ...(comparisonStyles[room.id] ?? []).map((look) => ({
      key: `saved:${look.id}`,
      label: look.name,
      ...(look.kind === 'finishes' ? { pick: look.pick } : { image: look.image }),
    })),
  ];
  const choiceFor = (key: string) =>
    comparisonChoices.find((choice) => choice.key === key) ?? comparisonChoices[0]!;
  const comparisonImage = (key: string) => {
    const choice = choiceFor(key);
    return (
      <figure className="pf-comparison-choice">
        <figcaption>
          {choice.label} ·{' '}
          {choice.pick
            ? 'Finish preview'
            : choice.image === room.photo.src
              ? 'Original photo'
              : 'Generated concept'}
        </figcaption>
        {choice.pick ? (
          <BeforeAfter
            room={room}
            pick={choice.pick}
            pending={key === 'finishes' ? pending : null}
            floorUnavailable={!!styleOf(choice.pick) && !floorImage(room, styleOf(choice.pick)!)}
            compare={false}
          />
        ) : (
          <img src={choice.image} alt={choice.label} />
        )}
      </figure>
    );
  };
  const namedLook = comparisonTarget.startsWith('saved:')
    ? comparisonStyles[room.id]?.find((look) => `saved:${look.id}` === comparisonTarget)
    : undefined;
  const floorControls = (
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
          onClick={() => chooseFinish({ floor: 'keep' })}
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
              chooseFinish({
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
              onClick={() => chooseFinish({ floor: f.key, floorStyle: pickedStyle! })}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
  const roomPlan = (
    <RoomPlan
      key={room.id}
      diagrams={
        <RoomDiagram
          sizeEstimated={!!(room.sizeNote || project.ceilingNote)}
          model={roomModel(room, ceilingFt)}
          title={room.title}
          placements={(placements[room.id] ?? []).filter((p) =>
            (items[room.id] ?? []).some((i) => i.id === p.itemId),
          )}
        />
      }
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
          projectId: meta.projectId,
          revision: meta.revision,
          roomId: room.id,
          requestId: crypto.randomUUID(),
        })) as StudioHandoff;
      }}
    />
  );
  return (
    <section className="pf-studio" aria-label={`${project.address} room studio`}>
      <div className="pf-project-bar">
        <details className="pf-project-details">
          <summary>Project · {project.address}</summary>
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
              <button type="button" className="pf-reset" onClick={() => setListOpen(true)}>
                Shopping list
              </button>
              <button type="button" className="pf-reset" onClick={showPlan}>
                Plan & budget
              </button>
              {actions}
            </div>
          </header>
          <div className="pf-edit-history" role="group" aria-label="Design edit history">
            <button type="button" disabled={!editHistory.canUndo} onClick={editHistory.undo}>
              Undo
            </button>
            <button type="button" disabled={!editHistory.canRedo} onClick={editHistory.redo}>
              Redo
            </button>
            <button type="button" onClick={() => setResetOpen(true)}>
              Reset room design
            </button>
            <small>Design edits across rooms · undo available for this visit</small>
          </div>
          {resetOpen && (
            <Modal title={`Reset ${room.title}?`} onClose={() => setResetOpen(false)}>
              <p>
                Restore this room’s starting paint, floor, furniture list and layout. Photos,
                measurements, generated-image history and saved revisions stay. You can undo this
                reset.
              </p>
              <div className="pf-edit-history">
                <button type="button" onClick={() => setResetOpen(false)}>
                  Keep editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    editHistory.separateNext();
                    setPicks((current) => ({
                      ...current,
                      [room.id]: baseline.current.picks[room.id] ?? DEFAULT_PICK,
                    }));
                    setItems((current) => ({
                      ...current,
                      [room.id]: baseline.current.items[room.id] ?? [],
                    }));
                    setPlacements((current) => ({
                      ...current,
                      [room.id]: baseline.current.placements[room.id] ?? [],
                    }));
                    setSelectedPlacement(null);
                    setResetOpen(false);
                  }}
                >
                  Reset this room
                </button>
              </div>
            </Modal>
          )}
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
                  <a
                    href={`#design/${encodeURIComponent(saveMeta!.projectId)}/${saveMeta!.revision}`}
                  >
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
                    {linkCopied ? 'Private link copied' : 'Copy private link'}
                  </button>
                </>
              )}
            </div>
          )}
        </details>
      </div>
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
      {saveError && (
        <p role="alert" className="pf-error-inline">
          {saveError}
        </p>
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
                <img
                  src={thumbnailUrl(
                    renderSource[r.id] !== 'photo' && modelRenders[r.id]
                      ? modelRenders[r.id]?.image || inspired[r.id] || r.photo.src
                      : inspired[r.id] || modelRenders[r.id]?.image || r.photo.src,
                  )}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
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
        <div
          className="pf-stage"
          ref={stageRef}
          tabIndex={-1}
          role="region"
          aria-label="Room preview"
        >
          <div className="pf-stage-bar">
            <div>
              <strong>{room.title}</strong>
              {needsSize && onEditRoom && (
                <button
                  type="button"
                  className="pf-ceiling"
                  onClick={() => {
                    setInspector('finishes');
                    requestAnimationFrame(showTools);
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
                        requestAnimationFrame(showTools);
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
                        requestAnimationFrame(showTools);
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
            {!photoless && (
              <div className="pf-views" role="tablist" aria-label="View">
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'inspired'}
                  onClick={() => {
                    setView('inspired');
                    setToolsOpen(false);
                    setFinishTool(null);
                  }}
                >
                  <Glyph name="paint" /> Design
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'photo'}
                  onClick={() => {
                    setView('photo');
                    setCompareRendered(false);
                    setToolsOpen(false);
                    setFinishTool(null);
                  }}
                >
                  <Glyph name="photo" /> Compare
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === '3d'}
                  onClick={() => {
                    setView('3d');
                    setInspector('layout');
                    setToolsOpen(true);
                    setFinishTool(null);
                  }}
                >
                  <Glyph name="layers" /> Furnishings
                </button>
              </div>
            )}
            <div className="pf-total" aria-live="polite">
              <span>
                Project estimate · {included.length} room{included.length === 1 ? '' : 's'}
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
                    : 'Demo allowances'}
              </small>
            </div>
          </div>
          <div className="pf-top-save-controls" role="group" aria-label="Save and compare">
            <span role="status" aria-live="polite" className="pf-autosave-status">
              {saveError
                ? browserSavedJson === snapshotJson
                  ? 'Workspace sync failed · browser copy saved'
                  : 'Workspace sync failed'
                : saving
                  ? 'Saving to workspace…'
                  : saveMeta && savedJson === snapshotJson
                    ? 'Autosaved to workspace'
                    : saveMeta || autoSave
                      ? 'Waiting to sync to workspace…'
                      : browserSaveFailed
                        ? 'Browser save failed'
                        : browserSavedJson === snapshotJson
                          ? 'Autosaved in this browser'
                          : 'Saving in this browser…'}
            </span>
            {!photoless && (
              <button
                type="button"
                className="pf-reset"
                onClick={() => {
                  if (view !== 'photo') setComparisonTarget(conceptImage ? 'rendered' : 'finishes');
                  setView('photo');
                  setToolsOpen(false);
                  setFinishTool(null);
                  setLookEditorOpen(true);
                  requestAnimationFrame(() => lookNameRef.current?.focus({ preventScroll: true }));
                }}
              >
                Save look
              </button>
            )}
            {(!saveMeta || saveError) && (
              <button
                type="button"
                className="pf-reset pf-save-action"
                disabled={saving}
                onClick={() => void save()}
              >
                {saveError ? 'Retry workspace sync' : 'Save to workspace'}
              </button>
            )}
            <button
              type="button"
              className="pf-reset"
              disabled={saving || sharing}
              title="Anyone with the link can view the saved design and its photos"
              onClick={() => void shareProject()}
            >
              {sharing ? 'Creating share link…' : 'Share project'}
            </button>
            {sharedLink && (
              <div className="pf-share-result" role="status">
                <p>
                  Anyone with this link can view this saved design and its photos.{' '}
                  {sharedLink.version !== snapshotJson
                    ? 'Choices changed; share again for an updated link.'
                    : 'The original stays yours.'}
                </p>
                <input
                  aria-label="Shareable project link"
                  readOnly
                  value={sharedLink.url}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <a href={sharedLink.url} target="_blank" rel="noreferrer">
                  Open shared project
                </a>
                <button
                  type="button"
                  className="pf-reset"
                  onClick={() => {
                    void workspaceRequest(`/shared-designs/${sharedLink.token}/revoke`, {})
                      .then(() => {
                        setSharedLink(null);
                        shareRequest.current = null;
                      })
                      .catch((e) => setShareError(e.message));
                  }}
                >
                  Stop sharing this link
                </button>
              </div>
            )}
            {shareError && (
              <p className="pf-share-result" role="alert">
                {shareError}
              </p>
            )}
          </div>
          {view === 'photo' && !photoless && (
            <div className="pf-comparison-controls">
              <label>
                Compare
                <select
                  aria-label="Compare against"
                  value={comparisonBase}
                  onChange={(e) => setComparisonBase(e.target.value)}
                >
                  {comparisonChoices.map((choice) => (
                    <option key={choice.key} value={choice.key}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                With
                <select
                  aria-label="Compare preview"
                  value={comparisonTarget}
                  onChange={(e) => {
                    setComparisonTarget(e.target.value);
                    setLookName(
                      comparisonStyles[room.id]?.find(
                        (look) => `saved:${look.id}` === e.target.value,
                      )?.name ?? '',
                    );
                  }}
                >
                  {comparisonChoices.map((choice) => (
                    <option key={choice.key} value={choice.key}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>
              <details
                className="pf-name-look"
                open={lookEditorOpen}
                onToggle={(e) => setLookEditorOpen(e.currentTarget.open)}
              >
                <summary>Save or name this look</summary>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const name = lookName.trim();
                    if (!name) return;
                    if (namedLook) {
                      setComparisonStyles((all) => ({
                        ...all,
                        [room.id]: (all[room.id] ?? []).map((look) =>
                          look.id === namedLook.id ? { ...look, name } : look,
                        ),
                      }));
                      return;
                    }
                    if ((comparisonStyles[room.id]?.length ?? 0) >= 12) return;
                    const choice = choiceFor(comparisonTarget);
                    const id = crypto.randomUUID();
                    const look = choice.pick
                      ? { id, name, kind: 'finishes' as const, pick: structuredClone(choice.pick) }
                      : { id, name, kind: 'image' as const, image: choice.image ?? room.photo.src };
                    setComparisonStyles((all) => ({
                      ...all,
                      [room.id]: [...(all[room.id] ?? []), look],
                    }));
                    setComparisonTarget(`saved:${id}`);
                  }}
                >
                  <label>
                    Look name
                    <input
                      aria-label="Look name"
                      ref={lookNameRef}
                      maxLength={120}
                      value={lookName}
                      onChange={(e) => setLookName(e.target.value)}
                      placeholder="Warm sage, light oak…"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={
                      !lookName.trim() ||
                      (!namedLook && (comparisonStyles[room.id]?.length ?? 0) >= 12)
                    }
                  >
                    {namedLook ? 'Rename look' : 'Save as style'}
                  </button>
                </form>
                {namedLook && (
                  <button
                    type="button"
                    className="pf-reset"
                    onClick={() => {
                      setComparisonStyles((all) => ({
                        ...all,
                        [room.id]: (all[room.id] ?? []).filter((look) => look.id !== namedLook.id),
                      }));
                      if (comparisonBase === comparisonTarget) setComparisonBase('original');
                      setComparisonTarget('finishes');
                      setLookName('');
                    }}
                  >
                    Delete saved look
                  </button>
                )}
                <small>
                  Stores this comparison look. Current room choices stay as edited. Up to 12 looks
                  per room.
                </small>
              </details>
            </div>
          )}
          {view === 'photo' &&
          (comparisonBase !== 'original' ||
            !['finishes', 'rendered'].includes(comparisonTarget)) ? (
            <div className="pf-comparison-pair">
              {comparisonImage(comparisonBase)}
              {comparisonImage(comparisonTarget)}
            </div>
          ) : (view === 'inspired' || (view === 'photo' && compareRendered)) &&
            room.photo.src &&
            conceptImage ? (
            <div>
              {conceptStale && (
                <p className="pf-styling-stale" role="status">
                  Previous design — choices have changed. Render again to apply them.
                </p>
              )}
              <InspiredView
                before={room.photo.src}
                after={conceptImage}
                compare={view === 'photo'}
                sideBySide
              />
              <div className="pf-design-3d-link">
                <p>Generated concept · geometry and furniture fit need checking.</p>
                <button
                  type="button"
                  className="pf-design-download"
                  onClick={() => {
                    openStudioTool('layout');
                    showTools();
                  }}
                >
                  Arrange in 3D
                </button>
              </div>
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
              onPlacementRotate={(id, degrees) =>
                setPlacements((all) => ({
                  ...all,
                  [room.id]: (all[room.id] ?? []).map((p) =>
                    p.id === id
                      ? {
                          ...p,
                          rotationDeg:
                            ((((p.rotationDeg + degrees + 180) % 360) + 360) % 360) - 180,
                        }
                      : p,
                  ),
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
                    ...(renderStyles[room.id] ? { renderStyle: renderStyles[room.id] } : {}),
                  }),
                  style: renderStyles[room.id] ?? '',
                }),
                onStyleChange: (style) => setRenderStyles((all) => ({ ...all, [room.id]: style })),
                initial: modelRenders[room.id],
                onRendered: (image, signature) => {
                  setModelRenders((all) => ({ ...all, [room.id]: { image, signature } }));
                  setRenderSource((all) => ({ ...all, [room.id]: 'model' }));
                  setView('inspired');
                  setToolsOpen(false);
                },
              }}
            />
          ) : view === '3d' ? (
            <p className="pf-layout-empty">
              Add room dimensions in Paint & floor to open the 3D layout.
            </p>
          ) : (
            <div>
              {view === 'inspired' && (
                <p className="pf-empty-design">
                  Finishes preview · open Furnishings to place furniture in 3D.
                </p>
              )}
              <BeforeAfter
                room={room}
                pick={pick}
                pending={pending || null}
                floorUnavailable={!!(workKey && floorErrors[workKey])}
                allowDownload
                compare={view === 'photo'}
              />
            </div>
          )}
          {!photoless && (
            <section
              className="pf-finish-dock"
              aria-label="Preview finish toolbar"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setFinishTool(null);
                  finishButtonRef.current?.focus();
                }
              }}
            >
              <div className="pf-finish-toolbar" role="group" aria-label="Preview tools">
                <button
                  ref={finishButtonRef}
                  type="button"
                  aria-expanded={finishTool === 'paint'}
                  aria-controls="preview-paint-panel"
                  onClick={() => {
                    setFinishTool(finishTool === 'paint' ? null : 'paint');
                    setToolsOpen(false);
                    setCompareRendered(false);
                    setView('photo');
                  }}
                >
                  <i style={{ background: pick.color?.hex ?? '#eee9df' }} />
                  Paint <span>{pick.color?.name ?? 'Current walls'}</span>
                </button>
                <button
                  type="button"
                  aria-expanded={finishTool === 'floor'}
                  aria-controls="preview-floor-panel"
                  onClick={() => {
                    setFinishTool(finishTool === 'floor' ? null : 'floor');
                    setToolsOpen(false);
                    setCompareRendered(false);
                    setView('photo');
                  }}
                >
                  Floor{' '}
                  <span>
                    {pickedStyle
                      ? FLOOR_STYLES.find((f) => f.id === pickedStyle)?.label
                      : 'Keep existing'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFinishTool(null);
                    openStudioTool('layout');
                    setToolsOpen(true);
                    showRoom();
                  }}
                >
                  Furnishings
                </button>
                <button
                  ref={controlsRef}
                  type="button"
                  aria-expanded={toolsOpen && inspector === 'finishes'}
                  aria-controls="room-design-controls"
                  onClick={() => {
                    setFinishTool(null);
                    setInspector('finishes');
                    toolsOpen && inspector === 'finishes' ? closeTools() : showTools();
                  }}
                >
                  Room settings
                </button>
                {finishTool && (
                  <button
                    type="button"
                    className="pf-finish-close"
                    onClick={() => {
                      setFinishTool(null);
                      finishButtonRef.current?.focus();
                    }}
                  >
                    Close
                  </button>
                )}
              </div>
              {finishTool === 'paint' && (
                <div
                  id="preview-paint-panel"
                  className="pf-finish-popover"
                  role="region"
                  aria-label="Preview paint selector"
                >
                  <ColorChoice
                    fullPicker
                    pick={pick}
                    tier={tier}
                    onColor={(color) => chooseFinish({ color })}
                    onPaint={chooseFinish}
                  />
                </div>
              )}
              {finishTool === 'floor' && (
                <div
                  id="preview-floor-panel"
                  className="pf-finish-popover"
                  role="region"
                  aria-label="Preview floor selector"
                >
                  {floorControls}
                </div>
              )}
            </section>
          )}
          {workKey && floorErrors[workKey] && <StudioError message={floorErrors[workKey]} />}
        </div>
      </div>

      <div className="pf-canvas-actions">
        {inspired[room.id] && modelRenders[room.id] && (
          <div className="pf-render-source" role="group" aria-label="Design image source">
            <button
              type="button"
              className="pf-reset"
              aria-pressed={!useModelImage}
              onClick={() => {
                setRenderSource((all) => ({ ...all, [room.id]: 'photo' }));
                setView('inspired');
              }}
            >
              Photo design
            </button>
            <button
              type="button"
              className="pf-reset"
              aria-pressed={useModelImage}
              onClick={() => {
                setRenderSource((all) => ({ ...all, [room.id]: 'model' }));
                setView('inspired');
              }}
            >
              3D render
            </button>
          </div>
        )}

        {view === '3d' && (
          <button
            type="button"
            className="pf-reset"
            onClick={() => {
              setInspector('layout');
              showTools();
            }}
          >
            Add / edit furniture
          </button>
        )}
        <button type="button" className="pf-reset" onClick={showPlan}>
          Room list & budget
        </button>
      </div>
      <section
        className="pf-workbench pf-panel"
        id="room-design-controls"
        hidden={!toolsOpen}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            closeTools();
          }
        }}
        ref={toolsRef}
        aria-label="Room editing workspace"
        tabIndex={-1}
      >
        <header className="pf-plan-heading">
          <h2>
            {shownTab === 'design'
              ? 'Photo ideas & restyling'
              : shownTab === 'layout'
                ? 'Furnishings'
                : 'Paint & floor'}
          </h2>
          <div className="pf-workbench-actions">
            <span>{room.title}</span>
            <button type="button" className="pf-reset" onClick={closeTools}>
              Close controls
            </button>
          </div>
        </header>
        <div className="pf-inspector-tabs" role="tablist" aria-label="Studio tools">
          {(
            [
              { id: 'layout', label: 'Furnishings' },
              { id: 'design', label: 'Photo ideas' },
              { id: 'finishes', label: 'Room settings' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={shownTab === tab.id}
              onClick={() => {
                openStudioTool(tab.id);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="pf-tools-design" hidden={shownTab !== 'design'}>
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
              onIdeaLayout={(ids) => {
                addAssets(
                  room,
                  ids.filter((id) => !(placements[room.id] ?? []).some((p) => p.assetId === id)),
                );
                showRoom();
              }}
              room={room}
              onPaint={(color) => update({ color })}
              onRestyled={(src, sourceFinishSignature) => {
                keepInspired(room.id, src);
                setRenderSource((all) => ({ ...all, [room.id]: 'photo' }));
                setToolsOpen(false);
                setRenderSignatures((current) => ({
                  ...current,
                  [room.id]: sourceFinishSignature ?? lookSignature(pick),
                }));
                openStudioTool('design');
                showRoom();
              }}
            />
          )}
        </div>
        <div className="pf-tools-layout" hidden={shownTab !== 'layout'}>
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
              onAddRoomItems={() => addRoomItemStarters(room)}
              onPreset={(id) => {
                const model = roomModel(room, ceilingFt);
                if (!model) return;
                const starts = studioPresetStarts(id, model).filter(
                  (start) => !(placements[room.id] ?? []).some((p) => p.assetId === start.assetId),
                );
                if (
                  (placements[room.id]?.length ?? 0) + starts.length > 60 ||
                  (items[room.id]?.length ?? 0) + starts.length > 100
                )
                  return;
                editHistory.separateNext();
                addAssets(
                  room,
                  starts.map((start) => start.assetId),
                  new Map(starts.map(({ assetId, ...start }) => [assetId, start])),
                );
                showRoom();
              }}
            />
          )}
        </div>
        <div className="pf-tools-finishes" hidden={shownTab !== 'finishes'}>
          <Imagine
            key={`imagine-${room.id}`}
            room={room}
            sample={sample}
            onFurnish={() => {
              openStudioTool('design');
              requestAnimationFrame(showTools);
            }}
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
          <button
            type="button"
            className="pf-reset"
            onClick={() => {
              setFinishTool('paint');
              setCompareRendered(false);
              setView('photo');
              showRoom();
            }}
          >
            Open paint and floor toolbar at the preview
          </button>

          <div className="pf-group">
            <div className="pf-group-head">
              <h3>
                Paint & floor <span className="pf-badge">Demo prices</span>
              </h3>
              <label className="pf-demo-tier">
                Demo material allowance
                <select
                  aria-label="Demo material allowance"
                  value={tier}
                  onChange={(e) => setTier(e.target.value as TierKey)}
                >
                  <option value="builder">Lower example</option>
                  <option value="mid">Standard example</option>
                  <option value="high">Higher example</option>
                </select>
              </label>
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
      </section>

      <section className="pf-plan-section" ref={planRef} aria-label="Plan and budget" tabIndex={-1}>
        <div className="pf-plan-heading">
          <h2>Plan & budget</h2>
          <span>{room.title}</span>
        </div>
        {roomPlan}
      </section>

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
