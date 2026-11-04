import { lazy, Suspense, useEffect, useState } from 'react';
import type { SessionInfo } from '../../adapters/http/project-repository.js';
import { Modal } from '../../components/modal.js';
import { rememberReturn } from './sign-in-return.js';
import { GoogleLogo } from './google-logo.js';
const SignInChoices = lazy(() =>
  import('./sign-in.js').then((module) => ({ default: module.SignInChoices })),
);

// Session discovery stays small and never loads the private workspace contracts.
async function sessionRequest(path: string, post = false) {
  const response = await fetch(`/api/workspace${path}`, {
    method: post ? 'POST' : 'GET',
    credentials: 'same-origin',
    headers: { 'X-Renovagent-Client': 'workspace' },
  });
  if (!response.ok) throw new Error('Account service is unavailable. Please try again.');
  return response.json();
}

export function AccountAccess() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const refresh = () =>
    sessionRequest('/session')
      .then(setSession)
      .catch(() => {});
  useEffect(() => {
    void refresh();
    window.addEventListener('renovagent-session', refresh);
    return () => window.removeEventListener('renovagent-session', refresh);
  }, []);
  const guest = session?.user?.guest;
  return (
    <>
      <button className="public-account" onClick={() => setOpen(true)}>
        Account
      </button>
      {open && (
        <Modal
          title={
            session?.signedIn
              ? guest
                ? 'Keep your projects'
                : 'Your account'
              : 'Welcome to Renovagent'
          }
          onClose={() => setOpen(false)}
          className="public-account-dialog"
        >
          {session?.signedIn ? (
            <>
              <p>
                {guest
                  ? 'Your projects are saved on the server. This browser keeps guest access for one year. Share a project link to open it anywhere; Google is optional for account recovery.'
                  : session.user?.email}
              </p>
              <div className="public-account-choices">
                {guest && session.providers?.includes('google') && (
                  <a
                    href="/api/workspace/auth/google"
                    onClick={(event) => {
                      event.preventDefault();
                      void import('../house-example/own-intake-draft.js')
                        .then((module) => module.flushOwnIntakeSave())
                        .then(() => {
                          rememberReturn();
                          window.location.assign('/api/workspace/auth/google');
                        })
                        .catch(() =>
                          setError(
                            'Your draft could not be saved. Keep this tab open and try again.',
                          ),
                        );
                    }}
                  >
                    <GoogleLogo />
                    Keep my projects with Google
                  </a>
                )}
                <button
                  onClick={() =>
                    void sessionRequest('/auth/logout', true)
                      .then(() => window.location.reload())
                      .catch((e) => setError(e.message))
                  }
                >
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <>
              <p>
                Continue as a limited guest to save and share projects. Google is optional for
                account recovery.
              </p>
              <div className="public-account-choices">
                <Suspense fallback={<p role="status">Loading sign-in options…</p>}>
                  <SignInChoices
                    className="public-auth-choice"
                    onSignedIn={async () => {
                      await refresh();
                      setOpen(false);
                    }}
                  />
                </Suspense>
              </div>
            </>
          )}
          <a className="public-account-projects" href="#projects" onClick={() => setOpen(false)}>
            Open my projects
          </a>
          <a className="public-account-projects" href="#projects" onClick={() => setOpen(false)}>
            Project notes
          </a>
          {error && <p role="alert">{error}</p>}
        </Modal>
      )}
    </>
  );
}
