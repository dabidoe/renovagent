import { InventoryWorkbench } from '../features/work/inventory-workbench.js';
import { homeInventory } from '@unpermitted/core';
import { HomePlan } from '../features/work/home-plan.js';
import { scopePlanningCoverage } from '@unpermitted/core';
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
import { type Artifact, type Fact, type WorkKind } from '@unpermitted/contracts';
import { latest, workLabels, photoQuestions } from '@unpermitted/core';
import {
  WorkspaceController,
  defaultView,
  projectFacts,
  projectRuns,
} from './workspace-controller.js';
import { artifactTitle } from '../features/work/artifact-view.js';
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
  } = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const active = state.activeProjectId || Object.keys(state.projects)[0] || '';
  const project = state.projects[active];
  const view = state.views[active] || defaultView;
  const [modal, setModal] = useState<
    'new' | 'import' | 'facts' | 'about' | 'projects' | 'archive' | null
  >(null);
  const [editingFact, setEditingFact] = useState<Fact | undefined>();
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [split, setSplit] = useState(32);
  const [notesOpen, setNotesOpen] = useState(false);
  const inventoryOverview = Boolean(
    project &&
      view.surface === 'overview' &&
      ['brief', 'options', 'plan'].includes(view.stage) &&
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
  const [importPreview, setImportPreview] = useState<LegacyImportPreview | null>(null);
  const facts = project ? projectFacts(state, active) : [];
  const runs = project ? projectRuns(state, active) : [];
  const artifactGroups = Object.values(state.artifacts).filter((v) => v[0].projectId === active);
  const selected = view.artifactRef
    ? state.artifacts[view.artifactRef.id]?.find((a) => a.revision === view.artifactRef!.revision)
    : undefined;
  const messages = state.messages.filter((m) => m.projectId === active);
  const attachments = Object.values(state.evidence).filter(
    (e) => e.projectId === active && e.source.attachment,
  );
  const workPane = useRef<HTMLElement>(null);
  useEffect(() => {
    if (workPane.current) workPane.current.scrollTop = 0;
  }, [active, view.surface, view.stage, view.artifactRef?.id, view.artifactRef?.revision]);
  const logEnd = useRef<HTMLDivElement>(null);
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
  const openArtifact = (artifact: Artifact) =>
    safe(
      controller.setView(active, {
        surface: 'artifact',
        artifactRef: { kind: 'artifact', id: artifact.id, revision: artifact.revision },
        tab: 'work',
      }),
    );
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
  function navigation() {
    return (
      <>
        <div className="brand">
          unpermitted<span>.</span>
          <small>ai</small>
        </div>
        <button className="new-project-button" onClick={() => setModal('new')}>
          <Glyph name="plus" />
          New project
        </button>
        <p className="nav-caption">{homePlanning ? 'YOUR HOME' : 'YOUR PROJECTS'}</p>
        {homePlanning ? (
          <>
            <div className="hp-sidebar-property">{state.properties[project.propertyId].name}</div>
            <button className="hp-switch-project" onClick={() => setModal('projects')}>
              Switch project ↗
            </button>
          </>
        ) : (
          projectButtons()
        )}
        {project && (
          <>
            <p className="nav-caption lifecycle-caption">THE PROJECT JOURNEY</p>
            <nav className="lifecycle-nav" aria-label="Project lifecycle">
              {stages.slice(0, 3).map((stage, i) => {
                const run = runs.find((r) => r.kind === stage);
                return (
                  <button
                    key={stage}
                    className={view.stage === stage ? 'current' : ''}
                    aria-current={view.stage === stage ? 'step' : undefined}
                    onClick={() =>
                      safe(controller.setView(active, { stage, surface: 'overview', tab: 'work' }))
                    }
                  >
                    <span className="stage-index">{String(i + 1).padStart(2, '0')}</span>
                    <span>
                      {
                        [
                          'Your place',
                          'The plan',
                          'Technical checks',
                          'Prepare the job',
                          'Coordinate',
                          'Guide execution',
                          'Handover',
                        ][i]
                      }
                    </span>
                    {run && (
                      <span
                        className={`stage-state ${run.state === 'succeeded' ? 'reviewed' : 'has-work'}`}
                      />
                    )}
                  </button>
                );
              })}
            </nav>
            <details className="later-stages">
              <summary>Prepare, build & hand over</summary>
              {stages.slice(3).map((stage) => (
                <button
                  key={stage}
                  onClick={() =>
                    safe(controller.setView(active, { stage, surface: 'overview', tab: 'work' }))
                  }
                >
                  {stageCopy[stage].label}
                </button>
              ))}
            </details>
            <div className="library-nav">
              <button onClick={() => setModal('archive')}>
                <Glyph name="file" />
                Artifacts<span>{artifactGroups.length}</span>
              </button>
              <button
                onClick={() =>
                  safe(controller.setView(active, { surface: 'sources', tab: 'work' }))
                }
              >
                <Glyph name="source" />
                Facts & sources<span>{facts.length + attachments.length}</span>
              </button>
              <button
                onClick={() =>
                  safe(controller.setView(active, { surface: 'activity', tab: 'work' }))
                }
              >
                <Glyph name="activity" />
                Activity<span>{runs.length}</span>
              </button>
            </div>
          </>
        )}
        <footer className="nav-footer">
          <span>
            <i />
            Saved on this device
          </span>
          <button className="link-button subtle" onClick={openImport}>
            Import previous preview
          </button>
          <button className="link-button subtle" onClick={() => setModal('about')}>
            About this workspace
          </button>
        </footer>
      </>
    );
  }
  const currentSource = sourceId ? state.evidence[sourceId] : undefined;
  return (
    <div
      className={`project-workspace ${homePlanning ? 'home-planning-shell' : ''}`}
      style={{ '--conversation-share': `${split}%` } as React.CSSProperties}
    >
      <aside className="workspace-sidebar">{navigation()}</aside>
      <div className="workspace-main">
        <header className="project-header">
          <div className="project-context">
            <button
              className="icon-btn mobile-only"
              aria-label="Open projects"
              onClick={() => setModal('projects')}
            >
              <Glyph name="menu" />
            </button>
            <Glyph name="home" />
            <div>
              <span>
                {project
                  ? state.properties[project.propertyId].name
                  : 'YOUR HOME, YOUR NEXT CHAPTER'}
              </span>
              <strong>{project?.name || 'A home improvement workspace'}</strong>
            </div>
          </div>
          <div className="header-tools">
            <span className="simulation-badge">
              <i />
              {homePlanning ? 'Local workspace · backend off' : 'Local planning · agents simulated'}
            </span>
            <button className="text-button" onClick={() => setModal('about')}>
              How it works
            </button>
          </div>
        </header>
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
        {!project ? (
          <main className="workspace-welcome">
            <div className="welcome-eyebrow">
              <Glyph name="home" />A WORKSPACE FOR THE WHOLE JOB
            </div>
            <h1>
              From “what if”
              <br />
              to <em>work well done.</em>
            </h1>
            <p>
              Investigate the space. Compare the options. Resolve the details.
              <br />
              Keep the plan, the work, and the conversation together.
            </p>
            <div className="welcome-actions">
              <button className="primary" onClick={() => setModal('new')}>
                Start your project <Glyph name="right" />
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => safe(controller.sampleProject())}
              >
                {busy ? 'Preparing the example…' : 'Explore a simulated project'}
              </button>
            </div>
            <div className="journey-preview">
              {[
                'Understand the property',
                'Explore & resolve',
                'Prepare & coordinate',
                'Build & hand over',
              ].map((text, i) => (
                <div key={text}>
                  <span>0{i + 1}</span>
                  <strong>{text}</strong>
                </div>
              ))}
            </div>
            <p className="welcome-disclosure">
              Local prototype · simulated workflow, real persistence.
              <br />
              No model, backend, code verification, or photo analysis connected.
            </p>
            <button className="link-button" onClick={openImport}>
              Bring in your previous preview project →
            </button>
          </main>
        ) : (
          <>
            <div className="mobile-switch" role="group" aria-label="Workspace view">
              <button
                aria-pressed={view.tab === 'work'}
                onClick={() => safe(controller.setView(active, { tab: 'work' }))}
              >
                <Glyph name="file" />
                The work
              </button>
              <button
                aria-pressed={view.tab === 'conversation'}
                onClick={() => safe(controller.setView(active, { tab: 'conversation' }))}
              >
                <Glyph name="chat" />
                Conversation{runs.some((r) => r.state === 'waiting_for_input') && <i />}
              </button>
            </div>
            <div
              className={`workspace-columns mobile-${view.tab} ${homePlanning ? `home-workspace ${notesOpen ? '' : 'home-wide'}` : ''}`}
            >
              <main className="work-pane" ref={workPane}>
                <div className="work-toolbar">
                  <div className="work-breadcrumb">
                    <span>THE WORK</span>
                    <span>/</span>
                    <strong>
                      {view.surface === 'sources'
                        ? 'Facts & sources'
                        : view.surface === 'activity'
                          ? 'Activity'
                          : stageCopy[view.stage].label}
                    </strong>
                  </div>
                  {homePlanning && (
                    <button
                      className="home-notes-toggle"
                      aria-pressed={notesOpen}
                      onClick={() => setNotesOpen(!notesOpen)}
                    >
                      {notesOpen ? 'Close project notes' : 'Project notes ↗'}
                    </button>
                  )}
                  <label className="layout-control">
                    Split{' '}
                    <input
                      type="range"
                      aria-label="Conversation panel width"
                      min="30"
                      max="48"
                      value={split}
                      onChange={(e) => setSplit(+e.target.value)}
                    />
                  </label>
                </div>
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
                        Advance a local fixture, pause for a clarification, retry a failure, or
                        cancel. Checkpoints and outputs survive refresh.
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
                        (r) =>
                          r.kind === view.stage && !['succeeded', 'cancelled'].includes(r.state),
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
                          <button
                            className="artifact-tile"
                            key={a.id}
                            onClick={() => openArtifact(a)}
                          >
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
              <aside className="conversation-pane" aria-label="Project conversation">
                <header className="conversation-heading">
                  <div className="dwang-avatar">
                    d<span>.</span>
                  </div>
                  <div>
                    <strong>{homePlanning ? 'Project notes' : 'Dwang'}</strong>
                    <span>
                      {homePlanning
                        ? 'Saved context · no live assistant'
                        : 'Your project coordinator'}
                    </span>
                  </div>
                  <span className="simulated-label">Simulated</span>
                </header>
                <div className="conversation-log" aria-live="polite" aria-relevant="additions">
                  <div className="conversation-intro">
                    <p>
                      {homePlanning ? (
                        <>
                          Notes stay
                          <br />
                          <em>with the work.</em>
                        </>
                      ) : (
                        <>
                          One conversation.
                          <br />
                          <em>A whole project behind it.</em>
                        </>
                      )}
                    </p>
                    <span>
                      {homePlanning
                        ? 'Save context and reference files. Focused decisions live beside the proposal; no automated replies run here.'
                        : 'Request work in the project journey. Keep its context and decisions here.'}
                    </span>
                  </div>
                  {messages.map((m) => (
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
                            safe(
                              controller.setView(active, {
                                surface: 'artifact',
                                artifactRef: ref,
                                tab: 'work',
                              }),
                            )
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
                  {runs
                    .filter((r) => !['succeeded', 'cancelled'].includes(r.state))
                    .slice(0, 2)
                    .map((r) => (
                      <RunCard key={r.id} run={r} controller={controller} busy={busy} compact />
                    ))}
                  {!messages.length && (
                    <p className="small-note">
                      Imported conversations remain in the original source archive. New messages are
                      stored here.
                    </p>
                  )}
                  <div ref={logEnd} />
                </div>
                <Composer
                  key={active}
                  controller={controller}
                  state={state}
                  projectId={active}
                  busy={busy}
                  notesOnly={homePlanning}
                />
              </aside>
            </div>
          </>
        )}
      </div>
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
                  .then(() => setModal(null)),
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
        <Modal title="Your projects" onClose={() => setModal(null)}>
          {projectButtons()}
          <button className="primary" onClick={() => setModal('new')}>
            <Glyph name="plus" />
            New project
          </button>
          {project && (
            <div className="mobile-project-tools">
              <button
                className="secondary"
                onClick={() => {
                  safe(controller.setView(active, { surface: 'sources', tab: 'work' }));
                  setModal(null);
                }}
              >
                Facts & sources
              </button>
              <button
                className="secondary"
                onClick={() => {
                  safe(controller.setView(active, { surface: 'activity', tab: 'work' }));
                  setModal(null);
                }}
              >
                Activity
              </button>
              <select
                aria-label="Project stage"
                value={view.stage}
                onChange={(e) => {
                  safe(
                    controller.setView(active, {
                      stage: e.target.value as WorkKind,
                      surface: 'overview',
                      tab: 'work',
                    }),
                  );
                  setModal(null);
                }}
              >
                {stages.map((stage) => (
                  <option value={stage} key={stage}>
                    {stageCopy[stage].label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="mobile-project-tools">
            <button className="link-button" onClick={() => setModal('about')}>
              About this workspace
            </button>
            <button className="link-button" onClick={openImport}>
              Import previous preview
            </button>
          </div>
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
                Local persistence, source files, project switching, revision history, decisions,
                stale-output detection, and workflow checkpoints.
              </p>
              <strong>What is simulated</strong>
              <p>
                All agent replies and produced planning artifacts follow local fixtures. Advance the
                steps explicitly. There is no AI reasoning, image/document analysis, code research,
                live pricing, professional approval, or external action.
              </p>
            </div>
            <a href="/legacy.html">Open the earlier preview</a>
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
