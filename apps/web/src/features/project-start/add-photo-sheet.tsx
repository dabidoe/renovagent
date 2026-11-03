import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '../../components/modal.js';
import { StudioError } from '../house-example/studio-error.js';
import {
  fetchSampleFile,
  parseSampleRooms,
  preparedSampleRoute,
  rememberPreparedSample,
  sampleThumbnail,
  type SampleRoom,
} from './sample-rooms.js';
import './add-photo-sheet.css';

export function SampleRoomGrid({
  rooms,
  busy,
  onChoose,
}: {
  rooms: SampleRoom[];
  busy: boolean;
  onChoose: (room: SampleRoom) => void;
}) {
  const [roomType, setRoomType] = useState('All rooms');
  const types = ['All rooms', ...new Set(rooms.map((room) => room.roomType))];
  const curatedFirst = [...rooms].sort((a, b) => Number(!!b.sourceUrl) - Number(!!a.sourceUrl));
  const shown =
    roomType === 'All rooms'
      ? curatedFirst
      : curatedFirst.filter((room) => room.roomType === roomType);
  return (
    <>
      <div className="sample-room-filters" aria-label="Filter sample rooms">
        {types.map((type) => (
          <button
            type="button"
            key={type}
            aria-pressed={roomType === type}
            onClick={() => setRoomType(type)}
          >
            {type}
          </button>
        ))}
      </div>
      <div className="sample-room-grid">
        {shown.map((room) => (
          <article key={room.id}>
            <button type="button" disabled={busy} onClick={() => onChoose(room)}>
              <img src={sampleThumbnail(room)} alt="" width={400} height={300} />
              <strong>{room.title}</strong>
              <small>
                {room.prepared ? 'Ready-to-edit sample' : 'Sample room'} · {room.roomType}
              </small>
            </button>
            <small className="sample-room-credit">
              {room.sourceUrl ? (
                <a href={room.sourceUrl} target="_blank" rel="noreferrer">
                  {room.source}
                </a>
              ) : (
                room.source
              )}
            </small>
          </article>
        ))}
      </div>
    </>
  );
}

export function AddPhotoSheet({
  onFiles,
  onClose,
  multiple = true,
}: {
  onFiles: (files: File[]) => void;
  onClose: () => void;
  multiple?: boolean;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const [gallery, setGallery] = useState(false);
  const [rooms, setRooms] = useState<SampleRoom[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!gallery) return;
    const controller = new AbortController();
    setError('');
    setRooms(null);
    void fetch('/starter-rooms/manifest.json', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(`Sample manifest could not be fetched (HTTP ${response.status}).`);
        return parseSampleRooms(await response.json());
      })
      .then((next) => {
        if (!controller.signal.aborted) setRooms(next);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      });
    return () => controller.abort();
  }, [gallery, attempt]);
  const accept = (files: File[]) => {
    if (!files.length) return;
    onFiles(files);
    onClose();
  };
  const choose = async (room: SampleRoom) => {
    if (room.prepared) {
      rememberPreparedSample(room);
      onClose();
      window.location.hash = preparedSampleRoute(room);
      return;
    }
    setBusy(true);
    setError('');
    try {
      accept([await fetchSampleFile(room)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return createPortal(
    <Modal
      title="Add photo"
      className="add-photo-sheet"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p>Upload your room or open a prepared sample with saved paint and floor previews.</p>
      <div className="add-photo-options" aria-label="Photo source">
        <button type="button" disabled={busy} onClick={() => camera.current?.click()}>
          Take photo<small>Use your camera</small>
        </button>
        <button type="button" disabled={busy} onClick={() => upload.current?.click()}>
          Upload<small>Choose your photos</small>
        </button>
        <button
          type="button"
          disabled={busy}
          aria-pressed={gallery}
          onClick={() => setGallery(true)}
        >
          Sample rooms<small>No photo needed</small>
        </button>
      </div>
      <input
        ref={camera}
        hidden
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Take room photo"
        onChange={(e) => accept(Array.from(e.currentTarget.files ?? []))}
      />
      <input
        ref={upload}
        hidden
        type="file"
        accept="image/*"
        multiple={multiple}
        aria-label="Upload room photos"
        onChange={(e) => accept(Array.from(e.currentTarget.files ?? []))}
      />
      {gallery && (
        <section aria-label="Sample rooms">
          <h3>Pick a room to make your own.</h3>
          <p>
            Samples open ready to edit. Your changes stay in this browser; save a project to keep an
            account copy. Custom restyles run when you request them.
          </p>
          {rooms && (
            <SampleRoomGrid rooms={rooms} busy={busy} onChoose={(room) => void choose(room)} />
          )}
          {!rooms && !error && <p role="status">Loading sample rooms…</p>}
          {rooms?.length === 0 && <p>No licensed sample rooms are available yet.</p>}
          {busy && <p role="status">Preparing your sample photo…</p>}
        </section>
      )}
      {error && (
        <>
          <StudioError message={error} />
          <button type="button" disabled={busy} onClick={() => setAttempt((n) => n + 1)}>
            Retry sample rooms
          </button>
        </>
      )}
    </Modal>,
    document.body,
  );
}
