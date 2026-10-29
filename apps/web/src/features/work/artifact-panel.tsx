import { ScopePlannerEntry } from './scope-planner.js';
import { type Workspace, type Artifact } from '@renovagent/contracts';
import { latest, photoQuestions } from '@renovagent/core';
import { WorkspaceController, defaultView, projectRuns } from '../../app/workspace-controller.js';
import { factText } from '../../app/presentation.js';
import { Glyph } from '../../components/glyph.js';
import { ArtifactView, artifactTitle } from './artifact-view.js';
export function ArtifactPanel({
  selected,
  state,
  controller,
  busy,
  onSource,
}: {
  selected: Artifact;
  state: Workspace;
  controller: WorkspaceController;
  busy: boolean;
  onSource: (id: string) => void;
}) {
  const active = selected.projectId,
    view = state.views[active] || defaultView,
    runs = projectRuns(state, active);
  const safe = (promise: Promise<unknown>) => void promise.catch(() => {});
  const openArtifact = (artifact: Artifact) =>
    safe(
      controller.setView(active, {
        surface: 'artifact',
        artifactRef: { kind: 'artifact', id: artifact.id, revision: artifact.revision },
        tab: 'work',
      }),
    );
  const setSourceId = onSource;
  const deterministic = [
    'planning-inputs',
    'planning-sources',
    'measured-layout',
    'code-assessment',
    'quantity-takeoff',
    'cost-plan',
    'gated-plan',
  ].includes(selected.payload.kind);
  const hasExample = (artifact: Artifact, seen = new Set<string>()): boolean => {
    const key = `${artifact.id}:${artifact.revision}`;
    if (seen.has(key)) return false;
    seen.add(key);
    if (artifact.payload.kind === 'planning-inputs') return artifact.payload.basis === 'example';
    return artifact.inputRefs.some((ref) => {
      const input =
        ref.kind === 'artifact'
          ? state.artifacts[ref.id]?.find((a) => a.revision === ref.revision)
          : undefined;
      return input ? hasExample(input, seen) : false;
    });
  };
  const example = hasExample(selected);

  return (
    <>
      <div className="artifact-heading">
        <div>
          <p className="eyebrow">SAVED PROJECT ARTIFACT</p>
          <h1>{artifactTitle(selected)}</h1>
        </div>
        <select
          aria-label="Artifact revision"
          value={selected.revision}
          onChange={(e) =>
            openArtifact(state.artifacts[selected.id].find((a) => a.revision === +e.target.value)!)
          }
        >
          {state.artifacts[selected.id].map((a) => (
            <option value={a.revision} key={a.revision}>
              Revision {a.revision}
              {a === latest(state.artifacts[a.id]) ? ' · latest' : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="artifact-meta">
        <span className="status fixture-status">
          {selected.payload.kind === 'photo-inventory'
            ? 'Muse image regions · unreviewed'
            : selected.payload.kind === 'inventory-direction'
              ? 'User-reported element direction'
              : deterministic
                ? example
                  ? 'Calculated · example inputs'
                  : 'Deterministic · reported inputs'
                : ['project-options', 'project-work-plan'].includes(selected.payload.kind)
                  ? 'Compiled locally · feasibility blocked'
                  : ['candidate-measurements', 'candidate-checks'].includes(selected.payload.kind)
                    ? 'Candidate observations · unverified'
                    : selected.payload.kind === 'photo-planning-answer'
                      ? 'User-reported direction · unverified'
                      : selected.payload.kind === 'property-research'
                        ? 'Sourced research · unreviewed'
                        : selected.id.endsWith(':working-brief')
                          ? 'Compiled from saved inputs'
                          : selected.payload.kind === 'project-brief' &&
                              selected.id.endsWith(':agent-brief')
                            ? 'Saved project intent · unreviewed'
                            : 'Simulated output'}
        </span>
        <span
          className={`status ${selected.freshness === 'stale' ? 'warning-status' : 'muted-status'}`}
        >
          {selected.freshness === 'stale'
            ? 'Inputs changed'
            : ['project-options', 'project-work-plan'].includes(selected.payload.kind)
              ? 'Study proposal · not released'
              : ['candidate-measurements', 'candidate-checks'].includes(selected.payload.kind)
                ? 'Saved input / check · no release'
                : selected.payload.kind === 'photo-planning-answer'
                  ? 'Saved response · revise in conversation'
                  : selected.lifecycle === 'accepted'
                    ? 'Accepted by you'
                    : selected.lifecycle === 'rejected'
                      ? 'Declined by you'
                      : 'Proposal · needs decision'}
        </span>
        <span>Revision {selected.revision}</span>
      </div>
      {latest(state.artifacts[selected.id])?.revision !== selected.revision && (
        <div className="historical-banner">
          You’re viewing a historical revision.{' '}
          <button
            className="link-button"
            onClick={() => openArtifact(latest(state.artifacts[selected.id])!)}
          >
            Open latest →
          </button>
        </div>
      )}
      {selected.freshness !== 'current' && (
        <div className="stale-banner">
          <strong>The inputs behind this artifact have changed.</strong>
          <span>Its history is preserved. Generate a new proposal before making a decision.</span>
        </div>
      )}
      {deterministic && (
        <div className="planning-navigation">
          {['geometry', 'code', 'drainage', 'quantities', 'cost', 'tasks', 'sources'].map(
            (part) => {
              const a = latest(state.artifacts[`${active}:planning:${part}`]);
              return a ? (
                <button key={part} className="secondary" onClick={() => openArtifact(a)}>
                  {part === 'code'
                    ? 'Applicability'
                    : part === 'drainage'
                      ? 'Local drain / vent'
                      : part === 'cost'
                        ? 'Partial cost'
                        : part}
                </button>
              ) : null;
            },
          )}
          <button
            className="text-button"
            onClick={() =>
              safe(
                controller.setView(active, {
                  stage: 'technical',
                  surface: 'overview',
                  tab: 'work',
                }),
              )
            }
          >
            Edit technical inputs →
          </button>
        </div>
      )}
      {((selected.id.endsWith(':working-brief') && photoQuestions(state, active).length > 0) ||
        ['project-options', 'project-work-plan'].includes(selected.payload.kind)) && (
        <ScopePlannerEntry
          state={state}
          projectId={active}
          controller={controller}
          busy={busy}
          compact={['project-options', 'project-work-plan'].includes(selected.payload.kind)}
        />
      )}
      <ArtifactView artifact={selected} state={state} controller={controller} busy={busy} />
      <section className="artifact-basis">
        <details>
          <summary>
            Inspect inputs & evidence <span>{selected.inputRefs.length} references</span>
          </summary>
          {selected.inputRefs.map((ref) => {
            const fact =
              ref.kind === 'fact'
                ? state.facts[ref.id]?.find((f) => f.revision === ref.revision)
                : undefined;
            return (
              <div className="basis-row" key={`${ref.kind}:${ref.id}`}>
                <Glyph name="source" />
                <div>
                  <strong>
                    {fact
                      ? fact.key
                      : ref.kind === 'evidence'
                        ? state.evidence[ref.id]?.source.description.slice(0, 70)
                        : ref.id}
                  </strong>
                  <span>
                    Consumed revision {ref.revision}
                    {fact ? ` · ${factText(fact)}` : ''}
                    {fact && latest(state.facts[ref.id])?.revision !== ref.revision
                      ? ' · newer observation available'
                      : ''}
                  </span>
                  {fact?.evidenceIds.map((id) => (
                    <button key={id} className="link-button" onClick={() => setSourceId(id)}>
                      View source →
                    </button>
                  ))}
                  {ref.kind === 'artifact' && (
                    <button
                      className="link-button"
                      onClick={() =>
                        openArtifact(
                          state.artifacts[ref.id].find((a) => a.revision === ref.revision)!,
                        )
                      }
                    >
                      Inspect exact input revision →
                    </button>
                  )}
                  {ref.kind === 'evidence' && (
                    <button className="link-button" onClick={() => setSourceId(ref.id)}>
                      Inspect source →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </details>
      </section>
      {[
        'photo-inventory',
        'inventory-direction',
        'photo-planning-answer',
        'project-options',
        'project-work-plan',
        'candidate-measurements',
        'candidate-checks',
      ].includes(selected.payload.kind) ? (
        <p className="small-note">
          {['photo-inventory', 'inventory-direction'].includes(selected.payload.kind)
            ? 'Review individual elements in the home inventory. No identification or preference establishes feasibility or releases work.'
            : selected.payload.kind === 'photo-planning-answer'
              ? 'This is your saved response. Select its question in conversation to revise it.'
              : ['candidate-measurements', 'candidate-checks'].includes(selected.payload.kind)
                ? 'These are unverified candidate observations and arithmetic. Revise measurements in the candidate editor; qualified review and construction release remain blocked.'
                : 'This is a conditional investigation proposal. Sequence an option for study; design acceptance and release of physical work are not supported here.'}
        </p>
      ) : (
        <div className="decision-bar">
          <div>
            <strong>
              {selected.lifecycle === 'accepted'
                ? 'This revision was accepted.'
                : selected.lifecycle === 'rejected'
                  ? 'This revision was declined.'
                  : 'Keep this direction?'}
            </strong>
            <span>
              User acceptance keeps a proposal in the record. It does not verify feasibility or
              release construction work.
            </span>
          </div>
          {selected.lifecycle === 'proposed' && (
            <div>
              <button
                className="secondary"
                disabled={busy || selected.freshness !== 'current'}
                onClick={() =>
                  safe(controller.decide(active, selected.id, selected.revision, true))
                }
              >
                Decline
              </button>
              <button
                className="primary"
                disabled={busy || selected.freshness !== 'current'}
                onClick={() => safe(controller.decide(active, selected.id, selected.revision))}
              >
                <Glyph name="check" />
                Accept revision {selected.revision}
              </button>
            </div>
          )}
          {selected.freshness !== 'current' &&
            latest(state.artifacts[selected.id])?.revision === selected.revision && (
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  safe(
                    deterministic
                      ? controller.calculatePlanning(active)
                      : controller.requestWork(
                          active,
                          runs.find((r) => r.targetArtifactId === selected.id)?.kind || view.stage,
                        ),
                  )
                }
              >
                {deterministic ? 'Recalculate current inputs' : 'Request fresh simulation'}
              </button>
            )}
        </div>
      )}
    </>
  );
}
