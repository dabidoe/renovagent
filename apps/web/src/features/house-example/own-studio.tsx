import { useEffect, useMemo, useRef, useState } from 'react';
import { validateIntakePhotos } from '../../app/project-intake.js';
import { pendingStudioSave, restorePendingStudioDesign } from './studio-sync.js';
import { workspaceRequest } from '../../adapters/http/project-repository.js';
import { AddPhotoSheet } from '../project-start/add-photo-sheet.js';
import { uploadStudioPhoto } from '../project-start/photo-upload.js';
import { StudioError } from './studio-error.js';
import { Glyph } from '../../components/glyph.js';
import { SignInChoices } from '../connect/sign-in.js';
import { PaintFloorStudio, parseFeet, type SavedStudioDesign } from './paint-floor-studio.js';
import { imageUrl, photoSha } from './own-project.js';
import type { Masks, StudioRoom } from './paint-floor.js';
import {
  analyzeUploadedRooms,
  applyOwnAnalysis,
  uploadedOwnStudio,
  type OwnStudioDraft as Saved,
} from './own-analysis.js';
import { loadOwnIntake, saveOwnIntake, type OwnIntakeDraft } from './own-intake-draft.js';
import { newOwnStudioHash, ownStudioStore, rememberOwnStudio } from './own-studio-route.js';

function load(draftId?: string): Saved | null {
  try {
    const saved = JSON.parse(
      localStorage.getItem(ownStudioStore(draftId)) || 'null',
    ) as Saved | null;
    return saved?.project?.rooms?.length ? saved : null;
  } catch {
    return null;
  }
}
function keep(saved: Saved | null, draftId?: string) {
  try {
    if (saved) {
      localStorage.setItem(ownStudioStore(draftId), JSON.stringify(saved));
      rememberOwnStudio(draftId);
    } else localStorage.removeItem(ownStudioStore(draftId));
    return true;
  } catch {
    // The project still works for this visit.
    return false;
  }
}

const upload = uploadStudioPhoto;
const outline = (sha256: string) => workspaceRequest('/studio/walls', { sha256 }) as Promise<Masks>;

type Step = { label: string; state: 'waiting' | 'working' | 'done' };
const MAX_PHOTOS = 8;

// What the home page handed over: the owner's words and room photos.
export type OwnStart = { idea: string; photos: File[] };

