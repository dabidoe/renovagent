import { CandidateMeasurementView } from './candidate-measurements.js';
import { ScopePlanningView } from './scope-planner.js';
import { type WorkspaceController } from '../../app/workspace-controller.js';
import { PhotoReviewSummary } from '../intake/photo-review-summary.js';
import { researchForArtifact, questionsForReviewedPhoto } from '@unpermitted/core';
import { PlanningView } from '../technical/planning-view.js';
import { type Workspace, type Artifact } from '@unpermitted/contracts';
export const artifactTitles: Record<Artifact['payload']['kind'], string> = {
  'photo-inventory': 'Visual home inventory',
  'inventory-direction': 'Your element direction',
  'candidate-measurements': 'Candidate measurement record',
  'candidate-checks': 'Candidate technical checks',
  'project-options': 'Project options & dependencies',
  'project-work-plan': 'Sequenced project work plan',
  'photo-planning-answer': 'Your photo planning response',
  'property-research': 'Property research & sources',
  'planning-inputs': 'Technical input record',
  'planning-sources': 'Technical source register',
  'measured-layout': 'Measured layout & constraints',
  'code-assessment': 'Code applicability & evidence',
  'quantity-takeoff': 'Traceable floor quantities',
  'cost-plan': 'Sourced material cost',
  'gated-plan': 'Gated order of work',
  'option-comparison': 'Options worth investigating',
  'project-brief': 'Working plan',
  'technical-check': 'Technical investigation',
  'task-plan': 'Proposed order of work',
  'material-plan': 'Material requirements',
  estimate: 'Estimate basis',
  'evidence-index': 'Evidence collection',
};
export function artifactTitle(artifact: Artifact) {
  if (artifact.payload.kind === 'candidate-measurements')
    return `Measurements · ${artifact.payload.survey.label}`;
  if (artifact.payload.kind === 'candidate-checks')
    return `Technical checks · ${artifact.payload.label}`;
  return artifact.payload.kind === 'code-assessment' &&
    artifact.payload.assessmentArea === 'drainage'
    ? 'Local drainage & vent checks'
    : artifact.payload.kind === 'planning-inputs'
      ? `Technical inputs · ${artifact.payload.group}`
      : artifactTitles[artifact.payload.kind];
}
function Sketch({
  alternate = false,
  diagram = 'zones',
}: {
  alternate?: boolean;
  diagram?: 'bathroom' | 'zones' | 'flooring';
}) {
  return (
    <svg
      className="option-sketch"
      viewBox="0 0 280 150"
      fill="none"
      aria-label="Illustrative arrangement, not to scale"
      role="img"
    >
      <defs>
        <pattern
          id={alternate ? 'grid-b' : 'grid-a'}
          width="12"
          height="12"
          patternUnits="userSpaceOnUse"
        >
          <path d="M12 0H0V12" stroke="currentColor" strokeWidth=".3" opacity=".2" />
        </pattern>
      </defs>
      <rect width="280" height="150" fill={`url(#${alternate ? 'grid-b' : 'grid-a'})`} />
      <g stroke="currentColor" strokeWidth="1.5">
        <path d="M65 125V25h150v100h-54m-35 0H65" />
        <path d="M126 125V90m0 0a35 35 0 0 1 35 35" strokeDasharray="3 3" />
        {diagram === 'flooring' ? (
          <path
            d={
              alternate
                ? 'M66 45h148M66 65h148M66 85h148M66 105h148M95 25v20m40 0v20m40 0v20m-80 0v20m40 0v20'
                : 'M90 25v100m25-100v100m25-100v100m25-100v100m25-100v100M65 55h25m0 40h25m0-40h25m0 40h25m0-40h25'
            }
          />
        ) : diagram === 'zones' ? (
          <>
            <rect x={alternate ? 145 : 77} y="39" width="53" height="39" rx="2" />
            <path d={alternate ? 'M78 44v65h57' : 'M146 95h56V48'} strokeDasharray="3 3" />
          </>
        ) : alternate ? (
          <>
            <rect x="175" y="36" width="28" height="23" rx="5" />
            <ellipse cx="89" cy="79" rx="13" ry="20" />
            <path d="M76 58h26v-17H76Z" />
          </>
        ) : (
          <>
            <rect x="76" y="36" width="28" height="23" rx="5" />
            <ellipse cx="185" cy="78" rx="13" ry="20" />
            <path d="M172 57h26V40h-26Z" />
          </>
        )}
        <path d="M51 25v100m-4-100h8m-8 100h8M65 13h150m-150-4v8m150-8v8" opacity=".35" />
      </g>
    </svg>
  );
}
export function ArtifactView({
  artifact,
  state,
  controller,
  busy,
}: {
  artifact: Artifact;
  state?: Workspace;
  controller?: WorkspaceController;
  busy?: boolean;
}) {
  const p = artifact.payload;
  const photoResearch = state ? researchForArtifact(state, artifact) : null;
  switch (p.kind) {
    case 'photo-inventory':
      return (
        <div>
          <h3>Visual observations · unreviewed</h3>
          <p>
            {p.items.length} observations across {p.photos.length} source photos. Regions are model
            proposals, not measured geometry.
          </p>
          <ul>
            {p.items.map((i) => (
              <li key={i.id}>
                {i.label} · {i.photoId} · {i.confidence} confidence
              </li>
            ))}
          </ul>
        </div>
      );
    case 'inventory-direction':
      return (
        <div>
          <h3>Your reported direction</h3>
          <p>
            {p.correctedLabel || p.itemId}: {p.disposition} · identification {p.identification}
          </p>
          <p>{p.note}</p>
          <p>Preference only; no technical approval.</p>
        </div>
      );
    case 'candidate-measurements':
    case 'candidate-checks':
      return <CandidateMeasurementView artifact={artifact} />;
    case 'project-options':
    case 'project-work-plan':
      return (
        <ScopePlanningView artifact={artifact} state={state} controller={controller} busy={busy} />
      );
    case 'planning-inputs':
    case 'planning-sources':
    case 'measured-layout':
    case 'code-assessment':
    case 'quantity-takeoff':
    case 'cost-plan':
    case 'gated-plan':
      return <PlanningView artifact={artifact} state={state} />;
    case 'option-comparison':
      return (
        <>
          <p className="work-lede">
            Two approaches to investigate. This is an illustrative comparison; neither approach has
            been verified against site conditions.
          </p>
          <div className="option-grid">
            {p.options.map((o, i) => (
              <section className="option-card" key={o.id}>
                <div className="option-card-label">
                  <span>OPTION {String(i + 1).padStart(2, '0')}</span>
                  <span>Illustrative</span>
                </div>
                <Sketch alternate={Boolean(i % 2)} diagram={o.diagram} />
                <div className="option-copy">
                  <h3>{o.title}</h3>
                  <p>{o.approach}</p>
                  <div className="tradeoff">
                    <span>THE TRADEOFF</span>
                    <p>{o.tradeoff}</p>
                  </div>
                  <h4>Before this becomes an option</h4>
                  <ul>
                    {o.unknowns.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              </section>
            ))}
          </div>
        </>
      );
    case 'photo-planning-answer':
      return (
        <div className="document-sections">
          <h3>{p.question}</h3>
          <p>{p.answer}</p>
          <p>{p.disposition} · user-reported · not verified site evidence.</p>
          <p>
            Source photos: {p.photoIds.join(', ')}. Use the exact source research revision for
            visual uncertainty and provenance.
          </p>
          {artifact.inputRefs
            .filter((r) => r.kind === 'artifact')
            .map((r) => {
              const source = state?.artifacts[r.id]?.find((a) => a.revision === r.revision);
              return source?.payload.kind === 'property-research' ? (
                <PhotoReviewSummary key={r.id} research={source.payload} />
              ) : null;
            })}
        </div>
      );
    case 'property-research':
      return (
        <div className="document-sections">
          <p>
            Unreviewed {p.method} research for {p.address}. These records do not establish current
            conditions or room dimensions.
          </p>
          <PhotoReviewSummary research={p} />
          {p.findings.map((f, i) => (
            <section key={i}>
              <div>
                <h3>{f.label}</h3>
                <p>{f.value}</p>
                <small>{f.limit}</small>
                {f.blockedReason && (
                  <p className="inline-error">Blocked from planning: {f.blockedReason}</p>
                )}
              </div>
            </section>
          ))}
          {p.sources.map((s) => (
            <p key={s.id}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title} ↗
              </a>
            </p>
          ))}
        </div>
      );
    case 'project-brief':
      return (
        <div className="document-sections">
          {p.sections.map((s, i) => (
            <section key={i}>
              <span className="section-number">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            </section>
          ))}
          {photoResearch && <PhotoReviewSummary research={photoResearch} />}
          {photoResearch?.images
            .filter((i) => !i.blockedReason)
            .map((image) => (
              <section key={image.id}>
                <div>
                  <h3>{image.title}</h3>
                  <p>
                    Unreviewed source reference · capture date and current conditions unverified.{' '}
                    {image.locator || 'Open the source page to locate this reference.'}
                  </p>
                  {image.observations && <p>Visual notes (unreviewed): {image.observations}</p>}
                  {image.planningUse && <p>Next check: {image.planningUse}</p>}
                  {photoResearch?.photoReview?.photos.find((photo) => photo.id === image.id) && (
                    <>
                      <p>
                        Uncertain:{' '}
                        {photoResearch.photoReview.photos
                          .find((photo) => photo.id === image.id)!
                          .uncertainties.join(' ') ||
                          'No additional uncertainty reported; current conditions remain unverified.'}
                      </p>
                      <ul>
                        {questionsForReviewedPhoto(photoResearch.photoReview, image.id).map(
                          (question) => (
                            <li key={question}>{question}</li>
                          ),
                        )}
                      </ul>
                    </>
                  )}
                  <a href={image.pageUrl} target="_blank" rel="noreferrer">
                    Open reference source ↗
                  </a>
                  {image.imageUrl && (
                    <p>
                      <a href={image.imageUrl} target="_blank" rel="noreferrer">
                        Open exact source photo ↗
                      </a>{' '}
                      · opens at the provider; no preview copied
                    </p>
                  )}
                </div>
              </section>
            ))}
        </div>
      );
    case 'technical-check':
      return (
        <>
          <div className="investigation-banner">
            Needs evidence · no technical conclusion has been verified
          </div>
          <div className="technical-text">{p.summary}</div>
        </>
      );
    case 'task-plan':
      return (
        <>
          <p className="work-lede">
            A simulated dependency outline. Actual scope, technical review, permits, and inspection
            gates still need resolution. No work is released.
          </p>
          <ol className="task-outline">
            {p.tasks.map((task, i) => (
              <li key={task.id}>
                <span className="task-number">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{task.title}</h3>
                  <p>
                    {task.deps.length
                      ? `Depends on: ${task.deps.join(', ')}`
                      : 'Start by establishing the evidence.'}
                  </p>
                </div>
                <span className="status muted-status">Needs review</span>
              </li>
            ))}
          </ol>
        </>
      );
    case 'material-plan':
      return (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Requirement</th>
                <th>Quantity</th>
                <th>Source tasks</th>
              </tr>
            </thead>
            <tbody>
              {p.lines.map((l, i) => (
                <tr key={i}>
                  <td>{l.description}</td>
                  <td>
                    {l.quantity} {l.unit}
                  </td>
                  <td>{l.sourceTaskIds.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!p.lines.length && <p>No material quantities have been resolved.</p>}
        </div>
      );
    case 'estimate':
      return (
        <>
          <p className="work-lede">
            {p.basis === 'fixture' ? 'Fixture prices only.' : 'User-provided prices.'} This is not a
            verified job estimate.
          </p>
          <table>
            <thead>
              <tr>
                <th>Line</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {p.lines.map((l, i) => (
                <tr key={i}>
                  <td>{l.description}</td>
                  <td>
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: p.currency,
                    }).format(l.minorUnits / 100)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );
    case 'evidence-index':
      return (
        <p>
          {p.evidenceIds.length} evidence references. Open Sources to inspect the original records.
        </p>
      );
  }
}
