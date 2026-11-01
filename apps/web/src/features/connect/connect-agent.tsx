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
  const introduction = `Connect to my Renovagent workspace at ${address}. Ask me for the connection key in your secure credentials field.`;
  const ask = `${introduction}\n\nConnection details: Streamable HTTP MCP. Send the key in the Authorization header as a Bearer token.`;
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
        <p className="ca-kicker">Your project, in the conversation</p>
        <h1>Bring Muse into your project.</h1>
        <p className="ca-sub">
          Ask for a plan, find finishes, and come back here to review what your agent saved.
        </p>
      </header>
      <div className="ca-guide-layout">
        <div className="ca-guide">
          <section className="ca-card ca-step" aria-labelledby="ca-ask-title">
            <span className="ca-step-number" aria-hidden="true">
              1
            </span>
            <div className="ca-step-body">
              <h2 id="ca-ask-title">Start a conversation in Muse.</h2>
              <p className="ca-note">
                Copy this message and send it to Muse. It includes the connection details.
              </p>
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
                  <a href="https://renovagent-production.up.railway.app/#connect">
                    hosted connection page
                  </a>{' '}
                  to pair with Muse.
                </p>
              )}
            </div>
          </section>
          <section className="ca-card ca-step" aria-labelledby="ca-permission-title">
            <span className="ca-step-number" aria-hidden="true">
              2
            </span>
            <div className="ca-step-body">
              <h2 id="ca-permission-title">Give Muse access to your workspace.</h2>
              {loading ? (
                <p className="ca-note" role="status">
                  Loading your workspace…
                </p>
              ) : signedOut ? (
                <>
                  <p className="ca-note">
                    Sign in, or try a private workspace as a guest, to create your connection key.
                  </p>
                  <div className="ca-make">
                    <SignInChoices className="ca-primary" />
                  </div>
                </>
              ) : (
                <>
                  <p className="ca-note">
                    Create a private connection key. It lets Muse read your projects and save plans
                    and finds. You keep control of approvals and purchases.
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
                      >
                        {busy ? 'Creating…' : 'Create connection key'}
                        <Glyph name="right" />
                      </button>
                    </form>
                  )}
                  <p className="ca-note">
                    Access lasts seven days. You can remove it below at any time.
                  </p>
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
            </div>
          </section>
          <section className="ca-card ca-step" aria-labelledby="ca-finish-title">
            <span className="ca-step-number" aria-hidden="true">
              3
            </span>
            <div className="ca-step-body">
              <h2 id="ca-finish-title">Finish in Muse, then try it.</h2>
              <p className="ca-note">
                When Muse asks, paste the key into its secure field. Then send this message to check
                that it can see your workspace.
              </p>
              <div className="ca-prompt">
                <p>Show me my Renovagent projects.</p>
                <Copy value="Show me my Renovagent projects." label="Copy first request" />
              </div>
              <p className="ca-note">
                If Muse asks you to post the key in the conversation, ask it to use its secure
                credentials field instead.
              </p>
            </div>
          </section>
          {error && (
            <p className="ca-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <aside className="ca-example" aria-label="What you can ask Muse">
          <MuseConversation />
          <p className="ca-example-note">
            Try the examples above to see what you can ask next. Saved plans open in the studio;
            saved finds appear on Your board.
          </p>
        </aside>
      </div>
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
