import { CandidateMeasurementsPanel } from './candidate-measurements.js';
import { type Artifact, type ArtifactPayload, type Workspace } from '@unpermitted/contracts';
import {
  scopeAnswerRefs,
  candidateSurveyRefs,
  scopePlanningCoverage,
  researchForArtifact,
  referenceCurrent,
} from '@unpermitted/core';
import { type WorkspaceController } from '../../app/workspace-controller.js';
import { PhotoReviewSummary } from '../intake/photo-review-summary.js';
const safe = (work: Promise<unknown>) => void work.catch(() => {});
export function ScopePlannerEntry({
  state,
  projectId,
  controller,
  busy,
  compact = false,
}: {
  compact?: boolean;
  state: Workspace;
  projectId: string;
  controller: WorkspaceController;
  busy: boolean;
}) {
  const coverage = scopePlanningCoverage(state, projectId);
  const research = state.artifacts[`${projectId}:property-research`]?.at(-1);
  const responses = scopeAnswerRefs(state, projectId);
  const options = state.artifacts[`${projectId}:scope-options`]?.at(-1);
  const plan = state.artifacts[`${projectId}:scope-work-plan`]?.at(-1);
  const open = (a: Artifact) =>
    safe(
      controller.setView(projectId, {
        surface: 'artifact',
        tab: 'work',
        artifactRef: { kind: 'artifact', id: a.id, revision: a.revision },
      }),
    );
  return (
    <section className={`scope-planner-entry ${compact ? 'compact' : ''}`}>
      {!compact && (
        <>
          <p className="eyebrow">FROM DIRECTION TO A STUDY PLAN</p>
          <h2>Compare the work. Expose the unknowns.</h2>
          <p>
            Build conditional scope and location options from the saved Muse questions and your
            exact responses. Choose one to investigate and see its order of work.
          </p>
        </>
      )}
      <p>
        {responses.length}/6 saved responses. Missing, unsure and deferred choices remain
        dependencies; option compatibility is unreviewed.
      </p>
      {!compact && (
        <p className="small-note">
          Local versioned recipe · no model call · feasibility and construction blocked · backend
          off
        </p>
      )}
      {!coverage.supported ? (
        <p role="status">{coverage.reason}</p>
      ) : !coverage.current ? (
        <p role="status">
          Current photo research is needed. Replace stale research before compiling options.
        </p>
      ) : null}
      <div className="scope-actions">
        <button
          className="primary"
          disabled={busy || !coverage.supported || !coverage.current || !research}
          onClick={() =>
            research &&
            safe(
              controller.buildProjectOptions(
                projectId,
                { kind: 'artifact', id: research.id, revision: research.revision },
                scopeAnswerRefs(state, projectId),
                options?.revision || 0,
                candidateSurveyRefs(state, projectId),
              ),
            )
          }
        >
          {options ? 'Rebuild options from saved direction' : 'Build project options'}
        </button>
        {options && (
          <button className="secondary" onClick={() => open(options)}>
            Open saved options · r{options.revision}
          </button>
        )}
        {plan && (
          <button className="secondary" onClick={() => open(plan)}>
            Open saved sequence · r{plan.revision}
          </button>
        )}
      </div>
      <CandidateMeasurementsPanel
        state={state}
        projectId={projectId}
        controller={controller}
        busy={busy}
      />
    </section>
  );
}
type Dependency = Extract<
  ArtifactPayload,
  { kind: 'project-options' }
