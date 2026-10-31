import { useEffect, useRef, useState } from 'react';
import { Glyph } from '../../components/glyph.js';
import { PROJECT_PHOTO_TYPES, validateProjectPhotos } from '../../app/project-intake.js';
import './photo-picker.css';
export function PhotoPicker({
  files,
  onChange,
  compact = false,
  disabled = false,
  title = 'Add room photos',
  hint = 'Drop photos here or browse · Up to 5',
}: {
  files: File[];
  onChange: (files: File[]) => void;
  compact?: boolean;
  disabled?: boolean;
  title?: string;
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);
  function add(next: File[]) {
    const all = [...files];
    for (const file of next)
      if (
        !all.some(
          (old) =>
            old.name === file.name &&
            old.size === file.size &&
            old.lastModified === file.lastModified,
        )
      )
        all.push(file);
    try {
      validateProjectPhotos(all);
      onChange(all);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  return (
    <section
      className={`photo-picker ${compact ? 'is-compact' : ''}`}
      aria-label="Project photos"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        if (!disabled) add([...event.dataTransfer.files]);
      }}
    >
      <input
        hidden
        ref={input}
        type="file"
        accept={PROJECT_PHOTO_TYPES.join(',')}
        multiple
        aria-label="Choose project photos"
        disabled={disabled}
        onChange={(event) => {
          add([...(event.currentTarget.files || [])]);
          event.currentTarget.value = '';
        }}
      />
      <button
        className="photo-picker-add"
        type="button"
        onClick={() => input.current?.click()}
        disabled={disabled}
      >
        {compact && previews[0] ? <img src={previews[0]} alt="" /> : <Glyph name="photo" />}
        <span>
          {compact ? (
            files.length ? (
              `${files.length} photo${files.length === 1 ? '' : 's'} added`
            ) : (
              'Add photos'
            )
          ) : (
            <>
              <strong>{title}</strong>
              <small>{hint}</small>
            </>
          )}
        </span>
        {!compact && <Glyph name="plus" />}
      </button>
      {!compact && files.length > 0 && (
        <div className="photo-picker-previews">
          {files.map((file, index) => (
            <figure key={`${file.name}-${file.size}-${file.lastModified}`}>
              <img src={previews[index]} alt={file.name} />
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                <Glyph name="close" />
              </button>
              <figcaption>{file.name}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="photo-picker-error">
          {error}
        </p>
      )}
    </section>
  );
}
