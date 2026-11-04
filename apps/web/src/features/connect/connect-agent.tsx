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
const EXAMPLE_REQUESTS = [
  'Show me my renovation projects.',
  'Help me plan a bathroom renovation.',
  'Save this inspiration to my project.',
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
      const session = await workspaceRequest('/session');
      if (session.mode === 'account' && !session.signedIn) {
        if (!session.guests)
          throw new Error('Guest access is unavailable. Sign in to create a key.');
        await workspaceRequest('/auth/guest', {});
        window.dispatchEvent(new Event('renovagent-session'));
        await load();
      }
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
  const address = 'https://renovagent.app/mcp';
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
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
  return (
    <section className="ca" aria-label="Connect Muse or your agent">
      <header className="ca-heading">
        <h1>Bring Muse into your project.</h1>
      </header>
      <div className="ca-guide-layout">
        <div className="ca-guide">
          <section className="ca-card ca-step" aria-labelledby="ca-connect-title">
            <span className="ca-step-number" aria-hidden="true">
              1
            </span>
            <div className="ca-step-body">
              <h2 id="ca-connect-title">Connect to Muse</h2>
              <p className="ca-note">
                In Muse’s custom-connector setup, enter this as the MCP server URL.
              </p>
              <div className="ca-row">
                <code>{address}</code>
                <Copy value={address} label="Copy endpoint" />
              </div>
            </div>
          </section>
          <section className="ca-card ca-step" aria-labelledby="ca-key-title">
            <span className="ca-step-number" aria-hidden="true">
              2
            </span>
            <div className="ca-step-body">
              <h2 id="ca-key-title">Create and paste your key</h2>
              {!fresh && (
                <form
                  className="ca-make"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!loading && !busy && (signedOut || endpoint) && name.trim()) void create();
                  }}
                >
                  <button
                    type="submit"
                    className="ca-primary"
                    disabled={loading || busy || (!signedOut && !endpoint) || !name.trim()}
                    aria-describedby={
                      !loading && !signedOut && !endpoint ? 'ca-key-unavailable' : undefined
                    }
                  >
                    {busy ? 'Creating…' : 'Create connection key'}
                    <Glyph name="right" />
                  </button>
                </form>
              )}
              {loading ? (
                <p className="ca-note" role="status">
                  Loading your workspace…
                </p>
              ) : signedOut ? (
                <>
                  <p className="ca-note">
                    Create a key to start a guest workspace. Google sign-in is optional.
                  </p>
                  <div className="ca-make">
                    <SignInChoices className="ca-link" showGuest={false} />
                  </div>
                </>
              ) : !endpoint ? (
                <p className="ca-note" id="ca-key-unavailable">
                  Keys can’t be created right now: the workspace service didn’t answer. Reload to
                  try again.
                </p>
              ) : (
                <p className="ca-note">
                  {fresh ? 'Key created. ' : ''}Access lasts one year. Revoke it in Advanced.
                </p>
              )}
              {fresh ? (
                <div className="ca-fresh" role="status">
                  <p>
                    <b>Your private key for {fresh.name}</b>
                  </p>
                  <div className="ca-row">
                    <code className="ca-secret">{fresh.key}</code>
                    <Copy value={fresh.key} label="Copy key" />
                  </div>
                  <p className="ca-note">Shown only once. Copy it before leaving this page.</p>
                  <button type="button" className="ca-link" onClick={() => setFresh(null)}>
                    Hide key
                  </button>
                </div>
              ) : null}
              <p className="ca-note">
                Paste the key into Muse’s secure API-key field. Choose bearer authentication in the
                Authorization header. Keep the key outside the chat.
              </p>
            </div>
          </section>
          <section className="ca-card ca-step" aria-labelledby="ca-start-title">
            <span className="ca-step-number" aria-hidden="true">
              3
            </span>
            <div className="ca-step-body">
              <h2 id="ca-start-title">Start using RenovAgent</h2>
              {EXAMPLE_REQUESTS.map((request) => (
                <div className="ca-prompt" key={request}>
                  <p>{request}</p>
                  <Copy value={request} />
                </div>
              ))}
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
      <details className="ca-card ca-dev">
        <summary>Advanced</summary>
        <p>
          Muse is one option. Any agent with a Streamable HTTP MCP client can use the same
          connection key.
        </p>
        {local && (
          <p>
            This is a local preview. Create your Muse key on the{' '}
            <a href="https://renovagent.app/#connect">hosted connection page</a>.
          </p>
        )}
        <p>
          If Muse cannot open secure key entry, stop and report that error. Do not put the key in
          chat. If access expires or is removed, create a new key. A website session alone does not
          authenticate Muse.
        </p>
        <div className="ca-guide-links">
          <a href="/agent-guide.md">Technical agent guide</a>
          <a href="/project-brief.md" download>
            Brief template
          </a>
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
      </details>
    </section>
  );
}
