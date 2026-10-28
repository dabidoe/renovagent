import { useRef, useState, type FormEvent } from 'react';
import { type Artifact, type Workspace, type Command } from '@unpermitted/contracts';
import {
  homeInventory,
  inventoryDirections,
  referenceCurrent,
  researchForArtifact,
} from '@unpermitted/core';
import { type WorkspaceController } from '../../app/workspace-controller.js';
import { PropertyIntake } from '../intake/property-intake.js';
import './inventory-workbench.css';
type Props = {
  state: Workspace;
  projectId: string;
  controller: WorkspaceController;
  busy: boolean;
  onArtifact: (a: Artifact) => void;
};
const actionNames = {
  retain: 'Keep',
  replace: 'Replace',
  investigate: 'Investigate',
  exclude: 'Not this item',
};
export function InventoryWorkbench(props: Props) {
  const { state, projectId, controller, onArtifact } = props;
  const inventory = homeInventory(state, projectId)!;
  const data = inventory.payload;
  const research = researchForArtifact(state, inventory);
  const goal = Object.values(state.facts)
    .map((v) => v.at(-1))
    .find((f) => f?.projectId === projectId && f.key === 'goal');
  const goalText = goal?.value.kind === 'text' ? goal.value.text : '';
  const firstSentence = goalText.split('. ')[0];
  const goalHeadline =
    firstSentence.length >= 20 && firstSentence.length <= 110
      ? firstSentence.replace(/\.$/, '')
      : '';
  const reportedContext =
    goalHeadline && goalText.startsWith(goalHeadline + '. ')
      ? goalText.slice(goalHeadline.length + 2)
      : goalText;
  const focusPhotos =
    research?.photoReview?.planning?.nextSteps.find((step) => step.kind === 'site-measurement')
      ?.photoIds ||
    research?.photoReview?.planning?.questions[0]?.photoIds ||
    [];
  const initialPhoto =
    data.kind === 'photo-inventory'
      ? focusPhotos.map((id) => data.photos.find((p) => p.id === id)).find(Boolean)?.id ||
        data.photos[0].id
      : '';
  const [photoId, setPhotoId] = useState(initialPhoto);
  const [selected, setSelected] = useState(
    data.kind === 'photo-inventory'
      ? (data.items.find((i) => i.category === 'countertop') || data.items[0]).id
      : '',
  );
  const [loaded, setLoaded] = useState(false),
    [failed, setFailed] = useState(false),
    [showRegions, setShowRegions] = useState(true),
    [showResearch, setShowResearch] = useState(false);
  const [error, setError] = useState('');
  const importer = useRef<HTMLInputElement>(null);
  if (data.kind !== 'photo-inventory') return null;
  const current = referenceCurrent(state, projectId, {
    kind: 'artifact',
    id: inventory.id,
    revision: inventory.revision,
  });
  const photo = research?.photoReview?.photos.find((p) => p.id === photoId),
    dimensions = data.photos.find((p) => p.id === photoId)!;
  const items = data.items.filter((i) => i.photoId === photoId);
  const item = items.find((i) => i.id === selected) || items[0];
  const directions = inventoryDirections(state, projectId, inventory);
  const activeDirections = current
    ? directions.filter((a) =>
        referenceCurrent(state, projectId, { kind: 'artifact', id: a.id, revision: a.revision }),
      )
    : [];
  const saved = activeDirections.find(
    (a) => a.payload.kind === 'inventory-direction' && a.payload.itemId === item?.id,
  );
  const title = (id: string) => {
    const d = activeDirections.find(
      (a) => a.payload.kind === 'inventory-direction' && a.payload.itemId === id,
    )?.payload;
    return d?.kind === 'inventory-direction' && d.correctedLabel
      ? d.correctedLabel
      : data.items.find((i) => i.id === id)?.label || id;
  };
  return (
    <div className="inventory-workbench">
      <header className="iv-heading">
        <div>
          <p className="hp-kicker">THE HOUSE / BEFORE THE WORK</p>
          <h1>
            {goalHeadline || (
              <>
                Your home,
                <br />
                <em>understood piece by piece.</em>
              </>
            )}
          </h1>
        </div>
        <div>
          <strong>
            {research?.address || state.properties[state.projects[projectId].propertyId].name}
          </strong>
          <span>
            {data.photos.length} annotated views · {research?.photoReview?.photos.length || 0}{' '}
            reviewed photos
          </span>
          <small>Muse visual proposals · current conditions unverified</small>
        </div>
      </header>
      {goalText && (
        <section className="iv-project-context" aria-label="Current project direction">
          <div>
            <span>PROJECT CONTEXT / REPORTED BY YOU</span>
            <p>{reportedContext}</p>
          </div>
          {current &&
            research?.photoReview?.planning?.nextSteps.find(
              (step) => step.kind === 'site-measurement',
            ) && (
              <div>
                <span>NEXT / ESTABLISH THE SPACE</span>
                <p>
                  {
                    research.photoReview.planning.nextSteps.find(
                      (step) => step.kind === 'site-measurement',
                    )!.text
                  }
                </p>
                <small>Unreviewed Muse investigation proposal · no feasibility established</small>
              </div>
            )}
        </section>
      )}
      {!current && (
        <div className="iv-stale" role="alert">
          The source context changed. These are historical observations. Import current research and
          regions before saving new direction.
        </div>
      )}
      <div className="iv-layout">
        <div className="iv-visual">
          <nav className="iv-rooms" aria-label="Annotated rooms">
            {data.photos.map((p, i) => {
              const reviewed = research?.photoReview?.photos.find((photo) => photo.id === p.id);
              return (
                <button
                  key={p.id}
                  aria-pressed={photoId === p.id}
                  onClick={() => {
                    setPhotoId(p.id);
                    setSelected(data.items.find((item) => item.photoId === p.id)!.id);
                    setFailed(false);
                  }}
                >
                  <span>0{i + 1}</span>
                  {reviewed?.roomType || 'Photo'}
                </button>
              );
            })}
          </nav>
          <div
            className="iv-photo"
            style={{ aspectRatio: `${dimensions.width}/${dimensions.height}` }}
          >
            {loaded && photo && !failed ? (
              <>
                <img
                  src={photo.imageUrl}
                  alt={`Original listing view: ${photo.roomType}; model regions are approximate`}
                  referrerPolicy="no-referrer"
                  onError={() => setFailed(true)}
                />
                {showRegions && (
                  <svg
                    className="iv-regions"
                    viewBox="0 0 1000 1000"
                    preserveAspectRatio="none"
                    aria-label="Model-proposed visible element regions"
                  >
                    {items
                      .filter((i) => i.id !== item?.id)
                      .concat(item ? [item] : [])
                      .map((i) => (
                        <polygon
                          key={i.id}
                          points={i.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
                          className={i.id === item?.id ? 'selected' : ''}
                          role="button"
                          tabIndex={0}
                          aria-label={`Highlight ${i.label}`}
                          onClick={() => setSelected(i.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelected(i.id);
                            }
                          }}
                        >
                          <title>{i.label} · approximate Muse region</title>
                        </polygon>
                      ))}
                  </svg>
                )}
                <div className="iv-photo-caption">
                  <span>SELECT AN ELEMENT TO PLAN ITS CHANGE</span>
                  <button aria-pressed={showRegions} onClick={() => setShowRegions(!showRegions)}>
                    {showRegions ? 'Hide highlights' : 'Show highlights'}
                  </button>
                </div>
              </>
            ) : (
              <div className="iv-load">
                <span>ACTUAL LISTING PHOTOGRAPHY</span>
                <h2>
                  See the home.
                  <br />
                  <em>Choose what changes.</em>
                </h2>
                <p>Load the source photo to inspect Muse’s proposed element regions.</p>
                <button
                  className="hp-primary"
                  onClick={() => {
                    setFailed(false);
                    setLoaded(true);
                  }}
                  disabled={!photo}
                >
                  {failed ? 'Retry source image' : 'Load listing photos →'}
                </button>
                <small>
                  External source images · rights unverified. No image is added to exports.
                </small>
              </div>
            )}
          </div>
          <div className="iv-photo-tools">
            <span>
              <i />
              Approximate regions · not a measured drawing
            </span>
            {photo && (
              <a href={photo.pageUrl} target="_blank" rel="noreferrer">
                Listing source ↗
              </a>
            )}
          </div>
          <div className="iv-elements" role="group" aria-label="Visible elements in this photo">
            {items.map((i) => (
              <button key={i.id} aria-pressed={item?.id === i.id} onClick={() => setSelected(i.id)}>
                <span>{i.category}</span>
                <strong>{title(i.id)}</strong>
              </button>
            ))}
          </div>
          <section className="iv-scope">
            <div className="hp-section-label">
              <span>THE EMERGING SCOPE</span>
              <span>Reported preferences · no work released</span>
            </div>
            <h2>
              What stays. What changes.
              <br />
              <em>What needs another look.</em>
            </h2>
            {activeDirections.length ? (
              <ul>
                {activeDirections.map((a) => {
                  const d = a.payload;
                  return d.kind === 'inventory-direction' ? (
                    <li key={a.id}>
                      <span className={`iv-disposition ${d.disposition}`}>
                        {actionNames[d.disposition]}
                      </span>
                      <strong>{title(d.itemId)}</strong>
                      <small>
                        {d.identification === 'confirmed'
                          ? 'Recognized by you'
                          : 'Identification ' + d.identification}
                      </small>
                      <button
                        onClick={() => {
                          const element = data.items.find((i) => i.id === d.itemId)!;
                          setPhotoId(element.photoId);
                          setSelected(element.id);
                        }}
                      >
                        Review ↗
                      </button>
                    </li>
                  ) : null;
                })}
              </ul>
            ) : (
              <p>
                Select a visible element, then record what you want to keep, replace or investigate.
                Nothing is preselected for the owner.
              </p>
            )}
            <p className="iv-fine">
              These are per-photo observations, not a verified count of unique house assets.
              Cross-photo matching and current-condition checks remain open.
            </p>
          </section>
        </div>
        <aside className="iv-inspector" aria-label="Selected element">
          {item && (
            <ElementEditor
              key={`${inventory.revision}:${item.id}:${saved?.revision || 0}`}
              {...props}
              inventory={inventory}
              itemId={item.id}
              saved={saved}
              current={current}
            />
          )}
          <details className="iv-provenance">
            <summary>How this identification was made</summary>
            <p>
              Muse inspected actual source image attachments. Labels and polygons are model
              proposals. A confirmation records what you recognize; it does not verify material,
              dimensions, condition, services or compliance.
            </p>
            <p>
              Model: {data.model}
              <br />
              Analyzed: {new Date(data.analyzedAt).toLocaleDateString()}
              <br />
              Source image hash: {dimensions.sha256.slice(0, 16)}…
            </p>
            {photo && (
              <a href={photo.imageUrl} target="_blank" rel="noreferrer">
                Open original image ↗
              </a>
            )}
          </details>
        </aside>
      </div>
      <details className="iv-house-file">
        <summary>House amenities & listing claims · inspect sources</summary>
        <p>
          These are listing claims, separate from Muse’s visible observations. Conflicting bathroom
          descriptions remain unresolved.
        </p>
        {research?.findings.map((f) => (
          <div key={f.label}>
            <strong>{f.label}</strong>
            <p>{f.value}</p>
            <small>{f.limit}</small>
            <a
              href={research.sources.find((s) => s.id === f.sourceId)?.url}
              target="_blank"
              rel="noreferrer"
            >
              Source ↗
            </a>
          </div>
        ))}
      </details>
      <div className="iv-footer-actions">
        <button className="hp-text-button" onClick={() => setShowResearch(!showResearch)}>
          Property research & photos ↗
        </button>
        <button className="hp-text-button" onClick={() => importer.current?.click()}>
          Import a new Muse region review ↗
        </button>
        <button
          className="hp-text-button"
          onClick={() => {
            const brief = state.artifacts[`${projectId}:working-brief`]?.at(-1);
            if (brief) onArtifact(brief);
          }}
        >
          Inspect saved working brief ↗
        </button>
      </div>
      {showResearch && <PropertyIntake {...props} />}
      <input
        ref={importer}
        type="file"
        hidden
        accept="application/json,.json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file)
            void (async () => {
              try {
                if (file.size > 2 * 1024 * 1024) throw Error('Inventory exceeds 2 MB');
                await controller.importPhotoInventory(projectId, JSON.parse(await file.text()));
              } catch (error) {
                setError(error instanceof Error ? error.message : String(error));
              }
            })();
          e.target.value = '';
        }}
      />
      {error && <p role="alert">{error}</p>}
      <footer className="hp-footer">
        Muse analyzed source photos · decisions saved on this device · backend off · no
        measurements, technical approval or construction release inferred
      </footer>
    </div>
  );
}
function ElementEditor({
  projectId,
  controller,
  busy,
  inventory,
  itemId,
  saved,
  current,
}: Props & { inventory: Artifact; itemId: string; saved?: Artifact; current: boolean }) {
  const p = inventory.payload;
  if (p.kind !== 'photo-inventory') return null;
  const item = p.items.find((i) => i.id === itemId)!;
  const initial = saved?.payload.kind === 'inventory-direction' ? saved.payload : undefined;
  type Direction = Extract<Command, { type: 'SetInventoryDirection' }>['payload']['disposition'];
  const [disposition, setDisposition] = useState<Direction | null>(initial?.disposition || null),
    [label, setLabel] = useState(initial?.correctedLabel || item.label),
    [recognized, setRecognized] = useState(initial?.identification === 'confirmed'),
    [note, setNote] = useState(initial?.note || ''),
    [error, setError] = useState('');
  const [baseline] = useState({
    source: { kind: 'artifact' as const, id: inventory.id, revision: inventory.revision },
    revision: saved?.revision || 0,
  });
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!disposition) return;
    try {
      await controller.setInventoryDirection(projectId, {
        inventoryRef: baseline.source,
        itemId,
        expectedDirectionRevision: baseline.revision,
        disposition,
        identification:
          disposition === 'exclude' ? 'rejected' : recognized ? 'confirmed' : 'unconfirmed',
        correctedLabel: label.trim() !== item.label ? label.trim() : null,
        note,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  const next =
    initial?.disposition === 'exclude'
      ? 'Identification rejected. This observation is excluded from the reported work scope. A clearer photo or new model review is needed to identify it again.'
      : initial?.disposition === 'replace'
        ? item.category === 'floor'
          ? 'Measure the finished floor boundary and select a flooring assembly before calculating quantities.'
          : item.category === 'countertop'
            ? 'Measure the countertop runs and verify retained cabinet condition and support before selecting a replacement.'
            : 'Establish dimensions, condition and affected connections before specifying a replacement.'
        : initial?.disposition === 'retain'
          ? 'Inspect condition and compatibility before relying on this retained element in the design.'
          : item.nextAction;
  return (
    <>
      <form className="iv-element-form" onSubmit={save}>
        <p className="hp-kicker">SELECTED / {item.category.toUpperCase()}</p>
        <h2>{initial?.correctedLabel || item.label}</h2>
        <span className="iv-confidence">{item.confidence} model confidence · unreviewed</span>
        <p>{item.observation}</p>
        <div className="iv-unknown">
          <span>STILL UNKNOWN</span>
          <p>{item.unknowns.slice(0, 2).join(' ')}</p>
        </div>
        <label className="iv-recognize">
          <input
            type="checkbox"
            checked={recognized}
            onChange={(e) => setRecognized(e.target.checked)}
            disabled={!current}
          />
          I recognize this element
        </label>
        <div className="iv-actions" role="group" aria-label="Direction for this element">
          {(Object.keys(actionNames) as Direction[]).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={disposition === d}
              onClick={() => setDisposition(d)}
              disabled={!current}
            >
              {actionNames[d]}
            </button>
          ))}
        </div>
        <label>
          What matters to you?
          <textarea
            value={note}
            maxLength={1000}
            placeholder="Your preferences or what you need to find out…"
            onChange={(e) => setNote(e.target.value)}
            disabled={!current}
          />
        </label>
        <details>
          <summary>Correct the identification</summary>
          <label>
            Element label
            <input
              value={label}
              maxLength={100}
              onChange={(e) => setLabel(e.target.value)}
              disabled={!current}
            />
          </label>
          <p>
            Corrections are saved separately. The original Muse label and region remain in history.
            Choose “Not this item” if the observation is wrong.
          </p>
        </details>
        <button className="hp-primary" disabled={busy || !current || !disposition || !label.trim()}>
          Save direction →
        </button>
        {error && <p role="alert">{error} Reopen the current element to retry.</p>}
        {initial && (
          <p className="iv-saved" role="status">
            Saved to the working brief · {actionNames[initial.disposition]}
          </p>
        )}
      </form>
      <section className="iv-next">
        <p className="hp-kicker">NEXT EVIDENCE / THIS ELEMENT</p>
        <p>{next}</p>
        <small>
          {initial
            ? 'Based on your saved direction.'
            : 'Muse proposal; confirm the identification before relying on it.'}{' '}
          Measurements, specifications and qualified review remain open.
        </small>
      </section>
    </>
  );
}
