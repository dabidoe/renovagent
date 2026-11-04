import { useEffect, useState } from 'react';
import { workspaceSchema } from '@renovagent/contracts';
import { workspaceRequest, type SessionInfo } from '../../adapters/http/project-repository.js';
import { SignInChoices } from '../connect/sign-in.js';
import { loadOwnIntake } from './own-intake-draft.js';

type Entry = { id: string; name: string; revision?: number; rooms?: number };
export function ProjectLibrary() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    void loadOwnIntake()
      .then((value) => {
        if (live && value && (value.idea || value.photos.length || value.plans.length))
          setDraft(true);
      })
      .catch(() => {});
    try {
      if (localStorage.getItem('renovagent.own-project.v1')) setDraft(true);
    } catch {
      /* Browser recovery may be unavailable. */
    }
    void workspaceRequest('/session')
      .then(async (s: SessionInfo) => {
        if (!live) return;
        setSession(s);
        if (s.mode === 'account' && !s.signedIn) return;
        const workspace = workspaceSchema.parse(await workspaceRequest(''));
        if (!live) return;
        setEntries(
          Object.values(workspace.projects)
            .map((project) => {
              const artifact = workspace.artifacts[`${project.id}:studio-design`]?.at(-1);
              return {
                id: project.id,
                name: project.name,
                ...(artifact?.payload.kind === 'studio-design'
                  ? { revision: artifact.revision, rooms: artifact.payload.project.rooms.length }
                  : {}),
              };
            })
            .reverse(),
        );
      })
      .catch(
        (e) => live && setError(e instanceof Error ? e.message : 'Could not load your projects.'),
      )
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [attempt]);
  const signedOut = session?.mode === 'account' && !session.signedIn;
  return (
    <section className="project-library" aria-labelledby="project-library-title">
      <header>
        <div>
          <h1 id="project-library-title">My projects</h1>
          <p>Pick up where you left off, or explore a different idea.</p>
        </div>
        <div>
          <a href="#your-project">Continue your studio</a> ·{' '}
          <a href="#notebook">Start project notes</a>
        </div>
      </header>
      {draft && (
        <article className="project-library-draft">
          <h2>Your current studio</h2>
          <p>
            Browser recovery · may include changes waiting to sync. Open this first if you recently
            edited a room.
          </p>
          <a href="#your-project">Resume current studio</a>
        </article>
      )}
      {loading ? (
        <p role="status">Loading saved projects…</p>
      ) : error ? (
        <div role="alert">
          <p>{error} Your saved projects have not been removed.</p>
          <button onClick={() => setAttempt(attempt + 1)}>Try again</button>
          <a href="#workspace/projects">Open project workspace</a>
        </div>
      ) : signedOut ? (
        <div className="project-library-access">
          <h2>Open your saved projects</h2>
          <p>
            Use the Google account you saved with. A new guest workspace won’t contain projects from
            another account.
          </p>
          <SignInChoices
            onSignedIn={async () => {
              setAttempt(attempt + 1);
            }}
          />
        </div>
      ) : (
        <>
          {session?.user?.guest && (
            <p className="project-library-note">
              Limited guest · projects are saved. Use Share project to open a design on another
              device. Keep this browser’s cookies to retain editing access.
            </p>
          )}
          {!entries.length && (
            <p>
              No account projects saved yet. Your own studio saves automatically after upload;
              example designs save when you choose Save project.
            </p>
          )}
          <div className="project-library-grid">
            {entries.map((entry) => (
              <article key={entry.id}>
                <h2>{entry.name}</h2>
                <p>
                  {entry.revision
                    ? `${entry.rooms} room${entry.rooms === 1 ? '' : 's'} · saved revision ${entry.revision}`
                    : 'Project notes and planning'}
                </p>
                <a
                  href={
                    entry.revision
                      ? `#design/${encodeURIComponent(entry.id)}/${entry.revision}`
                      : `#project/${encodeURIComponent(entry.id)}/notebook`
                  }
                >
                  {entry.revision ? 'Open design' : 'Open notebook'}
                </a>
                <a href={`#project/${encodeURIComponent(entry.id)}/notebook`}>
                  Notes, photos &amp; links
                </a>
              </article>
            ))}
          </div>
          <a href="#workspace/projects">All project notes & planning</a>
        </>
      )}
      <footer>
        <a href="#examples">Explore example projects</a>
        <span>Examples stay separate from your saved work.</span>
      </footer>
    </section>
  );
}
