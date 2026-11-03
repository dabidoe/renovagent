import { useEffect, useState } from 'react';
import type { StudioAssetId, StudioItem, StudioPlacement } from '@renovagent/contracts';
import {
  STUDIO_ASSETS,
  furnitureRoughPosition,
  photoFurnitureSpotted,
  studioAsset,
  studioRoomBounds,
  studioPlacementWarnings,
  type PhotoBox,
  type PhotoRead,
  type RoomModel,
} from '@renovagent/core';
import { forJev } from '../room3d/owner-photos.js';
import { workspaceRequest, type SessionInfo } from '../../adapters/http/project-repository.js';
import { StudioError } from './studio-error.js';
import { furnitureThumbnail } from '../room3d/furniture-assets.js';

export function AssetThumb({ id }: { id: StudioAssetId }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let live = true;
    void furnitureThumbnail(id)
      .then((value) => {
        if (live) setSrc(value);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id]);
  return src ? (
    <img src={src} alt="" />
  ) : (
    <span className="pf-asset-placeholder" aria-hidden="true">
      ◇
    </span>
  );
}
type SpottedScan =
  | { status: 'idle' }
  | { status: 'working' }
  | { status: 'done'; read: PhotoRead }
  | { status: 'error'; message: string };

function SpottedRow({
  photoSrc,
  bounds,
  onAddExisting,
}: {
  photoSrc: string;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number } | null;
  onAddExisting: (assetId: StudioAssetId, position: { xM: number; zM: number } | null) => void;
}) {
  const [scan, setScan] = useState<SpottedScan>({ status: 'idle' });
  const [added, setAdded] = useState<StudioAssetId[]>([]);
  const run = async () => {
    setScan({ status: 'working' });
    setAdded([]);
    try {
      const res = await fetch(photoSrc);
      if (!res.ok) throw Error('Could not load the room photo.');
      const image = await forJev(await res.blob());
      const session = (await workspaceRequest('/session')) as SessionInfo;
      if (session.mode === 'account' && !session.signedIn)
        throw Error('Sign in to the connected app to read photos with Jev.');
      if (!session.jev) throw Error('Jev is not configured on this server.');
      const read = (await workspaceRequest('/photo/read', image)) as PhotoRead;
      setScan({ status: 'done', read });
    } catch (e) {
      setScan({ status: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };
  const suggestions = scan.status === 'done' ? photoFurnitureSpotted(scan.read) : [];
  const place = (assetId: StudioAssetId, box: PhotoBox | undefined) => {
    onAddExisting(assetId, box && bounds ? furnitureRoughPosition(box, bounds) : null);
    setAdded((current) => (current.includes(assetId) ? current : [...current, assetId]));
  };
  return (
    <div className="pf-spotted">
      <div className="pf-group-head">
        <h3>Spotted in your photo</h3>
        {scan.status === 'done' ? (
          <button type="button" className="link-button" onClick={() => void run()}>
            Rescan
          </button>
        ) : scan.status !== 'working' ? (
          <button type="button" onClick={() => void run()}>
            Scan this room&apos;s photo
          </button>
        ) : null}
      </div>
      {scan.status === 'working' && <p className="small-note">Jev is reading the photo…</p>}
      {scan.status === 'error' && <StudioError message={scan.message} />}
      {scan.status === 'done' && !suggestions.length && (
        <p className="small-note">No catalog furniture spotted in this photo.</p>
      )}
      {!!suggestions.length && (
        <>
          <div className="pf-spotted-chips">
            {suggestions.map((s) => {
              const done = added.includes(s.assetId);
              return (
                <span key={s.assetId} className="pf-spotted-chip">
                  <b>
                    {studioAsset(s.assetId).name} · {Math.round(s.p * 100)}%
                  </b>
                  {done ? (
                    <small>Added ✓</small>
                  ) : (
                    <button type="button" onClick={() => place(s.assetId, s.box)}>
                      Add to layout
                    </button>
                  )}
                </span>
              );
            })}
          </div>
          {suggestions.some((s) => !added.includes(s.assetId)) && (
            <button
              type="button"
              onClick={() =>
                suggestions
                  .filter((s) => !added.includes(s.assetId))
                  .forEach((s) => place(s.assetId, s.box))
              }
            >
              Add all
            </button>
          )}
          <p className="small-note">Approximate position from photo — drag to adjust.</p>
        </>
      )}
    </div>
  );
}

export function FurniturePanel({
  model,
  placements,
  items,
  selected,
  onSelect,
  onChange,
  onAdd,
  photoSrc,
  onAddExisting,
}: {
  model: RoomModel | null;
  placements: StudioPlacement[];
  items: StudioItem[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onChange: (next: StudioPlacement[]) => void;
  onAdd: (assetId: StudioAssetId) => void;
  photoSrc?: string | null;
  onAddExisting?: (assetId: StudioAssetId, position: { xM: number; zM: number } | null) => void;
}) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const chosen = placements.find((p) => p.id === selected);
  const bounds = model ? studioRoomBounds(model) : null;
  const patch = (data: Partial<StudioPlacement>) => {
    if (chosen) onChange(placements.map((p) => (p.id === chosen.id ? { ...p, ...data } : p)));
  };
  const warnings = model ? studioPlacementWarnings(model, placements) : [];
  const quantities = items.flatMap((item) => {
    const count = placements.filter((p) => p.itemId === item.id).length;
    return count && item.quantity !== null && count !== item.quantity
      ? [
          `${item.name}: ${count} in 3D, ${item.quantity} in the room list. Check the intended quantity in Plan & budget.`,
        ]
      : [];
  });
  return (
    <div className="pf-furniture-panel">
      <button
        type="button"
        className="pf-add-furniture"
        aria-expanded={libraryOpen}
        onClick={() => setLibraryOpen(!libraryOpen)}
      >
        {libraryOpen ? 'Close library' : 'Add furniture'}
      </button>
      {!model && (
        <p className="pf-intake-error">
          Add room dimensions to place furniture. The photo designer works without them.
        </p>
      )}
      {libraryOpen && (
        <div className="pf-asset-grid" aria-label="3D furniture library">
          {STUDIO_ASSETS.map((a) => (
            <button
              type="button"
              key={a.id}
              disabled={!model || placements.length >= 60}
              onClick={() => {
                onAdd(a.id);
                setLibraryOpen(false);
              }}
              aria-label={`Add ${a.name} to 3D`}
            >
              <AssetThumb id={a.id} />
              <span>{a.name}</span>
              <b aria-hidden="true">+</b>
            </button>
          ))}
        </div>
      )}
      {photoSrc && onAddExisting && (
        <SpottedRow photoSrc={photoSrc} bounds={bounds} onAddExisting={onAddExisting} />
      )}
      {placements.length > 1 && (
        <label className="pf-furniture-selection">
          Selected piece
          <select
            aria-label="Selected furniture piece"
            value={selected ?? ''}
            onChange={(e) => onSelect(e.target.value || null)}
          >
            <option value="" disabled>
              Choose a piece
            </option>
            {placements.map((p) => (
              <option key={p.id} value={p.id}>
                {items.find((item) => item.id === p.itemId)?.name ?? studioAsset(p.assetId).name}
              </option>
            ))}
          </select>
        </label>
      )}
      {!chosen && <p>Choose a piece in the room to edit it.</p>}
      {chosen && (
        <div className="pf-placement-editor">
          <div className="pf-group-head">
            <h4>{studioAsset(chosen.assetId).name}</h4>
            <button
              type="button"
              onClick={() => {
                onChange(placements.filter((p) => p.id !== chosen.id));
                onSelect(null);
              }}
            >
              Remove from 3D
            </button>
          </div>
          <label>
            Rotate · {Math.round(chosen.rotationDeg)}°
            <input
              aria-label="Rotate selected furniture"
              type="range"
              min={-180}
              max={180}
              step={5}
              value={chosen.rotationDeg}
              onChange={(e) => patch({ rotationDeg: Number(e.target.value) })}
            />
          </label>
          <details className="pf-furniture-details">
            <summary>Position & size</summary>
            <label>
              Room list item
              <select
                aria-label="Room list item for selected 3D object"
                value={chosen.itemId}
                onChange={(e) => patch({ itemId: e.target.value })}
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="pf-placement-fields">
              {(['widthM', 'depthM', 'heightM'] as const).map((key) => (
                <label key={key}>
                  {key === 'widthM' ? 'Width' : key === 'depthM' ? 'Depth' : 'Height'} · m
                  <input
                    type="number"
                    step="0.05"
                    min="0.01"
                    max={key === 'heightM' ? 10 : 20}
                    value={chosen[key]}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (n > 0 && n <= (key === 'heightM' ? 10 : 20)) patch({ [key]: n });
                    }}
                  />
                </label>
              ))}
            </div>
            {bounds && (
              <div className="pf-placement-fields">
                {(['xM', 'zM'] as const).map((key) => (
                  <label key={key}>
                    {key === 'xM' ? 'Across' : 'Along'} room · m
                    <input
                      type="number"
                      step="0.1"
                      min={-10000}
                      max={10000}
                      value={chosen[key]}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (e.target.value && Number.isFinite(n) && Math.abs(n) <= 10000)
                          patch({ [key]: n });
                      }}
                    />
                  </label>
                ))}
              </div>
            )}
            <small>
              Models keep their proportions within these size limits. Measure real products before
              buying.
            </small>
          </details>
        </div>
      )}
      {!!(warnings.length || quantities.length) && (
        <div className="pf-layout-warnings" role="status">
          {warnings.map((w) => (
            <p key={w.id}>{w.message}</p>
          ))}
          {quantities.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}
      <details className="pf-furniture-details">
        <summary>Reference details</summary>
        <p className="pf-furniture-note">
          Layout proposal · doors, circulation, overlaps and product fit still need checking.
          Removing a model keeps its room-list item.{' '}
          <a href="/furniture/kenney/README.md" target="_blank" rel="noreferrer">
            Kenney assets · CC0 ↗
          </a>
        </p>
      </details>
    </div>
  );
}
