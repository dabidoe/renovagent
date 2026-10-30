import { useEffect, useRef, useState } from 'react';
import type { ScopeDraft, Workspace } from '@renovagent/contracts';
import { photoNotes, photoPins, type PhotoRead } from '@renovagent/core';
import type { WorkspaceController } from '../../app/workspace-controller.js';
import { workspaceRequest, type SessionInfo } from '../../adapters/http/project-repository.js';

// The owner's own room photos, read by Jev on the server: what it sees and
// where. Code turns that into pins for the planned work and suggestions; a
// suggestion changes the plan only after the owner approves it.

type Reading =
  | { status: 'working' }
  | { status: 'done'; read: PhotoRead }
  | { status: 'error'; message: string };

// Jev takes 280–1568 px per side: shrink large photos in the browser so only a
// small JPEG ever leaves it.
async function forJev(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, 1500 / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  if (Math.min(w, h) < 280) throw Error('This photo is too small to read (under 280 px).');
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  const jpeg = await new Promise<Blob>((ok, fail) =>
    canvas.toBlob(
      (b) => (b ? ok(b) : fail(Error('Could not encode the photo'))),
      'image/jpeg',
      0.85,
    ),
  );
  let binary = '';
  for (const n of new Uint8Array(await jpeg.arrayBuffer())) binary += String.fromCharCode(n);
  return { format: 'jpg' as const, data: btoa(binary) };
}

function useBlobUrl(controller: WorkspaceController, blobId: string | undefined) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!blobId) return;
    let live = true;
    let local = '';
    void controller.repository
      .readBlob(blobId)
      .then((blob) => {
        if (blob && live) {
          local = URL.createObjectURL(blob);
          setUrl(local);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
      if (local) URL.revokeObjectURL(local);
      setUrl('');
    };
  }, [controller, blobId]);
  return url;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function ownerPhotos(state: Workspace, projectId: string) {
  return Object.values(state.evidence).filter(
    (e) =>
      e.projectId === projectId &&
      (!e.source.reference || e.source.reference.kind === 'room') &&
      e.source.attachment?.mediaType.startsWith('image/'),
  );
}

