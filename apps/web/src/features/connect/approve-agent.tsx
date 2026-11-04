import { useEffect, useState } from 'react';
import { workspaceRequest } from '../../adapters/http/project-repository.js';
import { SignInChoices } from './sign-in.js';
import './connect-agent.css';

type Request = { name: string; callback: string; access: 'read' | 'propose'; expiresAt: string };
export function ApproveAgent({ requestId }: { requestId: string }) {
  const [request, setRequest] = useState<Request | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState('');
  const load = async () => {
    setError('');
    try {
      const session = await workspaceRequest('/session');
      setAccount(
        session.user?.email ||
          (session.mode === 'account' ? 'Your private guest workspace' : 'Your local workspace'),
      );
      if (session.mode === 'account' && !session.signedIn) {
        setSignedOut(true);
        return;
      }
      setRequest(await workspaceRequest(`/agent-pairing/${requestId}`));
      setSignedOut(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The connection request could not load.');
    }
  };
  useEffect(() => {
    void load();
  }, [requestId]);
  const decide = async (approve: boolean) => {
    setBusy(true);
    setError('');
    try {
      const result = await workspaceRequest(`/agent-pairing/${requestId}`, { approve });
      window.location.assign(result.redirect);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not finish connecting.');
      setBusy(false);
    }
  };
  return (
    <section className="ca" aria-label="Approve agent connection">
      <header className="ca-heading">
        <h1>Connect your agent.</h1>
      </header>
      <section className="ca-card">
        {signedOut ? (
          <>
            <h2>Choose your Renovagent workspace.</h2>
            <p>
              Sign in to connect your existing projects. Continue as guest starts a separate private
              workspace.
            </p>
            <SignInChoices onSignedIn={load} />
          </>
        ) : request ? (
          <>
            <h2>Allow {request.name} to access your workspace?</h2>
            <p>{account}</p>
            <p>
              {request.access === 'propose'
                ? 'This agent can read your projects and save proposed plans, drafts and inspiration.'
                : 'This agent can read your projects. It cannot save changes.'}
            </p>
            <p>
              You keep control of approvals and purchases. Access expires in seven days. Remove it
              at any time on the connection page.
            </p>
            <p>
              Return address supplied by this agent:{' '}
              <code style={{ overflowWrap: 'anywhere' }}>{request.callback}</code>
            </p>
            <p className="ca-note">
              Approve only if you started this connection in your agent. The agent name is supplied
              by that app.
            </p>
            <div className="ca-row">
              <button className="ca-primary" disabled={busy} onClick={() => void decide(true)}>
                {busy ? 'Returning to your agent…' : 'Approve connection'}
              </button>
              <button className="ca-link" disabled={busy} onClick={() => void decide(false)}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          !error && <p role="status">Loading connection request…</p>
        )}
        {error && (
          <>
            <p role="alert" className="ca-error">
              {error}
            </p>
            <button onClick={() => void load()}>Retry</button>
          </>
        )}
        <p>
          <a href="#connect">Manage agent connections</a>
        </p>
      </section>
    </section>
  );
}
