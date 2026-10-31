import { useEffect, useState } from 'react';
import { workspaceRequest } from '../../adapters/http/project-repository.js';

// SAM 3.1 outlines one named part of an owner photo ("floor", "walls"). The
// tint is drawn in the browser over the outline: an instant colour sketch,
// not a render. "Render with Muse Image" asks the server for a generated
// preview of the same change. Neither is saved to the project.

export type Outline = {
  phrase: string;
  width: number;
  height: number;
  model: string;
  segments: {
    id: string;
    confidence?: number;
    box: { left: number; top: number; right: number; bottom: number };
    path: string;
    scaleX: number;
    scaleY: number;
    imageShare: number;
  }[];
};
type Render = { url: string; model: string; finish: string };

const PHRASES = [
  'floor',
  'walls',
  'vanity',
  'toilet',
  'bathtub',
  'cabinets',
  'countertop',
  'window',
];
const share = (outline: Outline) =>
  Math.round(outline.segments.reduce((sum, s) => sum + s.imageShare, 0) * 100);

export function usePhotoOutline(blobId: string | undefined) {
  const [outline, setOutline] = useState<Outline | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [tint, setTint] = useState<{ color: string; name: string } | null>(null);
  const [render, setRender] = useState<Render | null>(null);
  const [rendering, setRendering] = useState(false);
  const [showRender, setShowRender] = useState(true);
  useEffect(() => {
    setOutline(null);
    setTint(null);
    setRender(null);
    setMessage('');
  }, [blobId]);
  useEffect(() => () => void (render && URL.revokeObjectURL(render.url)), [render]);
  const failed = (e: unknown) => {
    const text = e instanceof Error ? e.message : String(e);
    setMessage(
      /unavailable|Failed to fetch/i.test(text)
        ? 'Outlines need the Renovagent server (npm run dev:connected).'
        : text.slice(0, 200),
    );
  };
  const outlineOf = async (phrase: string) => {
    if (!blobId) return;
    setWorking(phrase);
    setMessage('');
    setRender(null);
    try {
      const result = (await workspaceRequest('/photos/segment', { blobId, phrase })) as Outline;
      setOutline(result);
      if (!result.segments.length) setMessage(`SAM found no ${phrase} in this photo.`);
    } catch (e) {
      failed(e);
    } finally {
      setWorking(null);
    }
  };
  const renderFinish = async () => {
    if (!blobId || !outline || !tint) return;
    setRendering(true);
    setMessage('');
    try {
      const finish = tint.name === tint.color ? tint.color : `${tint.name} (${tint.color})`;
      const result = (await workspaceRequest('/photos/repaint', {
        blobId,
        phrase: outline.phrase,
        finish,
      })) as { image: string; mediaType: string; model: string };
      const bytes = Uint8Array.from(atob(result.image), (c) => c.charCodeAt(0));
      setShowRender(true);
      setRender({
        url: URL.createObjectURL(new Blob([bytes], { type: result.mediaType })),
        model: result.model,
        finish,
      });
    } catch (e) {
      failed(e);
    } finally {
      setRendering(false);
    }
  };
  return {
    outline,
    working,
    message,
    tint,
    setTint,
    render,
    rendering,
    outlineOf,
    renderFinish,
    clearRender: () => setRender(null),
    showRender,
    setShowRender,
  };
}

// The image the photo figure shows: the Muse Image preview when one is open.
export const shownPreview = (state: ReturnType<typeof usePhotoOutline>) =>
  state.render && state.showRender ? state.render : null;

export function OutlineOverlay({
  outline,
  tint,
}: {
  outline: Outline;
  tint: { color: string } | null;
}) {
  return (
    <svg
      className={`photo-outline${tint ? ' is-tinted' : ''}`}
      viewBox={`0 0 ${outline.width} ${outline.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {outline.segments.map((s) => (
        <path
          key={s.id}
          d={s.path}
          fillRule="evenodd"
          transform={`translate(${s.box.left} ${s.box.top}) scale(${s.scaleX} ${s.scaleY})`}
          style={tint ? { fill: tint.color } : undefined}
        />
      ))}
    </svg>
  );
}

export function OutlineControls({
  state,
  swatches = [],
}: {
  state: ReturnType<typeof usePhotoOutline>;
  swatches?: { name: string; color: string; brand?: string }[];
}) {
  const [custom, setCustom] = useState('');
  const { outline, working, message, tint, render, rendering } = state;
  return (
    <div className="outline-controls">
      <p className="small-note">
        <b>Outline with SAM 3.1</b> · tap a part of the room
      </p>
      <div className="outline-chips" role="group" aria-label="Outline a part of this photo">
        {PHRASES.map((phrase) => (
          <button
            key={phrase}
            type="button"
            aria-pressed={outline?.phrase === phrase}
            disabled={working !== null}
            onClick={() => void state.outlineOf(phrase)}
          >
            {working === phrase ? '…' : phrase}
          </button>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (custom.trim()) void state.outlineOf(custom.trim());
          }}
        >
          <input
            value={custom}
            maxLength={60}
            placeholder="something else"
            aria-label="Outline something else"
            onChange={(e) => setCustom(e.target.value)}
          />
        </form>
      </div>
      {message && (
        <p role="status" className="small-note">
          {message}
        </p>
      )}
      {outline && outline.segments.length > 0 && (
        <>
          <p className="small-note">
            {outline.phrase}: {outline.segments.length} region
            {outline.segments.length > 1 ? 's' : ''}, about {share(outline)}% of the photo (
            {outline.model}). A share of the picture, not a measured area.
          </p>
          <div className="outline-tints" role="group" aria-label="Try a colour">
            {swatches.map((s) => (
              <button
                key={s.name}
                type="button"
                title={s.brand ? `${s.brand} · ${s.name}` : s.name}
                aria-pressed={tint?.name === s.name}
                style={{ background: s.color }}
                onClick={() => state.setTint({ color: s.color, name: s.name })}
              >
                <span className="sr-only">{s.name}</span>
              </button>
            ))}
            <label className="outline-custom-color">
              <input
                type="color"
                value={tint?.color ?? '#9caf88'}
                onChange={(e) => state.setTint({ color: e.target.value, name: e.target.value })}
              />
              Pick
            </label>
            {tint && (
              <button type="button" className="link-button" onClick={() => state.setTint(null)}>
                Clear
              </button>
            )}
          </div>
          {tint && (
            <p className="small-note">
              {tint.name} sketched over the outline.{' '}
              <button
                type="button"
                className="room3d-muse"
                disabled={rendering}
                onClick={() => void state.renderFinish()}
              >
                {rendering ? 'Muse Image is rendering…' : '✦ Render with Muse Image'}
              </button>
            </p>
          )}
        </>
      )}
      {render && (
        <div className="outline-render">
          <div className="outline-render-switch" role="group" aria-label="Photo or preview">
            <button
              type="button"
              aria-pressed={!state.showRender}
              onClick={() => state.setShowRender(false)}
            >
              Your photo
            </button>
            <button
              type="button"
              aria-pressed={state.showRender}
              onClick={() => state.setShowRender(true)}
            >
              Muse Image preview
            </button>
          </div>
          <p className="small-note">
            Generated preview ({render.model}): {outline?.phrase} in {render.finish}. Not a photo of
            finished work; not saved.{' '}
            <button type="button" className="link-button" onClick={state.clearRender}>
              Close
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
