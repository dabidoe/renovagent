import { useEffect, useState } from 'react';
import { money } from './paint-floor.js';
import { studioAssetAvailable } from '../room3d/available-assets.js';
import type { StudioAssetId, StudioItem, StudioPlacement } from '@renovagent/contracts';
import {
  DEMO_FURNITURE_ALLOWANCES,
  STUDIO_ASSETS,
  STUDIO_ROOM_PRESETS,
  studioAsset,
  studioPlacementAtWall,
  studioRoomBounds,
  studioPlacementWarnings,
  studioItemAsset,
  studioItemModelSuggestions,
  type RoomModel,
} from '@renovagent/core';

export function AssetThumb({ id }: { id: StudioAssetId }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let live = true;
    // Thumbnails render with the 3D engine, which loads on demand.
    void import('../room3d/furniture-assets.js')
      .then(({ furnitureThumbnail }) => furnitureThumbnail(id))
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
  onAddRoomItems,
  onPreset,
}: {
  model: RoomModel | null;
  placements: StudioPlacement[];
  items: StudioItem[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onChange: (next: StudioPlacement[]) => void;
  onAdd: (assetId: StudioAssetId) => void;
  onAddRoomItems: () => void;
  onPreset: (id: string) => void;
}) {
  const chosen = placements.find((p) => p.id === selected);
  const bounds = model ? studioRoomBounds(model) : null;
  const patch = (data: Partial<StudioPlacement>) => {
    if (chosen) onChange(placements.map((p) => (p.id === chosen.id ? { ...p, ...data } : p)));
  };
  const warnings = model ? studioPlacementWarnings(model, placements) : [];
  const suggestions = studioItemModelSuggestions(items, placements).filter((s) =>
    studioAssetAvailable(s.assetId),
  );
  const starterCount = suggestions.reduce((sum, s) => sum + s.count, 0);
  const unsupported = items.filter(
    (item) => !studioItemAsset(item.name) && !placements.some((p) => p.itemId === item.id),
  );
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
        <h3>Add furniture & fixtures</h3>
        <span>{placements.length} objects</span>
      </div>
      <p>Start with a room set or add pieces. Drag furniture to arrange it.</p>
      <section className="pf-room-presets" aria-label="Starter room layouts">
        {STUDIO_ROOM_PRESETS.filter((p) => p.assets.every(studioAssetAvailable)).map((preset) => {
          const missing = preset.assets.filter(
            (assetId) => !placements.some((p) => p.assetId === assetId),
          ).length;
          return (
            <button
              type="button"
              key={preset.id}
              aria-label={`Add ${preset.name} starter`}
              disabled={
                !model ||
                !missing ||
                placements.length + missing > 60 ||
                items.length + missing > 100
              }
              onClick={() => onPreset(preset.id)}
            >
              <span className="pf-preset-art">
                {preset.assets.slice(0, 3).map((id) => (
                  <AssetThumb key={id} id={id} />
                ))}
              </span>
              <b>{preset.name}</b>
              <small>{missing ? `Add ${missing} pieces` : 'Pieces already placed'}</small>
            </button>
          );
        })}
      </section>
      <small className="pf-inspo-note">
        Generic starter layouts · adds missing pieces without replacing your arrangement. Sizes and
        fit need checking.
      </small>
      <p className="pf-inspo-note">
        New library pieces include editable demo allowances in Plan & budget. These are illustrative
        amounts, not product prices.
      </p>
      {!placements.length && (
        <p className="pf-layout-empty" role="status">
          No furniture placed yet. A photo design does not create 3D objects.
        </p>
      )}
      {!!suggestions.length && (
        <section className="pf-layout-starters" aria-label="Room-list starter models">
          <h4>Start from your room list</h4>
          <ul>
            {suggestions.map((s) => (
              <li key={s.itemId}>
                {s.name} → {s.count} × {studioAsset(s.assetId).name}
                {s.quantityUnknown && ' (one starter; quantity unknown)'}
              </li>
            ))}
          </ul>
          <p>
            Generic models with starter sizes and positions. Arrange them to suit your room; they do
            not reproduce the photo design. Your item quantities and allowances stay as entered.
          </p>
          <button
            className="pf-design-download"
            type="button"
            disabled={!model || placements.length + starterCount > 60}
            onClick={onAddRoomItems}
          >
            Add {starterCount} starter {starterCount === 1 ? 'piece' : 'pieces'} to 3D
          </button>
          {placements.length + starterCount > 60 && (
            <p>
              The layout supports 60 objects. Reduce room-list quantities to add these starters.
            </p>
          )}
        </section>
      )}
      {!!unsupported.length && (
        <p>
          No matching library model: {unsupported.map((item) => item.name).join('; ')}. You can add
          a library piece below and link it to a room-list item.
        </p>
      )}
      {!model && (
        <p className="pf-intake-error">
          Add room dimensions to place furniture. The photo designer works without them.
        </p>
      )}
      <div className="pf-asset-grid" aria-label="3D furniture library">
        {STUDIO_ASSETS.filter((a) => studioAssetAvailable(a.id)).map((a) => (
          <button
            type="button"
            key={a.id}
            disabled={!model || placements.length >= 60}
            onClick={() => onAdd(a.id)}
            aria-label={`Add ${a.name} to 3D`}
          >
            <AssetThumb id={a.id} />
            <span>{a.name}</span>
            <small className="pf-demo-allowance">
              {DEMO_FURNITURE_ALLOWANCES[a.id] === null
                ? 'Allowance not entered'
                : `${money(DEMO_FURNITURE_ALLOWANCES[a.id]!)} · demo`}
            </small>
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
            Elevation above floor · m
            <input
              type="number"
              aria-label="Elevation above floor"
              min={0}
              max={10}
              step="0.05"
              value={chosen.yM ?? 0}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (e.target.value && Number.isFinite(n) && n >= 0 && n <= 10) patch({ yM: n });
              }}
            />
          </label>
          {model && studioAsset(chosen.assetId).url && (
            <label>
              Place against wall
              <select
                aria-label="Place fixture against wall"
                value=""
                onChange={(e) => {
                  if (e.target.value)
                    patch(
                      studioPlacementAtWall(
                        chosen.assetId,
                        model,
                        e.target.value,
                        undefined,
                        chosen,
                      ),
                    );
                }}
              >
                <option value="">Choose wall…</option>
                {model.walls.map((w, i) => (
                  <option key={w.id} value={w.id}>
                    Wall {i + 1}
                  </option>
                ))}
              </select>
            </label>
          )}
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
                Color
                <input
                  type="color"
                  aria-label="Selected furniture color"
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
          Kenney furniture · CC0 ↗
        </a>
      </p>
      <p className="pf-furniture-note">
        Bathroom fixtures: reodesuxz, project-use license. Source-mesh sizes are illustrative, not
        measured products. No code-clearance envelopes are supplied.
      </p>
    </div>
  );
}
