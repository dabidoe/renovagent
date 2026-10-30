import { useEffect, useState } from 'react';
import type { Artifact, DesignOptions } from '@renovagent/contracts';
import { workspaceRequest } from '../../adapters/http/project-repository.js';
import type { WorkspaceController } from '../../app/workspace-controller.js';

type Summary = {
  ref: { revision: number };
  sourcePhoto: { label: string; path: string };
  selectedOptionId: string | null;
  options: {
    id: string;
    title: string;
    summary: string;
    retained: string[];
    direction: { wallColor: string; floorFinish: string };
    preview: { status: string; path?: string; label?: string; error?: string };
    materials: { range: string; tiers: { tier: string; subtotal: string }[]; basis: string } | null;
    coverage: string;
    biggestUnknown: string | null;
  }[];
  limits: string[];
};

// Same-room options: the original photo, a labeled generated concept per
// option, and each option's own materials range and coverage. Prices come
// from the server's catalog at view time; nothing here is purchasable.
export function DesignOptionsView({
  artifact,
  controller,
}: {
  artifact: Artifact & { payload: DesignOptions };
  controller?: WorkspaceController;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [colors, setColors] = useState<Record<string, string>>({});
  const projectId = artifact.projectId;
  const pending = artifact.payload.options.some((o) => o.preview.status === 'pending');

  useEffect(() => {
    let live = true;
    workspaceRequest(`/design/summary?projectId=${encodeURIComponent(projectId)}`)
      .then((value) => live && setSummary(value as Summary))
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [projectId, artifact.revision]);

  // Previews arrive from the server worker; refresh until none are pending.
  useEffect(() => {
    if (!pending || !controller) return;
    const timer = setInterval(() => void controller.refresh().catch(() => {}), 5000);
    return () => clearInterval(timer);
  }, [pending, controller]);

  const revise = async (optionId: string, body: Record<string, unknown>) => {
    setBusy(optionId);
    setError('');
    try {
      await workspaceRequest('/design/revise', {
        requestId: `web-${optionId}-${Date.now()}`,
        projectId,
        optionId,
        ...body,
      });
      await controller?.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };

  if (!summary)
    return <p className="small-note">{error || 'Loading options and current prices…'}</p>;
  return (
    <div>
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={() => setError('')}>Dismiss</button>
        </div>
      )}
      <p className="work-lede">“{artifact.payload.request}”</p>
      <figure className="design-original">
        <img src={summary.sourcePhoto.path} alt={summary.sourcePhoto.label} />
        <figcaption className="small-note">Original photo · {summary.sourcePhoto.label}</figcaption>
      </figure>
      <div className="option-grid">
        {summary.options.map((option, index) => (
          <section className="option-card" key={option.id} aria-label={option.title}>
            <div className="option-card-label">
              <span>OPTION {String(index + 1).padStart(2, '0')}</span>
              <span>{summary.selectedOptionId === option.id ? 'Your preference' : 'Concept'}</span>
            </div>
            {option.preview.status === 'generated' && option.preview.path ? (
              <figure>
                <img src={option.preview.path} alt={`${option.title}, generated concept`} />
                <figcaption className="small-note">{option.preview.label}</figcaption>
              </figure>
            ) : (
              <p className="small-note">
                {option.preview.status === 'failed'
                  ? `Preview failed: ${option.preview.error ?? 'unknown error'}`
                  : 'Generating a concept preview…'}
              </p>
            )}
            <div className="option-copy">
              <h3>{option.title}</h3>
              <p>{option.summary}</p>
              <p className="small-note">
                Walls: {option.direction.wallColor} · Floor: {option.direction.floorFinish}
              </p>
              <div className="tradeoff">
                <span>MATERIALS</span>
                <p>
                  {option.materials ? option.materials.range : 'Not priced yet'}
                  {option.materials && (
                    <span className="small-note">
                      {' '}
                      · {option.materials.tiers.map((t) => `${t.tier} ${t.subtotal}`).join(' · ')}
                    </span>
                  )}
                </p>
                <p className="small-note">
                  {option.coverage}
                  {option.materials && ` Prices: ${option.materials.basis}.`}
                </p>
              </div>
              {option.biggestUnknown && (
                <p className="small-note">Biggest unknown: {option.biggestUnknown}</p>
              )}
              <p className="small-note">Keeps: {option.retained.join('; ')}</p>
              <div>
                <button
                  className="secondary"
                  disabled={!!busy || summary.selectedOptionId === option.id}
                  onClick={() => void revise(option.id, { select: true })}
                >
                  {summary.selectedOptionId === option.id ? 'Preferred' : 'I like this one'}
                </button>{' '}
                {option.preview.status === 'failed' && (
                  <button
                    className="link-button"
                    disabled={!!busy}
                    onClick={() => void revise(option.id, { retryPreview: true })}
                  >
                    Retry preview
                  </button>
                )}
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const wallColor = colors[option.id]?.trim();
                  if (wallColor) void revise(option.id, { direction: { wallColor } });
                }}
              >
                <input
                  aria-label={`Wall color for ${option.title}`}
                  placeholder="Try a wall color, e.g. soft blue"
                  value={colors[option.id] ?? ''}
                  onChange={(event) => setColors({ ...colors, [option.id]: event.target.value })}
                />{' '}
                <button className="link-button" disabled={!!busy} type="submit">
                  {busy === option.id ? 'Saving…' : 'Update'}
                </button>
              </form>
            </div>
          </section>
        ))}
      </div>
      {summary.limits.map((limit) => (
        <p key={limit} className="small-note">
          {limit}
        </p>
      ))}
    </div>
  );
}
