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
  EXAMPLE_TAG,
  exampleQuotes,
  floorPlanSvg,
  roomAnnotations,
  roomSurfaces,
  scopeDraftId,
  scopeRecipe,
  type ExampleContractor,
  type ExampleQuote,
  type RoomAnnotation,
  type RoomSurface,
} from '@renovagent/core';
import type { WorkspaceController } from '../../app/workspace-controller.js';
import { loadRoomSource, type RoomSource } from './room-source.js';
import type { RoomLook, RoomScene } from './room-scene.js';

const EXISTING: RoomLook = { wallColor: 'white', floorFinish: 'existing', label: 'Existing' };
const TIERS = ['mid', 'builder', 'high'] as const;
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

// Store searches, like the how-to videos: the person picks the product there.
const SHOPS: [string, (q: string) => string][] = [
  ['Home Depot', (q) => `https://www.homedepot.com/s/${encodeURIComponent(q)}`],
  ["Lowe's", (q) => `https://www.lowes.com/search?searchTerm=${encodeURIComponent(q)}`],
];
function Shop({ query }: { query: string }) {
  return (
    <span className="room3d-shop">
      {SHOPS.map(([name, url]) => (
        <a key={name} href={url(query)} target="_blank" rel="noopener noreferrer">
          {name}
        </a>
      ))}
    </span>
  );
}

function ExampleTag() {
  return <span className="room3d-tag">Example</span>;
}

function Stars({ c }: { c: ExampleContractor }) {
  return (
    <span className="small-note">
      ★ {c.rating.toFixed(1)} · {c.reviews} reviews
    </span>
  );
}

