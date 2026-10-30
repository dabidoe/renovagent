import { useEffect, useRef, useState } from 'react';
import type { Workspace } from '@renovagent/contracts';
import type { WorkspaceController } from '../../app/workspace-controller.js';
import { Glyph } from '../../components/glyph.js';
function StoredPhoto({
  controller,
  blobId,
  name,
}: {
  controller: WorkspaceController;
  blobId: string;
  name: string;
}) {
  const [url, setUrl] = useState('');
  useEffect(() => {
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
    };
  }, [controller, blobId]);
  return url ? (
    <img src={url} alt={name} />
  ) : (
    <span className="room-photo-loading">
      <Glyph name="photo" />
      {name}
    </span>
  );
}
export function RoomWelcome({
  state,
  projectId,
  controller,
  heading,
}: {
  state: Workspace;
  projectId: string;
  controller: WorkspaceController;
  heading: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const photos = Object.values(state.evidence).filter(
    (evidence) =>
      evidence.projectId === projectId &&
      evidence.source.attachment?.mediaType.startsWith('image/'),
  );
  const photo = photos[selected] ?? photos[0];
  const goal = Object.values(state.facts)
    .map((versions) => versions.at(-1)!)
    .find((fact) => fact.projectId === projectId && fact.key === 'goal');
  return (
    <section className="room-welcome" aria-label={heading}>
      <div className="room-welcome-media">
        {photo?.source.attachment ? (
          <StoredPhoto
            controller={controller}
            blobId={photo.source.attachment.blobId}
            name={photo.source.attachment.name}
          />
        ) : (
          <div className="room-welcome-placeholder">
            <Glyph name="photo" />
            <strong>Your room starts here.</strong>
            <span>Add a photo of the space or a little inspiration.</span>
            <button onClick={() => input.current?.click()} type="button" disabled={saving}>
              {saving ? 'Saving photo…' : 'Add room photos'} <Glyph name="plus" />
            </button>
          </div>
        )}
      </div>
      <div className="room-welcome-copy">
        <span className="room-welcome-label">Your project</span>
        <h3>{heading}</h3>
        {goal?.value.kind === 'text' && <p>{goal.value.text}</p>}
        <div className="room-welcome-next">
          <Glyph name="plan" />
          <div>
            <strong>Give your plan a starting point.</strong>
            <p>
              Keep your photos here. Add measurements below when you’re ready to build the 3D room.
            </p>
          </div>
        </div>
        {photos.length > 0 && (
          <>
            <div className="room-welcome-thumbs">
              {photos.map((item, index) => {
                const attachment = item.source.attachment!;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={`View ${attachment.name}`}
                    aria-pressed={photo.id === item.id}
                    onClick={() => setSelected(index)}
                  >
                    <StoredPhoto
                      controller={controller}
                      blobId={attachment.blobId}
                      name={attachment.name}
                    />
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="room-welcome-add"
              onClick={() => input.current?.click()}
              disabled={saving}
            >
              <Glyph name="plus" />
              {saving ? 'Saving photo…' : 'Add another photo'}
            </button>
          </>
        )}
        <input
          ref={input}
          hidden
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          aria-label="Add project room photos"
          onChange={async (event) => {
            const files = [...(event.currentTarget.files || [])];
            event.currentTarget.value = '';
            setError('');
            setSaving(true);
            try {
              for (const file of files) await controller.attachFile(projectId, file);
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            } finally {
              setSaving(false);
            }
          }}
        />
        {error && (
          <p role="alert" className="room-welcome-error">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
