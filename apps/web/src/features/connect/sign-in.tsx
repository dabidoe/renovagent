import { useEffect, useState } from 'react';
import { flushOwnIntakeSave } from '../house-example/own-intake-draft.js';
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
      .catch(() => setError('Sign-in is unavailable right now. Please try again.'));
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
      window.dispatchEvent(new Event('renovagent-session'));
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
      {shown.map((provider) => (
        <a
          key={provider}
          className={className}
          href={signInUrlFor(provider)}
          onClick={(event) => {
            event.preventDefault();
            const href = event.currentTarget.href;
            setBusy(true);
            void flushOwnIntakeSave()
              .then(() => {
                rememberReturn();
                window.location.assign(href);
              })
              .catch(() => {
                setBusy(false);
                setError('Your draft could not be saved. Keep this tab open and try again.');
              });
          }}
        >
          Continue with {provider === 'meta' ? 'Meta' : 'Google'}
        </a>
      ))}
      {session?.guests && (
        <button type="button" className={className} disabled={busy} onClick={() => void guest()}>
          {busy ? 'Starting…' : 'Continue as guest'}
        </button>
      )}
      {!session && !error && <span role="status">Loading sign-in options…</span>}
      {error && <span role="alert">{error}</span>}
    </>
  );
}