function Intake({
  start,
  draft,
  draftId,
  onBuilt,
  onSignedIn,
}: {
  start?: OwnStart | null;
  draft?: OwnIntakeDraft | null;
  draftId?: string;
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const planInput = useRef<HTMLInputElement>(null);
  // Tiny previews for the selected files; revoked when the selection changes.
  const [thumbUrls, setThumbUrls] = useState<string[]>([]);
  useEffect(() => {
    const urls = photos.map((file) => URL.createObjectURL(file));
    setThumbUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [photos]);
  // Nothing typed or picked yet: still save (clears an old draft), but say nothing.
  const hasDraft = !!(where || ceiling || idea || photos.length || plans.length);
  useEffect(() => {
    let live = true;
    setRecovery(hasDraft ? 'Saving draft in this browser…' : '');
    void saveOwnIntake({ where, ceiling, idea, photos, plans }, draftId).then(
      () => {
        if (!hasDraft) return;
        rememberOwnStudio(draftId);
        if (live)
          setRecovery(
            'Photo files and brief saved in this browser. No project saved to your account yet.',
          );
      },
      () =>
        live &&
        hasDraft &&
        setRecovery(
          'This browser could not save the draft. Keep this tab open to retain your photos and brief.',
        ),
    );
    return () => {
      live = false;
    };
  }, [where, ceiling, idea, photos, plans, hasDraft, draftId]);
  const build = async () => {
    setError('');
    const list: Step[] = [
      { label: `Uploading ${photos.length + plans.length} images`, state: 'working' },
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
      await saveOwnIntake({ where, ceiling, idea, photos, plans }, draftId).catch(() => {
        setRecovery('Draft recovery is unavailable in this browser. Keep this tab open.');
      });
      const session = (await workspaceRequest('/session')) as {
        mode?: string;
        signedIn?: boolean;
        guests?: boolean;
      };
      if (session.mode === 'account' && !session.signedIn) {
        if (session.guests) {
          await workspaceRequest('/auth/guest', {});
          window.dispatchEvent(new Event('renovagent-session'));
        } else {
          setSteps(null);
          setNeedsAccess(true);
          return;
        }
      }
      const photoShas = await Promise.all(photos.map(upload));
      const planShas = await Promise.all(plans.map(upload));
      onBuilt(
        uploadedOwnStudio({
          id: draftId,
          photos: photoShas,
          plans: planShas,
          where,
          ceilingFt: parseFeet(ceiling),
          idea,
        }),
      );
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
      <h1>Show us the rooms.</h1>
      <p className="pf-sub">
        Room photos from your phone or a listing. Add the floor plan if you have one, and we size
        every room from it.
      </p>
      <div className="pf-drop">
        <button type="button" disabled={busy} onClick={() => setSheetOpen(true)}>
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
          ref={planInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const next = [...(e.target.files ?? [])].slice(0, 2);
            e.target.value = '';
            try {
              validateIntakePhotos(next);
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
              return;
            }
            setError('');
            setPlans(next);
          }}
        />
      </div>
      {sheetOpen && (
        <AddPhotoSheet
          onFiles={(next) => setPhotos([...photos, ...next].slice(0, MAX_PHOTOS))}
          onClose={() => setSheetOpen(false)}
        />
      )}
      {!!photos.length && (
        <ul className="pf-photo-thumbs" aria-label="Selected room photos">
          {photos.map((file, index) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}`}>
              <img
                src={thumbUrls[index]}
                alt=""
                onError={(event) => {
                  // Formats the browser cannot render (e.g. HEIC in Chrome)
                  // fall back to the filename alone.
                  event.currentTarget.style.display = 'none';
                }}
              />
              <span>{file.name}</span>
            </li>
          ))}
        </ul>
      )}
      <label className="pf-field">
        <span>What do you imagine?</span>
        <input
          className="pf-intake-idea"
          placeholder="Dark green walls, light oak floors…"
          value={idea}
          disabled={busy}
          maxLength={300}
          onChange={(e) => setIdea(e.target.value)}
        />
      </label>
      <div className="pf-intake-row">
        <label className="pf-field">
          <span>Address or listing link</span>
          <input
            placeholder="Street address or listing URL"
            value={where}
            disabled={busy}
            maxLength={300}
            onChange={(e) => setWhere(e.target.value)}
          />
        </label>
        <label className="pf-field">
          <span>Ceiling height</span>
          <input
            placeholder="Optional, e.g. 9 ft"
            value={ceiling}
            disabled={busy}
            inputMode="decimal"
            onChange={(e) => setCeiling(e.target.value)}
          />
        </label>
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
        <div className="pf-build-row">
          <button
            type="button"
            className="pf-build"
            disabled={!photos.length || needsAccess}
            aria-describedby={!photos.length ? 'pf-build-needs' : undefined}
            onClick={() => void build()}
          >
            Build my plan <Glyph name="right" />
          </button>
          {!photos.length && (
            <small id="pf-build-needs">Add at least one room photo to build your plan.</small>
          )}
        </div>
      )}
      {error && <StudioError message={error} />}
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
  draftId,
}: {
  start?: OwnStart | null;
  initialDesign?: SavedStudioDesign;
  onSignedIn?: () => Promise<void>;
  draftId?: string;
}) {
  const recoveredDesign = useMemo(() => {
    if (!initialDesign) return undefined;
    const key = `renovagent.studio.${initialDesign.snapshot.project.id}.saved.${initialDesign.projectId}.${initialDesign.revision}.saved.v1.pending`;
    try {
      return restorePendingStudioDesign(
        initialDesign,
        pendingStudioSave(JSON.parse(localStorage.getItem(key) || 'null')),
      );
    } catch {
      return initialDesign;
    }
  }, [initialDesign]);
  // Each new route restores only its own draft; saved designs keep their
  // existing account identity and legacy drafts use the explicit resume route.
  const [draft, setDraft] = useState<OwnIntakeDraft | null>(null);
  const [usedStart, setUsedStart] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const analysisRun = useRef(0);
  useEffect(
    () => () => {
      analysisRun.current++;
    },
    [],
  );
  const [saved, setSaved] = useState<Saved | null | undefined>(() =>
    recoveredDesign
      ? {
          project: recoveredDesign.snapshot.project,
          plans: recoveredDesign.snapshot.intake?.planRooms ?? [],
          analysis: recoveredDesign.snapshot.intake?.analysis,
        }
      : undefined,
  );
  useEffect(() => {
    if (initialDesign) return;
    let live = true;
    void loadOwnIntake(draftId)
      .catch(() => null)
      .then((pending) => {
        if (!live) return;
        // An explicit new photo set wins; a recoverable intake wins over an older built room.
        const restored = start ? null : pending;
        setDraft(restored);
        setSaved(start || restored?.photos.length || restored?.idea ? null : load(draftId));
      });
    return () => {
      live = false;
    };
  }, [initialDesign, start, draftId]);
  const keepLocal = (next: Saved | null) => {
    if (!initialDesign && keep(next, draftId) && next)
      void saveOwnIntake(null, draftId).catch(() => {});
  };
  const commit = (next: Saved | null) => {
    if (next) setUsedStart(true);
    else {
      analysisRun.current++;
      setAnalyzing(false);
    }
    setSaved(next);
    keepLocal(next);
  };
  const analyze = async (input: Saved) => {
    if (!input.analysis) return;
    const run = ++analysisRun.current;
    setAnalyzing(true);
    try {
      const read = await analyzeUploadedRooms(input.analysis);
      if (run !== analysisRun.current) return;
      setSaved((current) => {
        if (!current || current.project.id !== input.project.id) return current;
        const next = applyOwnAnalysis(current, read);
        keepLocal(next);
        return next;
      });
    } catch (error) {
      if (run !== analysisRun.current) return;
      setSaved((current) => {
        if (!current?.analysis || current.project.id !== input.project.id) return current;
        const next = {
          ...current,
          analysis: {
            ...current.analysis,
            error: error instanceof Error ? error.message : 'Room analysis is unavailable.',
          },
        };
        keepLocal(next);
        return next;
      });
    } finally {
      if (run === analysisRun.current) setAnalyzing(false);
    }
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
        draftId={draftId}
        onBuilt={(next) => {
          commit(next);
          void analyze(next);
        }}
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
    <>
      {saved.analysis && (
        <aside className="pf-analysis-status" aria-label="Room analysis">
          <div>
            <p role="status">
              <strong>
                {analyzing
                  ? 'Photo uploaded. Reading room details…'
                  : 'Photo uploaded. Room details are not ready.'}
              </strong>
            </p>
            <p>
              Your photo and brief are here. You can enter measurements while analysis is
              unavailable.
            </p>
            {saved.analysis.error && (
              <details>
                <summary>Analysis details</summary>
                <p>{saved.analysis.error}</p>
              </details>
            )}
          </div>
          <button type="button" disabled={analyzing} onClick={() => void analyze(saved)}>
            {analyzing ? 'Reading room…' : 'Retry room analysis'}
          </button>
        </aside>
      )}
      <PaintFloorStudio
        key={project.id}
        project={project}
        autoImagine={!saved.analysis}
        autoSave
        intake={
          saved.analysis || plans.length
            ? { analysis: saved.analysis, planRooms: plans }
            : undefined
        }
        savedDesign={recoveredDesign}
        kicker={
          initialDesign?.snapshot.basis === 'listing-example'
            ? project.id.startsWith('starter-')
              ? 'Saved sample · proposed design'
              : 'Saved listing example · proposed design'
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
              window.location.hash = newOwnStudioHash();
            }}
          >
            New project
          </button>
        }
      />
    </>
  );
}
