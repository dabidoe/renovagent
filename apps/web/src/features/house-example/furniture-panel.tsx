import { useEffect, useState } from 'react';
import type { StudioAssetId, StudioItem, StudioPlacement } from '@renovagent/contracts';
import {
  STUDIO_ASSETS,
  studioAsset,
  studioRoomBounds,
  studioPlacementWarnings,
  type RoomModel,
} from '@renovagent/core';
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
export function FurniturePanel({
  model,
  placements,
  items,
  selected,
  onSelect,
  onChange,
  onAdd,
}: {
  model: RoomModel | null;
  placements: StudioPlacement[];
  items: StudioItem[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onChange: (next: StudioPlacement[]) => void;
  onAdd: (assetId: StudioAssetId) => void;
}) {
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
      <div className="pf-group-head">
        <h3>Build the room in 3D</h3>
        <span>{placements.length} objects</span>
      </div>
      <p>Add pieces. Rotate to explore, Move to arrange, then render with Muse.</p>
      {!model && (
        <p className="pf-intake-error">
          Add room dimensions to place furniture. The photo designer works without them.
        </p>
      )}
      <div className="pf-asset-grid" aria-label="3D furniture library">
        {STUDIO_ASSETS.map((a) => (
          <button
            type="button"
            key={a.id}
            disabled={!model || placements.length >= 60}
            onClick={() => onAdd(a.id)}
            aria-label={`Add ${a.name} to 3D`}
          >
            <AssetThumb id={a.id} />
            <span>{a.name}</span>
            <b aria-hidden="true">+</b>
          </button>
        ))}
      </div>
      {!!placements.length && (
        <div className="pf-placement-list" aria-label="Objects in this room">
          {placements.map((p) => (
            <button
              type="button"
              key={p.id}
              aria-pressed={p.id === selected}
              onClick={() => onSelect(p.id)}
            >
              <span>
                {items.find((i) => i.id === p.itemId)?.name ?? studioAsset(p.assetId).name}
              </span>
              <small>{studioAsset(p.assetId).name}</small>
            </button>
          ))}
        </div>
      )}
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
              <label>
                Colour
                <input
                  type="color"
                  aria-label="Selected furniture colour"
                  value={chosen.color}
                  onChange={(e) => patch({ color: e.target.value })}
                />
              </label>
            </div>
          )}
          <small>
            Concept sizes are editable starting points. Measure your actual piece before buying.
          </small>
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
      <p className="pf-furniture-note">
        Layout proposal · doors, circulation, overlaps and product fit still need checking. Removing
        a model keeps its room-list item.{' '}
        <a href="/furniture/kenney/README.md" target="_blank" rel="noreferrer">
          Kenney assets · CC0 ↗
        </a>
      </p>
    </div>
  );
}
