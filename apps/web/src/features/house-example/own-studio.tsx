import { useRef, useState } from 'react';
import { workspaceRequest } from '../../adapters/http/project-repository.js';
import { Glyph } from '../../components/glyph.js';
import { PaintFloorStudio, parseFeet } from './paint-floor-studio.js';
import { imageUrl, ownProject, photoSha, type PlanRoom, type ReadPhoto } from './own-project.js';
import type { HouseProject, Masks, StudioRoom } from './paint-floor.js';

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
  } catch {
    // The project still works for this visit.
  }
}

const base64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error(`${file.name} could not be read`));
    reader.readAsDataURL(file);
  });
const upload = async (file: File) =>
  (
    (await workspaceRequest('/studio/photo', { data: await base64(file), name: file.name })) as {
      sha256: string;
    }
  ).sha256;
const outline = (sha256: string) => workspaceRequest('/studio/walls', { sha256 }) as Promise<Masks>;

type Step = { label: string; state: 'waiting' | 'working' | 'done' };
const MAX_PHOTOS = 8;

function Intake({ onBuilt }: { onBuilt: (saved: Saved) => void }) {
  const [where, setWhere] = useState('');
  const [ceiling, setCeiling] = useState('');
  const [idea, setIdea] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [plans, setPlans] = useState<File[]>([]);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [error, setError] = useState('');
  const photoInput = useRef<HTMLInputElement>(null);
  const planInput = useRef<HTMLInputElement>(null);
  const build = async () => {
    setError('');
    const list: Step[] = [
      { label: `Uploading ${photos.length + plans.length} images`, state: 'working' },
      { label: 'Muse Spark reads each room and the plan', state: 'waiting' },
      { label: 'SAM 3.1 outlines the walls', state: 'waiting' },
    ];
    const advance = (i: number) =>
      setSteps(
        list.map((s, j) => ({ ...s, state: j < i ? 'done' : j === i ? 'working' : 'waiting' })),
      );
    advance(0);
    try {
      const photoShas = await Promise.all(photos.map(upload));
      const planShas = await Promise.all(plans.map(upload));
      advance(1);
      const read = (await workspaceRequest('/studio/read', {
        photos: photoShas,
        plans: planShas,
      })) as {
        photos: ReadPhoto[];
        plans: PlanRoom[];
        ceiling: { ft: number; note: string };
      };
      advance(2);
      const walls: Record<string, Masks | null> = {};
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
      setError(e instanceof Error ? e.message : String(e));
    }
  };
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
          disabled={!photos.length}
          onClick={() => void build()}
        >
          Build my plan <Glyph name="right" />
        </button>
      )}
      {error && <p className="pf-intake-error">{error}</p>}
    </section>
  );
}

export function OwnStudio() {
  const [saved, setSaved] = useState<Saved | null>(load);
  const commit = (next: Saved | null) => {
    setSaved(next);
    keep(next);
  };
  if (!saved) return <Intake onBuilt={commit} />;
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
      keep(next);
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
      keep(next);
      return next;
    });
  };
  return (
    <PaintFloorStudio
      key={project.id}
      project={project}
      kicker="Your project"
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
          keep(next);
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
        <button type="button" className="pf-reset" onClick={() => commit(null)}>
          Start over
        </button>
      }
    />
  );
}
