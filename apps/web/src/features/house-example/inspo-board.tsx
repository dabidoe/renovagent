import { useEffect, useState } from 'react';
import { workspaceRequest } from '../../adapters/http/project-repository.js';
import { imageUrl } from './own-project.js';

// The owner's inspiration board: links they saved here and what their own agent
// (Muse or any MCP client) found with save_inspiration. Agent finds are marked
// as not checked; Renovagent never opens the links. A photo on the board can be
// read like an uploaded one.
type Find = {
  id: string;
  kind: 'inspiration' | 'product';
  title: string;
  url?: string;
  note?: string;
  imageSha256?: string;
  agent: string | null;
  createdAt: string;
};

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

export function InspoBoard({
  onUsePhoto,
  busy,
}: {
  onUsePhoto: (sha256: string) => void;
  busy: boolean;
}) {
  const [finds, setFinds] = useState<Find[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const load = () =>
    (workspaceRequest('/studio/finds') as Promise<{ finds: Find[] }>)
      .then((r) => setFinds(r.finds))
      // Signed out: no board, and the panel's own sign-in prompt covers it.
      .catch(() => setFinds(null));
  useEffect(() => {
    void load();
  }, []);
  if (!finds) return null;
  const remove = async (id: string) => {
    try {
      await workspaceRequest('/studio/finds/remove', { id });
      setFinds((all) => all?.filter((f) => f.id !== id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.');
    }
  };
  return (
    <details className="pf-board" open={finds.length > 0}>
      <summary>
        Your board <small>{finds.length ? `${finds.length} saved` : 'links and finds'}</small>
      </summary>
      {finds.length === 0 && (
        <p className="pf-inspo-note">
          Save links here, or ask your agent to: connect it at Connect, then say “find me a rust
          velvet pillow and add it to my Renovagent board”.
        </p>
      )}
      <ul>
        {finds.map((f) => (
          <li key={f.id}>
            {f.imageSha256 ? <img src={imageUrl(f.imageSha256)} alt="" /> : <span aria-hidden />}
            <div>
              {f.url ? (
                <a href={f.url} target="_blank" rel="noopener noreferrer nofollow">
                  {f.title}
                </a>
              ) : (
                <b>{f.title}</b>
              )}
              <small>
                {f.kind === 'product' ? 'Product' : 'Inspiration'}
                {f.url ? ` · ${host(f.url)}` : ''} ·{' '}
                {f.agent ? `Found by ${f.agent} · not checked` : 'Saved by you'}
              </small>
              {f.note && <p>{f.note}</p>}
              <div className="pf-board-actions">
                {f.imageSha256 && (
                  <button type="button" disabled={busy} onClick={() => onUsePhoto(f.imageSha256!)}>
                    Use this photo
                  </button>
                )}
                <button type="button" onClick={() => void remove(f.id)}>
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {adding ? (
        <form
          className="pf-board-add"
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setError('');
            try {
              await workspaceRequest('/studio/finds', {
                requestId: crypto.randomUUID(),
                kind: data.get('kind') === 'product' ? 'product' : 'inspiration',
                title: String(data.get('title') || '').trim() || host(String(data.get('url'))),
                url: String(data.get('url') || '').trim(),
              });
              setAdding(false);
              await load();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'That did not work.');
            }
          }}
        >
          <input name="url" type="url" required placeholder="https://…" aria-label="Link" />
          <input name="title" maxLength={200} placeholder="What it is" aria-label="Title" />
          <select name="kind" aria-label="Kind" defaultValue="inspiration">
            <option value="inspiration">A look</option>
            <option value="product">A product</option>
          </select>
          <button type="submit">Save link</button>
          <button type="button" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" className="pf-board-new" onClick={() => setAdding(true)}>
          Add a link
        </button>
      )}
      {error && (
        <p className="pf-intake-error" role="alert">
          {error}
        </p>
      )}
    </details>
  );
}
