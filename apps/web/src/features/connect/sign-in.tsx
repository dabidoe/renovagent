import { useEffect, useState } from 'react';
import { signInUrlFor, workspaceRequest } from '../../adapters/http/project-repository.js';

import { rememberReturn } from './sign-in-return.js';
export { rememberReturn, takeReturn } from './sign-in-return.js';

// The ways in: each configured provider, and (where the server allows it) a
// one-click guest account with its own private workspace. Sign-in returns to
// the page that asked for it.
export function SignInChoices({
  providers,
  className = 'link-button',
  onSignedIn,
}: {
  providers?: string[];
  className?: string;
  onSignedIn?: () => void | Promise<void>;
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
      if (onSignedIn) {
        await onSignedIn();
        setBusy(false);
      } else window.location.reload();
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
