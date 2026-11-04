import { MuseAnimation } from './muse-animation.js';
import { useEffect, useState } from 'react';
import { workspaceRequest } from '../../adapters/http/project-repository.js';
import { Glyph } from '../../components/glyph.js';
import { SignInChoices } from './sign-in.js';
import { Copy } from './copy-button.js';
import { MuseConversation } from './muse-conversation.js';
import './connect-agent.css';

// Connect Muse or any MCP agent to the owner's own workspace: the site's /mcp
// address and keys the owner makes here. A key is shown once, when it is
// made; examples on this page only ever show a placeholder.

type Key = { id: string; name: string; access: 'read' | 'propose'; expiresAt: string };
const PLACEHOLDER = 'reno_YOUR_KEY';
const STARTERS = [
  {
    title: 'Save a plan',
    request:
      'Make a paint-and-floor plan for my room. Ask for missing measurements, then save it and give me the link.',
  },
  { title: 'Save inspiration', request: 'Save this photo to my Renovagent inspiration board.' },
  {
    title: 'Use a brief',
    request:
      'Read this Markdown brief and start a Renovagent project. Keep unknown measurements unknown.',
  },
];

export function ConnectAgent() {
  const [endpoint, setEndpoint] = useState('');
  const [keys, setKeys] = useState<Key[]>([]);
  const [error, setError] = useState('');
  const [name, setName] = useState('Muse');
  const [fresh, setFresh] = useState<{ key: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = () =>
    (workspaceRequest('/agent-keys') as Promise<{ endpoint: string; keys: Key[] }>)
      .then((r) => {
        setEndpoint(r.endpoint);
        setKeys(r.keys);
        setSignedOut(false);
      })
      .catch((e: { code?: string; message?: string }) =>
        e.code === 'FORBIDDEN' ? setSignedOut(true) : setError(e.message ?? String(e)),
      )
      .finally(() => setLoading(false));
  useEffect(() => {
    void load();
  }, []);
  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const made = (await workspaceRequest('/agent-keys', {
        name: name.trim(),
        access: 'propose',
      })) as {
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
  const address = endpoint || new URL('/mcp', window.location.origin).href;
  const local = /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(address);
  const introduction = `Connect to my Renovagent workspace at ${address} using MCP OAuth. Start the browser authorization flow so I can sign in and approve access. Request renovagent:read and renovagent:propose so you can read projects and save proposed plans and inspiration. Do not ask me to copy a key into chat.`;
  const guideUrl = new URL('/agent-guide.md', window.location.origin).href;
  const ask = `${introduction}\n\nRead ${guideUrl} for tool, photo and brief instructions. Use the resource metadata advertised in the 401 response to discover authorization. Register a public client, use authorization code with S256 PKCE, and open the authorization URL for me. If your connector only supports API keys, say so and link me to ${new URL('/#connect', window.location.origin).href} for manual setup; do not claim OAuth has completed.`;
  const config = JSON.stringify(
    {
      mcpServers: {
        renovagent: {
          type: 'http',
          url: address,
          headers: { Authorization: `Bearer ${PLACEHOLDER}` },
        },
      },
    },
    null,
    2,
  );
  const curl = `curl -X POST ${address} \\
  -H "Authorization: Bearer ${PLACEHOLDER}" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;
  return (
    <section className="ca" aria-label="Connect Muse or your agent">
      <header className="ca-heading">
        <h1>Bring Muse into your project.</h1>
      </header>
      <div className="ca-guide-layout">
        <div className="ca-guide">
          <section className="ca-card ca-step" aria-labelledby="ca-ask-title">
            <span className="ca-step-number" aria-hidden="true">
              1
            </span>
            <div className="ca-step-body">
              <h2 id="ca-ask-title">Start a conversation in Muse.</h2>
              <p className="ca-note">Paste this into Muse.</p>
              <div className="ca-prompt">
                <p>{introduction}</p>
                <Copy value={ask} label="Copy connection message" />
                <details className="ca-full-message">
                  <summary>Show full message</summary>
                  <p>{ask}</p>
                </details>
              </div>
              {local && (
                <p className="ca-note">
                  This is a local preview, which Muse cannot reach. Use the{' '}
                  <a href="https://renovagent.app/#connect">hosted connection page</a> to pair with
                  Muse.
                </p>
              )}
            </div>
          </section>
          <section className="ca-card ca-step" aria-labelledby="ca-permission-title">
            <span className="ca-step-number" aria-hidden="true">
              2
            </span>
            <div className="ca-step-body">
              <h2 id="ca-permission-title">Approve access in Renovagent.</h2>
              <p className="ca-note">
                Your agent opens a Renovagent approval page. Sign in to your existing workspace,
                review the requested access, and choose Approve connection. You won’t need to copy a
                key.
              </p>
              <details>
                <summary>Manual key setup for clients without OAuth</summary>
                {loading ? (
                  <p className="ca-note" role="status">
                    Loading your workspace…
                  </p>
                ) : signedOut ? (
                  <>
                    <p className="ca-note">
                      Continue as a guest to try it. Google sign-in is optional.
                    </p>
                    <div className="ca-make">
                      <SignInChoices className="ca-primary" />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="ca-note">
                      Muse can read your projects and save plans and finds. You control approvals
                      and purchases.
                    </p>
                    {!fresh && (
                      <form
                        className="ca-make"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (name.trim()) void create();
                        }}
                      >
                        <button
                          type="submit"
                          className="ca-primary"
                          disabled={busy || !endpoint || !name.trim()}
                          aria-describedby={!endpoint ? 'ca-key-unavailable' : undefined}
                        >
                          {busy ? 'Creating…' : 'Create connection key'}
                          <Glyph name="right" />
                        </button>
                      </form>
                    )}
                    {!fresh && !endpoint && (
                      <p className="ca-note" id="ca-key-unavailable">
                        Keys can’t be created right now: the workspace service didn’t answer. Reload
                        to try again.
                      </p>
                    )}
                    <p className="ca-note">Access lasts one year. Remove it below at any time.</p>
                  </>
                )}
                {fresh && (
                  <div className="ca-fresh" role="status">
                    <p>
                      <b>Your private key for {fresh.name}</b>
                    </p>
                    <div className="ca-row">
                      <code className="ca-secret">{fresh.key}</code>
                      <Copy value={fresh.key} label="Copy private key" />
                    </div>
                    <p className="ca-note">
                      Shown this once. Paste it into Muse’s secure credentials field when asked,
                      outside the chat.
                    </p>
                    <button type="button" className="ca-link" onClick={() => setFresh(null)}>
                      Hide key
                    </button>
                  </div>
                )}
              </details>
            </div>
          </section>
          <section className="ca-card ca-step" aria-labelledby="ca-finish-title">
            <span className="ca-step-number" aria-hidden="true">
              3
            </span>
            <div className="ca-step-body">
              <h2 id="ca-finish-title">Finish in Muse, then try it.</h2>
              <p className="ca-note">
                After approval, return to your agent. It finishes the connection securely. Then
                send:
              </p>
              <div className="ca-prompt">
                <p>Show me my Renovagent projects.</p>
                <Copy value="Show me my Renovagent projects." label="Copy first request" />
              </div>
            </div>
          </section>
          {error && (
            <p className="ca-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <aside className="ca-example" aria-label="What you can ask Muse">
          <div className="ca-muse-intro">
            <div>
              <h2>Muse + Renovagent</h2>
              <p>
                Plans open in your studio. Finds go to <b>Your board</b>.
              </p>
            </div>
            <MuseAnimation variant="connect" />
          </div>
          <MuseConversation />
        </aside>
      </div>
      <section className="ca-card ca-say" aria-labelledby="ca-say-title">
        <h2 id="ca-say-title">What to say</h2>
        <div className="ca-starters">
          {STARTERS.map((s) => (
            <div key={s.title}>
              <h3>{s.title}</h3>
              <p>{s.request}</p>
              <Copy value={s.request} label={`Copy: ${s.title.toLowerCase()}`} />
            </div>
          ))}
        </div>
        <p className="ca-note">
          Attach the photo or brief in Muse. For a room preview,{' '}
          <a href="#your-project">upload your photo in the studio</a>.
        </p>
      </section>
      <details className="ca-card ca-dev">
        <summary>Photos, briefs & agent instructions</summary>
        <p>
          Chat attachments aren’t automatically uploaded to Renovagent. The agent guide explains the
          supported paths.
        </p>
        <div className="ca-guide-links">
          <a href="/agent-guide.md" target="_blank" rel="noreferrer">
            Read agent guide (.md) ↗
          </a>
          <a href="/project-brief.md" download>
            Brief template ↓
          </a>
        </div>
      </details>
      {keys.length > 0 && (
        <details className="ca-card ca-manage">
          <summary>
            Manage your connection keys <span>{keys.length}</span>
          </summary>
          <ul className="ca-keys" aria-label="Your keys">
            {keys.map((k) => (
              <li key={k.id}>
                <span>
                  <b>{k.name}</b>
                  <small>
                    Expires{' '}
                    {new Date(k.expiresAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </small>
                </span>
                <button type="button" className="ca-link" onClick={() => void revoke(k.id)}>
                  Remove access
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <details className="ca-card ca-dev">
        <summary>Other agents & connection details</summary>
        <p>
          Muse is one option. Any agent with a Streamable HTTP MCP client can use the same
          connection key.
        </p>
        <div className="ca-row">
          <code>{address}</code>
          <Copy value={address} label="Copy address" />
        </div>
        {!signedOut && (
          <label className="ca-connection-name">
            Name for your next connection
            <input
              aria-label="Connection name"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        <p>Client configuration:</p>
        <div className="ca-code">
          <pre>{config}</pre>
          <Copy value={config} />
        </div>
        <p>Or list the available tools:</p>
        <div className="ca-code">
          <pre>{curl}</pre>
          <Copy value={curl} />
        </div>
      </details>
    </section>
  );
}
