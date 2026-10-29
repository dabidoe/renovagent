import { ConnectedPhotos } from './connected-photos.js';
import { PhotoReviewSummary } from './photo-review-summary.js';
import { useEffect, useRef, useState } from 'react';
import { type Artifact, type Workspace } from '@renovagent/contracts';
import {
  latest,
  propertyAddress,
  researchJobId,
  musePropertyPrompt,
  propertyMarkdown,
  photoReviewJob,
  questionsForReviewedPhoto,
  imageReferenceKind,
} from '@renovagent/core';
import { type WorkspaceController } from '../../app/workspace-controller.js';
import {
  cityResearch,
  findPhiladelphiaRecords,
  type CityCandidate,
} from '../../adapters/research/city-records.js';
import { Media } from '../properties/media.js';
import { Glyph } from '../../components/glyph.js';
export function downloadText(name: string, text: string, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function PropertyIntake({
  state,
  projectId,
  controller,
  busy,
  onArtifact,
}: {
  state: Workspace;
  projectId: string;
  controller: WorkspaceController;
  busy: boolean;
  onArtifact: (a: Artifact) => void;
}) {
  const fact = propertyAddress(state, projectId),
    address = fact?.value.kind === 'text' ? fact.value.text : '';
  const [draft, setDraft] = useState(address),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(''),
    [candidates, setCandidates] = useState<CityCandidate[]>([]),
    [references, setReferences] = useState(false),
    [loadImages, setLoadImages] = useState(false);
  useEffect(() => {
    setDraft(address);
    setLoadImages(false);
    setCandidates([]);
  }, [address]);
  const upload = useRef<HTMLInputElement>(null),
    importer = useRef<HTMLInputElement>(null),
    inventoryImporter = useRef<HTMLInputElement>(null);
  const artifact = latest(state.artifacts[`${projectId}:property-research`]);
  const research =
    artifact?.payload.kind === 'property-research' && artifact.freshness === 'current'
      ? artifact.payload
      : null;
  const canPreview =
    research?.images.some(
      (i) => !i.blockedReason && i.previewUrl && i.previewPermission !== 'unknown',
    ) || false;
  const brief = latest(state.artifacts[`${projectId}:working-brief`]);
  const files = Object.values(state.evidence).filter(
    (e) => e.projectId === projectId && e.source.attachment,
  );
  const goal = Object.values(state.facts)
    .map((v) => v.at(-1)!)
    .find((f) => f.projectId === projectId && f.key === 'goal');
  const goalText = goal?.value.kind === 'text' ? goal.value.text : state.projects[projectId].name;
  const jobId = fact ? researchJobId(projectId, fact.id, fact.revision) : '';
  async function run(label: string, fn: () => Promise<unknown>) {
    setLoading(label);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading('');
    }
  }
  async function addFiles(list: File[]) {
    await run('Saving references', async () => {
      for (const file of list) await controller.attachFile(projectId, file);
    });
  }
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return (
    <section className="property-intake">
      <ConnectedPhotos controller={controller} state={state} projectId={projectId} />
      <div className="intake-progress" aria-label="Project workflow">
        <span className="active">
          01 <b>Your place</b>
        </span>
        <i />
        <span>
          02 <b>The plan</b>
        </span>
        <i />
        <span>
          03 <b>The work</b>
        </span>
      </div>
      <div className="intake-heading">
        <p className="eyebrow">A GOOD PLAN STARTS WITH YOUR PLACE</p>
        <h1>
          Let’s put your home
          <br />
          <em>in the picture.</em>
        </h1>
        <p>
          We’ll gather the useful context, find what’s missing,
          <br className="desktop-only" /> and build the plan around the work you have in mind.
        </p>
      </div>
      <form
        className="property-address"
        onSubmit={(e) => {
          e.preventDefault();
          setCandidates([]);
          setLoadImages(false);
          void run('Saving address', () => controller.savePropertyAddress(projectId, draft));
        }}
      >
        <Glyph name="home" />
        <input
          aria-label="Property address"
          placeholder="Street address, city, state"
          required
          minLength={3}
          maxLength={300}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="primary" disabled={busy || !!loading || draft.trim() === address}>
          {address ? 'Update' : 'Use this address'} <Glyph name="right" />
        </button>
      </form>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {loading && (
        <p className="intake-status" role="status">
          {loading}…
        </p>
      )}
      {address && (
        <>
          <div className="intake-context-line">
            <span>
              <i />
              {address}
            </span>
            <small>Reported address · confirm the parcel before using records</small>
          </div>
          <section className="reference-board">
            <div className="intake-section-heading">
              <div>
                <p className="eyebrow">01 / GET THE CONTEXT</p>
                <h2>A few views tell us a lot.</h2>
              </div>
              <span className="quiet-badge">Nothing loaded automatically</span>
            </div>
            {!research?.images.length ? (
              <div className="reference-slots" aria-label="Reference views to investigate">
                {[
                  ['Street & surroundings', 'Access, exterior and nearby context', 'street'],
                  ['From above', 'Roof, lot and building context', 'overhead'],
                  ['Earlier interiors', 'Former listing photos, if available', 'interior'],
                ].map(([title, copy, style]) => (
                  <div className={`reference-slot ${style}`} key={title}>
                    <div className="reference-linework" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>
                    <strong>{title}</strong>
                    <small>{copy}</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="discovered-images">
                {research.images.map((i) => (
                  <article key={i.id}>
                    {loadImages &&
                    !i.blockedReason &&
                    i.previewUrl &&
                    i.previewPermission !== 'unknown' ? (
                      <img
                        src={i.previewUrl}
                        alt={i.title}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                    ) : (
                      <div className="image-not-loaded">
                        <Glyph name="file" />
                        <span>
                          {i.previewPermission === 'unknown'
                            ? 'Source page only · preview permission unknown'
                            : 'Preview not loaded'}
                        </span>
                      </div>
                    )}
                    <strong title={i.title}>{i.title}</strong>
                    {i.previewUrl && (
                      <small>Preview provider: {new URL(i.previewUrl).hostname}</small>
                    )}
                    <small>{imageReferenceKind(i.pageUrl)} · unreviewed reference</small>
                    {i.locator && <small>{i.locator}</small>}
                    {i.observations && <small>Visual notes (unreviewed): {i.observations}</small>}
                    {i.planningUse && <small>Next check: {i.planningUse}</small>}
                    {research.photoReview?.photos.find((photo) => photo.id === i.id)?.questions
                      .length ? (
                      <details>
                        <summary>Muse’s planning questions</summary>
                        <ul>
                          {questionsForReviewedPhoto(research.photoReview, i.id).map((question) => (
                            <li key={question}>{question}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                    {i.blockedReason && (
                      <small className="inline-error">
                        Blocked from planning: {i.blockedReason}
                      </small>
                    )}
                    {i.imageUrl && (
                      <a href={i.imageUrl} target="_blank" rel="noreferrer">
                        Open exact source photo ↗
                      </a>
                    )}
                    <small>
                      {i.capturedAt
                        ? `Reported image date: ${i.capturedAt} · basis unverified`
                        : 'Photo capture date unknown'}
                    </small>
                    <a href={i.pageUrl} target="_blank" rel="noreferrer">
                      Open source ↗
                    </a>
                  </article>
                ))}
              </div>
            )}
            <div className="image-choice">
              <div>
                <strong>
                  {research?.images.length
                    ? canPreview
                      ? 'Do you want to load these image previews?'
                      : 'Image reference pages found.'
                    : 'Want to look for online references?'}
                </strong>
                <p>
                  {research?.images.length
                    ? `${research.images.length} reference links · ${research.images.filter((i) => !i.blockedReason && i.previewUrl && i.previewPermission !== 'unknown').length} previews declared permitted. Map viewers and documents are not property photos. Dates and rights need review.`
                    : 'Maps and former listings are leads. We won’t pretend an image exists before it’s found.'}
                </p>
              </div>
              {research?.images.length ? (
                <button
                  className="secondary"
                  disabled={!canPreview}
                  onClick={() => setLoadImages((v) => !v)}
                >
                  {!canPreview
                    ? 'Source pages only'
                    : loadImages
                      ? 'Hide previews'
                      : 'Load permitted previews'}
                </button>
              ) : (
                <button className="secondary" onClick={() => setReferences((v) => !v)}>
                  {references ? 'Hide reference links' : 'Choose references'} <Glyph name="right" />
                </button>
              )}
            </div>
            {!!research?.images.length && (
              <button className="text-button" onClick={() => setReferences((v) => !v)}>
                {references ? 'Hide map and listing links' : 'Open map and listing searches'}
              </button>
            )}
            {research && <PhotoReviewSummary research={research} />}
            {references && (
              <div className="reference-links">
                <a href={maps} target="_blank" rel="noreferrer">
                  Google Maps / Street View ↗
                </a>
                <a
                  href={`https://earth.google.com/web/search/${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Google Earth ↗
                </a>
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent('"' + address + '" former real estate listing photos')}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Find former listing pages ↗
                </a>
                <small>
                  Opening a provider sends it this address. Images stay on the source page unless a
                  permitted preview is returned.
                </small>
              </div>
            )}
          </section>
          <div className="intake-research-grid">
            <section className="record-collection">
              <p className="eyebrow">02 / FIND THE USEFUL FACTS</p>
              <h2>The public-record starting point.</h2>
              <p>Parcel, recorded area, age, zoning and permit leads—each tied to its source.</p>
              <button
                className="secondary"
                disabled={!!loading || busy}
                onClick={() =>
                  void run('Looking up Philadelphia records', async () => {
                    const rows = await findPhiladelphiaRecords(address);
                    setCandidates(rows);
                    if (!rows.length)
                      throw Error(
                        'No exact street-address match. Try the street address without unit/city text, or open the official viewer.',
                      );
                  })
                }
              >
                Look up Philadelphia records <Glyph name="right" />
              </button>
              <small>
                This lookup sends the street address to Philadelphia’s public OPA data service.
                Other cities need a local source.
              </small>
              <a
                className="text-button"
                href={`https://atlas.phila.gov/${encodeURIComponent(address)}`}
                target="_blank"
                rel="noreferrer"
              >
                Open official Atlas viewer ↗
              </a>
              {candidates.length > 0 && (
                <div className="parcel-matches">
                  <strong>Which record is your property?</strong>
                  {candidates.map((row) => (
                    <button
                      className="parcel-match"
                      key={row.parcel_number}
                      onClick={() =>
                        void run('Saving sourced record', async () => {
                          await controller.savePropertyResearch(
                            projectId,
                            cityResearch(row, address, jobId),
                          );
                          setCandidates([]);
                        })
                      }
                    >
                      {row.location}
                      <small>Parcel {row.parcel_number} · use this record →</small>
                    </button>
                  ))}
                </div>
              )}
            </section>
            <section className="muse-handoff">
              <p className="eyebrow">MUSE / RESEARCH HANDOFF</p>
              <h2>Give Muse a focused job.</h2>
              <p>
                Research this address, find source-backed records and image references, then bring
                the results into the plan.
              </p>
              <div className="intake-buttons">
                <button
                  className="secondary"
                  onClick={() =>
                    downloadText(
                      'muse-property-job.json',
                      JSON.stringify(
                        {
                          schemaVersion: 1,
                          address,
                          jobId,
                          goal: goalText,
                          context: research || undefined,
                          prompt: musePropertyPrompt(
                            address,
                            goalText,
                            jobId,
                            research || undefined,
                          ),
                        },
                        null,
                        2,
                      ),
                      'application/json',
                    )
                  }
                >
                  Export Muse job <Glyph name="right" />
                </button>
                <button className="text-button" onClick={() => importer.current?.click()}>
                  Import results
                </button>
                {research?.photoReview && (
                  <button
                    className="text-button"
                    onClick={() => inventoryImporter.current?.click()}
                  >
                    Import visual inventory
                  </button>
                )}
              </div>
              {research && (
                <div className="intake-buttons">
                  <button
                    className="secondary"
                    disabled={
                      !research.photoReview?.photos.length &&
                      !research.images.some((image) => image.imageUrl)
                    }
                    onClick={() =>
                      downloadText(
                        'muse-photo-review-job.json',
                        JSON.stringify(photoReviewJob(research, goalText), null, 2),
                        'application/json',
                      )
                    }
                  >
                    Export photo review job
                  </button>
                  <small>
                    Attaches known source images through the external CLI; earlier visual notes and
                    room labels are excluded from the model prompt. No in-app run.
                  </small>
                </div>
              )}
              <small>
                {controller.connected
                  ? 'Connected Muse photo jobs available above · manual handoff remains optional'
                  : 'File handoff · backend off'}
              </small>
              {research && (
                <small>
                  Export includes the current unreviewed sourced record, so Muse can build on what
                  is already here.
                </small>
              )}
              <details>
                <summary>Run the exported job</summary>
                <p>From this project’s terminal:</p>
                <code>
                  npm run muse:property -- --job /path/to/muse-property-job.json --output
                  /path/to/property-results.json
                </code>
                <p>
                  <code>
                    npm run muse:photos -- --job /path/to/muse-photo-review-job.json --output
                    /path/to/photo-results.json
                  </code>
                </p>
                <p>
                  Then import property-results.json or photo-results.json. Muse uses its own
                  configured account; the app never receives credentials.
                </p>
              </details>
            </section>
          </div>
          <section
            className="intake-dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void addFiles([...e.dataTransfer.files]);
            }}
          >
            <Glyph name="plus" />
            <div>
              <h3>Drop in what you already have.</h3>
              <p>Current photos, a floor plan, inspection report or an old quote.</p>
            </div>
            <button
              className="text-button"
              onClick={() => upload.current?.click()}
              disabled={!!loading}
            >
              Choose files
            </button>
            <small>Stored locally · original files kept · not analyzed</small>
          </section>
          {files.length > 0 && (
            <details className="intake-files">
              <summary>
                {files.length} saved reference{files.length === 1 ? '' : 's'}
              </summary>
              {files.map((f) => (
                <Media key={f.id} controller={controller} state={state} evidenceId={f.id} />
              ))}
            </details>
          )}
          {research && (
            <section className="intake-findings">
              <div className="intake-section-heading">
                <div>
                  <p className="eyebrow">THE RECORD IS TAKING SHAPE</p>
                  <h2>Useful context. Clear sources.</h2>
                  <small>
                    {research.method === 'muse'
                      ? 'Muse research'
                      : research.method === 'city-records'
                        ? 'City records'
                        : 'Imported research'}{' '}
                    · {research.findings.length} findings · {research.sources.length} sources ·{' '}
                    {research.findings.filter((f) => f.blockedReason).length} blocked · unreviewed
                  </small>
                </div>
                <button
                  className="text-button"
                  onClick={() => downloadText('property.md', propertyMarkdown(research, goalText))}
                >
                  Download property.md ↓
                </button>
              </div>
              <dl>
                {research.findings.slice(0, 6).map((f, i) => (
                  <div key={i}>
                    <dt>{f.label}</dt>
                    <dd>
                      {f.value}
                      <small>{f.limit}</small>
                      {f.blockedReason && (
                        <strong className="inline-error">
                          Blocked from planning: {f.blockedReason}
                        </strong>
                      )}
                      <a
                        href={research.sources.find((s) => s.id === f.sourceId)!.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Source: {research.sources.find((s) => s.id === f.sourceId)!.title} ↗
                      </a>
                    </dd>
                  </div>
                ))}
              </dl>
              <details>
                <summary>All findings & sources · unreviewed</summary>
                {research.findings.map((f, i) => (
                  <p key={i}>
                    <strong>{f.label}:</strong> {f.value} <small>{f.limit}</small>
                    {f.blockedReason && (
                      <strong className="inline-error">
                        Blocked from planning: {f.blockedReason}
                      </strong>
                    )}
                    <a
                      href={research.sources.find((s) => s.id === f.sourceId)!.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Source: {f.sourceId} ↗
                    </a>
                  </p>
                ))}
                {research.sources.map((s) => (
                  <p key={s.id}>
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.title} ↗
                    </a>{' '}
                    · {s.retrievedAt.slice(0, 10)}
                  </p>
                ))}
              </details>
            </section>
          )}
          {!research && artifact?.freshness === 'stale' && (
            <p className="intake-status">
              The address changed. Earlier research remains in history; request fresh research for
              this address.
            </p>
          )}
          <section className="intake-next">
            <div>
              <p className="eyebrow">NEXT / SHAPE THE PLAN</p>
              <h2>{research ? 'We have a starting point.' : 'We can start with what you know.'}</h2>
              <p>
                {research?.nextQuestions[0] ||
                  'Tell us what you want to change in the conversation. Your working brief grows as details and records arrive.'}
              </p>
            </div>
            <button
              className="primary"
              disabled={!brief}
              onClick={() => brief && onArtifact(brief)}
            >
              Open working plan <Glyph name="right" />
            </button>
          </section>
        </>
      )}
      <input
        ref={upload}
        hidden
        type="file"
        multiple
        accept="image/*,application/pdf,text/plain,.docx"
        onChange={(e) => {
          void addFiles([...(e.target.files || [])]);
          e.target.value = '';
        }}
      />
      <input
        ref={inventoryImporter}
        hidden
        type="file"
        accept="application/json,.json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file)
            void run('Importing visual inventory', async () => {
              if (file.size > 2 * 1024 * 1024) throw Error('Inventory file exceeds 2 MB');
              await controller.importPhotoInventory(projectId, JSON.parse(await file.text()));
            });
          e.target.value = '';
        }}
      />
      <input
        ref={importer}
        hidden
        type="file"
        accept="application/json,.json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file)
            void run('Importing Muse research', async () => {
              if (file.size > 2 * 1024 * 1024)
                throw Error('Choose a results JSON file smaller than 2 MB.');
              await controller.savePropertyResearch(projectId, JSON.parse(await file.text()));
              setLoadImages(false);
            });
          e.target.value = '';
        }}
      />
    </section>
  );
}