>['options'][number]['dependencies'][number];
export function ScopePlanningView({
  artifact,
  state,
  controller,
  busy = false,
}: {
  artifact: Artifact;
  state?: Workspace;
  controller?: WorkspaceController;
  busy?: boolean;
}) {
  const p = artifact.payload;
  if (p.kind !== 'project-options' && p.kind !== 'project-work-plan') return null;
  const sourceOptions =
    p.kind === 'project-options'
      ? artifact
      : artifact.inputRefs.flatMap(
          (r) =>
            state?.artifacts[r.id]?.filter(
              (a) => a.revision === r.revision && a.payload.kind === 'project-options',
            ) || [],
        )[0];
  const research = state && sourceOptions ? researchForArtifact(state, sourceOptions) : null;
  const current =
    !!state &&
    referenceCurrent(state, artifact.projectId, {
      kind: 'artifact',
      id: artifact.id,
      revision: artifact.revision,
    });
  const open = (id: string, revision: number) =>
    controller &&
    safe(
      controller.setView(artifact.projectId, {
        surface: 'artifact',
        tab: 'work',
        artifactRef: { kind: 'artifact', id, revision },
      }),
    );
  const dependency = (d: Dependency) => (
    <li key={d.id} className={`scope-dependency ${d.status}`}>
      <div className="scope-dependency-label">
        <strong>{d.title}</strong>
        <span>
          {d.status === 'reported'
            ? 'Reported · fit unreviewed'
            : d.status === 'needs-review'
              ? 'Needs review'
              : d.status === 'unsupported'
                ? 'Unsupported · blocked'
                : d.kind === 'direction'
                  ? 'Direction open · blocked'
                  : 'Missing · blocked'}
        </span>
      </div>
      <p>{d.detail}</p>
      {d.inputRefs.map((r) => (
        <button
          key={`${r.id}:${r.revision}`}
          className="link-button"
          onClick={() => open(r.id, r.revision)}
        >
          Inspect{' '}
          {state?.artifacts[r.id]?.find((a) => a.revision === r.revision)?.payload.kind ===
          'photo-planning-answer'
            ? 'response'
            : 'survey / check'}{' '}
          r{r.revision}
        </button>
      ))}
      <div className="scope-source-links">
        {d.photoIds.map((id) => {
          const photo = research?.photoReview?.photos.find((photo) => photo.id === id);
          return photo ? (
            <a key={id} href={photo.imageUrl} target="_blank" rel="noreferrer">
              {id}
            </a>
          ) : null;
        })}
      </div>
    </li>
  );
  return (
    <div className="scope-planning-view">
      {state && !current && (
        <p className="stale-banner" role="status">
          The inputs or recipe behind this proposal changed. Keep it as history and rebuild current
          options before sequencing work.
        </p>
      )}
      <p className="work-lede">
        {p.kind === 'project-options'
          ? 'Three conditional ways to stage this kitchen and powder-room project. Reported preferences are quoted, with compatibility awaiting reconciliation.'
          : `Study focus: ${p.optionTitle}. Survey and services investigation can proceed in parallel after scope clarification; design waits for both.`}
      </p>
      <div className="scope-release-banner">
        <strong>Construction blocked</strong>
        <span>
          Recipe {p.recipe} · compiled locally from exact saved revisions. No option is proven
          feasible, no permit or inspection is passed, and no work is released.
        </span>
      </div>
      {p.kind === 'project-options' ? (
        <div className="scope-option-grid">
          {p.options.map((o, i) => (
            <section className="scope-option-card" key={o.id}>
              <p className="eyebrow">STUDY OPTION {i + 1} · FEASIBILITY BLOCKED</p>
              <h2>{o.title}</h2>
              <p>{o.summary}</p>
              <h3>Proposed scope</h3>
              <ul>
                {o.scope.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <h3>Outside this option</h3>
              <ul>
                {o.exclusions.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <details>
                <summary>
                  Direction & dependencies ·{' '}
                  {o.dependencies.filter((d) => d.status !== 'reported').length} unresolved
                </summary>
                <ul className="scope-dependencies">{o.dependencies.map(dependency)}</ul>
              </details>
              <p className="small-note">
                Study focus only. Choosing this option does not certify that it matches every answer
                or approve its design.
              </p>
              {controller && state && (
                <button
                  className="primary"
                  disabled={busy || !current}
                  onClick={() =>
                    safe(
                      controller.planProjectOption(
                        artifact.projectId,
                        { kind: 'artifact', id: artifact.id, revision: artifact.revision },
                        o.id,
                        state.artifacts[`${artifact.projectId}:scope-work-plan`]?.at(-1)
                          ?.revision || 0,
                      ),
                    )
                  }
                >
                  Sequence this option
                </button>
              )}
            </section>
          ))}
        </div>
      ) : (
        <>
          {sourceOptions && (
            <button
              className="link-button"
              onClick={() => open(sourceOptions.id, sourceOptions.revision)}
            >
              Compare source options · exact r{sourceOptions.revision} →
            </button>
          )}
          <ol className="scope-sequence">
            {p.steps.map((step, i) => (
              <li key={step.id} id={`scope-step-${step.id}`}>
                <div className="scope-step-number">{String(i + 1).padStart(2, '0')}</div>
                <div>
                  <p className="eyebrow">
                    {step.kind.replaceAll('-', ' ')} · {step.status.replaceAll('-', ' ')} · not
                    completed
                  </p>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  <p className="scope-predecessors">
                    {step.dependsOn.length
                      ? `After: ${step.dependsOn.map((id) => p.steps.find((s) => s.id === id)?.title).join(' + ')}`
                      : 'Start with this planning conversation.'}
                  </p>
                  <details>
                    <summary>Required evidence & hold points · {step.blockers.length}</summary>
                    <ul className="scope-dependencies">{step.blockers.map(dependency)}</ul>
                  </details>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
      {research && (
        <details className="scope-source-review">
          <summary>Original Muse photo review, confidence & uncertainty</summary>
          <PhotoReviewSummary research={research} />
        </details>
      )}
    </div>
  );
}
