import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  DesignOptions,
  PurchasePlanPayload,
  ScopeDraft,
  Workspace,
} from '@renovagent/contracts';
import {
  designOptionsId,
  dimensionLabel,
  floorPlanSvg,
  roomSurfaces,
  scopeDraftId,
  type RoomSurface,
} from '@renovagent/core';
import type { WorkspaceController } from '../../app/workspace-controller.js';
import { loadRoomSource, type RoomSource } from './room-source.js';
import type { RoomLook, RoomScene } from './room-scene.js';

const EXISTING: RoomLook = { wallColor: 'white', floorFinish: 'existing', label: 'Existing' };
const m2 = (v: number | null | undefined) =>
  v === null || v === undefined
    ? 'not established'
    : `${v} m² (${Math.round(v * 10.7639 * 10) / 10} sq ft)`;
const money = (minor: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100);

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function proposedLook(state: Workspace, projectId: string): RoomLook | null {
  const options = state.artifacts[designOptionsId(projectId)]?.at(-1)?.payload as
    | DesignOptions
    | undefined;
  const selected = options?.options.find((o) => o.id === options.selectedOptionId);
  return selected ? { ...selected.direction, label: `Proposed: ${selected.title}` } : null;
}

function SurfaceDetail({ surface }: { surface: RoomSurface }) {
  const g = surface.geometry;
  return (
    <div className="room3d-detail" aria-live="polite">
      <h4>{surface.label}</h4>
      <p className="small-note">Measured geometry (not verified)</p>
      <dl>
        {g.lengthM !== undefined && (
          <>
            <dt>Length</dt>
            <dd>{dimensionLabel(g.lengthM)}</dd>
          </>
        )}
        {g.heightM !== undefined && (
          <>
            <dt>Height</dt>
            <dd>{g.heightM === null ? 'not established' : dimensionLabel(g.heightM)}</dd>
          </>
        )}
        {g.grossAreaM2 !== undefined && (
          <>
            <dt>Gross area</dt>
            <dd>{m2(g.grossAreaM2)}</dd>
          </>
        )}
        {!!g.openingsAreaM2 && (
          <>
            <dt>Openings</dt>
            <dd>{m2(g.openingsAreaM2)} (not deducted)</dd>
          </>
        )}
        {g.areaM2 !== undefined && (
          <>
            <dt>Area</dt>
            <dd>{m2(g.areaM2)}</dd>
          </>
        )}
        {g.widthM !== undefined && (
          <>
            <dt>Footprint</dt>
            <dd>
              {dimensionLabel(g.widthM)} × {dimensionLabel(g.depthM!)}
            </dd>
          </>
        )}
      </dl>
      {surface.notes.map((n) => (
        <p key={n} className="small-note">
          {n}
        </p>
      ))}
      <h5>In the scope</h5>
      {surface.links.length === 0 ? (
        <p className="small-note">No scope item acts on this surface yet.</p>
      ) : (
        <ul className="room3d-links">
          {surface.links.map((l) => (
            <li key={l.requirementId}>
              <strong>{l.purpose}</strong>
              <div>
                {l.quantity === null ? 'Quantity open' : `${l.quantity} ${l.unit}`}{' '}
                <span className="small-note">· package total · {l.quantityBasis}</span>
              </div>
              {l.product ? (
                <div className="room3d-product">
                  <div className="room3d-product-image" aria-label="No product image on file">
                    No product image on file
                  </div>
                  <div>
                    {l.product.name}
                    <div className="small-note">
                      {l.product.retailer} · SKU {l.product.sku} ·{' '}
                      {money(l.product.lineTotalMinor, l.product.currency)} · price{' '}
                      {l.product.freshness}
                    </div>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RoomStudio({
  state,
  projectId,
  controller,
}: {
  state: Workspace;
  projectId: string;
  controller: WorkspaceController;
}) {
  const [source, setSource] = useState<RoomSource | null>(null);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<'3d' | 'plan'>('3d');
  const [webglError, setWebglError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Wall dimensions default on for one room, off for busy multi-room plans.
  const [showDims, setShowDims] = useState<boolean | null>(null);
  const proposed = proposedLook(state, projectId);
  const [showProposed, setShowProposed] = useState(true);
  const look = showProposed && proposed ? proposed : EXISTING;
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<RoomScene | null>(null);

  // Reload when the room facts change (a new plan or new measurements).
  const factKey = Object.values(state.facts)
    .map((v) => v.at(-1)!)
    .filter((f) => f.projectId === projectId)
    .map((f) => `${f.id}@${f.revision}`)
    .join(',');
  useEffect(() => {
    let live = true;
    loadRoomSource(state, projectId, (id) => controller.repository.readBlob(id))
      .then((s) => live && (setSource(s), setLoadError('')))
      .catch((e) => live && setLoadError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, factKey]);

  const draft = state.artifacts[scopeDraftId(projectId)]?.at(-1);
  const plan = ['builder', 'mid', 'high']
    .map((t) => state.artifacts[`${projectId}:purchase-plan:${t}`]?.at(-1))
    .find(Boolean);
  const surfaces = useMemo(
    () =>
      source
        ? roomSurfaces(
            source.model,
            draft?.payload.kind === 'scope-draft' ? (draft.payload as ScopeDraft) : null,
            plan?.payload.kind === 'purchase-plan' ? (plan.payload as PurchasePlanPayload) : null,
          )
        : [],
    [source, draft, plan],
  );
  const title = state.projects[projectId]?.name ?? 'Room';
  const svg = useMemo(
    () => (source ? floorPlanSvg(source.model, { title, sourceLabel: source.label }) : ''),
    [source, title],
  );

  useEffect(() => {
    if (!source || view !== '3d' || !host.current) return;
    let disposed = false;
    const el = host.current;
    import('./room-scene.js')
      .then(({ mountRoomScene }) => {
        if (disposed) return;
        scene.current = mountRoomScene(el, source.model, surfaces, look, setSelectedId, {
          sourceEvidenceId: source.evidenceId,
          title,
        });
      })
      .catch((e) => {
        setWebglError(e instanceof Error ? e.message : String(e));
        setView('plan');
      });
    return () => {
      disposed = true;
      scene.current?.dispose();
      scene.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, view, surfaces]);
  useEffect(() => scene.current?.setLook(look), [look]);

  if (loadError) return <p role="alert">Could not read the floor plan: {loadError}</p>;
  if (!source)
    return (
      <section className="room3d" aria-label="Room studio">
        <h3>Room studio</h3>
        <p className="small-note">
          Save a floor plan or your room&apos;s length and width above to see the room in 3D and as
          a dimensioned drawing.
        </p>
      </section>
    );
  const selected = surfaces.find((s) => s.id === selectedId) ?? null;
  return (
    <section className="room3d" aria-label="Room studio">
      <header className="room3d-head">
        <div>
          <h3>Room studio</h3>
          <p className="small-note">
            {source.label} · {source.model.walls.length} walls ·{' '}
            {source.model.walls.reduce((n, w) => n + w.openings.length, 0)} openings · measured, not
            verified
          </p>
        </div>
        <div className="room3d-actions" role="group" aria-label="Room view">
          <button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}>
            3D
          </button>
          <button type="button" aria-pressed={view === 'plan'} onClick={() => setView('plan')}>
            Plan drawing
          </button>
          {proposed && (
            <button
              type="button"
              aria-pressed={showProposed}
              onClick={() => setShowProposed((v) => !v)}
            >
              {showProposed ? proposed.label : 'Existing'}
            </button>
          )}
          <button type="button" onClick={() => download(`${title}-plan.svg`, svg, 'image/svg+xml')}>
            Download drawing
          </button>
          {view === '3d' && (
            <button
              type="button"
              aria-pressed={showDims ?? source.model.walls.length <= 8}
              onClick={() => setShowDims(!(showDims ?? source.model.walls.length <= 8))}
            >
              Dimensions
            </button>
          )}
          {view === '3d' && (
            <button
              type="button"
              onClick={() =>
                void scene.current
                  ?.exportGlb()
                  .then((glb) => download(`${title}.glb`, glb, 'model/gltf-binary'))
              }
            >
              Download 3D (.glb)
            </button>
          )}
        </div>
      </header>
      {[...source.warnings, ...source.model.notes].map((w) => (
        <p key={w} role="status" className="small-note">
          {w}
        </p>
      ))}
      {webglError && (
        <p role="status" className="small-note">
          3D is unavailable in this browser ({webglError}); showing the drawing.
        </p>
      )}
      {showProposed && proposed && view === '3d' && (
        <p className="small-note">
          Colours and finishes are illustrative swatches for “{proposed.wallColor}” and “
          {proposed.floorFinish}”, not product photos.
        </p>
      )}
      <div className="room3d-body">
        {view === '3d' ? (
          <div
            key="canvas"
            ref={host}
            className={`room3d-canvas${(showDims ?? source.model.walls.length <= 8) ? '' : ' hide-dims'}`}
            data-testid="room3d-canvas"
          />
        ) : (
          <div key="plan" className="room3d-plan" dangerouslySetInnerHTML={{ __html: svg }} />
        )}
        <aside className="room3d-side">
          {selected ? (
            <SurfaceDetail surface={selected} />
          ) : (
            <p className="small-note">Click a wall, the floor or a fixture to see its scope.</p>
          )}
          <h5>Surfaces</h5>
          <ul className="room3d-surfaces">
            {surfaces.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  aria-pressed={s.id === selectedId}
                  onClick={() => {
                    setSelectedId(s.id);
                    scene.current?.select(s.id);
                  }}
                >
                  {s.label}
                  {s.links.length ? ` · ${s.links.length} scope items` : ''}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
