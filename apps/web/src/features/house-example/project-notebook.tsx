import { useEffect, useRef, useState } from 'react';
import {
  projectEntryContentSchema,
  type ProjectEntryContent,
  type ProjectNotebookRecord,
} from '@renovagent/contracts';
import { workspaceRequest } from '../../adapters/http/project-repository.js';
import { SignInChoices } from '../connect/sign-in.js';
import { uploadStudioPhoto } from '../project-start/photo-upload.js';
import './project-notebook.css';
type Data = {
  project: { id: string; name: string; revision: number };
  designRevision: number | null;
  entries: ProjectNotebookRecord[];
  total: number;
  nextOffset: number | null;
  messages: { id: string; text: string; role: string; at: string }[];
  draft?: { text: string } | null;
};
const empty = () => ({
  title: '',
  text: '',
  room: '',
  entryType: 'note' as ProjectEntryContent['entryType'],
  links: '',
  tags: '',
  images: [] as ProjectEntryContent['images'],
});
const TYPES = [
  'note',
  'room-photo',
  'inspiration',
  'product',
  'reference',
  'decision',
  'question',
] as const;
function NotebookAttachments({
  images,
  disabled,
  progress,
  onFiles,
  onChange,
}: {
  images: ProjectEntryContent['images'];
  disabled: boolean;
  progress: string;
  onFiles: (files: File[]) => void;
  onChange: (images: ProjectEntryContent['images']) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <div className="notebook-media">
      <div
        className={`notebook-dropzone ${dragging && !disabled ? 'is-dragging' : ''}`}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) onFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <circle cx="8" cy="8" r="1.5" />
          <path d="m3 17 5-5 4 4 4-6 5 7" />
        </svg>
        <div>
          <strong>
            {progress || (dragging ? 'Drop files here' : 'Bring your project into focus')}
          </strong>
          <p>Room photos, inspiration, or something you want to keep.</p>
        </div>
        <button type="button" disabled={disabled} onClick={() => input.current?.click()}>
          {progress ? 'Uploading…' : images.length ? 'Add more photos' : 'Add photos'}
        </button>
        <input
          ref={input}
          className="notebook-file-input"
          aria-label="Add photos or text documents"
          type="file"
          accept="image/*,.txt,.md,text/plain,text/markdown"
          multiple
          disabled={disabled}
          onChange={(e) => {
            onFiles(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
        <small>Or drop files here · Up to 12 photos · .txt and .md welcome</small>
      </div>
      {!!images.length && (
        <div className="notebook-attachments" aria-label="Attached photos">
          {images.map((image, i) => (
            <figure key={image.sha256}>
              <div className="notebook-attachment-preview">
                <img src={`/api/workspace/design-images/${image.sha256}`} alt={image.label} />
                <button
                  type="button"
                  aria-label="Remove image"
                  title={`Remove ${image.label}`}
                  disabled={disabled}
                  onClick={() => onChange(images.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
              <figcaption title={image.label}>{image.label}</figcaption>
              <select
                aria-label={`Role for ${image.label}`}
                value={image.role}
                disabled={disabled}
                onChange={(e) =>
                  onChange(
                    images.map((im, j) =>
                      i === j ? { ...im, role: e.target.value as typeof image.role } : im,
                    ),
                  )
                }
              >
                <option value="reference">Reference photo</option>
                <option value="room">My room</option>
                <option value="inspiration">Inspiration</option>
                <option value="product">Product</option>
              </select>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
export function NotebookCards({
  entries,
  imageUrl,
  onEdit,
  onRemove,
}: {
  entries: ProjectNotebookRecord[];
  imageUrl: (sha: string) => string;
  onEdit?: (entry: ProjectNotebookRecord) => void;
  onRemove?: (entry: ProjectNotebookRecord) => void;
}) {
  return (
    <div className="notebook-cards">
      {entries.map((entry) => (
        <article key={entry.id} className="notebook-card">
          <div className="notebook-card-meta">
            <span>
              {entry.content.entryType.replaceAll('-', ' ')}
              {entry.content.room ? ` · ${entry.content.room}` : ''}
            </span>
            <span>Revision {entry.revision}</span>
          </div>
          <h3>{entry.content.title}</h3>
          {entry.content.text && <p className="notebook-text">{entry.content.text}</p>}
          {!!entry.content.images.length && (
            <div className="notebook-images">
              {entry.content.images.map((image) => (
                <figure key={image.sha256}>
                  <a href={imageUrl(image.sha256)} target="_blank" rel="noreferrer">
                    <img
                      src={imageUrl(image.sha256)}
                      alt={image.label}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </a>
                  <figcaption>
                    {image.role} · {image.label}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          {!!entry.content.links.length && (
            <ul className="notebook-links">
              {entry.content.links.map((link, i) => (
                <li key={i}>
                  <a href={link.url} target="_blank" rel="noreferrer">
                    {link.label || link.url}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {!!entry.content.tags.length && (
            <p className="notebook-tags">{entry.content.tags.map((t) => `#${t}`).join(' ')}</p>
          )}
          <small>
            {entry.author.kind === 'agent' ? `Saved by ${entry.author.name}` : entry.author.name} ·{' '}
            {entry.content.assertion.replaceAll('-', ' ')} ·{' '}
            {new Date(entry.updatedAt).toLocaleString()}
          </small>
          {(onEdit || onRemove) && (
            <div className="notebook-actions">
              {onEdit && (
                <button aria-label={`Edit ${entry.content.title}`} onClick={() => onEdit(entry)}>
                  Edit
                </button>
              )}
              {onRemove && (
                <button
                  aria-label={`Remove ${entry.content.title}`}
                  onClick={() => onRemove(entry)}
                >
                  Remove
                </button>
              )}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
async function ensureGuest() {
  const session = await workspaceRequest('/session');
  if (session.mode === 'account' && !session.signedIn && session.guests) {
    await workspaceRequest('/auth/guest', {});
    window.dispatchEvent(new Event('renovagent-session'));
  }
}
export function ProjectNotebook({
  projectId,
  embedded = false,
}: {
  projectId?: string;
  embedded?: boolean;
}) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(!!projectId),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [uploadProgress, setUploadProgress] = useState(''),
    [query, setQuery] = useState(''),
    [roomFilter, setRoomFilter] = useState(''),
    [attempt, setAttempt] = useState(0),
    [status, setStatus] = useState(''),
    [share, setShare] = useState('');
  const [name, setName] = useState('');
  const [draft, setDraft] = useState(empty),
    [editing, setEditing] = useState<ProjectNotebookRecord | null>(null);
  const request = useRef<{ signature: string; id: string } | null>(null),
    newRequest = useRef(crypto.randomUUID()),
    uploadLock = useRef(false),
    compose = useRef<HTMLFormElement>(null);
  const store = `renovagent.project-notebook.${projectId ?? 'new'}.draft`;
  const [recovered, setRecovered] = useState(false);
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(store) || 'null');
      if (raw?.draft && typeof raw.draft.text === 'string') {
        setDraft({ ...empty(), ...raw.draft });
        setEditing(raw.editing ?? null);
        if (typeof raw.name === 'string') setName(raw.name);
        if (typeof raw.newRequest === 'string') newRequest.current = raw.newRequest;
        if (typeof raw.request?.signature === 'string' && typeof raw.request?.id === 'string') {
          request.current = raw.request;
          setStatus('Unfinished save recovered. Save again to finish.');
        }
      }
    } catch {}
    setRecovered(true);
  }, [store]);
  useEffect(() => {
    if (!recovered) return;
    try {
      localStorage.setItem(
        store,
        JSON.stringify({
          draft,
          editing,
          request: request.current,
          name,
          newRequest: newRequest.current,
        }),
      );
    } catch {
      setStatus('Browser draft recovery is unavailable. Save your entry before leaving.');
    }
  }, [draft, editing, name, store, recovered]);
  useEffect(() => {
    if (!projectId) return;
    let live = true;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ query, room: roomFilter, limit: '50' });
    void workspaceRequest(`/projects/${encodeURIComponent(projectId)}/notebook?${params}`)
      .then(
        (result) => live && setData(result),
        (e) => live && setError(e.message || 'Could not load project notebook.'),
      )
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [projectId, query, roomFilter, attempt]);
  const update = (patch: Partial<ReturnType<typeof empty>>) =>
    setDraft((d) => ({ ...d, ...patch }));
  const create = async () => {
    setBusy(true);
    setError('');
    try {
      await ensureGuest();
      const p = await workspaceRequest('/projects/start', {
        requestId: newRequest.current,
        name: name.trim() || 'My home project',
        brief:
          draft.text.trim().slice(0, 4000) ||
          'Project notebook for notes, room photos, inspiration and links. Scope and measurements are not yet confirmed.',
      });
      if (draft.images.length || draft.text.trim()) {
        const initialDraft = {
          ...draft,
          title:
            draft.text.trim().split('\n')[0]?.slice(0, 120) ||
            draft.images[0]?.label ||
            'Project notes',
        };
        const content = projectEntryContentSchema.parse({
          entryType: initialDraft.entryType,
          title: initialDraft.title,
          text: initialDraft.text,
          images: initialDraft.images,
          assertion: 'user-reported',
        });
        const payload = { content, expectedRevision: 0 };
        const retry = {
          signature: JSON.stringify(payload),
          id: `${newRequest.current}-first-entry`,
        };
        // A lost first-save response must recover with the same command identity.
        let recoverable = false;
        try {
          localStorage.setItem(
            `renovagent.project-notebook.${p.projectId}.draft`,
            JSON.stringify({ draft: initialDraft, editing: null, request: retry }),
          );
          recoverable = true;
        } catch {}
        try {
          await workspaceRequest(`/projects/${encodeURIComponent(p.projectId)}/notebook`, {
            ...payload,
            requestId: retry.id,
          });
          try {
            localStorage.removeItem(`renovagent.project-notebook.${p.projectId}.draft`);
          } catch {}
        } catch {
          if (!recoverable)
            throw Error(
              'Your project was created, but the entry could not be saved. Keep this page open and try again.',
            );
          // The notebook opens with its unsaved material ready to retry.
        }
      }
      try {
        localStorage.removeItem(store);
      } catch {}
      window.location.hash = `#project/${encodeURIComponent(p.projectId)}/notebook`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create project.');
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!projectId) return;
    setBusy(true);
    setError('');
    try {
      const content = projectEntryContentSchema.parse({
        entryType: draft.entryType,
        title:
          draft.title.trim() ||
          draft.text.trim().split('\n')[0]?.slice(0, 120) ||
          draft.images[0]?.label ||
          'Saved reference',
        text: draft.text,
        room: draft.room.trim() || undefined,
        tags: draft.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        links: draft.links
          .split('\n')
          .map((url) => url.trim())
          .filter(Boolean)
          .map((url) => ({ url })),
        images: draft.images,
        assertion: 'user-reported',
      });
      const payload = {
        content,
        expectedRevision: editing?.revision ?? 0,
        ...(editing ? { entryId: editing.id } : {}),
      };
      const signature = JSON.stringify(payload);
      if (request.current?.signature !== signature)
        request.current = { signature, id: crypto.randomUUID() };
      // Persist retry identity before sending: a lost response must survive reload.
      try {
        localStorage.setItem(
          store,
          JSON.stringify({
            draft,
            editing,
            request: request.current,
            name,
            newRequest: newRequest.current,
          }),
        );
      } catch {
        // Saving remains available when browser storage is blocked.
      }
      await workspaceRequest(`/projects/${encodeURIComponent(projectId)}/notebook`, {
        ...payload,
        requestId: request.current.id,
      });
      setDraft(empty());
      setEditing(null);
      request.current = null;
      setStatus('Saved to this project. Muse can read it.');
      setAttempt((a) => a + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save entry.');
    } finally {
      setBusy(false);
    }
  };
  const files = async (selected: File[]) => {
    if (!selected.length || uploadLock.current || busy) return;
    uploadLock.current = true;
    setUploading(true);
    setError('');
    setStatus('');
    let currentImages = [...draft.images];
    let currentText = draft.text;
    const failures: string[] = [];
    try {
      await ensureGuest();
      for (const [index, file] of selected.entries()) {
        setUploadProgress(`Adding file ${index + 1} of ${selected.length}…`);
        try {
          if (file.type.startsWith('image/')) {
            if (currentImages.length >= 12)
              throw Error('Each entry holds up to 12 photos. Save these and start another entry.');
            const sha256 = await uploadStudioPhoto(file);
            if (currentImages.some((image) => image.sha256 === sha256)) continue;
            currentImages = [
              ...currentImages,
              {
                sha256,
                label: file.name.slice(0, 200),
                role:
                  draft.entryType === 'room-photo'
                    ? 'room'
                    : draft.entryType === 'inspiration'
                      ? 'inspiration'
                      : draft.entryType === 'product'
                        ? 'product'
                        : 'reference',
              },
            ];
            setDraft((d) => ({ ...d, images: currentImages }));
          } else if (/\.(txt|md)$/i.test(file.name)) {
            if (file.size > 80000) throw Error('Use a text document under 80 KB.');
            const text = `\n\n${file.name}\n${await file.text()}`;
            if (currentText.length + text.length > 20000)
              throw Error('This entry exceeds 20,000 characters. Split the document into entries.');
            currentText += text;
            setDraft((d) => ({ ...d, text: currentText }));
          } else throw Error('Add an image, .txt or .md file.');
        } catch (e) {
          failures.push(
            `${file.name}: ${e instanceof Error ? e.message : 'Could not attach file.'}`,
          );
        }
      }
      if (failures.length) setError(failures.join('\n'));
      if (currentImages.length > draft.images.length || currentText !== draft.text)
        setStatus(
          projectId
            ? 'Files ready. Save the entry to attach them to this project.'
            : 'Files ready. Create the notebook to save them.',
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not attach files.');
    } finally {
      uploadLock.current = false;
      setUploading(false);
      setUploadProgress('');
    }
  };
  const edit = async (entry: ProjectNotebookRecord) => {
    setBusy(true);
    setError('');
    try {
      const full = (await workspaceRequest(
        `/projects/${encodeURIComponent(projectId!)}/notebook/${encodeURIComponent(entry.id)}`,
      )) as ProjectNotebookRecord;
      setEditing(full);
      setDraft({
        title: full.content.title,
        text: full.content.text,
        entryType: full.content.entryType,
        room: full.content.room || '',
        links: full.content.links.map((l) => l.url).join('\n'),
        tags: full.content.tags.join(', '),
        images: full.content.images,
      });
      compose.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (entry: ProjectNotebookRecord) => {
    if (
      !window.confirm(
        `Remove “${entry.content.title}” from this notebook? Earlier versions remain in history.`,
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await workspaceRequest(
        `/projects/${encodeURIComponent(projectId!)}/notebook/${encodeURIComponent(entry.id)}/remove`,
        { requestId: crypto.randomUUID(), expectedRevision: entry.revision },
      );
      setAttempt((a) => a + 1);
      setStatus('Entry removed. Earlier versions remain in history.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const loadMore = async () => {
    if (!data || data.nextOffset === null) return;
    try {
      const next = await workspaceRequest(
        `/projects/${encodeURIComponent(projectId!)}/notebook?${new URLSearchParams({ query, room: roomFilter, offset: String(data.nextOffset), limit: '50' })}`,
      );
      setData((d) => (d ? { ...next, entries: [...d.entries, ...next.entries] } : next));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const attachments = (
    <NotebookAttachments
      images={draft.images}
      disabled={busy || uploading}
      progress={uploadProgress}
      onFiles={(selected) => void files(selected)}
      onChange={(images) => update({ images })}
    />
  );
  const feedback = (
    <div className="notebook-feedback">
      {status && (
        <p className="notebook-status" role="status">
          {status}
        </p>
      )}
      {uploadProgress && (
        <p className="notebook-status" role="status">
          {uploadProgress}
        </p>
      )}

      {error && (
        <div role="alert">
          <p>{error}</p>
          {!data && projectId && (
            <>
              <p>Use the workspace that owns this project, or open its shared link.</p>
              <SignInChoices onSignedIn={async () => setAttempt((a) => a + 1)} />
            </>
          )}
        </div>
      )}
    </div>
  );
  return (
    <section
      className={`project-notebook ${embedded ? 'notebook-embedded' : ''}`}
      aria-label="Project notebook"
    >
      <header>
        <div>
          <p className="notebook-eyebrow">Project memory · available to Muse</p>
          <h1>
            {data
              ? `${data.project.name} · Notebook`
              : projectId
                ? 'Project notebook'
                : 'Start with notes, photos or links'}
          </h1>
          <p>A place for the room as it is, the ideas you love, and what comes next.</p>
        </div>
        {data?.designRevision && (
          <a href={`#design/${encodeURIComponent(projectId!)}/${data.designRevision}`}>
            Open saved design
          </a>
        )}
      </header>
      {!projectId ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
          className="notebook-compose"
        >
          {attachments}
          <label>
            Project name
            <input
              value={name}
              disabled={busy || uploading}
              onChange={(e) => setName(e.target.value)}
              maxLength={300}
              placeholder="Living room refresh"
            />
          </label>
          <label>
            What are you working on?
            <textarea
              value={draft.text}
              disabled={busy || uploading}
              onChange={(e) => update({ text: e.target.value })}
              maxLength={20000}
              placeholder="A few words are enough. Measurements can wait."
            />
          </label>
          <button className="notebook-primary" disabled={busy || uploading}>
            {busy ? 'Creating…' : 'Create project notebook'}
          </button>
          <small>No sign-in needed. A limited guest workspace is created for you.</small>
          {feedback}
        </form>
      ) : (
        <>
          {loading && !data && <p role="status">Loading project notes…</p>}
          {!data && feedback}
          {data && (
            <>
              <form
                ref={compose}
                className="notebook-compose"
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <h2>{editing ? 'Edit saved entry' : 'Add a little context'}</h2>
                <fieldset disabled={busy || uploading} className="notebook-form-fields">
                  {attachments}
                  <label className="notebook-note-label">
                    Notes
                    <textarea
                      value={draft.text}
                      onChange={(e) => update({ text: e.target.value })}
                      maxLength={20000}
                      placeholder="What do you have in mind? Add a thought, a question, or a little context for your photos…"
                      rows={3}
                    />
                  </label>
                  <details className="notebook-details" open={editing ? true : undefined}>
                    <summary>Organize &amp; add links</summary>
                    <div className="notebook-fields">
                      <label>
                        Type
                        <select
                          value={draft.entryType}
                          onChange={(e) =>
                            update({
                              entryType: e.target.value as ProjectEntryContent['entryType'],
                            })
                          }
                        >
                          {TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type.replaceAll('-', ' ')}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Room (optional)
                        <input
                          value={draft.room}
                          onChange={(e) => update({ room: e.target.value })}
                          maxLength={120}
                          placeholder="Living room"
                        />
                      </label>
                      <label>
                        Title (optional)
                        <input
                          value={draft.title}
                          onChange={(e) => update({ title: e.target.value })}
                          maxLength={200}
                        />
                      </label>
                    </div>
                    <label>
                      Links · one per line
                      <textarea
                        value={draft.links}
                        onChange={(e) => update({ links: e.target.value })}
                        placeholder="https://…"
                        rows={2}
                      />
                    </label>
                    <label>
                      Tags · comma separated
                      <input
                        value={draft.tags}
                        onChange={(e) => update({ tags: e.target.value })}
                      />
                    </label>
                  </details>
                </fieldset>
                <div className="notebook-compose-footer">
                  <small>
                    {draft.images.length ? `${draft.images.length} / 12 photos · ` : ''}
                    {editing ? 'Editing saved entry' : 'Draft until you save'}
                  </small>
                  <div className="notebook-actions">
                    <button
                      className="notebook-primary"
                      disabled={
                        busy ||
                        uploading ||
                        !(draft.text.trim() || draft.links.trim() || draft.images.length)
                      }
                    >
                      {busy
                        ? 'Saving…'
                        : uploading
                          ? 'Uploading…'
                          : editing
                            ? 'Save changes'
                            : 'Save entry'}
                    </button>
                    {editing && (
                      <button
                        type="button"
                        disabled={busy || uploading}
                        onClick={() => {
                          setEditing(null);
                          setDraft(empty());
                          setStatus('');
                        }}
                      >
                        Cancel edit
                      </button>
                    )}
                  </div>
                </div>
                {feedback}
              </form>
              <div className="notebook-filters">
                <label>
                  Search this notebook
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Notes, sources, tags…"
                  />
                </label>
                <label>
                  Filter by room
                  <input
                    value={roomFilter}
                    onChange={(e) => setRoomFilter(e.target.value)}
                    placeholder="All rooms"
                  />
                </label>
                <button
                  disabled={busy || uploading}
                  onClick={() => {
                    setAttempt((a) => a + 1);
                  }}
                >
                  Refresh notes from Muse
                </button>
                <button
                  disabled={busy || uploading}
                  title="Publish the saved notebook and design for anyone with the link"
                  onClick={() => {
                    setBusy(true);
                    setError('');
                    void workspaceRequest('/studio-designs/share', {
                      projectId,
                      requestId: crypto.randomUUID(),
                      ...(data.designRevision ? { revision: data.designRevision } : {}),
                    })
                      .then((result) => {
                        setShare(result.url);
                        void navigator.clipboard.writeText(result.url).catch(() => {});
                      })
                      .catch((e) => setError(e.message))
                      .finally(() => setBusy(false));
                  }}
                >
                  Share this project
                </button>
              </div>
              {share && (
                <p role="status">
                  Anyone with this link can view the saved notebook, design and photos:{' '}
                  <a href={share} target="_blank" rel="noreferrer">
                    Open shared project
                  </a>
                  <input
                    aria-label="Notebook share link"
                    readOnly
                    value={share}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </p>
              )}
              <p>
                {data.total} saved {data.total === 1 ? 'entry' : 'entries'}
                {loading ? ' · refreshing…' : ''}
              </p>
              {!data.entries.length && (
                <p className="notebook-empty">
                  {query || roomFilter
                    ? 'No entries match. Try another search or room.'
                    : 'Your project starts here. Add photos or a thought above, or ask Muse to save something here.'}
                </p>
              )}
              <NotebookCards
                entries={data.entries}
                imageUrl={(sha) => `/api/workspace/design-images/${sha}`}
                onEdit={busy || uploading ? undefined : (entry) => void edit(entry)}
                onRemove={busy || uploading ? undefined : (entry) => void remove(entry)}
              />
              {data.nextOffset !== null && (
                <button onClick={() => void loadMore()}>Load more entries</button>
              )}
              {!!(data.messages.length || data.draft?.text) && (
                <details className="notebook-legacy">
                  <summary>Earlier conversation and draft</summary>
                  {data.messages.map((m) => (
                    <p key={m.id} className="notebook-text">
                      <strong>{m.role}</strong> · {m.text}
                    </p>
                  ))}
                  {data.draft?.text && (
                    <p className="notebook-text">
                      <strong>Unsent draft</strong> · {data.draft.text}
                    </p>
                  )}
                </details>
              )}
            </>
          )}
        </>
      )}
      <p className="notebook-disclaimer">
        Saved notes are source material, not verified measurements or construction approval.
      </p>
    </section>
  );
}
