import { useState } from 'react';
import type { ReferenceInput } from '../../app/project-intake.js';
import { PhotoPicker } from '../project-start/photo-picker.js';
import { ReferenceFields, referenceFromForm } from './reference-fields.js';
export function ReferenceEditor({
  onSave,
  onCancel,
}: {
  onSave: (inputs: ReferenceInput[]) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      className="reference-editor"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setError('');
        const data = new FormData(event.currentTarget);
        setBusy(true);
        try {
          const reference = referenceFromForm(data) ?? {
            kind: String(data.get('referenceKind') || 'inspiration') as 'inspiration' | 'product',
          };
          if (!reference.url && !photos.length) throw Error('Add a reference image or a link.');
          await onSave([{ reference, photos }]);
          onCancel();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>Bring the look you want—and the products behind it.</p>
      <fieldset disabled={busy}>
        <PhotoPicker
          files={photos}
          onChange={setPhotos}
          title="Add reference images"
          hint="A room you love, a finish, a product · Up to 5"
          disabled={busy}
        />
        <ReferenceFields />
      </fieldset>
      {error && (
        <p role="alert" className="reference-error">
          {error}
        </p>
      )}
      <div className="reference-actions">
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button className="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save reference'}
        </button>
      </div>
    </form>
  );
}
