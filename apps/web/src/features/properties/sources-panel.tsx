import { type Workspace, type Fact } from '@renovagent/contracts';
import { WorkspaceController, projectFacts } from '../../app/workspace-controller.js';
import { factText } from '../../app/presentation.js';
import { Glyph } from '../../components/glyph.js';
import { Media } from './media.js';
export function SourcesPanel({
  state,
  controller,
  projectId,
  onEdit,
  onSource,
}: {
  state: Workspace;
  controller: WorkspaceController;
  projectId: string;
  onEdit: (fact?: Fact) => void;
  onSource: (id: string) => void;
}) {
  const facts = projectFacts(state, projectId),
    attachments = Object.values(state.evidence).filter(
      (e) => e.projectId === projectId && e.source.attachment,
    );
  const openFacts = onEdit,
    setSourceId = onSource;
  return (
    <>
      <div className="surface-heading">
        <p className="eyebrow">WHAT WE KNOW & HOW WE KNOW IT</p>
        <h1>Facts & sources</h1>
        <p>
          Reported details stay separate from verified conditions. Every correction keeps its
          history and invalidates dependent work.
        </p>
        <button className="primary" onClick={() => openFacts()}>
          <Glyph name="plus" />
          Record a detail
        </button>
      </div>
      <div className="fact-list">
        {facts.map((f) => (
          <section key={f.id}>
            <div>
              <span className="eyebrow">{f.key.replace('legacy.', '')}</span>
              <p>{factText(f)}</p>
              <small>
                {f.assertion === 'assumed' ? 'Example assumption' : 'Reported by you'} · unverified
                · revision {f.revision}
              </small>
            </div>
            <button className="text-button" onClick={() => openFacts(f)}>
              Edit
            </button>
            <details>
              <summary>History & source</summary>
              {state.facts[f.id].map((version) => (
                <div className="fact-history" key={version.revision}>
                  <span>
                    r{version.revision} · {factText(version)}
                  </span>
                  {version.evidenceIds.map((id) => (
                    <button className="link-button" key={id} onClick={() => setSourceId(id)}>
                      Inspect source
                    </button>
                  ))}
                </div>
              ))}
            </details>
          </section>
        ))}
      </div>
      <h2 className="section-heading">
        Photos & documents <span>{attachments.length}</span>
      </h2>
      <p className="small-note">
        Attach files in the conversation. Originals stay on this device and are not analyzed.
      </p>
      {attachments.map((e) => (
        <div className="source-file" key={e.id}>
          <Media controller={controller} state={state} evidenceId={e.id} />
          <button className="link-button" onClick={() => setSourceId(e.id)}>
            Source details →
          </button>
        </div>
      ))}
    </>
  );
}
