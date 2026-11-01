import { useRef, useState, useEffect, type ReactNode } from 'react';
import type { ExampleQuote, RoomAnnotation } from '@renovagent/core';
import { Glyph } from '../../components/glyph.js';
import { FLOOR_OPTIONS, WALL_OPTIONS, type Pick } from './example-photo.js';

const money = (minor: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: minor % 100 ? 2 : 0,
  }).format(minor / 100);

type Chapter = 'design' | 'costs' | 'handoff';
const chapters: { id: Chapter; label: string; icon: string }[] = [
  { id: 'design', label: 'Design', icon: 'paint' },
  { id: 'costs', label: 'Work & costs', icon: 'layers' },
  { id: 'handoff', label: 'Handoff', icon: 'file' },
];

// A presentation of the existing scope engine, not a second planning model.
// Picks stay previews; saving still goes through the studio's validated command.
export function ExampleStudio({
  stage,
  viewControls,
  pick,
  before,
  onPick,
  steps,
  activeId,
  onStep,
  quotes,
  template,
  changed,
  confirmation,
  onReviewDesign,
  onReset,
  onHandoff,
  onDownloadPlan,
  onChangeWork,
  scopeEditor,
  status,
  stale,
  onRefresh,
  agentTools,
}: {
  stage: ReactNode;
  viewControls: ReactNode;
  pick: Pick;
  before: boolean;
  onPick: (pick: Pick) => void;
  steps: RoomAnnotation[];
  activeId: string | null;
  onStep: (id: string | null, mode?: 'diy' | 'pro') => void;
  quotes: ExampleQuote[];
  template: { materialsMinor: number; toolsMinor: number; needsArea: number } | null;
  changed: boolean;
  confirmation: ReactNode;
  onReviewDesign: () => void;
  onReset: () => void;
  onHandoff: () => void;
  onDownloadPlan: () => void;
  onChangeWork: () => void;
  scopeEditor: ReactNode;
  status: string;
  stale: boolean;
  onRefresh: () => void;
  agentTools: ReactNode;
}) {
  const [chapter, setChapter] = useState<Chapter>('design');
  const [costMode, setCostMode] = useState<'diy' | 'pro'>('diy');
  const inspector = useRef<HTMLElement>(null);
  const media = useRef<HTMLDivElement>(null);
  const scrollOnPhone = (element: Element | null) => {
    if (window.matchMedia('(max-width: 800px)').matches)
      element?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
  };
  useEffect(() => {
    if (activeId) scrollOnPhone(media.current?.querySelector('[role="dialog"]') ?? null);
  }, [activeId]);
  const fullQuote = quotes.find((q) => !q.notQuoted.length && !q.needsArea.length);
  const wall = WALL_OPTIONS.find((w) => w.key === pick.wall)!;
  const floor = FLOOR_OPTIONS.find((f) => f.key === pick.floor)!;
  const diy = template ? template.materialsMinor + template.toolsMinor : null;
  const total = costMode === 'pro' ? fullQuote?.totalMinor : diy;
  const changeChapter = (next: Chapter) => {
    onStep(null);
    setChapter(next);
    requestAnimationFrame(() => scrollOnPhone(inspector.current));
  };
  const costSummary = (
    <div className="studio-budget">
      <div>
        <span>DIY materials & tools</span>
        <strong>{diy === null ? '—' : money(diy)}</strong>
      </div>
      <div>
        <span>With installation</span>
        <strong>{fullQuote ? money(fullQuote.totalMinor) : '—'}</strong>
      </div>
      <p>Example allowances · before tax</p>
    </div>
  );
  return (
    <section className="room3d example-studio" aria-label="Example project studio">
      <header className="studio-heading">
        <div>
          <p className="studio-kicker">THE EXAMPLE PROJECT</p>
          <h1>
            Living room,
            <br className="studio-mobile-break" /> reimagined.
          </h1>
        </div>
        <p className="studio-project-meta">
          <Glyph name="home" />
          <span>
            Living room refresh<small>Paint · flooring · finishing touches</small>
          </span>
        </p>
      </header>
      <nav className="studio-chapters" aria-label="Project walkthrough">
        {chapters.map((item, i) => (
          <button
            key={item.id}
            type="button"
            aria-current={chapter === item.id ? 'step' : undefined}
            onClick={() => changeChapter(item.id)}
          >
            <Glyph name={item.icon} />
            <span>{item.label}</span>
            <small>0{i + 1}</small>
          </button>
        ))}
      </nav>
      {stale && (
        <div className="studio-stale" role="status">
          <span>Measurements changed. Update the scope to refresh these costs.</span>
          <button type="button" onClick={onRefresh}>
            Update scope <Glyph name="right" />
          </button>
        </div>
      )}
      <div className="studio-layout">
        <div className="studio-scene-column">
          <div className="studio-scene-toolbar">
            <span>
              <i />{' '}
              {activeId ? steps.find((s) => s.id === activeId)?.title : 'Your room, reimagined'}
            </span>
            {viewControls}
          </div>
          <div ref={media}>{stage}</div>
          <div className="studio-scene-caption">
            <div>
              <strong>
                {before ? 'Before the refresh' : `${wall.label} + ${floor.label.toLowerCase()}`}
              </strong>
              <span>Choose a finish. See the room and its costs change together.</span>
            </div>
            <span className="studio-example-label">Example · 3D render</span>
          </div>
          <div className="studio-work-strip" aria-label="Explore the work">
            <button type="button" aria-pressed={!activeId} onClick={() => onStep(null)}>
              <Glyph name="home" />
              <span>
                The finished room<small>See it all together</small>
              </span>
            </button>
            {steps.map((step) => (
              <button
                type="button"
                key={step.id}
                aria-pressed={activeId === step.id}
                onClick={() => onStep(step.id)}
              >
                <span className="studio-step-number">{String(step.number).padStart(2, '0')}</span>
                <span>
                  {step.title}
                  <small>
                    {step.estimate?.areaSqFt !== null && step.estimate?.areaSqFt !== undefined
                      ? `${step.estimate.areaSqFt} sq ft`
                      : step.guide?.phase}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </div>
        <aside
          ref={inspector}
          className="studio-inspector"
          aria-label={chapters.find((c) => c.id === chapter)!.label}
        >
          {scopeEditor ||
            (chapter === 'design' ? (
              <>
                <div className="studio-inspector-title">
                  <span className="studio-kicker">MAKE IT YOURS</span>
                  <h2>Find your finish.</h2>
                  <p>A few choices. A different feeling.</p>
                </div>
                <fieldset className="studio-finishes">
                  <legend>
                    Wall colour <span>{wall.label}</span>
                  </legend>
                  <div className="studio-wall-options">
                    {WALL_OPTIONS.map((w) => (
                      <button
                        type="button"
                        key={w.key}
                        aria-label={w.label}
                        aria-pressed={w.key === pick.wall}
                        onClick={() => onPick({ ...pick, wall: w.key })}
                      >
                        <i style={{ backgroundColor: w.hex }}>
                          {w.key === pick.wall && <Glyph name="check" />}
                        </i>
                        <span>{w.label}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="studio-finishes">
                  <legend>
                    Flooring <span>{floor.label}</span>
                  </legend>
                  <div className="studio-floor-options">
                    {FLOOR_OPTIONS.map((f) => (
                      <button
                        type="button"
                        key={f.key}
                        aria-pressed={f.key === pick.floor}
                        onClick={() => onPick({ ...pick, floor: f.key })}
                      >
                        <i className={`studio-floor-swatch ${f.key}`} />
                        <span>
                          {f.label}
                          <small>
                            {f.key === 'carpet'
                              ? 'Work with what’s here'
                              : f.key === 'lvp'
                                ? 'Light oak · click-lock'
                                : 'Dark oak · engineered'}
                          </small>
                        </span>
                        {f.key === pick.floor && <Glyph name="check" />}
                      </button>
                    ))}
                  </div>
                </fieldset>
                {costSummary}
                {confirmation || (
                  <div className="studio-next">
                    <button
                      type="button"
                      className="studio-primary"
                      onClick={changed ? onReviewDesign : () => changeChapter('costs')}
                    >
                      {changed ? 'Review design change' : 'Explore work & costs'}
                      <Glyph name="right" />
                    </button>
                    {changed && (
                      <button type="button" className="studio-text-button" onClick={onReset}>
                        Return to saved design
                      </button>
                    )}
                  </div>
                )}
                <span className="studio-save-status">
                  <Glyph name={changed ? 'paint' : 'check'} />
                  {changed ? 'Preview · your saved design is unchanged' : 'Saved to this project'}
                </span>
              </>
            ) : chapter === 'costs' ? (
              <>
                <div className="studio-inspector-title">
                  <span className="studio-kicker">THE WHOLE JOB</span>
                  <h2>Know what goes into it.</h2>
                  <p>From pulling up carpet to the last coat.</p>
                </div>
                <div className="studio-segment" role="group" aria-label="Cost approach">
                  <button
                    type="button"
                    aria-pressed={costMode === 'diy'}
                    onClick={() => setCostMode('diy')}
                  >
                    Do it yourself
                  </button>
                  <button
                    type="button"
                    aria-pressed={costMode === 'pro'}
                    onClick={() => setCostMode('pro')}
                  >
                    Hire a pro
                  </button>
                </div>
                <div className="studio-cost-total">
                  <span>
                    {costMode === 'diy' ? 'Materials & tools' : 'Materials & installation'}
                  </span>
                  <strong>{total === null || total === undefined ? '—' : money(total)}</strong>
                  <small>Example allowance · before tax</small>
                </div>
                <dl className="studio-cost-split">
                  <div>
                    <dt>Materials & supplies</dt>
                    <dd>
                      {costMode === 'pro'
                        ? fullQuote
                          ? money(fullQuote.materialsMinor)
                          : '—'
                        : template
                          ? money(template.materialsMinor)
                          : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>{costMode === 'pro' ? 'Labour' : 'Tools'}</dt>
                    <dd>
                      {costMode === 'pro'
                        ? fullQuote
                          ? money(fullQuote.labourMinor)
                          : '—'
                        : template
                          ? money(template.toolsMinor)
                          : '—'}
                    </dd>
                  </div>
                </dl>
                <div className="studio-cost-steps">
                  {steps.map((step) => {
                    const line = fullQuote?.lines.find((l) => l.packageId === step.id);
                    return (
                      <button
                        type="button"
                        key={step.id}
                        onClick={() => onStep(step.id, costMode)}
                        aria-current={activeId === step.id || undefined}
                      >
                        <span className="studio-step-number">
                          {String(step.number).padStart(2, '0')}
                        </span>
                        <span>
                          {step.title}
                          <small>
                            {step.estimate?.areaSqFt !== null &&
                            step.estimate?.areaSqFt !== undefined
                              ? `${step.estimate.areaSqFt} sq ft`
                              : step.guide?.phase}
                          </small>
                        </span>
                        <strong>
                          {costMode === 'pro'
                            ? line
                              ? money(line.materialsMinor + line.labourMinor)
                              : '—'
                            : step.estimate
                              ? money(step.estimate.totalMinor)
                              : '—'}
                        </strong>
                        <Glyph name="right" />
                      </button>
                    );
                  })}
                </div>
                <details className="studio-material-links">
                  <summary>
                    Find these finishes <Glyph name="plus" />
                  </summary>
                  <p>
                    Retailer searches for the chosen specifications. Allowances above are example
                    prices.
                  </p>
                  {[
                    { label: `${wall.label} eggshell paint`, query: wall.spec },
                    ...(floor.shopFor ? [{ label: floor.label, query: floor.shopFor }] : []),
                  ].map((item) => (
                    <div key={item.label}>
                      <strong>{item.label}</strong>
                      <a
                        href={`https://www.homedepot.com/s/${encodeURIComponent(item.query)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Home Depot ↗
                      </a>
                      <a
                        href={`https://www.lowes.com/search?searchTerm=${encodeURIComponent(item.query)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Lowe’s ↗
                      </a>
                    </div>
                  ))}
                </details>
                <div className="studio-next">
                  <button
                    type="button"
                    className="studio-primary"
                    onClick={() => changeChapter('handoff')}
                  >
                    Review the handoff
                    <Glyph name="right" />
                  </button>
                  <button type="button" className="studio-text-button" onClick={onChangeWork}>
                    Edit the scope of work
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="studio-inspector-title">
                  <span className="studio-kicker">ON THE SAME PAGE</span>
                  <h2>A plan worth sharing.</h2>
                  <p>Take the conversation beyond “what did you have in mind?”</p>
                </div>
                <div className="studio-document">
                  <div className="studio-document-icon">
                    <Glyph name="file" />
                  </div>
                  <span>PROJECT BRIEF</span>
                  <h3>Living room refresh</h3>
                  <p>
                    {wall.label} walls.{' '}
                    {floor.label === 'Keep carpet'
                      ? 'Existing carpet retained'
                      : `${floor.label} flooring`}
                    . The work behind the look, all in one place.
                  </p>
                  <ul>
                    {steps.map((step) => (
                      <li key={step.id}>
                        <Glyph name="check" />
                        {step.title}
                      </li>
                    ))}
                  </ul>
                  <div>
                    <span>Scope · quantities · materials</span>
                    <Glyph name="file" />
                  </div>
                </div>
                {changed && (
                  <p className="studio-handoff-note">
                    Your preview has unsaved changes. Save your design to include them in the
                    handoff.
                  </p>
                )}
                <div className="studio-next">
                  <button
                    type="button"
                    className="studio-primary"
                    onClick={
                      stale
                        ? onRefresh
                        : changed
                          ? () => changeChapter('design')
                          : () => {
                              onHandoff();
                              requestAnimationFrame(() =>
                                scrollOnPhone(
                                  media.current?.querySelector('[role="dialog"]') ?? null,
                                ),
                              );
                            }
                    }
                  >
                    {stale
                      ? 'Update the scope first'
                      : changed
                        ? 'Save the design first'
                        : 'Open contractor brief'}
                    <Glyph name="right" />
                  </button>
                  <button type="button" className="studio-secondary" onClick={onDownloadPlan}>
                    <Glyph name="plan" />
                    Download floor plan
                  </button>
                </div>
                <p className="studio-footnote">
                  A starting point for a contractor’s review and quote. Example scope and cost
                  allowances.
                </p>
              </>
            ))}
          {status && (
            <p className="studio-handoff-note" role="status">
              {status}
            </p>
          )}
          {agentTools && (
            <details className="studio-agent-tools">
              <summary>
                <Glyph name="connection" />
                Muse & project tools
                <Glyph name="plus" />
              </summary>
              {agentTools}
            </details>
          )}
        </aside>
      </div>
    </section>
  );
}
