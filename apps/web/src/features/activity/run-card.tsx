import { type Run } from '@renovagent/contracts';
import { workLabels } from '@renovagent/core';
import { WorkspaceController } from '../../app/workspace-controller.js';
import { stateLabel } from '../../app/presentation.js';
import { Glyph } from '../../components/glyph.js';
export function RunCard({
  run,
  controller,
  busy,
  compact = false,
}: {
  run: Run;
  controller: WorkspaceController;
  busy: boolean;
  compact?: boolean;
}) {
  const act = (action: 'advance' | 'retry' | 'cancel' | 'fail') =>
    void controller.transition(run.projectId, run.id, action).catch(() => {});
  return (
    <section className={`run-card ${compact ? 'compact' : ''}`}>
      <div className="run-title">
        <span className="simulation-dot" />
        <strong>{workLabels[run.kind]}</strong>
        <span className={`status run-${run.state}`}>{stateLabel(run.state)}</span>
      </div>
      <p>{run.history.at(-1)?.detail}</p>
      <div className="run-actions">
        {['queued', 'running'].includes(run.state) && (
          <button className="small-primary" disabled={busy} onClick={() => act('advance')}>
            Advance simulation <Glyph name="right" />
          </button>
        )}
        {run.state === 'waiting_for_input' && (
          <button
            className="link-button"
            onClick={() => void controller.setView(run.projectId, { tab: 'conversation' })}
          >
            Reply in conversation →
          </button>
        )}
        {run.state === 'waiting_for_approval' && run.outputRef && (
          <button
            className="link-button"
            onClick={() =>
              void controller.setView(run.projectId, {
                surface: 'artifact',
                artifactRef: run.outputRef,
                tab: 'work',
              })
            }
          >
            Open proposal r{run.outputRef.revision} →
          </button>
        )}
        {run.state === 'failed' && run.attempt < 3 && (
          <button className="small-primary" disabled={busy} onClick={() => act('retry')}>
            Retry simulation
          </button>
        )}
        {!['succeeded', 'cancelled'].includes(run.state) && (
          <button className="link-button subtle" disabled={busy} onClick={() => act('cancel')}>
            Cancel
          </button>
        )}
      </div>
      {!compact && (
        <details>
          <summary>Simulation checkpoints · attempt {run.attempt}</summary>
          <ol>
            {run.history.map((h, i) => (
              <li key={i}>
                <span>{stateLabel(h.state)}</span> {h.detail}
              </li>
            ))}
          </ol>
          {!['succeeded', 'cancelled', 'failed', 'waiting_for_approval'].includes(run.state) && (
            <button className="link-button subtle" disabled={busy} onClick={() => act('fail')}>
              Test a simulated failure
            </button>
          )}
        </details>
      )}
    </section>
  );
}
