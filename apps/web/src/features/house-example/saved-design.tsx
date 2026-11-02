import { useEffect, useState } from 'react';
import { workspaceRequest } from '../../adapters/http/project-repository.js';
import { OwnStudio } from './own-studio.js';
import type { SavedStudioDesign } from './paint-floor-studio.js';

export function SavedDesign({ projectId, revision }: { projectId: string; revision: number }) {
  const [design, setDesign] = useState<SavedStudioDesign | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setDesign(null);
    setError('');
    void workspaceRequest('/session')
      .then(
        () =>
          workspaceRequest(
            `/studio-designs/${encodeURIComponent(projectId)}/${revision}`,
          ) as Promise<SavedStudioDesign>,
      )
      .then((result) => {
        if (live) setDesign(result);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : 'Could not open this design');
      });
    return () => {
      live = false;
    };
  }, [projectId, revision]);
  if (error)
    return (
      <section className="ca">
        <h1>This design could not be opened.</h1>
        <p>{error}</p>
        <p>Use the account or guest browser that saved it. This is a private project link.</p>
        <a href="#connect">Connect your account</a>
      </section>
    );
  if (!design) return <p role="status">Opening saved room design…</p>;
  return <OwnStudio key={`${projectId}:${revision}`} initialDesign={design} />;
}
