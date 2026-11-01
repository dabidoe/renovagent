import { useEffect, useState } from 'react';
import { workspaceRequest } from '../../adapters/http/project-repository.js';
import { Glyph } from '../../components/glyph.js';
import './connect-agent.css';

// Connect Muse or any MCP agent to the owner's own workspace: the site's /mcp
// address and keys the owner makes here. A key is shown once, when it is
// made; examples on this page only ever show a placeholder.

type Key = { id: string; name: string; access: 'read' | 'propose'; expiresAt: string };
const PLACEHOLDER = 'reno_YOUR_KEY';

function Copy({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="ca-copy"
      onClick={() =>
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        })
      }
    >
      {done ? 'Copied' : label}
    </button>
  );
}

export function ConnectAgent() {
  const [endpoint, setEndpoint] = useState('');
  const [keys, setKeys] = useState<Key[]>([]);
  const [error, setError] = useState('');
  const [name, setName] = useState('Muse');
  const [access, setAccess] = useState<Key['access']>('propose');
  const [fresh, setFresh] = useState<{ key: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () =>
    (workspaceRequest('/agent-keys') as Promise<{ endpoint: string; keys: Key[] }>)
      .then((r) => {
        setEndpoint(r.endpoint);
        setKeys(r.keys);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  useEffect(() => {
    void load();
  }, []);
  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const made = (await workspaceRequest('/agent-keys', { name: name.trim(), access })) as {
        key: string;
      };
      setFresh({ key: made.key, name: name.trim() });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (id: string) => {
    await workspaceRequest('/agent-keys/revoke', { id }).catch((e) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
    await load();
  };
  const local = /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(endpoint);
  const ask = `Connect to my Renovagent workspace. It is an MCP server at ${endpoint || 'this address'} (Streamable HTTP). Send my API key in the Authorization header as a Bearer token.`;
  const config = JSON.stringify(
    {
      mcpServers: {
        renovagent: {
          type: 'http',
          url: endpoint,
          headers: { Authorization: `Bearer ${PLACEHOLDER}` },
        },
      },
    },
    null,
    2,
  );
  const curl = `curl -X POST ${endpoint} \\
  -H "Authorization: Bearer ${PLACEHOLDER}" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;
  return (
    <section className="ca" aria-label="Connect Muse or your agent">
      <p className="ca-kicker">Works with Muse</p>
      <h1>Connect your agent.</h1>
      <p className="ca-sub">
        Muse, Claude or any MCP client can read your projects, find paint colours and floor styles,
        and price paint and floors with the same numbers as this site. It runs on your agent’s own
        model; nothing here is charged for it.
      </p>

      <div className="ca-card">
        <h2>Your address</h2>
        <div className="ca-row">
          <code>{endpoint || '…'}</code>
          {endpoint && <Copy value={endpoint} />}
        </div>
        {local && (
          <p className="ca-note">
            This address works for agents on this computer. Muse runs in the cloud, so it needs the
            hosted site’s address.
          </p>
        )}
      </div>

      <div className="ca-card">
        <h2>Make a key</h2>
        <form
          className="ca-make"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) void create();
          }}
        >
          <input
            aria-label="Key name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="ca-access" role="group" aria-label="What the agent may do">
            <button
              type="button"
              aria-pressed={access === 'propose'}
              onClick={() => setAccess('propose')}
            >
              Read and propose
            </button>
            <button
              type="button"
              aria-pressed={access === 'read'}
              onClick={() => setAccess('read')}
            >
              Read only
            </button>
          </div>
          <button type="submit" className="ca-primary" disabled={busy || !name.trim()}>
            Make key <Glyph name="right" />
          </button>
        </form>
        <p className="ca-note">
          Proposals stay proposals: an agent can start projects and suggest changes, never approve
          them or buy anything. Keys last seven days; you can revoke one at any time.
        </p>
        {fresh && (
          <div className="ca-fresh" role="status">
            <p>
              <b>Your key for {fresh.name}</b> — shown this once. Paste it into your agent’s API-key
              field, not into a chat.
            </p>
            <div className="ca-row">
              <code className="ca-secret">{fresh.key}</code>
              <Copy value={fresh.key} label="Copy key" />
            </div>
            <button type="button" className="ca-link" onClick={() => setFresh(null)}>
              I’ve saved it
            </button>
          </div>
        )}
        {error && <p className="ca-error">{error}</p>}
        {keys.length > 0 && (
          <ul className="ca-keys" aria-label="Your keys">
            {keys.map((k) => (
              <li key={k.id}>
                <span>
                  <b>{k.name}</b>
                  <small>
                    {k.access === 'read' ? 'Read only' : 'Read and propose'} · until{' '}
                    {new Date(k.expiresAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </small>
                </span>
                <button type="button" className="ca-link" onClick={() => void revoke(k.id)}>
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="ca-card">
        <h2>In Muse</h2>
        <ol className="ca-steps">
          <li>
            <span>Ask Muse to connect:</span>
            <div className="ca-row">
              <q>{ask}</q>
              <Copy value={ask} />
            </div>
          </li>
          <li>When Muse asks for the key, paste it into its secure field.</li>
          <li>
            Try: <q>Price dark walnut floors and sage walls for my 13 by 23 foot living room.</q>
          </li>
        </ol>
      </div>

      <details className="ca-card ca-dev">
        <summary>Other agents and the API</summary>
        <p>Any MCP client (Streamable HTTP). For example, a client config:</p>
        <div className="ca-code">
          <pre>{config}</pre>
          <Copy value={config} />
        </div>
        <p>Or list the tools directly:</p>
        <div className="ca-code">
          <pre>{curl}</pre>
          <Copy value={curl} />
        </div>
        <p className="ca-note">
          Tools include list_projects, start_project, list_floor_styles, find_paint_color and
          plan_paint_and_floor. Prices are this demo’s example prices, not live offers.
        </p>
      </details>
    </section>
  );
}
