import { InventoryWorkbench } from '../features/work/inventory-workbench.js';
import { homeInventory } from '@renovagent/core';
import { HomePlan } from '../features/work/home-plan.js';
import { scopePlanningCoverage } from '@renovagent/core';
import { CandidateMeasurementsPanel } from '../features/work/candidate-measurements.js';
import { ScopePlannerEntry } from '../features/work/scope-planner.js';
import { PropertyIntake } from '../features/intake/property-intake.js';
import { PlanningPanel } from '../features/technical/planning-panel.js';
import { ArtifactPanel } from '../features/work/artifact-panel.js';
import { SourcesPanel } from '../features/properties/sources-panel.js';
import { stages, stageCopy, factText } from './presentation.js';
import { Glyph } from '../components/glyph.js';
import { Modal } from '../components/modal.js';
import { Media } from '../features/properties/media.js';
import { RunCard } from '../features/activity/run-card.js';
import { Composer } from '../features/conversation/composer.js';
import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { type Artifact, type Fact, type WorkKind } from '@renovagent/contracts';
import { latest, workLabels, photoQuestions } from '@renovagent/core';
import {
  WorkspaceController,
  defaultView,
  projectFacts,
  projectRuns,
  clearStoredMode,
} from './workspace-controller.js';
import { artifactTitle } from '../features/work/artifact-view.js';
import { PurchasePlans } from '../features/commerce/purchase-plans.js';
import { signInUrlFor, signOutAccount } from '../adapters/http/project-repository.js';
import {
  previewLegacyImport,
  LEGACY_STORAGE_KEY,
  type LegacyImportPreview,
} from '../adapters/fixtures/import-legacy.js';
export function App({ controller }: { controller: WorkspaceController }) {
  const {
    workspace: state,
    busy,
    error,
    auth,
  } = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const active = state.activeProjectId || Object.keys(state.projects)[0] || '';
  const project = state.projects[active];
  const view = state.views[active] || defaultView;
  const [modal, setModal] = useState<
    | 'new'
    | 'import'
    | 'facts'
    | 'about'
    | 'projects'
    | 'archive'
    | 'history'
    | 'tools'
    | 'materials'
    | 'contractors'
    | 'connections'
    | null
  >(null);
  const [editingFact, setEditingFact] = useState<Fact | undefined>();
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [workOpen, setWorkOpen] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);
  const [startPrompt, setStartPrompt] = useState('');
  useEffect(() => {
    // A landing-page brief is a draft for a new project, never a write to the active home.
    try {
      const brief = sessionStorage.getItem('renovagent.project-brief');
      if (brief) {
        sessionStorage.removeItem('renovagent.project-brief');
        setStartPrompt(brief.slice(0, 300));
        setModal('new');
      }
    } catch {
      // The normal workspace remains usable when session storage is unavailable.
    }
  }, []);

  const inventoryOverview = Boolean(
    project &&
      view.surface === 'overview' &&
      view.stage === 'brief' &&
      homeInventory(state, active),
  );
  const homePlanning =
    inventoryOverview ||
    Boolean(
      project &&
        view.surface === 'overview' &&
        ['brief', 'options', 'plan'].includes(view.stage) &&
        scopePlanningCoverage(state, active).supported,
    );
  const [localError, setLocalError] = useState('');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'error') {
      params.delete('auth');
      const query = params.size ? `?${params}` : '';
      window.history.replaceState(null, '', `${window.location.pathname}${query}`);
      setLocalError('Google sign-in failed. Check the server configuration and try again.');
    }
  }, []);
  const [importPreview, setImportPreview] = useState<LegacyImportPreview | null>(null);
  const facts = project ? projectFacts(state, active) : [];
  const runs = project ? projectRuns(state, active) : [];
  const artifactGroups = Object.values(state.artifacts).filter((v) => v[0].projectId === active);
  const selected = view.artifactRef
    ? state.artifacts[view.artifactRef.id]?.find((a) => a.revision === view.artifactRef!.revision)
    : undefined;
  const messages = state.messages.filter((m) => m.projectId === active);
  const workPane = useRef<HTMLElement>(null);
  useEffect(() => {
    if (workPane.current) workPane.current.scrollTop = 0;
  }, [
    active,
    view.surface,
    view.stage,
    view.artifactRef?.id,
    view.artifactRef?.revision,
    workOpen,
  ]);
  const logEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setWorkOpen(false);
    setShowRecent(false);
    setShowQuestions(false);
  }, [active]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const log = logEnd.current?.parentElement;
      if (log) log.scrollTop = log.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [messages.length, active, view.tab]);
  useEffect(() => {
    const refresh = () => void controller.refresh().catch(() => {});
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [controller]);
  const safe = (promise: Promise<unknown>) =>
    void promise.catch((e) => setLocalError(e instanceof Error ? e.message : String(e)));
  const openFacts = (fact?: Fact) => {
    setEditingFact(fact);
    setModal('facts');
  };
  function openWork(patch: Parameters<WorkspaceController['setView']>[1] = {}) {
    setModal(null);
    safe(controller.setView(active, { tab: 'work', ...patch }).then(() => setWorkOpen(true)));
  }
  const openArtifact = (artifact: Artifact) =>
    openWork({
      surface: 'artifact',
      artifactRef: { kind: 'artifact', id: artifact.id, revision: artifact.revision },
      tab: 'work',
    });
  const openImport = () => {
    setLocalError('');
    try {
      setImportPreview(previewLegacyImport(localStorage.getItem(LEGACY_STORAGE_KEY)));
      setModal('import');
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e));
    }
  };
  function projectButtons() {
    return (
      <div className="project-buttons">
        {Object.values(state.projects).map((p) => (
          <button
            key={p.id}
            className={`project-button ${active === p.id ? 'selected' : ''}`}
            aria-current={active === p.id ? 'page' : undefined}
            onClick={() => {
              safe(controller.setView(p.id));
              setModal(null);
            }}
          >
            <Glyph name="home" />
            <span>
              {p.name}
              <small>{state.properties[p.propertyId].name}</small>
            </span>
            {p.id === active && <span className="selected-dot" />}
          </button>
        ))}
      </div>
    );
  }
  const currentSource = sourceId ? state.evidence[sourceId] : undefined;
  function renderMessages(items: typeof messages) {
    return (
      <div className="prompt-messages">
        {' '}
        {items.map((m) => (
          <article className={`conversation-message ${m.role}`} key={m.id}>
            <div className="message-label">
              {m.mode === 'simulated'
                ? 'Dwang · simulated'
                : m.mode === 'system'
                  ? 'Project record'
                  : m.text.startsWith('[Example')
                    ? 'Example input'
                    : 'You'}
            </div>
            <p>{m.text}</p>
            {m.evidenceIds.map((id) => (
              <Media key={id} controller={controller} state={state} evidenceId={id} />
            ))}
            {m.artifactRefs.map((ref) => (
              <button
                key={`${ref.id}:${ref.revision}`}
                className="message-artifact"
                onClick={() =>
                  openWork({
                    surface: 'artifact',
                    artifactRef: ref,
                    tab: 'work',
                  })
                }
              >
                <Glyph name="file" />
                <span>
                  {m.mode === 'system'
                    ? artifactTitle(
                        state.artifacts[ref.id].find((a) => a.revision === ref.revision)!,
                      )
                    : 'Open saved output'}{' '}
                  <small>Revision {ref.revision} · exact historical version</small>
                </span>
                <Glyph name="right" />
              </button>
            ))}
          </article>
        ))}
      </div>
    );
  }
  function openPlan() {
    const priority = ['conversation-plan', 'project-work-plan', 'project-options', 'project-brief'];
    const candidates = artifactGroups.map((versions) => latest(versions)!);
    const artifact = priority.flatMap((kind) =>
      candidates.filter((a) => a.payload.kind === kind),
    )[0];
    if (artifact) openArtifact(artifact);
    else openWork({ stage: 'plan', surface: 'overview' });
  }
  const workTitle =
    view.surface === 'artifact' && selected
      ? artifactTitle(selected)
      : view.surface === 'sources'
        ? 'Facts & sources'
        : view.surface === 'activity'
          ? 'Activity'
          : inventoryOverview
            ? 'Your house'
            : stageCopy[view.stage].label;
  return (
    <div className="prompt-workspace">
      <header className="prompt-header">
        <button
          className="prompt-brand"
          onClick={() => {
            setWorkOpen(false);
            setShowRecent(false);
          }}
          aria-label="Renovagent home"
        >
          <span className="prompt-brand-symbol">
            <Glyph name="home" />
          </span>
          <span>
            renovagent<span className="brand-period">.</span>
          </span>
        </button>
        <button
          className="prompt-project-picker"
          aria-label={project ? `Switch project: ${project.name}` : 'Choose a home'}
          onClick={() => setModal('projects')}
        >
          <span>
            {project ? state.properties[project.propertyId].name.split(',')[0] : 'Choose a home'}
          </span>
          <Glyph name="chevron" />
        </button>
        {controller.connected && auth.email && (
          <span className="prompt-account">
            {auth.email}
            <button
              className="link-button subtle"
              onClick={async () => {
                await signOutAccount().catch(() => {});
                clearStoredMode();
                window.location.reload();
              }}
            >
              Sign out
            </button>
          </span>
        )}
      </header>
      {auth.required && (
        <div className="error-banner" role="alert">
          <span>{error || 'Sign in to reconnect your shared workspace.'}</span>
          {(auth.providers.length ? auth.providers : ['google']).map((provider) => (
            <a key={provider} className="link-button" href={signInUrlFor(provider)}>
              Sign in with {provider === 'meta' ? 'Meta' : 'Google'}
            </a>
          ))}
          <button onClick={() => controller.clearError()}>Dismiss</button>
        </div>
      )}
      {(error || localError) && (
        <div className="error-banner" role="alert">
          <span>{error || localError}</span>
          <button
            onClick={() => {
              controller.clearError();
              setLocalError('');
            }}
          >
            Dismiss
          </button>
          <button onClick={() => safe(controller.refresh())}>Reload records</button>
        </div>
      )}
      <main className={`prompt-main ${showRecent ? 'has-conversation' : ''}`}>
        <div className="prompt-intro">
          <h1>What would you like to improve?</h1>
        </div>
        {project && showRecent && (
          <section className="prompt-recent" aria-label="Recent conversation" aria-live="polite">
            <div className="prompt-section-label">
              <span>Saved to this project</span>
              <button onClick={() => setModal('history')}>
                View history <Glyph name="history" />
              </button>
            </div>
            {renderMessages(messages.slice(-3))}
            <div ref={logEnd} />
          </section>
        )}
        {project ? (
          <Composer
            key={active}
            controller={controller}
            state={state}
            projectId={active}
            busy={busy}
            compact
            showQuestions={showQuestions}
            onOpenTools={() => setModal('tools')}
            onSent={() => setShowRecent(true)}
          />
        ) : (
          <form
            className="prompt-start"
            onSubmit={(e) => {
              e.preventDefault();
              setModal('new');
            }}
          >
            <label className="sr-only" htmlFor="start-prompt">
              What would you like to improve?
            </label>
            <textarea
              id="start-prompt"
              maxLength={300}
              value={startPrompt}
              onChange={(e) => setStartPrompt(e.target.value)}
              placeholder="I’m thinking about updating my kitchen…"
            />
            <div>
              <span>Give your idea a place to grow</span>
              <button className="send" aria-label="Start a project">
                <Glyph name="arrow" />
              </button>
            </div>
          </form>
        )}
        {!project && (
          <button
            className="prompt-example"
            disabled={busy}
            onClick={() => safe(controller.sampleProject())}
          >
            {busy ? 'Opening example…' : 'Or explore a clearly labeled example'}{' '}
            <Glyph name="right" />
          </button>
        )}
        {project && (
          <p className="prompt-disclosure">Saved project notes · Live chat not connected</p>
        )}
      </main>
      {workOpen && project && (
        <Modal className="work-dialog" title={workTitle} onClose={() => setWorkOpen(false)}>
          <main className="work-pane" ref={workPane}>
            {view.surface === 'artifact' && selected ? (
              <ArtifactPanel
                selected={selected}
                state={state}
                controller={controller}
                busy={busy}
                onSource={setSourceId}
              />
            ) : view.surface === 'sources' ? (
              <SourcesPanel
                state={state}
                controller={controller}
                projectId={active}
                onEdit={openFacts}
                onSource={setSourceId}
              />
            ) : view.surface === 'activity' ? (
              <>
                <div className="surface-heading">
                  <p className="eyebrow">PERSISTED WORK, NOT A LOADING ANIMATION</p>
                  <h1>Activity & checkpoints</h1>
                  <p>
                    Advance a local fixture, pause for a clarification, retry a failure, or cancel.
                    Checkpoints and outputs survive refresh.
                  </p>
                </div>
                {runs.map((run) => (
                  <RunCard key={run.id} run={run} controller={controller} busy={busy} />
                ))}
                {!runs.length && (
                  <p className="empty-copy">
                    No simulations yet. Choose a stage of the project to request one.
                  </p>
                )}
                <h2 className="section-heading">Your decisions</h2>
                <div className="decision-history">
                  {Object.values(state.decisions)
                    .filter((d) => d.projectId === active)
                    .reverse()
                    .map((d) => (
                      <section key={d.id}>
                        <span className="eyebrow">
                          {d.outcome === 'accepted' ? 'ACCEPTED BY YOU' : 'DECLINED BY YOU'}
                        </span>
                        <p>
                          {d.outcome === 'accepted'
                            ? 'Direction accepted for the project record.'
                            : 'Proposal declined; its history is retained.'}
                        </p>
                        {d.artifactRefs.map((ref) => (
                          <button
                            key={ref.id}
                            className="link-button"
                            onClick={() =>
                              safe(
                                controller.setView(active, {
                                  surface: 'artifact',
                                  artifactRef: ref,
                                  tab: 'work',
                                }),
                              )
                            }
                          >
                            Inspect decision artifact · revision {ref.revision} →
                          </button>
                        ))}
                      </section>
                    ))}
                </div>
                <h2 className="section-heading">Project audit trail</h2>
                <ol className="audit-list">
                  {state.events
                    .filter((e) => e.projectId === active)
                    .slice()
                    .reverse()
                    .slice(0, 35)
                    .map((e) => (
                      <li key={e.id}>
                        <strong>{e.type.replace(/([a-z])([A-Z])/g, '$1 $2')}</strong>
                        <span>
                          Project revision {e.projectRevision} ·{' '}
                          {new Date(e.at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </li>
                    ))}
                </ol>
              </>
            ) : inventoryOverview ? (
              <InventoryWorkbench
                key={`${active}:${homeInventory(state, active)?.revision}`}
                state={state}
                projectId={active}
                controller={controller}
                busy={busy}
                onArtifact={openArtifact}
              />
            ) : homePlanning ? (
              <HomePlan
                key={active}
                state={state}
                projectId={active}
                controller={controller}
                busy={busy}
                onArtifact={openArtifact}
              />
            ) : view.stage === 'brief' ? (
              <PropertyIntake
                key={active}
                state={state}
                projectId={active}
                controller={controller}
                busy={busy}
                onArtifact={openArtifact}
              />
            ) : (
              <>
                <div className="surface-heading">
                  <div className="stage-number">
                    0{stages.indexOf(view.stage) + 1} / THE PROJECT JOURNEY
                  </div>
                  <h1>{stageCopy[view.stage].label}</h1>
                  <p>{stageCopy[view.stage].description}</p>
                </div>
                {view.stage === 'technical' && photoQuestions(state, active).length > 0 && (
                  <CandidateMeasurementsPanel
                    key={active}
                    state={state}
                    projectId={active}
                    controller={controller}
                    busy={busy}
                  />
                )}
                {view.stage === 'technical' && (
                  <PlanningPanel
                    key={active}
                    state={state}
                    projectId={active}
                    controller={controller}
                    busy={busy}
                  />
                )}
                {['options', 'plan'].includes(view.stage) &&
                  photoQuestions(state, active).length > 0 && (
                    <ScopePlannerEntry
                      state={state}
                      projectId={active}
                      controller={controller}
                      busy={busy}
                    />
                  )}
                {view.stage !== 'technical' &&
                  !(
                    ['options', 'plan'].includes(view.stage) &&
                    photoQuestions(state, active).length > 0
                  ) && (
                    <section className="next-work">
                      <div className="next-work-icon">
                        <Glyph name="activity" />
                      </div>
                      <div>
                        <span className="eyebrow">A BOUNDED NEXT PIECE OF WORK</span>
                        <h2>{workLabels[view.stage]}</h2>
                        <p>
                          {view.stage === 'options'
                            ? 'Explore two approaches, identify tradeoffs, and expose what still needs investigation.'
                            : 'Build an inspectable working artifact from the details recorded so far.'}
                        </p>
                        <button
                          className="primary"
                          disabled={
                            busy ||
                            runs.some(
                              (r) =>
                                r.kind === view.stage &&
                                !['succeeded', 'failed', 'cancelled'].includes(r.state),
                            )
                          }
                          onClick={() => safe(controller.requestWork(active, view.stage))}
                        >
                          Start simulated work <Glyph name="right" />
                        </button>
                        <span className="small-note">
                          Local fixture · no AI, web research, or external action
                        </span>
                      </div>
                    </section>
                  )}
                {runs
                  .filter(
                    (r) => r.kind === view.stage && !['succeeded', 'cancelled'].includes(r.state),
                  )
                  .map((r) => (
                    <RunCard key={r.id} run={r} controller={controller} busy={busy} />
                  ))}
                <div className="section-heading-row">
                  <h2 className="section-heading">
                    Project artifacts <span>{artifactGroups.length}</span>
                  </h2>
                  <button
                    className="text-button"
                    onClick={() => safe(controller.setView(active, { surface: 'sources' }))}
                  >
                    Inspect facts & sources →
                  </button>
                </div>
                <div className="artifact-library">
                  {artifactGroups.map((versions) => {
                    const a = latest(versions)!;
                    return (
                      <button className="artifact-tile" key={a.id} onClick={() => openArtifact(a)}>
                        <span className="artifact-tile-icon">
                          <Glyph name="file" />
                        </span>
                        <div>
                          <strong>{artifactTitle(a)}</strong>
                          <span>
                            r{a.revision} ·{' '}
                            {a.freshness === 'stale'
                              ? 'Inputs changed'
                              : a.lifecycle === 'accepted'
                                ? 'Accepted'
                                : a.lifecycle === 'rejected'
                                  ? 'Declined'
                                  : 'Decision needed'}
                          </span>
                        </div>
                        <Glyph name="right" />
                      </button>
                    );
                  })}
                  {!artifactGroups.length && (
                    <div className="empty-artifacts">
                      <Glyph name="file" />
                      <p>
                        The work will land here.
                        <span>Start a simulation to create your first versioned artifact.</span>
                      </p>
                    </div>
                  )}
                </div>
                <section className="workspace-facts-preview">
                  <div>
                    <p className="eyebrow">THE PROJECT’S STARTING POINT</p>
                    <h2>A record that grows with the job.</h2>
                  </div>
                  <button className="secondary" onClick={() => openFacts()}>
                    Add a detail
                  </button>
                  {facts.slice(0, 3).map((f) => (
                    <p key={f.id}>
                      <span>{f.key}</span>
                      {factText(f)}
                    </p>
                  ))}
                </section>
              </>
            )}
          </main>
        </Modal>
      )}
      {modal === 'history' && (
        <Modal title="Conversation history" onClose={() => setModal(null)}>
          {messages.length ? (
            renderMessages(messages)
          ) : (
            <p>No messages yet. Your conversation will stay with this project.</p>
          )}
        </Modal>
      )}
      {modal === 'tools' && (
        <Modal title="Your workspace" onClose={() => setModal(null)}>
          <div className="prompt-menu">
            <button disabled={!project} onClick={() => setModal('history')}>
              <Glyph name="history" />
              <span>
                Conversation history<small>Saved messages and linked outputs</small>
              </span>
              <Glyph name="right" />
            </button>

            <button
              disabled={!project}
              onClick={() => openWork({ stage: 'brief', surface: 'overview' })}
            >
              <Glyph name="home" />
              <span>
                Your house<small>Photos, rooms and observations</small>
              </span>
              <Glyph name="right" />
            </button>
            <button disabled={!project} onClick={openPlan}>
              <Glyph name="plan" />
              <span>
                The plan<small>The current saved scope and its evidence</small>
              </span>
              <Glyph name="right" />
            </button>
            <button disabled={!project} onClick={() => setModal('materials')}>
              <Glyph name="materials" />
              <span>
                Materials<small>Requirements and sourcing</small>
              </span>
              <Glyph name="right" />
            </button>
            <button disabled={!project} onClick={() => setModal('contractors')}>
              <Glyph name="people" />
              <span>
                Contractors<small>Scope and quote preparation</small>
              </span>
              <Glyph name="right" />
            </button>
            <button
              disabled={!project}
              onClick={() => {
                setShowQuestions(!showQuestions);
                setModal(null);
              }}
            >
              <Glyph name="chat" />
              <span>
                {showQuestions ? 'Hide photo questions' : 'Questions from photos'}
                <small>Review what still needs your direction</small>
              </span>
              <Glyph name="right" />
            </button>

            <button onClick={() => setModal('projects')}>
              <Glyph name="home" />
              <span>
                Homes & projects<small>Switch context or start something new</small>
              </span>
              <Glyph name="right" />
            </button>
            <button disabled={!project} onClick={() => setModal('archive')}>
              <Glyph name="file" />
              <span>
                Saved work<small>Plans, decisions and earlier versions</small>
              </span>
              <Glyph name="right" />
            </button>
            <button disabled={!project} onClick={() => openWork({ surface: 'sources' })}>
              <Glyph name="source" />
              <span>
                Facts & sources<small>Photos, measurements and supporting evidence</small>
              </span>
              <Glyph name="right" />
            </button>
            <button disabled={!project} onClick={() => openWork({ surface: 'activity' })}>
              <Glyph name="activity" />
              <span>
                Activity<small>Work requests and project history</small>
              </span>
              <Glyph name="right" />
            </button>
            <button onClick={() => setModal('connections')}>
              <Glyph name="connection" />
              <span>
                Muse & connections<small>Your project beyond this window</small>
              </span>
              <Glyph name="right" />
            </button>
          </div>
          {project && (
            <label className="prompt-stage-label">
              Open a project stage
              <select
                aria-label="Project stage"
                value={view.stage}
                onChange={(e) =>
                  openWork({ stage: e.target.value as WorkKind, surface: 'overview' })
                }
              >
                {stages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stageCopy[stage].label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="prompt-menu-footer">
            <button onClick={() => setModal('about')}>About this workspace</button>
            <button onClick={openImport}>Import previous preview</button>
          </div>
        </Modal>
      )}
      {modal === 'materials' && (
        <Modal title="Materials" onClose={() => setModal(null)}>
          {controller.connected && project ? (
            <PurchasePlans controller={controller} projectId={project.id} />
          ) : (
            <div className="prompt-empty">
              <span className="prompt-empty-icon">
                <Glyph name="materials" />
              </span>
              <h3>A shopping list with a reason behind every item.</h3>
              <p>
                {project
                  ? 'Connect the workspace to compare catalog offers and build tiered purchase plans.'
                  : 'Choose a home first, then compare catalog offers and build tiered purchase plans.'}
              </p>
              <button className="primary" onClick={openPlan}>
                Review the current plan <Glyph name="right" />
              </button>
            </div>
          )}
        </Modal>
      )}
      {modal === 'contractors' && (
        <Modal title="Contractors" onClose={() => setModal(null)}>
          <div className="prompt-empty">
            <span className="prompt-empty-icon">
              <Glyph name="people" />
            </span>
            <h3>Good help starts with a clear scope.</h3>
            <p>
              Review what needs doing before requesting quotes. Local contractor search, credential
              checks and outreach aren’t connected yet. Tiered purchase plans can already be
              accepted or declined from Materials.
            </p>
            <button className="primary" onClick={openPlan}>
              Review the current scope <Glyph name="right" />
            </button>
          </div>
        </Modal>
      )}
      {modal === 'connections' && (
        <Modal title="Use your project in Muse" onClose={() => setModal(null)}>
          <div className="prompt-empty">
            <span className="prompt-empty-icon">
              <Glyph name="connection" />
            </span>
            <h3>Your agent. The same project.</h3>
            <p>
              The web workspace and a standard Muse agent should share the same saved facts, plans
              and tools through MCP.
            </p>
            <p>
              {controller.connected
                ? 'Muse photo analysis is connected in this local workspace.'
                : 'Connect through Your house to enable local Muse photo analysis.'}{' '}
              General Muse agent access to this workspace is a separate integration and is not
              enabled by this screen.
            </p>
            <button
              className="secondary"
              disabled={!project}
              onClick={() => openWork({ stage: 'brief', surface: 'overview' })}
            >
              Open house & photo tools <Glyph name="right" />
            </button>
          </div>
        </Modal>
      )}
      {modal === 'archive' && (
        <Modal title="Project record" onClose={() => setModal(null)}>
          <p>
            Sources, decisions and earlier work stay inspectable. These records are not a list of
            tasks to approve.
          </p>
          <div className="hp-archive-list">
            {artifactGroups.map((versions) => {
              const a = latest(versions)!;
              return (
                <button
                  key={a.id}
                  onClick={() => {
                    openArtifact(a);
                    setModal(null);
                  }}
                >
                  <strong>{artifactTitle(a)}</strong>
                  <small>
                    Revision {a.revision} ·{' '}
                    {a.freshness === 'stale'
                      ? 'Inputs changed — historical basis'
                      : a.lifecycle === 'accepted'
                        ? 'Accepted record'
                        : 'Saved record'}
                  </small>
                </button>
              );
            })}
          </div>
        </Modal>
      )}
      {modal === 'new' && (
        <Modal title="Start with your place" onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              safe(
                controller
                  .createProject({
                    name: String(data.get('name')),
                    goal: String(data.get('goal')),
                    propertyId: String(data.get('propertyId')) || undefined,
                    propertyName:
                      String(data.get('propertyName')) ||
                      String(data.get('address')) ||
                      'My property',
                    address: String(data.get('address')),
                    underway: data.get('underway') === 'on',
                  })
                  .then(() => {
                    setModal(null);
                    setStartPrompt('');
                  }),
              );
            }}
          >
            <label>
              Property address
              <input
                name="address"
                maxLength={300}
                placeholder="Street address, city, state (or add later)"
                autoFocus
              />
            </label>
            <label>
              Project name
              <input name="name" required maxLength={300} placeholder="Kitchen renovation" />
            </label>
            <label>
              What do you have in mind?
              <textarea
                name="goal"
                defaultValue={startPrompt}
                required
                maxLength={300}
                placeholder="The work you want to do, and what matters to you."
              />
            </label>
            <details>
              <summary>Use an existing property</summary>
              <label>
                Property
                <select name="propertyId" aria-label="Property">
                  <option value="">Create a property record</option>
                  {Object.values(state.properties).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                New property name (for a new record)
                <input name="propertyName" maxLength={300} placeholder="My home" />
              </label>
            </details>
            <label className="checkbox-label">
              <input type="checkbox" name="underway" />
              Work is already underway
            </label>
            <p className="small-note">
              Nothing is assumed about the building, costs, permits, or completed work.
            </p>
            <div className="dialog-actions">
              <button type="button" className="secondary" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                Create project
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === 'facts' && project && (
        <Modal
          error={error || localError}
          title={editingFact ? 'Correct a project detail' : 'Record a project detail'}
          onClose={() => setModal(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget),
                key = String(data.get('key'));
              safe(
                controller
                  .recordFact(active, {
                    key,
                    text: String(data.get('value')),
                    fact: editingFact || facts.find((f) => f.key === key),
                  })
                  .then(() => setModal(null)),
              );
            }}
          >
            <label>
              Detail
              {editingFact ? (
                <input name="key" readOnly value={editingFact.key} />
              ) : (
                <select name="key" aria-label="Detail">
                  {[
                    'location',
                    'buildingUse',
                    'dimensions',
                    'priorities',
                    'budget',
                    'existingConditions',
                    'siteNote',
                  ].map((key) => (
                    <option value={key} key={key}>
                      {key}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label>
              {editingFact?.value.kind === 'quantity'
                ? `Value (${editingFact.originalValue.kind === 'quantity' ? editingFact.originalValue.unit : ''})`
                : 'What you know'}
              <textarea
                name="value"
                defaultValue={
                  editingFact
                    ? editingFact.originalValue.kind === 'quantity'
                      ? String(editingFact.originalValue.amount)
                      : factText(editingFact)
                    : ''
                }
                required
                maxLength={3000}
                autoFocus
              />
            </label>
            <p className="small-note">
              Saved as your unverified observation. Corrections preserve prior revisions and make
              dependent artifacts stale.
            </p>
            <div className="dialog-actions">
              <button type="button" className="secondary" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                Save observation
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === 'projects' && (
        <Modal title="Homes & projects" onClose={() => setModal(null)}>
          {projectButtons()}
          <button className="primary prompt-new-project" onClick={() => setModal('new')}>
            <Glyph name="plus" />
            New project
          </button>
        </Modal>
      )}
      {modal === 'import' && importPreview && (
        <Modal title="Import your previous project" onClose={() => setModal(null)}>
          <p>
            {importPreview.facts.length} reported details · {importPreview.photoCount} photos ·{' '}
            {importPreview.messageCount} messages retained in the source archive.
          </p>
          <ul className="import-warnings">
            {importPreview.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                safe(controller.importLegacy(importPreview).then(() => setModal(null)))
              }
            >
              Import a separate project
            </button>
          </div>
        </Modal>
      )}
      {modal === 'about' && (
        <Modal title="A workspace for the whole job" onClose={() => setModal(null)}>
          <div className="about-copy">
            <p>
              Conversation directs the work. The project record holds the facts, evidence, options,
              decisions, and outputs that build toward a finished job.
            </p>
            <ol>
              <li>Understand the property and explore alternatives.</li>
              <li>Resolve technical questions, then prepare scope and dependencies.</li>
              <li>Coordinate resources, guide execution, and keep the handover record.</li>
            </ol>
            <div className="simulation-explainer">
              <strong>What is real here</strong>
              <p>
                {controller.connected
                  ? 'Mongo persistence and real Muse photo analysis through the local backend, alongside'
                  : 'Local persistence alongside'}{' '}
                source files, project switching, revision history, decisions, stale-output detection
                and workflow checkpoints.
              </p>
              <strong>What is simulated</strong>
              <p>
                The general agent conversation and workflow demonstrations still use labeled
                fixtures. Muse photo observations and planning questions are real model proposals.
                Technical review, live pricing, professional approval and physical-work release
                remain unavailable.
              </p>
            </div>
            <a href="./legacy.html">Open the earlier preview</a>
          </div>
        </Modal>
      )}
      {currentSource && (
        <Modal title="Source evidence" onClose={() => setSourceId(null)}>
          <span className="status muted-status">{currentSource.source.kind}</span>
          <p className="source-description">{currentSource.source.description}</p>
          <Media controller={controller} state={state} evidenceId={currentSource.id} />
          <dl className="source-metadata">
            <dt>Recorded</dt>
            <dd>{new Date(currentSource.recordedAt).toLocaleString()}</dd>
            <dt>Scope</dt>
            <dd>{currentSource.projectId ? 'This project' : 'Shared property evidence'}</dd>
            <dt>Evidence ID</dt>
            <dd>{currentSource.id}</dd>
            {currentSource.source.attachment && (
              <>
                <dt>Content hash</dt>
                <dd>{currentSource.source.attachment.sha256}</dd>
              </>
            )}
          </dl>
        </Modal>
      )}
    </div>
  );
}
