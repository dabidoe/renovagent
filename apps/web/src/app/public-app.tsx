import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { BrandMark } from '../components/brand-mark.js';
import { AccountAccess } from '../features/connect/account-access.js';
import { Landing } from '../features/landing/landing.js';
import type { OwnStart } from '../features/house-example/own-studio.js';
import { landingAnchors, publicRoute } from './public-routes.js';

const Studio = lazy(() => import('./public-studio.js'));
const Workspace = lazy(() => import('./workspace-entry.js'));

class RouteBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="storage-error">
        <h1>This page could not load.</h1>
        <button onClick={() => window.location.reload()}>Retry</button>
        <a href="#">Return home</a>
      </main>
    ) : (
      this.props.children
    );
  }
}

export function PublicApp() {
  const [hash, setHash] = useState(() => window.location.hash);
  const [prompt, setPrompt] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [start, setStart] = useState<OwnStart | null>(null);
  const [authError, setAuthError] = useState(
    () => new URLSearchParams(window.location.search).get('auth') === 'error',
  );
  const route = publicRoute(hash);
  const landing = route === 'landing';
  useEffect(() => {
    if (authError) {
      const url = new URL(window.location.href);
      url.searchParams.delete('auth');
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, [authError]);
  useEffect(() => {
    const sync = () => {
      setHash(window.location.hash);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  useEffect(() => {
    if (hash !== '#your-project') setStart(null);
    if (landing && landingAnchors.has(hash)) {
      const frame = requestAnimationFrame(() =>
        document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [hash, landing]);
  useEffect(() => {
    // Keep the older brief handoff, without opening any saved workspace first.
    if (
      window.location.hash.startsWith('#connect/approve/') ||
      window.location.hash.startsWith('#share/')
    )
      return;
    try {
      const brief = sessionStorage.getItem('renovagent.project-brief');
      if (brief) {
        sessionStorage.removeItem('renovagent.project-brief');
        setStart({ idea: brief.slice(0, 300), photos: [] });
        window.location.hash = '#your-project';
      }
    } catch {
      // The public site also works without session storage.
    }
  }, []);
  const open = (to: string) => {
    window.location.hash = to;
    window.scrollTo({ top: 0 });
  };
  const own = (idea?: string) => {
    const brief = idea ?? prompt.trim();
    // An empty ‘try your own’ action resumes recovery instead of replacing it.
    setStart(brief || photos.length ? { idea: brief, photos } : null);
    open('#your-project');
  };
  const errorBanner = authError && (
    <div className="error-banner" role="alert">
      <span>Google sign-in failed. Check the server configuration and try again.</span>
      <button onClick={() => setAuthError(false)}>Dismiss</button>
    </div>
  );
  // Only this explicit route opens the repository or downloads the notes workspace.
  if (route === 'workspace')
    return (
      <>
        {errorBanner}
        <RouteBoundary key="workspace">
          <Suspense fallback={<PageLoading workspace />}>
            <Workspace />
          </Suspense>
        </RouteBoundary>
      </>
    );
  return (
    <div
      className={`prompt-workspace ${landing ? 'is-landing' : 'is-example-project is-house-example'}`}
    >
      <header className="prompt-header">
        <button className="prompt-brand" aria-label="Renovagent home" onClick={() => open('')}>
          <BrandMark size={174} lockup compact={landing} tone={landing ? 'light' : 'dark'} />
        </button>
        <AccountAccess />
        <nav className="public-navigation" aria-label="Main navigation">
          <a href="#examples" aria-current={hash === '#examples' ? 'page' : undefined}>
            Examples
          </a>
          <a href="#your-project" aria-current={hash === '#your-project' ? 'page' : undefined}>
            Your project
          </a>
          <a href="#projects" aria-current={hash === '#projects' ? 'page' : undefined}>
            My projects
          </a>
          <a href="#connect" aria-current={hash === '#connect' ? 'page' : undefined}>
            Connect agent
          </a>
        </nav>
      </header>
      {errorBanner}
      {landing ? (
        <main className="prompt-main landing-main">
          <Landing
            prompt={prompt}
            onPrompt={setPrompt}
            photos={photos}
            onPhotos={setPhotos}
            onOwnProject={own}
            onExamples={() => open('#examples')}
            onDirection={(id) => open(`#example/${id}`)}
            busy={false}
          />
        </main>
      ) : (
        <main className="prompt-main has-room">
          <RouteBoundary key={hash}>
            <Suspense fallback={<PageLoading />}>
              <Studio hash={hash} start={start} onOpen={open} />
            </Suspense>
          </RouteBoundary>
        </main>
      )}
    </div>
  );
}

function PageLoading({ workspace = false }: { workspace?: boolean }) {
  return (
    <div className="loading-workspace" role="status">
      <p>{workspace ? 'Opening your saved workspace…' : 'Opening the studio…'}</p>
      <a href="#">Return home</a>
    </div>
  );
}
