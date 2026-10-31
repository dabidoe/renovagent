import type { Workspace } from '@renovagent/contracts';
import type { WorkspaceController } from '../../app/workspace-controller.js';
import { StoredPhoto } from '../room3d/room-welcome.js';
import { Glyph } from '../../components/glyph.js';
export function ReferenceBoard({
  state,
  projectId,
  controller,
  onAdd,
}: {
  state: Workspace;
  projectId: string;
  controller: WorkspaceController;
  onAdd: () => void;
}) {
  const items = Object.values(state.evidence).filter(
    (e) => e.projectId === projectId && e.source.reference && e.source.reference.kind !== 'room',
  );
  return (
    <section className="reference-board" aria-label="Inspiration and products">
      <header>
        <div>
          <h3>Inspiration & products</h3>
          {!items.length && <p>Save the look. Keep the links.</p>}
        </div>
        <button type="button" onClick={onAdd}>
          <Glyph name="plus" />
          Add a reference
        </button>
      </header>
      {items.length > 0 && (
        <div className="reference-board-grid">
          {items.map((item) => {
            const ref = item.source.reference!,
              attachment = item.source.attachment;
            const host = ref.url ? new URL(ref.url).hostname.replace(/^www\./, '') : null;
            return (
              <article key={item.id}>
                {attachment ? (
                  <div className="reference-card-photo">
                    <StoredPhoto
                      controller={controller}
                      blobId={attachment.blobId}
                      name={ref.title || attachment.name}
                    />
                  </div>
                ) : (
                  <div className="reference-card-link">
                    <Glyph name={ref.kind === 'product' ? 'materials' : 'photo'} />
                    {host}
                  </div>
                )}
                <div className="reference-card-copy">
                  <span>{ref.kind === 'product' ? 'Product' : 'Inspiration'}</span>
                  <h4>{ref.title || host || attachment?.name || 'Reference'}</h4>
                  {ref.note && <p>{ref.note}</p>}
                  {ref.price && (
                    <p className="reference-card-price">
                      Saved{' '}
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: ref.price.currency,
                      }).format(ref.price.minorUnits / 100)}
                      <small>
                        {new Date(item.recordedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </small>
                    </p>
                  )}
                  {ref.url && (
                    <a href={ref.url} target="_blank" rel="noopener noreferrer">
                      Open source <Glyph name="right" />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