export function OwnerPhotos({
  state,
  projectId,
  controller,
  draft,
  onAdd,
}: {
  state: Workspace;
  projectId: string;
  controller: WorkspaceController;
  draft: ScopeDraft | null;
  onAdd: (packageId: string) => Promise<void>;
}) {
  const photos = ownerPhotos(state, projectId);
  const [selected, setSelected] = useState(0);
  const [readings, setReadings] = useState<Record<string, Reading>>({});
  const [adding, setAdding] = useState<string | null>(null);
  const [upload, setUpload] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const photo = photos[selected] ?? photos[0];
  const url = useBlobUrl(controller, photo?.source.attachment?.blobId);
  const addPhotos = async (files: File[]) => {
    setUpload('Adding…');
    try {
      for (const file of files) await controller.attachFile(projectId, file);
      setSelected(photos.length);
      setUpload('');
    } catch (e) {
      setUpload(e instanceof Error ? e.message : String(e));
    }
  };
  const picker = (
    <>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) void addPhotos(files);
        }}
      />
      <button type="button" className="link-button" onClick={() => fileInput.current?.click()}>
        Add room photos
      </button>
      {upload && <span className="small-note">{upload}</span>}
    </>
  );
  if (!photo)
    return (
      <section className="owner-photos" aria-label="Your photos">
        <header>
          <h4>Your photos</h4>
          {picker}
        </header>
        <p className="small-note">
          Add photos of this room: Jev finds the floor, walls and fixtures, pins the planned work on
          them and flags what the plan may be missing.
        </p>
      </section>
    );
  const reading = readings[photo.id] ?? null;
  const read = reading?.status === 'done' ? reading.read : null;
  const pins = read ? photoPins(read, draft) : [];
  const notes = read ? photoNotes(read, draft) : [];
  const title = (id: string) => draft?.packages.find((p) => p.id === id)?.title ?? id;

  const readWithJev = async () => {
    const id = photo.id;
    setReadings((r) => ({ ...r, [id]: { status: 'working' } }));
    try {
      const blob = await controller.repository.readBlob(photo.source.attachment!.blobId);
      if (!blob) throw Error('The photo file is missing.');
      const image = await forJev(blob);
      const session = (await workspaceRequest('/session')) as SessionInfo;
      if (session.mode === 'account' && !session.signedIn)
        throw Error('Sign in to the connected app to read photos with Jev.');
      if (!session.jev) throw Error('Jev is not configured on this server.');
      const result = (await workspaceRequest('/photo/read', image)) as PhotoRead;
      setReadings((r) => ({ ...r, [id]: { status: 'done', read: result } }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setReadings((r) => ({
        ...r,
        [id]: {
          status: 'error',
          message: /unavailable|Failed to fetch/i.test(message)
            ? 'Reading photos with Jev needs the Renovagent server (npm run dev:connected).'
            : message.slice(0, 200),
        },
      }));
    }
  };

  return (
    <section className="owner-photos" aria-label="Your photos">
      <header>
        <h4>Your photos</h4>
        {picker}
        <button
          type="button"
          className="room3d-muse"
          disabled={reading?.status === 'working'}
          onClick={() => void readWithJev()}
        >
          {reading?.status === 'working'
            ? 'Jev is reading the photo…'
            : read
              ? '✦ Read by Jev · read again'
              : '✦ Pin with Jev'}
        </button>
      </header>
      <div className="owner-photos-body">
        <figure className="owner-photo">
          {url && <img src={url} alt={photo.source.attachment?.name ?? photo.source.description} />}
          {read &&
            // Outline only what carries a pin, so the photo stays readable.
            [...new Set(pins.map((p) => p.box))].map((b, k) => (
              <span
                key={k}
                className="owner-photo-box"
                style={{
                  left: `${b.left * 100}%`,
                  top: `${b.top * 100}%`,
                  width: `${(b.right - b.left) * 100}%`,
                  height: `${(b.bottom - b.top) * 100}%`,
                }}
              />
            ))}
          {pins.map((p, i) => (
            <span
              key={p.packageId}
              className="room3d-photo-pin"
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            >
              <b>{i + 1}</b>
              <span>{p.title}</span>
            </span>
          ))}
          {read && (
            <figcaption className="room3d-photo-label">
              Read by Jev ({read.model}): observations, not measurements
            </figcaption>
          )}
        </figure>
        <div className="owner-photos-side">
          {photos.length > 1 && (
            <div className="owner-photos-thumbs" role="group" aria-label="Choose a photo">
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={i === selected}
                  onClick={() => setSelected(i)}
                >
                  {i + 1}
                  {readings[p.id]?.status === 'done' ? ' ✦' : ''}
                </button>
              ))}
            </div>
          )}
          {reading?.status === 'error' && (
            <p role="alert" className="small-note">
              {reading.message}
            </p>
          )}
          {read ? (
            <>
              <p className="small-note">
                {read.room.kind === 'other' ? 'Room' : `Looks like a ${read.room.kind}`} ·{' '}
                {pins.length
                  ? `${pins.length} planned step${pins.length > 1 ? 's' : ''} pinned`
                  : draft
                    ? 'nothing in the plan to pin here'
                    : 'plan the work to pin it'}
              </p>
              <ul className="owner-photo-notes">
                {notes.map((n) => (
                  <li key={n.id} className={`is-${n.kind}`}>
                    {n.text}
                    {n.packageId &&
                      (adding === n.packageId ? (
                        <span className="room3d-use">
                          <button
                            type="button"
                            className="primary"
                            onClick={() => void onAdd(n.packageId!).then(() => setAdding(null))}
                          >
                            Approve: add {title(n.packageId)}
                          </button>
                          <button
                            type="button"
                            className="link-button subtle"
                            onClick={() => setAdding(null)}
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => setAdding(n.packageId!)}
                        >
                          Add {title(n.packageId)} to the plan
                        </button>
                      ))}
                  </li>
                ))}
              </ul>
              <p className="small-note">
                Seen:{' '}
                {(['toilet', 'vanity', 'shower', 'tub', 'fan', 'window'] as const)
                  .filter((k) => read.seen[k] >= 0.5)
                  .map((k) => `${k} ${pct(read.seen[k])}`)
                  .join(' · ') || 'no fixtures'}
              </p>
            </>
          ) : (
            reading?.status !== 'working' && (
              <p className="small-note">
                Jev finds the floor, walls and fixtures in this photo, pins the planned work on them
                and flags what the plan may be missing.
              </p>
            )
          )}
        </div>
      </div>
    </section>
  );
}
