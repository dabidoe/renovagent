import { useEffect, useState } from 'react';
import { signInUrlFor, workspaceRequest } from '../../adapters/http/project-repository.js';

const RETURN = 'renovagent.return-to';

// Sign-in leaves the page, and the address fragment never reaches the server,
// so the plan link is kept for the return.
export function rememberReturn() {
  try {
    if (window.location.hash) sessionStorage.setItem(RETURN, window.location.hash);
  } catch {
    // Without storage the owner opens the link again after signing in.
  }
}
export function takeReturn() {
  try {
    const to = sessionStorage.getItem(RETURN);
    sessionStorage.removeItem(RETURN);
    return to && /^#[a-z0-9/_-]+$/i.test(to) ? to : null;
  } catch {
    return null;
  }
}

// The ways in: each configured provider, and (where the server allows it) a
// one-click guest account with its own private workspace. Sign-in returns to
// the page that asked for it.
export function SignInChoices({
  providers,
  className = 'link-button',
}: {
  providers?: string[];
  className?: string;
}) {
  const [session, setSession] = useState<{ providers: string[]; guests: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    (workspaceRequest('/session') as Promise<{ providers?: string[]; guests?: boolean }>)
      .then((s) => live && setSession({ providers: s.providers ?? [], guests: Boolean(s.guests) }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const shown = providers?.length ? providers : session?.providers.length ? session.providers : [];
  const guest = async () => {
    setBusy(true);
    setError('');
    try {
      await workspaceRequest('/auth/guest', {});
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Guest sign-in failed');
      setBusy(false);
    }
  };
  return (
    <>
      {session?.guests && (
        <button type="button" className={className} disabled={busy} onClick={() => void guest()}>
          {busy ? 'Starting…' : 'Continue as guest'}
        </button>
      )}
      {shown.map((provider) => (
        <a
          key={provider}
          className={className}
          href={signInUrlFor(provider)}
          onClick={rememberReturn}
        >
          Sign in with {provider === 'meta' ? 'Meta' : 'Google'}
        </a>
      ))}
      {error && <span role="alert">{error}</span>}
    </>
  );
}
