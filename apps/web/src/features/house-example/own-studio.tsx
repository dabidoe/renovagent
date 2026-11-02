import { useEffect, useRef, useState } from 'react';
import { workspaceRequest } from '../../adapters/http/project-repository.js';
import { Glyph } from '../../components/glyph.js';
import { SignInChoices } from '../connect/sign-in.js';
import { PaintFloorStudio, parseFeet, type SavedStudioDesign } from './paint-floor-studio.js';
import { imageUrl, ownProject, photoSha, type PlanRoom, type ReadPhoto } from './own-project.js';
import type { HouseProject, Masks, StudioRoom } from './paint-floor.js';
import { loadOwnIntake, saveOwnIntake, type OwnIntakeDraft } from './own-intake-draft.js';

const STORE = 'renovagent.own-project.v1';
type Saved = { project: HouseProject; plans: PlanRoom[] };
function load(): Saved | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null') as Saved | null;
    return saved?.project?.rooms?.length ? saved : null;
  } catch {
    return null;
  }
}
function keep(saved: Saved | null) {
  try {
    if (saved) localStorage.setItem(STORE, JSON.stringify(saved));
    else localStorage.removeItem(STORE);
    return true;
  } catch {
    // The project still works for this visit.
    return false;
  }
}

const upload = async (file: File) =>
  (
    (await workspaceRequest('/studio/photo', file)) as {
      sha256: string;
    }
  ).sha256;
const outline = (sha256: string) => workspaceRequest('/studio/walls', { sha256 }) as Promise<Masks>;

type Step = { label: string; state: 'waiting' | 'working' | 'done' };
const MAX_PHOTOS = 8;

// What the home page handed over: the owner's words and room photos.
export type OwnStart = { idea: string; photos: File[] };

