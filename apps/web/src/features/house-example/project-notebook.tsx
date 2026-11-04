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
              {onEdit && <button onClick={() => onEdit(entry)}>Edit {entry.content.title}</button>}
              {onRemove && (
                <button onClick={() => onRemove(entry)}>Remove {entry.content.title}</button>
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
    [query, setQuery] = useState(''),
    [roomFilter, setRoomFilter] = useState(''),
    [attempt, setAttempt] = useState(0),
    [status, setStatus] = useState(''),
    [share, setShare] = useState('');
  const [name, setName] = useState(''),
    [brief, setBrief] = useState('');
  const [draft, setDraft] = useState(empty),
    [editing, setEditing] = useState<ProjectNotebookRecord | null>(null);
  const request = useRef<{ signature: string; id: string } | null>(null),
    newRequest = useRef(crypto.randomUUID()),
    compose = useRef<HTMLFormElement>(null);
  const store = `renovagent.project-notebook.${projectId ?? 'new'}.draft`;
  const [recovered, setRecovered] = useState(false);
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(store) || 'null');
      if (raw?.draft && typeof raw.draft.text === 'string') {
        setDraft({ ...empty(), ...raw.draft });
        setEditing(raw.editing ?? null);
        if (typeof raw.request?.signature === 'string' && typeof raw.request?.id === 'string')
          request.current = raw.request;
      }
    } catch {}
    setRecovered(true);
  }, [store]);
  useEffect(() => {
    if (!recovered) return;
    try {
      localStorage.setItem(store, JSON.stringify({ draft, editing, request: request.current }));
    } catch {
      setStatus('Browser draft recovery is unavailable. Save your entry before leaving.');
    }
  }, [draft, editing, store, recovered]);
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
          brief.trim() ||
          'Project notebook for notes, room photos, inspiration and links. Scope and measurements are not yet confirmed.',
      });
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
        localStorage.setItem(store, JSON.stringify({ draft, editing, request: request.current }));
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
    setUploading(true);
    setError('');
    try {
      const added: ProjectEntryContent['images'] = [];
      let text = '';
      for (const file of selected) {
        if (file.type.startsWith('image/')) {
          added.push({
            sha256: await uploadStudioPhoto(file),
            label: file.name.slice(0, 200),
            role:
              draft.entryType === 'room-photo'
                ? 'room'
                : draft.entryType === 'inspiration'
                  ? 'inspiration'
                  : draft.entryType === 'product'
                    ? 'product'
                    : 'reference',
          });
        } else if (/\.(txt|md)$/i.test(file.name)) {
          if (file.size > 80000) throw Error('Use a text document under 80 KB.');
          text += `\n\n${file.name}\n${await file.text()}`;
        } else throw Error('Add an image, .txt or .md file.');
      }
      if (draft.text.length + text.length > 20000)
        throw new Error(
          'This entry exceeds 20,000 characters. Save a shorter excerpt or split the document into entries.',
        );
      setDraft((d) => ({
        ...d,
        images: [...d.images, ...added].slice(0, 12),
        text: d.text + text,
      }));
      setStatus('Files ready. Save the entry to attach them to this project.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not attach file.');
    } finally {
      setUploading(false);
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
          <p>
            Keep your room photos, inspiration, choices and questions together. Nothing here is
            treated as a verified measurement or construction approval.
          </p>
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
          <label>
            Project name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={300}
              placeholder="Living room refresh"
            />
          </label>
          <label>
            What are you working on?
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              maxLength={4000}
              placeholder="A few words are enough. Measurements can wait."
            />
          </label>
          <button className="notebook-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create project notebook'}
          </button>
          <small>No sign-in needed. A limited guest workspace is created for you.</small>
        </form>
      ) : (
        <>
          {loading && !data && <p role="status">Loading project notes…</p>}
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
                <h2>{editing ? 'Edit saved entry' : 'Add to this project'}</h2>
                <fieldset disabled={busy || uploading} className="notebook-form-fields">
                  <div className="notebook-fields">
                    <label>
                      Type
                      <select
                        value={draft.entryType}
                        onChange={(e) =>
                          update({ entryType: e.target.value as ProjectEntryContent['entryType'] })
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
                    Notes
                    <textarea
                      value={draft.text}
                      onChange={(e) => update({ text: e.target.value })}
                      maxLength={20000}
                      placeholder="What you like, what to keep, measurements you reported, decisions or questions…"
                      rows={5}
                    />
                  </label>
                  <label>
                    Links · one per line
                    <textarea
                      value={draft.links}
                      onChange={(e) => update({ links: e.target.value })}
                      placeholder="https://…"
                      rows={2}
                    />
                  </label>
                  <details>
                    <summary>Tags and files</summary>
                    <label>
                      Tags · comma separated
                      <input
                        value={draft.tags}
                        onChange={(e) => update({ tags: e.target.value })}
                      />
                    </label>
                    <label>
                      Add photos or text documents
                      <input
                        type="file"
                        accept="image/*,.txt,.md,text/plain,text/markdown"
                        multiple
                        disabled={uploading || busy}
                        onChange={(e) => {
                          void files(Array.from(e.target.files ?? []));
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <small>
                      Images, .txt and .md. Uploaded files stay as draft material until you save the
                      entry.
                    </small>
                  </details>
                  {!!draft.images.length && (
                    <div className="notebook-attachments">
                      {draft.images.map((image, i) => (
                        <div key={image.sha256}>
                          <img
                            src={`/api/workspace/design-images/${image.sha256}`}
                            alt={image.label}
                          />
                          <span>{image.label}</span>
                          <select
                            aria-label={`Role for ${image.label}`}
                            value={image.role}
                            onChange={(e) =>
                              update({
                                images: draft.images.map((im, j) =>
                                  i === j
                                    ? { ...im, role: e.target.value as typeof image.role }
                                    : im,
                                ),
                              })
                            }
                          >
                            {['room', 'inspiration', 'product', 'reference'].map((role) => (
                              <option key={role}>{role}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              update({ images: draft.images.filter((_, j) => j !== i) })
                            }
                          >
                            Remove image
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </fieldset>
                <div className="notebook-actions">
                  <button className="notebook-primary" disabled={busy || uploading}>
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
                      onClick={() => {
                        setEditing(null);
                        setDraft(empty());
                      }}
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
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
                  disabled={busy}
                  onClick={() => {
                    setAttempt((a) => a + 1);
                  }}
                >
                  Refresh notes from Muse
                </button>
                <button
                  disabled={busy}
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
                  No entries match yet. Add a note, a room photo or a link above, or ask Muse to
                  save something to this project.
                </p>
              )}
              <NotebookCards
                entries={data.entries}
                imageUrl={(sha) => `/api/workspace/design-images/${sha}`}
                onEdit={(entry) => void edit(entry)}
                onRemove={(entry) => void remove(entry)}
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
      {status && <p role="status">{status}</p>}
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
    </section>
  );
}
