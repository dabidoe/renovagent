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
  roomAnnotations,
  roomSurfaces,
  scopeDraftId,
  scopeRecipe,
  type RoomAnnotation,
  type RoomSurface,
} from '@renovagent/core';
import type { WorkspaceController } from '../../app/workspace-controller.js';
import { loadRoomSource, type RoomSource } from './room-source.js';
import type { RoomLook, RoomScene } from './room-scene.js';

const EXISTING: RoomLook = { wallColor: 'white', floorFinish: 'existing', label: 'Existing' };
const TIERS = ['mid', 'builder', 'high'] as const;
const TIER_LABEL: Record<(typeof TIERS)[number], string> = {
  builder: 'Budget',
  mid: 'Mid-range',
  high: 'Premium',
};
const m2 = (v: number | null | undefined) =>
  v === null || v === undefined
    ? 'not established'
    : `${v} m² (${Math.round(v * 10.7639 * 10) / 10} sq ft)`;
const money = (minor: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: minor % 100 ? 2 : 0,
  }).format(minor / 100);
const pinCost = (a: RoomAnnotation) =>
  a.costMinor === null || !a.currency ? 'not priced' : money(a.costMinor, a.currency);
const STATUS: Record<string, string> = {
  quantified: '',
  'needs-input': 'needs a measurement',
  'needs-product-spec': 'needs a product choice',
  conditional: 'only if needed',
  'needs-source': 'needs a source',
};

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

// Without a chosen design option, the planned work implies an illustrative
// look: the floor package names the new finish, carpet removal the old one.
// Wall colour is not in the scope, so it stays as is.
const FLOOR_FINISH: Record<string, string> = {
  'lvp-floor': 'vinyl plank',
  'hardwood-floor': 'hardwood',
  'floor-tile': 'tile',
};
function scopeLooks(draft: ScopeDraft | null): { existing: RoomLook; proposed: RoomLook | null } {
  const included = new Set(draft?.packages.filter((p) => p.included).map((p) => p.id));
  const existing = {
    ...EXISTING,
    floorFinish: included.has('carpet-removal') ? 'carpet' : EXISTING.floorFinish,
  };
  const floor = Object.keys(FLOOR_FINISH).find((id) => included.has(id));
  return {
    existing,
    proposed: floor
      ? { ...existing, floorFinish: FLOOR_FINISH[floor]!, label: 'Proposed: planned work' }
      : null,
  };
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
    </div>
  );
}