function Intake({
  start,
  draft,
  onBuilt,
  onSignedIn,
}: {
  start?: OwnStart | null;
  draft?: OwnIntakeDraft | null;
  onBuilt: (saved: Saved) => void;
  onSignedIn?: () => Promise<void>;
}) {
  const [where, setWhere] = useState(draft?.where ?? '');
  const [ceiling, setCeiling] = useState(draft?.ceiling ?? '');
  const [idea, setIdea] = useState(start?.idea || draft?.idea || '');
  const [photos, setPhotos] = useState<File[]>(
    start?.photos.length ? start.photos.slice(0, MAX_PHOTOS) : (draft?.photos ?? []),
  );
  const [plans, setPlans] = useState<File[]>(draft?.plans ?? []);
  const [recovery, setRecovery] = useState('');
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [error, setError] = useState('');
  const [needsAccess, setNeedsAccess] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const planInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let live = true;
    setRecovery('Saving draft in this browser…');
    void saveOwnIntake({ where, ceiling, idea, photos, plans }).then(
      () =>
        live &&
        setRecovery(
          'Photo files and brief saved in this browser. No project saved to your account yet.',
        ),
      () =>
        live &&
        setRecovery(
          'This browser could not save the draft. Keep this tab open to retain your photos and brief.',
        ),
    );
    return () => {
      live = false;
    };
  }, [where, ceiling, idea, photos, plans]);
  const build = async (analyze = true) => {
    setError('');
    const list: Step[] = [
      { label: `Uploading ${photos.length + plans.length} images`, state: 'working' },
      { label: 'Muse Spark reads each room and the plan', state: 'waiting' },
      { label: 'SAM 3.1 outlines the walls', state: 'waiting' },
    ];
    let stage = 'Uploading photos';
    const advance = (i: number) => {
      stage = list[i]!.label;
      setSteps(
        list.map((s, j) => ({ ...s, state: j < i ? 'done' : j === i ? 'working' : 'waiting' })),
      );
    };
    advance(0);
    try {
      await saveOwnIntake({ where, ceiling, idea, photos, plans }).catch(() => {
        setRecovery('Draft recovery is unavailable in this browser. Keep this tab open.');
      });
      const session = (await workspaceRequest('/session')) as { mode?: string; signedIn?: boolean };
      if (session.mode === 'account' && !session.signedIn) {
        setSteps(null);
        setNeedsAccess(true);
        return;
      }
      const photoShas = await Promise.all(photos.map(upload));
      const planShas = await Promise.all(plans.map(upload));
      advance(1);
      const read = analyze
        ? ((await workspaceRequest('/studio/read', {
            photos: photoShas,
            plans: planShas,
          })) as {
            photos: ReadPhoto[];
            plans: PlanRoom[];
            ceiling: { ft: number; note: string };
          })
        : {
            photos: photoShas.map((sha256, i) => ({
              sha256,
              kind: 'other',
              title: `Room ${i + 1}`,
              floor: 'other',
            })),
            plans: [],
            ceiling: { ft: null, note: 'Ceiling height not supplied; room analysis was skipped' },
          };
      advance(2);
      const walls: Record<string, Masks | null> = {};
      if (analyze)
        await Promise.all(
          read.photos.map(async (p) => {
            walls[p.sha256] = await outline(p.sha256).catch(() => null);
          }),
        );
      const listing = /^https?:\/\//i.test(where.trim()) ? where.trim() : undefined;
      onBuilt({
        plans: read.plans,
        project: {
          ...ownProject({
            id: `own-${photoShas[0]!.slice(0, 10)}`,
            address: listing ? 'Your listing' : where.trim() || 'Your project',
            ...(listing ? { listing } : {}),
            ceilingFt: parseFeet(ceiling) ?? read.ceiling.ft,
            photos: read.photos,
            plans: read.plans,
            walls,
          }),
          // Typed heights are the owner's; otherwise Spark's estimate, labelled.
          ...(parseFeet(ceiling) ? {} : { ceilingNote: read.ceiling.note }),
          ...(idea.trim().length >= 3 ? { idea: idea.trim() } : {}),
        },
      });
    } catch (e) {
      setSteps(null);
      setError(`${stage}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  // Photos from the home page start building at once.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !start?.photos.length) return;
    started.current = true;
    void build();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const busy = steps !== null;
  return (
    <section className="pf-intake" aria-label="Show your project">
      <p className="pf-kicker">Your project</p>
      <h1>Show us the rooms.</h1>
      <p className="pf-sub">
        Room photos from your phone or a listing. Add the floor plan if you have one, and we size
        every room from it.
      </p>
      <div className="pf-drop">
        <button type="button" disabled={busy} onClick={() => photoInput.current?.click()}>
          <Glyph name="photo" />
          <span>
            <b>
              {photos.length
                ? `${photos.length} room photo${photos.length === 1 ? '' : 's'}`
                : 'Room photos'}
            </b>
            <small>One per room, up to {MAX_PHOTOS}</small>
          </span>
        </button>
        <button type="button" disabled={busy} onClick={() => planInput.current?.click()}>
          <Glyph name="plan" />
          <span>
            <b>
              {plans.length
                ? `${plans.length} floor plan${plans.length === 1 ? '' : 's'}`
                : 'Floor plan'}
            </b>
            <small>Optional</small>
          </span>
        </button>
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => setPhotos([...(e.target.files ?? [])].slice(0, MAX_PHOTOS))}
        />
        <input
          ref={planInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => setPlans([...(e.target.files ?? [])].slice(0, 2))}
        />
      </div>
      {!!photos.length && <p className="pf-sub">{photos.map((file) => file.name).join(' · ')}</p>}
      <input
        className="pf-intake-idea"
        aria-label="What do you imagine?"
        placeholder="What do you imagine? Dark green walls, light oak floors…"
        value={idea}
        disabled={busy}
        maxLength={300}
        onChange={(e) => setIdea(e.target.value)}
      />
      <div className="pf-intake-row">
        <input
          aria-label="Address or listing link"
          placeholder="Address or listing link"
          value={where}
          disabled={busy}
          maxLength={300}
          onChange={(e) => setWhere(e.target.value)}
        />
        <input
          aria-label="Ceiling height"
          placeholder="Ceiling (optional)"
          value={ceiling}
          disabled={busy}
          inputMode="decimal"
          onChange={(e) => setCeiling(e.target.value)}
        />
      </div>
      {steps ? (
        <ol className="pf-steps" aria-live="polite">
          {steps.map((s) => (
            <li key={s.label} className={`is-${s.state}`}>
              <span aria-hidden="true">{s.state === 'done' ? '✓' : ''}</span>
              {s.label}
            </li>
          ))}
        </ol>
      ) : (
        <button
          type="button"
          className="pf-build"
          disabled={!photos.length || needsAccess}
          onClick={() => void build()}
        >
          Build my plan <Glyph name="right" />
        </button>
      )}
      {error && <p className="pf-intake-error">{error}</p>}
      {error && !!photos.length && !busy && !needsAccess && (
        <button type="button" className="pf-reset" onClick={() => void build(false)}>
          Open studio without analysis
        </button>
      )}
      <p className="pf-sub" role="status">
        {recovery}
      </p>
      {needsAccess && (
        <div className="pf-studio-access">
          <h3>Keep this studio yours.</h3>
          <p>Continue as a guest to start. Your selected photos are ready.</p>
          <SignInChoices
            className="pf-build"
            onSignedIn={async () => {
              await onSignedIn?.();
              setNeedsAccess(false);
              await build();
            }}
          />
        </div>
      )}
    </section>
  );
}

export function OwnStudio({
  start,
  initialDesign,
  onSignedIn,
}: {
  start?: OwnStart | null;
  initialDesign?: SavedStudioDesign;
  onSignedIn?: () => Promise<void>;
}) {
  // A new start from the home page replaces the project kept in the browser.
  const [draft, setDraft] = useState<OwnIntakeDraft | null>(null);
  const [usedStart, setUsedStart] = useState(false);
  const [saved, setSaved] = useState<Saved | null | undefined>(() =>
    initialDesign ? { project: initialDesign.snapshot.project, plans: [] } : undefined,
  );
  useEffect(() => {
    if (initialDesign) return;
    let live = true;
    void loadOwnIntake()
      .catch(() => null)
      .then((pending) => {
        if (!live) return;
        // An explicit new photo set wins; a recoverable intake wins over an older built room.
        const restored = start?.photos.length ? null : pending;
        setDraft(restored);
        setSaved(start || restored?.photos.length || restored?.idea ? null : load());
      });
    return () => {
      live = false;
    };
  }, [initialDesign, start]);
  const keepLocal = (next: Saved | null) => {
    if (!initialDesign && keep(next) && next) void saveOwnIntake(null).catch(() => {});
  };
  const commit = (next: Saved | null) => {
    if (next) setUsedStart(true);
    setSaved(next);
    keepLocal(next);
  };
  if (saved === undefined)
    return (
      <p className="pf-empty" role="status">
        Restoring your studio draft…
      </p>
    );
  if (!saved)
    return (
      <Intake
        start={usedStart ? null : start}
        draft={draft}
        onBuilt={commit}
        onSignedIn={onSignedIn}
      />
    );
  const { project, plans } = saved;
  const editRoom = (roomId: string, patch: Partial<StudioRoom>) =>
    setSaved((current) => {
      if (!current) return current;
      const next = {
        ...current,
        project: {
          ...current.project,
          rooms: current.project.rooms.map((r) => (r.id === roomId ? { ...r, ...patch } : r)),
        },
      };
      keepLocal(next);
      return next;
    });
  const renderFloor = async (roomId: string, style: string) => {
    const room = project.rooms.find((r) => r.id === roomId)!;
    const laid = (await workspaceRequest('/studio/floor', {
      sha256: photoSha(room),
      style,
    })) as { sha256: string };
    editRoom(roomId, {
      floors: { ...room.floors, [style]: { src: imageUrl(laid.sha256), walls: null } },
    });
    const walls = await outline(laid.sha256).catch(() => null);
    setSaved((current) => {
      if (!current) return current;
      const next = {
        ...current,
        project: {
          ...current.project,
          rooms: current.project.rooms.map((r) =>
            r.id === roomId
              ? { ...r, floors: { ...r.floors, [style]: { src: imageUrl(laid.sha256), walls } } }
              : r,
          ),
        },
      };
      keepLocal(next);
      return next;
    });
  };
  return (
    <PaintFloorStudio
      key={project.id}
      project={project}
      savedDesign={initialDesign}
      kicker={
        initialDesign?.snapshot.basis === 'listing-example'
          ? 'Saved listing example · proposed design'
          : 'Your project'
      }
      renderFloor={renderFloor}
      onEditRoom={editRoom}
      onCeiling={(ceilingFt) => {
        const { ceilingNote: _estimate, ...reported } = project;
        commit({ ...saved, project: { ...reported, ceilingFt } });
      }}
      onIdeaUsed={() =>
        setSaved((current) => {
          if (!current?.project.idea) return current;
          const { idea: _used, ...rest } = current.project;
          const next = { ...current, project: rest };
          keepLocal(next);
          return next;
        })
      }
      roomTools={(room) =>
        plans.length ? (
          <label className="pf-plan-pick">
            <span>Size from plan</span>
            <select
              value={plans.findIndex(
                (p) => p.widthFt === room.size?.xFt && p.lengthFt === room.size?.yFt,
              )}
              onChange={(e) => {
                const p = plans[Number(e.target.value)];
                if (p) editRoom(room.id, { size: { xFt: p.widthFt, yFt: p.lengthFt } });
              }}
            >
              <option value={-1}>Choose a room</option>
              {plans.map((p, i) => (
                <option key={i} value={i}>
                  {p.name.toLowerCase()} · {p.widthFt.toFixed(1)} × {p.lengthFt.toFixed(1)} ft
                </option>
              ))}
            </select>
          </label>
        ) : null
      }
      actions={
        <button
          type="button"
          className="pf-reset"
          onClick={() => {
            if (
              !window.confirm(
                'Start a new room? Save this project first to keep an account link. This replaces the current browser room.',
              )
            )
              return;
            setDraft(null);
            commit(null);
          }}
        >
          Start over
        </button>
      }
    />
  );
}