// One step of the work, over the room: do it yourself, or what a pro quoted.
function TaskPopup({
  pin,
  quotes,
  isExample,
  connected,
  pricing,
  onPrice,
  onClose,
}: {
  pin: RoomAnnotation;
  quotes: ExampleQuote[];
  isExample: boolean;
  connected: boolean;
  pricing: string;
  onPrice: () => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'diy' | 'pro'>('diy');
  const g = pin.guide;
  const e = pin.estimate;
  const quoted = quotes.flatMap((q) => {
    const line = q.lines.find((l) => l.packageId === pin.id);
    return line ? [{ q, line }] : [];
  });
  return (
    <div className="room3d-popup" role="dialog" aria-label={pin.title}>
      <header>
        <div>
          <span className="room3d-step-phase">{g?.phase ?? 'Other'}</span>
          <h4>{pin.title}</h4>
        </div>
        <button type="button" className="room3d-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="room3d-tiers" role="group" aria-label="Who does it">
        <button type="button" aria-pressed={mode === 'diy'} onClick={() => setMode('diy')}>
          Do it yourself
        </button>
        <button type="button" aria-pressed={mode === 'pro'} onClick={() => setMode('pro')}>
          Hire a pro
        </button>
      </div>
      {mode === 'diy' ? (
        <>
          {g && (
            <p className="room3d-diy">
              <span className={`room3d-chip diy-${g.diy.toLowerCase()}`}>{g.diy}</span>{' '}
              <span className="small-note">{g.diyNote}</span>
            </p>
          )}
          {e && (
            <dl className="room3d-costs">
              <dt>
                Materials
                <small>
                  {e.needsArea
                    ? 'Needs a measurement'
                    : e.areaSqFt !== null && g?.materialPerSqFtMinor !== undefined
                      ? `${e.areaSqFt} sq ft`
                      : (g?.materialNote ?? 'Nothing beyond the tools')}
                </small>
              </dt>
              <dd>{e.needsArea ? '—' : `≈ ${money(e.materialMinor, 'USD')}`}</dd>
              {g && g.kit.length > 0 && (
                <>
                  <dt>
                    Tools
                    <small>A pro brings their own</small>
                  </dt>
                  <dd>≈ {money(e.kitMinor, 'USD')}</dd>
                </>
              )}
              <dt className="room3d-costs-total">You pay</dt>
              <dd className="room3d-costs-total">≈ {money(e.totalMinor, 'USD')}</dd>
            </dl>
          )}
          {g?.shopFor && (
            <p className="room3d-shop-row">
              <span>Shop materials</span>
              <Shop query={g.shopFor} />
            </p>
          )}
          {g && g.kit.length > 0 && (
            <ul className="room3d-kit">
              {g.kit.map((item) => (
                <li key={item.name}>
                  <a
                    href={SHOPS[0]![1](item.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Search Home Depot"
                  >
                    {item.name}
                  </a>
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
              ▶ Watch how it's done
            </a>
          )}
          <p className="small-note">Typical big-box prices, not a quote.</p>
        </>
      ) : quoted.length ? (
        <ul className="room3d-quote-lines">
          {quoted.map(({ q, line }) => (
            <li key={q.contractor.id}>
              <div className="room3d-line-head">
                <strong>{q.contractor.name}</strong>
                <strong>{money(line.materialsMinor + line.labourMinor, 'USD')}</strong>
              </div>
              <div className="small-note">
                Materials {money(line.materialsMinor, 'USD')} · Labour{' '}
                {money(line.labourMinor, 'USD')}
                {line.areaSqFt !== null ? ` (${line.areaSqFt} sq ft)` : ''}
              </div>
              <div className="small-note">
                <Stars c={q.contractor} /> <ExampleTag />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="small-note">
          {isExample
            ? 'None of the example quotes cover this step.'
            : 'Add a quote you received to compare it here (coming soon).'}
        </p>
      )}
      {pin.unplacedReason && <p className="small-note">{pin.unplacedReason}.</p>}
      <details className="room3d-more">
        <summary>Item details{pin.costMinor !== null ? ` · ${pinCost(pin)}` : ''}</summary>
        <ul className="room3d-links">
          {pin.lines.map((l) => (
            <li key={l.requirementId}>
              <div className="room3d-line-head">
                <strong>{l.purpose}</strong>
                <span>{l.product ? money(l.product.lineTotalMinor, l.product.currency) : '—'}</span>
              </div>
              <div className="small-note">
                {l.quantity === null ? 'Quantity open' : `${l.quantity} ${l.unit}`}
                {STATUS[l.status] ? ` · ${STATUS[l.status]}` : ''}
                {l.product ? ` · ${l.product.productName}, ${l.product.retailer}` : ''}
              </div>
            </li>
          ))}
        </ul>
        {pin.costMinor === null && connected && (
          <button
            type="button"
            className="link-button"
            disabled={pricing === 'working'}
            onClick={onPrice}
          >
            {pricing === 'working' ? 'Checking prices…' : 'Check catalog prices'}
          </button>
        )}
      </details>
    </div>
  );
}

// A contractor's quote, itemized per step as materials plus labour.
function QuotePopup({ quote, onClose }: { quote: ExampleQuote; onClose: () => void }) {
  const c = quote.contractor;
  return (
    <div className="room3d-popup" role="dialog" aria-label={`Quote from ${c.name}`}>
      <header>
        <div>
          <span className="room3d-step-phase">
            {c.trade} · <ExampleTag />
          </span>
          <h4>{c.name}</h4>
          <Stars c={c} />
        </div>
        <button type="button" className="room3d-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>
      <table className="room3d-quote">
        <thead>
          <tr>
            <th>Step</th>
            <th>Materials</th>
            <th>Labour</th>
          </tr>
        </thead>
        <tbody>
          {quote.lines.map((l) => (
            <tr key={l.packageId}>
              <td>
                {l.title}
                <small>{l.basis}</small>
              </td>
              <td>{money(l.materialsMinor, 'USD')}</td>
              <td>{money(l.labourMinor, 'USD')}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td colSpan={2}>{money(quote.totalMinor, 'USD')}</td>
          </tr>
        </tfoot>
      </table>
      {quote.notQuoted.length > 0 && (
        <p className="small-note">Not in this quote: {quote.notQuoted.join(', ')}.</p>
      )}
      {quote.needsArea.length > 0 && (
        <p className="small-note">Needs a measurement first: {quote.needsArea.join(', ')}.</p>
      )}
      <blockquote className="room3d-review">
        “{c.review.text}” <cite>{c.review.author}</cite>
      </blockquote>
      <p className="small-note">
        Example contractor, quote and reviews, made up for this demo. Tax not included.
      </p>
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
  // Catalog prices sit in each step's details; the mid-range plan is enough there.
  const plan = plans[0] ?? undefined;
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
  // Example quotes only for the labelled example; real projects get none.
  const isExample = !!scopeDraft?.request.startsWith(EXAMPLE_TAG);
  const quotes = useMemo(
    () => (isExample && notes ? exampleQuotes(notes.steps) : []),
    [isExample, notes],
  );
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const allPins = notes ? [...notes.pins, ...notes.unplaced] : [];
  const choosePin = (id: string | null) => {
    setPinId(id);
    setQuoteId(null);
    setSelectedId(null);
    const pin = allPins.find((p) => p.id === id);
    scene.current?.select(pin?.surfaceIds ?? []);
    scene.current?.focusPin(id);
  };
  // Clicking a surface opens the work acting on it; plain surfaces show geometry.
  const chooseSurface = (surfaceId: string | null) => {
    const pin = surfaceId ? notes?.pins.find((p) => p.surfaceIds.includes(surfaceId)) : undefined;
    setQuoteId(null);
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
  // Esc closes whichever popup is open.
  const popupOpen = !!(pinId || quoteId || selectedId);
  useEffect(() => {
    if (!popupOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && choosePinRef.current(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [popupOpen]);

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
  const activeQuote = quotes.find((q) => q.contractor.id === quoteId) ?? null;
  const fullQuotes = quotes.filter((q) => !q.notQuoted.length && !q.needsArea.length);
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
        <div className="room3d-stage">
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
          {activePin ? (
            <TaskPopup
              key={activePin.id}
              pin={activePin}
              quotes={quotes}
              isExample={isExample}
              connected={controller.connected}
              pricing={pricing}
              onPrice={() => void price()}
              onClose={() => choosePin(null)}
            />
          ) : activeQuote ? (
            <QuotePopup quote={activeQuote} onClose={() => setQuoteId(null)} />
          ) : selected ? (
            <div className="room3d-popup" role="dialog" aria-label={selected.label}>
              <header>
                <div />
                <button
                  type="button"
                  className="room3d-close"
                  aria-label="Close"
                  onClick={() => choosePin(null)}
                >
                  ×
                </button>
              </header>
              <SurfaceDetail surface={selected} />
              <p className="small-note">No planned work on this surface.</p>
            </div>
          ) : null}
        </div>
        <aside className="room3d-side">
          {!scopeDraft || replanning ? (
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
            </>
          ) : (
            <>
              <div className="room3d-compare">
                <div>
                  <span className="eyebrow">Do it yourself</span>
                  <strong>
                    {template
                      ? `≈ ${money(template.materialsMinor + template.toolsMinor, 'USD')}`
                      : '—'}
                  </strong>
                  <span className="small-note">Materials and tools</span>
                </div>
                <div>
                  <span className="eyebrow">Hire a pro</span>
                  <strong>
                    {fullQuotes.length ? `${money(fullQuotes[0]!.totalMinor, 'USD')}` : '—'}
                  </strong>
                  <span className="small-note">
                    {fullQuotes.length ? 'Lowest full quote' : 'No quotes yet'}
                  </span>
                </div>
              </div>
              {!!template?.needsArea && (
                <p className="small-note">
                  {template.needsArea} step{template.needsArea > 1 ? 's need' : ' needs'} a
                  measurement to price.
                </p>
              )}
              <ol className="room3d-order">
                {steps.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-current={pinId === s.id || undefined}
                      onClick={() => choosePin(s.id)}
                    >
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
              <div className="room3d-quotes">
                <span className="eyebrow">Contractor quotes</span>
                {quotes.length ? (
                  quotes.map((q) => (
                    <button
                      key={q.contractor.id}
                      type="button"
                      aria-current={quoteId === q.contractor.id || undefined}
                      onClick={() => {
                        choosePin(null);
                        setQuoteId(q.contractor.id);
                      }}
                    >
                      <span>
                        <strong>{q.contractor.name}</strong> <ExampleTag />
                        <br />
                        <Stars c={q.contractor} />
                        {q.notQuoted.length > 0 && (
                          <span className="small-note"> · part of the job</span>
                        )}
                      </span>
                      <strong>{money(q.totalMinor, 'USD')}</strong>
                    </button>
                  ))
                ) : (
                  <p className="small-note">Add a quote you received (coming soon).</p>
                )}
              </div>
              <button
                type="button"
                className="link-button subtle"
                onClick={() => setReplanning(true)}
              >
                Change the work
              </button>
            </>
          )}
          {pricing && pricing !== 'working' && (
            <p role="alert" className="small-note">
              {pricing}
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
