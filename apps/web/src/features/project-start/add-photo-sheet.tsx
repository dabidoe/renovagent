import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '../../components/modal.js';
import { StudioError } from '../house-example/studio-error.js';
import {
  fetchSampleFile,
  parseSampleRooms,
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
  return (
    <div className="sample-room-grid">
      {rooms.map((room) => (
        <button type="button" key={room.id} disabled={busy} onClick={() => onChoose(room)}>
          <img src={sampleThumbnail(room)} alt="" width={400} height={300} />
          <strong>{room.title}</strong>
          <small>Sample room · {room.roomType}</small>
        </button>
      ))}
    </div>
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
      <p>Start with your room or borrow a sample. Every new look runs live.</p>
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
          <p>Owner-provided demo photos. No saved analysis or generated results.</p>
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