function AnnotationDetail({
  pin,
  surfaces,
  onBack,
}: {
  pin: RoomAnnotation;
  surfaces: RoomSurface[];
  onBack: () => void;
}) {
  void surfaces;
  const g = pin.guide;
  const e = pin.estimate;
  return (
    <div className="room3d-detail" aria-live="polite">
      <button type="button" className="link-button subtle" onClick={onBack}>
        ← Overview
      </button>
      <h4>{pin.title}</h4>
      {g && (
        <p className="room3d-diy">
          <span className={`room3d-chip diy-${g.diy.toLowerCase()}`}>DIY: {g.diy}</span>{' '}
          <span className="small-note">{g.diyNote}</span>
        </p>
      )}
      {e && (
        <dl className="room3d-costs">
          <dt>
            Materials
            <small>
              {g?.materialNote ?? 'No materials beyond the kit'}
              {e.areaSqFt !== null && g?.materialPerSqFtMinor !== undefined
                ? ` · ${e.areaSqFt} sq ft measured`
                : ''}
            </small>
          </dt>
          <dd>{e.needsArea ? 'needs a measurement' : `≈ ${money(e.materialMinor, 'USD')}`}</dd>
          {g && g.kit.length > 0 && (
            <>
              <dt>
                DIY tools
                <small>A contractor brings these</small>
              </dt>
              <dd>≈ {money(e.kitMinor, 'USD')}</dd>
            </>
          )}
          <dt className="room3d-costs-total">DIY total</dt>
          <dd className="room3d-costs-total">≈ {money(e.totalMinor, 'USD')}</dd>
        </dl>
      )}
      {g && g.kit.length > 0 && (
        <ul className="room3d-kit">
          {g.kit.map((item) => (
            <li key={item.name}>
              <span>{item.name}</span>
              <span>{money(item.priceMinor, 'USD')}</span>
            </li>
          ))}
        </ul>
      )}
      {g && (
        <a
          className="room3d-video"
          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(g.videoSearch)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          ▶ Watch how-to videos
        </a>
      )}
      <p className="small-note">
        Template prices: typical retail, not a quote. Hiring out adds labour (not estimated).
      </p>
      {pin.unplacedReason && <p className="small-note">{pin.unplacedReason}.</p>}
      <details className="room3d-more">
        <summary>
          Line items and store prices
          {pin.costMinor !== null ? ` · ${pinCost(pin)} found` : ''}
        </summary>
        <p className="small-note">{pin.summary}</p>
        <ul className="room3d-links">
          {pin.lines.map((l) => (
            <li key={l.requirementId}>
              <div className="room3d-line-head">
                <strong>{l.purpose}</strong>
                <span>
                  {l.product ? money(l.product.lineTotalMinor, l.product.currency) : 'not priced'}
                </span>
              </div>
              <div className="small-note">
                {l.quantity === null ? 'Quantity open' : `${l.quantity} ${l.unit}`}
                {STATUS[l.status] ? ` · ${STATUS[l.status]}` : ''}
              </div>
              {l.product && (
                <div className="room3d-product">
                  <div className="room3d-product-image" aria-label="No product image on file">
                    No image on file
                  </div>
                  <div>
                    {l.product.productName}
                    <div className="small-note">
                      {l.product.retailer} · SKU {l.product.sku} · price {l.product.freshness}
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

const ROOMS = [
  {
    recipeId: 'bathroom-refresh',
    label: 'Bathroom',
    request: 'Refresh this bathroom',
    defaults: ['removal-protection', 'vanity', 'toilet', 'floor-tile', 'paint', 'exhaust-fan'],
  },
  {
    recipeId: 'living-room-refresh',
    label: 'Living room',
    request: 'Refresh this living room',
    defaults: ['removal-protection', 'wall-paint', 'carpet-removal', 'lvp-floor'],
  },
] as const;

// Picks a room type and its work packages, then drafts the scope from the
// recorded room facts. Nothing is priced or ordered here.
function WorkPlanner({
  onDraft,
  busy,
}: {
  onDraft: (recipeId: string, packageIds: string[], request: string) => void;
  busy: boolean;
}) {
  const [room, setRoom] = useState<(typeof ROOMS)[number]>(ROOMS[0]);
  const [picked, setPicked] = useState<string[]>([...ROOMS[0].defaults]);
  const packages = scopeRecipe(room.recipeId).packages;
  return (
    <div className="room3d-summary room3d-planner">
      <h4>Plan the work</h4>
      <div className="room3d-tiers" role="group" aria-label="Room type">
        {ROOMS.map((r) => (
          <button
            key={r.recipeId}
            type="button"
            aria-pressed={r === room}
            onClick={() => {
              setRoom(r);
              setPicked([...r.defaults]);
            }}
          >
            {r.label}
          </button>
        ))}
      </div>
      <ul className="room3d-checks">
        {packages.map((p) => (
          <li key={p.id}>
            <label>
              <input
                type="checkbox"
                checked={picked.includes(p.id)}
                onChange={(e) =>
                  setPicked((now) =>
                    e.target.checked ? [...now, p.id] : now.filter((id) => id !== p.id),
                  )
                }
              />{' '}
              {p.title}
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="primary"
        disabled={busy || !picked.length}
        onClick={() =>
          onDraft(
            room.recipeId,
            packages.map((p) => p.id).filter((id) => picked.includes(id)),
            room.request,
          )
        }
      >
        Pin this work in the room
      </button>
      <span className="small-note">
        Quantities come from your recorded measurements; missing ones stay open.
      </span>
    </div>
  );
}

export function RoomStudio({
  state,
  projectId,
  controller,
  heading = 'Room studio',
}: {
  state: Workspace;
  projectId: string;
  controller: WorkspaceController;
  heading?: string;
}) {
  const [source, setSource] = useState<RoomSource | null>(null);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<'3d' | 'plan'>('3d');
  const [webglError, setWebglError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pinId, setPinId] = useState<string | null>(null);
  const [pricing, setPricing] = useState('');
  const [replanning, setReplanning] = useState(false);
  // Wall dimensions default on for one room, off for busy multi-room plans.
  const [showDims, setShowDims] = useState<boolean | null>(null);
  const [showProposed, setShowProposed] = useState(true);
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
  const plans = TIERS.map((t) => state.artifacts[`${projectId}:purchase-plan:${t}`]?.at(-1)).filter(
    (p) => p?.payload.kind === 'purchase-plan',
  );
  const [tier, setTier] = useState<string | null>(null);
  const plan =
    plans.find((p) => (p!.payload as PurchasePlanPayload).tier === tier) ?? plans[0] ?? undefined;
  // Every command re-reads the workspace into new objects, so key on revisions:
  // unrelated changes (a chat draft, a view switch) must not rebuild the scene.
  const scopeKey = `${draft?.revision ?? 0}:${plan?.id ?? ''}@${plan?.revision ?? 0}`;
  const scopeDraft = draft?.payload.kind === 'scope-draft' ? (draft.payload as ScopeDraft) : null;
  const planPayload = plan ? (plan.payload as PurchasePlanPayload) : null;
  // A chosen design option sets the proposed look; otherwise the planned work does.
  const fromScope = scopeLooks(scopeDraft);
  const proposedNow = proposedLook(state, projectId) ?? fromScope.proposed;
  const existingNow = fromScope.existing;
  // Stable look objects: a new object each render would rebuild the floor texture.
  const proposed = useMemo(
    () => proposedNow,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [proposedNow?.wallColor, proposedNow?.floorFinish, proposedNow?.label],
  );
  const existing = useMemo(
    () => existingNow,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [existingNow.floorFinish],
  );
  const look = showProposed && proposed ? proposed : existing;
  const surfaces = useMemo(
    () => (source ? roomSurfaces(source.model, scopeDraft, planPayload) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, scopeKey],
  );
  const notes = useMemo(
    () => (source ? roomAnnotations(source.model, scopeDraft, planPayload) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, scopeKey],
  );
  const title = state.projects[projectId]?.name ?? 'Room';
  const svg = useMemo(
    () => (source ? floorPlanSvg(source.model, { title, sourceLabel: source.label }) : ''),
    [source, title],
  );
  const allPins = notes ? [...notes.pins, ...notes.unplaced] : [];
  const choosePin = (id: string | null) => {
    setPinId(id);
    setSelectedId(null);
    const pin = allPins.find((p) => p.id === id);
    scene.current?.select(pin?.surfaceIds ?? []);
    scene.current?.focusPin(id);
  };
  // Clicking a surface opens the work acting on it; plain surfaces show geometry.
  const chooseSurface = (surfaceId: string | null) => {
    const pin = surfaceId ? notes?.pins.find((p) => p.surfaceIds.includes(surfaceId)) : undefined;
    if (pin) {
      setPinId(pin.id);
      setSelectedId(null);
      scene.current?.select(pin.surfaceIds);
      scene.current?.focusPin(pin.id);
    } else {
      setPinId(null);
      setSelectedId(surfaceId);
      scene.current?.focusPin(null);
    }
  };
  const chooseSurfaceRef = useRef(chooseSurface);
  chooseSurfaceRef.current = chooseSurface;
  const choosePinRef = useRef(choosePin);
  choosePinRef.current = choosePin;

  useEffect(() => {
    if (!source || view !== '3d' || !host.current) return;
    let disposed = false;
    const el = host.current;
    import('./room-scene.js')
      .then(({ mountRoomScene }) => {
        if (disposed) return;
        scene.current = mountRoomScene(
          el,
          source.model,
          surfaces,
          look,
          (id) => chooseSurfaceRef.current(id),
          { sourceEvidenceId: source.evidenceId, title },
          notes?.pins ?? [],
          (id) => choosePinRef.current(id),
          (p: RoomAnnotation) =>
            p.estimate ? `≈ ${money(p.estimate.totalMinor, 'USD')}` : pinCost(p),
        );
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
  }, [source, view, surfaces, notes]);
  useEffect(() => scene.current?.setLook(look), [look]);

  const run = async (work: () => Promise<unknown>) => {
    setPricing('working');
    try {
      await work();
      setPricing('');
      return true;
    } catch (e) {
      setPricing(e instanceof Error ? e.message : String(e));
      return false;
    }
  };
  const price = () => run(() => controller.priceScopeDraft(projectId));
  // Connected workspaces price straight away; the catalog is on the server.
  const draftWork = async (recipeId: string, packageIds: string[], request: string) => {
    const drafted = await run(() =>
      controller.draftScope(projectId, recipeId, packageIds, request),
    );
    if (!drafted) return;
    setReplanning(false);
    choosePin(null);
    if (controller.connected) await price();
  };

  if (loadError) return <p role="alert">Could not read the floor plan: {loadError}</p>;
  if (!source)
    return (
      <section className="room3d room3d-empty" aria-label={heading}>
        <h3>{heading}</h3>
        <p>
          Bring in your room to see it in 3D, with every planned piece of work pinned where it
          happens and what it costs.
        </p>
        <p className="small-note">
          Import a floor plan from a scanning app, or enter the room&apos;s length and width.
        </p>
      </section>
    );
  const selected = surfaces.find((s) => s.id === selectedId) ?? null;
  const activePin = allPins.find((p) => p.id === pinId) ?? null;
  // Dimension labels are opt-in: the room reads better without them.
  const dimsOn = showDims ?? false;
  const steps = notes?.steps ?? [];
  const template = notes?.template ?? null;
  return (
    <section className="room3d" aria-label={heading}>
      <header className="room3d-head">
        <div>
          <h3>{heading}</h3>
          <p className="small-note">{source.label} · measured, not verified</p>
        </div>
        <div className="room3d-actions" role="group" aria-label="Room view">
          <button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}>
            3D
          </button>
          <button type="button" aria-pressed={view === 'plan'} onClick={() => setView('plan')}>
            Plan
          </button>
          {proposed && (
            <button
              type="button"
              aria-pressed={showProposed}
              onClick={() => setShowProposed((v) => !v)}
            >
              {showProposed ? 'After' : 'Before'}
            </button>
          )}
          <details className="room3d-menu">
            <summary aria-label="More">⋯</summary>
            <div>
              {view === '3d' && (
                <button type="button" onClick={() => setShowDims(!dimsOn)}>
                  {dimsOn ? 'Hide' : 'Show'} dimensions
                </button>
              )}
              <button
                type="button"
                onClick={() => download(`${title}-plan.svg`, svg, 'image/svg+xml')}
              >
                Download drawing (SVG)
              </button>
              {view === '3d' && (
                <button
                  type="button"
                  onClick={() =>
                    void scene.current
                      ?.exportGlb()
                      .then((glb) => download(`${title}.glb`, glb, 'model/gltf-binary'))
                  }
                >
                  Download 3D model (GLB)
                </button>
              )}
            </div>
          </details>
        </div>
      </header>
      {source.warnings.map((w) => (
        <p key={w} role="status" className="small-note">
          {w}
        </p>
      ))}
      {webglError && (
        <p role="status" className="small-note">
          3D is unavailable in this browser ({webglError}); showing the drawing.
        </p>
      )}
      {steps.length > 0 && !replanning && (
        <nav className="room3d-steps" role="tablist" aria-label="Order of work">
          <button type="button" role="tab" aria-selected={!pinId} onClick={() => choosePin(null)}>
            <span className="room3d-step-phase">All</span>
            <span>Overview</span>
          </button>
          {steps.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={pinId === s.id}
              onClick={() => choosePin(s.id)}
            >
              <span className="room3d-step-phase">{s.guide?.phase ?? 'Other'}</span>
              <span>{s.title}</span>
            </button>
          ))}
        </nav>
      )}
      <div className="room3d-body">
        {view === '3d' ? (
          <div
            key="canvas"
            ref={host}
            className={`room3d-canvas${dimsOn ? '' : ' hide-dims'}`}
            data-testid="room3d-canvas"
          />
        ) : (
          <div key="plan" className="room3d-plan" dangerouslySetInnerHTML={{ __html: svg }} />
        )}
        <aside className="room3d-side">
          {activePin ? (
            <AnnotationDetail pin={activePin} surfaces={surfaces} onBack={() => choosePin(null)} />
          ) : selected ? (
            <>
              <button
                type="button"
                className="link-button subtle"
                onClick={() => chooseSurface(null)}
              >
                ← Overview
              </button>
              <SurfaceDetail surface={selected} />
              <p className="small-note">No planned work acts on this surface.</p>
            </>
          ) : !scopeDraft || replanning ? (
            <>
              <WorkPlanner
                busy={pricing === 'working'}
                onDraft={(recipeId, packageIds, request) =>
                  void draftWork(recipeId, packageIds, request)
                }
              />
              {replanning && (
                <button
                  type="button"
                  className="link-button subtle"
                  onClick={() => setReplanning(false)}
                >
                  Keep the current plan
                </button>
              )}
              {pricing && pricing !== 'working' && (
                <p role="alert" className="small-note">
                  {pricing}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="room3d-summary">
                <span className="eyebrow">DIY estimate · template prices</span>
                <strong className="room3d-total">
                  {template
                    ? `≈ ${money(template.materialsMinor + template.toolsMinor, 'USD')}`
                    : 'Not estimated'}
                </strong>
                {template && (
                  <span className="small-note">
                    Materials ≈ {money(template.materialsMinor, 'USD')} · DIY tools ≈{' '}
                    {money(template.toolsMinor, 'USD')}
                    <br />
                    Hiring out: materials plus labour (not estimated)
                  </span>
                )}
                {!!template?.needsArea && (
                  <span className="small-note">
                    {template.needsArea} step{template.needsArea > 1 ? 's need' : ' needs'} a
                    measurement to price materials.
                  </span>
                )}
              </div>
              <ol className="room3d-order">
                {steps.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => choosePin(s.id)}>
                      <span className="room3d-step-phase">{s.guide?.phase ?? 'Other'}</span>
                      <span className="room3d-pin-title">{s.title}</span>
                      {s.guide && (
                        <span className={`room3d-chip diy-${s.guide.diy.toLowerCase()}`}>
                          {s.guide.diy}
                        </span>
                      )}
                      <span className="room3d-pin-cost">
                        {s.estimate ? `≈ ${money(s.estimate.totalMinor, 'USD')}` : '—'}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              <div className="room3d-store">
                {notes?.totalMinor != null && notes.currency ? (
                  <>
                    <span className="small-note">
                      Store prices found: {money(notes.totalMinor, notes.currency)} for{' '}
                      {notes.priced} of {notes.items} items (demo catalog)
                    </span>
                    {plans.length > 1 && (
                      <div className="room3d-tiers" role="group" aria-label="Price tier">
                        {plans.map((p) => {
                          const t = (p!.payload as PurchasePlanPayload).tier;
                          return (
                            <button
                              key={t}
                              type="button"
                              aria-pressed={p === plan}
                              onClick={() => setTier(t)}
                            >
                              {TIER_LABEL[t as keyof typeof TIER_LABEL] ?? t}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : controller.connected ? (
                  <button
                    type="button"
                    className="link-button"
                    disabled={pricing === 'working'}
                    onClick={() => void price()}
                  >
                    {pricing === 'working' ? 'Checking store prices…' : 'Check store prices'}
                  </button>
                ) : null}
                {pricing && pricing !== 'working' && (
                  <p role="alert" className="small-note">
                    {pricing}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="link-button subtle"
                onClick={() => setReplanning(true)}
              >
                Change the work
              </button>
              {source.model.notes.map((n) => (
                <p key={n} className="small-note">
                  {n}
                </p>
              ))}
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
