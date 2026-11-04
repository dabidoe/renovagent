import { NotebookCards } from './project-notebook.js';
import { useEffect, useRef, useState } from 'react';
import type { StudioDesign, ProjectNotebookRecord } from '@renovagent/contracts';
import { studioItemBudget } from '@renovagent/core';
import { workspaceRequest } from '../../adapters/http/project-repository.js';
import { DEFAULT_PICK, floorImage, styleOf, roomTakeoff, money } from './paint-floor.js';
import './shared-design.css';

type Shared = {
  snapshot?: StudioDesign;
  notebook?: ProjectNotebookRecord[];
  name?: string;
  brief?: string;
  revision: number;
  createdAt: string;
};
export function SharedDesign({ token }: { token: string }) {
  const [shared, setShared] = useState<Shared | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  useEffect(() => {
    let live = true;
    void workspaceRequest(`/shared-designs/${token}`).then(
      (result) => live && setShared(result),
      (e) => live && setError(e.message || 'Could not open the shared project.'),
    );
    return () => {
      live = false;
    };
  }, [token]);
  const copy = async () => {
    setBusy(true);
    setError('');
    try {
      const session = await workspaceRequest('/session');
      if (session.mode === 'account' && !session.signedIn) {
        await workspaceRequest('/auth/guest', {});
        window.dispatchEvent(new Event('renovagent-session'));
      }
      const saved = await workspaceRequest(`/shared-designs/${token}/copy`, {
        requestId: requestId.current,
      });
      window.location.hash =
        saved.view === 'notebook'
          ? `#project/${encodeURIComponent(saved.projectId)}/notebook`
          : `#design/${encodeURIComponent(saved.projectId)}/${saved.revision}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your copy.');
      setBusy(false);
    }
  };
  if (!shared)
    return (
      <section className="shared-design">
        <p role={error ? 'alert' : 'status'}>{error || 'Opening shared project…'}</p>
      </section>
    );
  const { snapshot, revision } = shared;
  return (
    <section className="shared-design" aria-label="Shared project">
      <header>
        <p>Shared project · saved revision {revision}</p>
        <h1>{shared.name ?? snapshot?.project.address ?? 'Shared project'}</h1>
        <p>
          This saved version is viewable by anyone with the link. Your edits go into your own copy.
        </p>
        <button className="pf-build" type="button" disabled={busy} onClick={() => void copy()}>
          {busy ? 'Saving your copy…' : 'Save a copy & edit'}
        </button>
        <small>No sign-in needed. Limited guests can save projects and share links.</small>
        {error && <p role="alert">{error}</p>}
      </header>
      {!snapshot && shared.brief && (
        <article className="shared-room">
          <h2>Project brief</h2>
          <p className="notebook-text">{shared.brief}</p>
        </article>
      )}
      {!!shared.notebook?.length && (
        <section aria-label="Shared project notebook">
          <h2>Project notebook</h2>
          <NotebookCards
            entries={shared.notebook}
            imageUrl={(sha) => `/api/workspace/shared-designs/${token}/images/${sha}`}
          />
        </section>
      )}
      {snapshot?.project.rooms.map((room) => {
        const pick = snapshot.picks[room.id] ?? DEFAULT_PICK;
        const style = styleOf(pick);
        const model = snapshot.modelRenders?.[room.id]?.image;
        const generated = snapshot.inspired[room.id] || model;
        const floor = style ? floorImage(room, style)?.src : null;
        const image = generated || floor || room.photo.src;
        const finishes = roomTakeoff(
          room,
          snapshot.project.ceilingFt,
          pick,
          snapshot.tier,
        ).totalMinor;
        const items = snapshot.items?.[room.id] ?? [];
        const budget = studioItemBudget(items);
        return (
          <article key={room.id} className="shared-room">
            <h2>{room.title}</h2>
            {image && (
              <figure>
                <img src={image} alt={`${room.title} shared design`} referrerPolicy="no-referrer" />
                <figcaption>
                  {generated || floor
                    ? 'Generated concept · check dimensions and fit'
                    : 'Source photo'}
                </figcaption>
              </figure>
            )}
            {image !== room.photo.src && room.photo.src && (
              <details>
                <summary>Original photo</summary>
                <img
                  src={room.photo.src}
                  alt={`${room.title} original`}
                  referrerPolicy="no-referrer"
                />
              </details>
            )}
            <p>
              {room.size
                ? `${room.size.xFt} × ${room.size.yFt} ft${room.sizeNote ? ' · estimated' : ' · entered dimensions'}`
                : 'Room dimensions unknown'}
            </p>
            <p>
              {pick.color ? `Walls: ${pick.color.name}. ` : 'Keep existing walls. '}
              {pick.floor === 'keep'
                ? 'Keep existing floor.'
                : `Floor: ${pick.floorStyle || pick.floor}.`}
            </p>
            <p>
              <strong>{money(finishes + budget.allowanceMinor)}</strong> · demo materials and
              entered allowances
            </p>
            {!room.size && (pick.color || pick.floor !== 'keep') && (
              <p>Finish estimate needs room dimensions.</p>
            )}
            <small>
              Example prices for this demo, not live offers. Labour, tax and delivery are separate.{' '}
              {budget.unpriced ? `${budget.unpriced} items not priced.` : ''}
            </small>
            {!!items.length && (
              <ul>
                {items.map((item) => (
                  <li key={item.id}>
                    {item.name} · {item.action} · quantity {item.quantity ?? 'unknown'}
                  </li>
                ))}
              </ul>
            )}
          </article>
        );
      })}
    </section>
  );
}
