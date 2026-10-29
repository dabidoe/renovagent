import { useEffect, useState } from 'react';
import { latest, savedPhotoReferences } from '@renovagent/core';
import type { Workspace } from '@renovagent/contracts';
import type { WorkspaceController } from '../../app/workspace-controller.js';
import { workspaceRequest } from '../../adapters/http/project-repository.js';
type Job = {
  id: string;
  projectId: string;
  status: string;
  stage: string;
  error: string | null;
  input: { researchRevision: number };
  completedResearchRevision?: number;
};
export function ConnectedPhotos({
  controller,
  state,
  projectId,
}: {
  controller: WorkspaceController;
  state: Workspace;
  projectId: string;
}) {
  const research = latest(state.artifacts[`${projectId}:property-research`]);
  const photos = savedPhotoReferences(state, projectId);
  const inventory = latest(state.artifacts[`${projectId}:photo-inventory`]);
  const defaultIds =
    inventory?.payload.kind === 'photo-inventory'
      ? inventory.payload.photos.map((p) => p.id)
      : photos.slice(0, 4).map((p) => p.id);
  const [selected, setSelected] = useState(defaultIds),
    [uploads, setUploads] = useState<string[]>([]),
    [jobs, setJobs] = useState<Job[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    setSelected(defaultIds);
    setUploads([]);
    setRequestId(crypto.randomUUID());
  }, [projectId, research?.revision]);
  useEffect(() => {
    if (!controller.connected) return;
    let stopped = false,
      seen = '';
    const poll = async () => {
      try {
        const result: Job[] = await workspaceRequest(
          `/photo-jobs?projectId=${encodeURIComponent(projectId)}`,
        );
        if (stopped) return;
        setJobs(result);
        const signature = result.map((j) => `${j.id}:${j.status}`).join('|');
        if (!seen || signature !== seen) await controller.refresh();
        seen = signature;
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : 'Cannot load photo jobs');
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 2500);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [controller, controller.connected, projectId]);
  const active = jobs.find((j) => ['queued', 'running'].includes(j.status));
  const attachments = Object.values(state.evidence).filter(
    (e) =>
      e.projectId === projectId &&
      /^image\/(jpeg|png|webp)$/.test(e.source.attachment?.mediaType || ''),
  );
  const toggle = (id: string, list: string[], set: (v: string[]) => void) => {
    set(list.includes(id) ? list.filter((v) => v !== id) : [...list, id]);
    setRequestId(crypto.randomUUID());
  };
  return (
    <details className="connected-photos">
      <summary>
        Muse photo analysis{' '}
        <span>
          {controller.connected ? 'Connected · Mongo saved' : 'Connect your local workspace'}
        </span>
      </summary>
      {!controller.connected ? (
        <>
          <p>
            Connect {Object.keys(state.projects).length} projects, their revision history and saved
            attachments to the connected Mongo workspace. The IndexedDB original stays on this
            device. If Mongo already has a workspace, that saved workspace opens without overwriting
            either copy.
          </p>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await controller.connectBackend();
              } catch (e) {
                setError(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Connect workspace to Mongo →
          </button>
        </>
      ) : (
        <>
          <p>
            Choose up to eight saved source photos or uploaded images. Muse receives these images
            and the project goal through the backend. Results remain unreviewed proposals; changed
            inputs block publication.
          </p>
          <details className="photo-job-selection">
            <summary>{selected.length + uploads.length} selected · choose photos</summary>
            <div className="photo-job-choices">
              {photos.map((p) => (
                <label key={p.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(p.id)}
                    disabled={Boolean(active)}
                    onChange={() => toggle(p.id, selected, setSelected)}
                  />
                  {p.id}
                  {p.roomType ? ` · ${p.roomType}` : ''}
                  {p.researchRevision !== research?.revision ? ' · earlier review' : ''}
                </label>
              ))}
              {attachments.map((e) => (
                <label key={e.id}>
                  <input
                    type="checkbox"
                    checked={uploads.includes(e.id)}
                    disabled={Boolean(active)}
                    onChange={() => toggle(e.id, uploads, setUploads)}
                  />
                  Uploaded · {e.source.attachment?.name}
                </label>
              ))}
            </div>
          </details>
          <label className="photo-job-upload">
            Add current photos
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              disabled={busy || Boolean(active)}
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                e.target.value = '';
                setBusy(true);
                try {
                  const ids: string[] = [];
                  for (const file of files) {
                    if (file.size > 5 * 1024 * 1024)
                      throw Error('Photo analysis supports images up to 5 MB each');
                    ids.push(await controller.attachFile(projectId, file));
                  }
                  setUploads((previous) => [...previous, ...ids]);
                  setRequestId(crypto.randomUUID());
                } catch (e) {
                  setError(String(e));
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
          <button
            disabled={
              busy ||
              Boolean(active) ||
              selected.length + uploads.length < 1 ||
              selected.length + uploads.length > 8
            }
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await workspaceRequest('/photo-jobs', {
                  requestId,
                  projectId,
                  photoIds: selected,
                  evidenceIds: uploads,
                });
                setRequestId(crypto.randomUUID());
                setJobs(
                  await workspaceRequest(`/photo-jobs?projectId=${encodeURIComponent(projectId)}`),
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Analyze {selected.length + uploads.length || ''}{' '}
            {selected.length + uploads.length === 1 ? 'photo' : 'photos'} with Muse →
          </button>
          <div aria-live="polite">
            {jobs
              .slice(-3)
              .reverse()
              .map((job) => (
                <article key={job.id}>
                  <strong>
                    {job.status} · {job.stage}
                  </strong>
                  <small>
                    Research input r{job.input.researchRevision}
                    {job.completedResearchRevision
                      ? ` → saved r${job.completedResearchRevision}`
                      : ''}
                  </small>
                  {job.error && <p>{job.error}</p>}
                  {['queued', 'running'].includes(job.status) && (
                    <button
                      onClick={async () => {
                        await workspaceRequest(`/photo-jobs/${job.id}/cancel`, {});
                        setJobs(
                          await workspaceRequest(
                            `/photo-jobs?projectId=${encodeURIComponent(projectId)}`,
                          ),
                        );
                      }}
                    >
                      Cancel analysis
                    </button>
                  )}
                </article>
              ))}
          </div>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
