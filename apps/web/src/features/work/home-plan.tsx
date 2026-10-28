import { useState, useRef, type FormEvent } from 'react';
import {
  emptyCandidateSurvey,
  type Workspace,
  type Artifact,
  type CandidateSurvey,
} from '@unpermitted/contracts';
import {
  mm,
  candidateCheck,
  propertyAddress,
  scopeAnswerRefs,
  candidateSurveyRefs,
} from '@unpermitted/core';
import { type WorkspaceController } from '../../app/workspace-controller.js';
import { PropertyIntake } from '../intake/property-intake.js';
import { CandidateMeasurementsPanel } from './candidate-measurements.js';
import { homePlanModel } from './home-plan-model.js';
import './home-plan.css';

type Props = {
  state: Workspace;
  projectId: string;
  controller: WorkspaceController;
  busy: boolean;
  onArtifact: (a: Artifact) => void;
};
const studyChoices = [
  {
    id: 'kitchen-only',
    number: '01',
    title: 'Kitchen first',
    detail: 'Develop the kitchen scope. Defer the extra bathroom.',
    test: 'Cabinet condition, retained services and circulation',
    role: 'kitchen',
  },
  {
    id: 'ground-floor-powder',
    number: '02',
    title: 'Explore a ground-floor bathroom',
    detail: 'Keep the kitchen in scope; investigate a nominated ground-floor space.',
    test: 'Available enclosure, stair clearance and waste / vent route',
    role: 'ground-floor',
  },
  {
    id: 'basement-powder',
    number: '03',
    title: 'Explore a basement bathroom',
    detail: 'Keep the kitchen in scope; investigate a nominated basement space.',
    test: 'Finished headroom, access and drainage elevations',
    role: 'basement',
  },
];
const shortQuestions = [
  'What should stay in the kitchen?',
  'Keep the peninsula?',
  'Change the existing bathroom?',
  'Consider the basement?',
  'Consider a ground-floor enclosure?',
  'Keep circulation unchanged?',
];
const choices = [
  ['Keep the main layout', 'Consider changing the layout', 'Inspect before deciding'],
  ['Keep it for now', 'Explore removing it', 'Measure circulation first'],
  [
    'Keep the existing bathroom out of scope',
    'Investigate changes to it',
    'Decide after a walkthrough',
  ],
  [
    'Include basement investigation',
    'Exclude the basement from my preferred scope',
    'Investigate access and drainage first',
  ],
  [
    'Include a ground-floor enclosure investigation',
    'Exclude enclosed / understair areas from my preferred scope',
    'Measure and inspect first',
  ],
  [
    'Retain existing circulation and door positions',
    'Consider changes after technical review',
    'Survey the circulation first',
  ],
];
export function HomePlan(props: Props) {
  const { state, projectId, controller, busy, onArtifact } = props;
  const m = homePlanModel(state, projectId);
  const research =
    m.research?.payload.kind === 'property-research' ? m.research.payload : undefined;
  const address = research?.address || state.properties[state.projects[projectId].propertyId].name;
  const [room, setRoom] = useState('kitchen');
  const [loadPhotos, setLoadPhotos] = useState(false);
  const [failedPhoto, setFailedPhoto] = useState('');
  const [editor, setEditor] = useState<number | null>(null);
  const [editingSurvey, setEditingSurvey] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const action = useRef<HTMLElement>(null);
  const photos = research?.photoReview?.photos || [];
  const photo = photos.find((p) => p.roomType === room);
  const photoHref = photo?.imageUrl;
  const houseFacts =
    research?.findings.filter(
      (f) => !f.blockedReason && /Recorded year built|Recorded zoning/.test(f.label),
    ) || [];
  const areaClaims =
    research?.findings.filter(
      (f) =>
        !f.blockedReason &&
        /Listing structured living area|Listing description living area claim/.test(f.label),
    ) || [];
  const study = studyChoices.find((s) => s.id === m.selection);
  const check = candidateCheck(state, projectId, m.role);
  const trace =
    check?.freshness === 'current' && check.payload.kind === 'candidate-checks'
      ? check.payload.traces.find((t) => t.label === 'Floor area')
      : undefined;
  async function chooseStudy(id: string) {
    if (!m.research) return;
    setError('');
    try {
      await controller.selectHomeStudy(
        projectId,
        id,
        { kind: 'artifact', id: m.research.id, revision: m.research.revision },
        scopeAnswerRefs(state, projectId),
        candidateSurveyRefs(state, projectId),
        state.artifacts[`${projectId}:scope-options`]?.at(-1)?.revision || 0,
        state.artifacts[`${projectId}:scope-work-plan`]?.at(-1)?.revision || 0,
      );
      setNotice('Investigation focus saved. Next, establish the size of the nominated space.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <div className="home-plan">
      <header className="hp-heading">
        <div>
          <p className="hp-kicker">YOUR HOME / A PLAN IN PROGRESS</p>
          <h1>
            Refresh the kitchen.
            <br />
            <em>Investigate an extra bath.</em>
          </h1>
        </div>
        <div className="hp-address">
          <span>PROPERTY · LISTING STUDY</span>
          <strong>{address}</strong>
          <small>Public listing · current conditions unverified</small>
        </div>
      </header>
      <div className="hp-layout">
        <div className="hp-main">
          <section className="hp-home" aria-label="Your home evidence">
            <div className="hp-room-tabs" role="group" aria-label="Explore the home">
              {[
                ['kitchen', 'Kitchen'],
                ['basement', 'Basement'],
                ['bathroom', 'Existing bath'],
                ['exterior', 'Outside'],
              ].map(([id, label]) => (
                <button key={id} aria-pressed={room === id} onClick={() => setRoom(id)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="hp-photo">
              {loadPhotos && photoHref && failedPhoto !== photoHref ? (
                <img
                  src={photoHref}
                  alt={`Listing source photo: ${room}; current condition unverified`}
                  referrerPolicy="no-referrer"
                  onError={() => setFailedPhoto(photoHref)}
                />
              ) : (
                <div className="hp-photo-placeholder">
                  <HouseDrawing />
                  <div>
                    <span>LISTING EVIDENCE / LOAD TO VIEW</span>
                    <h2>
                      {room === 'kitchen'
                        ? 'Start with what’s here.'
                        : room === 'basement'
                          ? 'A space to investigate.'
                          : room === 'bathroom'
                            ? 'Separate existing from proposed.'
                            : 'Know the place first.'}
                    </h2>
                    <p>
                      {failedPhoto === photoHref
                        ? 'This source image could not load. Open the original instead.'
                        : 'View the original listing imagery alongside the imported Muse observations.'}
                    </p>
                    <button
                      className="hp-light-button"
                      onClick={() => setLoadPhotos(true)}
                      disabled={!photoHref || failedPhoto === photoHref}
                    >
                      Load listing photos ↗
                    </button>
                    <small className="hp-source-notice">
                      External source images · rights unverified
                      <br />
                      Illustration shown here is not a property survey.
                    </small>
                  </div>
                </div>
              )}
              {loadPhotos && photoHref && failedPhoto !== photoHref && (
                <div className="hp-photo-caption">
                  <span>LISTING PHOTO · {room.toUpperCase()}</span>
                  <button onClick={() => setLoadPhotos(false)}>Hide photos</button>
                </div>
              )}
            </div>
            <div className="hp-observation">
              <span className="hp-dot" />
              <div>
                <strong>What the photo suggests</strong>
                <p>
                  {photo
                    ? `${photo.observations.join(' ').slice(0, 220)}${photo.observations.join(' ').length > 220 ? '…' : ''}`
                    : 'No current photo observation is available for this space. Refresh the research before relying on earlier evidence.'}
                </p>
              </div>
              {photo && (
                <a href={photo.pageUrl} target="_blank" rel="noreferrer">
                  Listing source ↗
                </a>
              )}
            </div>
            <details className="hp-evidence">
              <summary>
                Evidence & limits {photo ? '· Muse photo review' : '· current research needed'}
              </summary>
              <p>
                Imported Muse observations are unreviewed. Listing photos can be dated. Image rights
                remain unverified; loading an original source image here does not change its rights
                or add it to an export.
              </p>
              {photo && (
                <>
                  <p>{photo.observations.join(' ')}</p>
                  <p>
                    Uncertain:{' '}
                    {photo.uncertainties.join(' ') ||
                      'Dimensions, current condition and concealed services.'}
                  </p>
                  <a href={photo.imageUrl} target="_blank" rel="noreferrer">
                    Open original photo ↗
                  </a>
                </>
              )}
            </details>
          </section>
          <div className="hp-house-facts" aria-label="Sourced house context">
            {houseFacts.map((f) => (
              <details key={f.label}>
                <summary>
                  <span>{f.label.includes('year') ? 'RECORDED YEAR' : 'RECORDED ZONING'}</span>
                  <strong>{f.value}</strong>
                </summary>
                <p>{f.limit}</p>
                <a
                  href={research?.sources.find((source) => source.id === f.sourceId)?.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Official source ↗
                </a>
                <small>Imported record · unreviewed</small>
              </details>
            ))}
            {areaClaims.length > 1 && (
              <details className="hp-fact-conflict">
                <summary>
                  <span>LIVING AREA</span>
                  <strong>Sources disagree ↗</strong>
                </summary>
                {areaClaims.map((f) => (
                  <div key={f.label}>
                    <p>{f.value}</p>
                    <small>{f.limit}</small>
                    <a
                      href={research?.sources.find((source) => source.id === f.sourceId)?.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Listing source ↗
                    </a>
                  </div>
                ))}
              </details>
            )}
          </div>
          <section className="hp-proposal">
            <div className="hp-section-label">
              <span>THE WORKING PROPOSAL</span>
              <span>For investigation · not a design approval</span>
            </div>
            <h2>
              Refresh the kitchen.
              <br />
              <em>Give the extra bathroom its own investigation.</em>
            </h2>
            <p>
              Separate the work we want from the conditions we still need to establish. The listing
              gives us a starting point, not permission to assume a layout will fit.
            </p>
            <div className="hp-tracks">
              <div>
                <span>01 / DEVELOP</span>
                <h3>The kitchen</h3>
                <p>
                  Confirm what stays. Measure the work area. Inspect retained cabinets and services
                  before specifying replacements.
                </p>
              </div>
              <div>
                <span>02 / ESTABLISH</span>
                <h3>The additional bathroom</h3>
                <p>
                  Choose a location to study. Establish its geometry, access and services before
                  comparing fixture layouts.
                </p>
              </div>
            </div>
            <div className="hp-scope-line">
              <strong>Current focus</strong>
              <span>
                {study?.title ||
                  'Not selected yet — choose a study after the first kitchen decision.'}
              </span>
              {m.plan && (
                <button onClick={() => onArtifact(m.plan!)}>Inspect saved sequence ↗</button>
              )}
            </div>
            {m.survey?.payload.kind === 'candidate-measurements' && (
              <div className="hp-measure-result">
                <strong>
                  {trace?.value != null ? `${trace.value} ${trace.unit}` : 'Footprint incomplete'}
                </strong>
                <span>
                  {m.survey.payload.survey.label} ·{' '}
                  {m.survey.payload.basis === 'example'
                    ? 'example values, not this home'
                    : `${m.survey.payload.survey.measurement} / reported`}
                  <small>Measured area does not establish fixture fit or code compliance.</small>
                </span>
                <button
                  onClick={() => {
                    setEditingSurvey(true);
                    action.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  Revise
                </button>
              </div>
            )}
            {m.survey?.payload.kind === 'candidate-measurements' && (
              <SavedFootprint
                survey={m.survey.payload.survey}
                example={m.survey.payload.basis === 'example'}
              />
            )}
          </section>
          <section className="hp-route">
            <div className="hp-section-label">
              <span>HOW THIS BECOMES A JOB</span>
              <span>Design and physical work remain gated</span>
            </div>
            <ol>
              {[
                ['Establish the brief', 'Your preferences + site evidence'],
                ['Resolve the design', 'Layout, services + local requirements'],
                ['Prepare the job', 'Specifications, quantities + trade scopes'],
                ['Build & keep the record', 'Approvals, inspections + handover'],
              ].map(([title, detail], i) => (
                <li key={title} className={i === 0 ? 'active' : ''}>
                  <span>{i + 1}</span>
                  <div>
                    <strong>{title}</strong>
                    <small>{detail}</small>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <aside className="hp-action-rail">
          <section className="hp-next" ref={action} aria-label="Your next action">
            <p className="hp-kicker">ONE USEFUL NEXT MOVE</p>
            {!m.coverage.current ? (
              <>
                <h2>Refresh the evidence.</h2>
                <p>
                  The property or project context changed. Earlier photo research cannot support a
                  current proposal.
                </p>
                <button className="hp-primary" onClick={() => setResearchOpen(true)}>
                  Open research handoff →
                </button>
              </>
            ) : editor !== null || m.next === 'direction' ? (
              <Decision
                key={`${projectId}:${editor ?? 0}`}
                {...props}
                index={editor ?? 0}
                onDone={() => {
                  setEditor(null);
                  setNotice(
                    'Direction saved to your brief. Dependent proposals now need rebuilding.',
                  );
                }}
              />
            ) : m.next === 'study' ? (
              <>
                <h2>Choose what to investigate first.</h2>
                <p>
                  This selects a study focus, not a feasible design. Your saved preferences still
                  need reconciliation.
                </p>
                <StudyChoices busy={busy} selected={m.selection} choose={chooseStudy} />
              </>
            ) : m.next === 'measure' || editingSurvey ? (
              <>
                <h2>Put a size to the space.</h2>
                <p>
                  {m.role === 'kitchen'
                    ? 'Measure the nominated kitchen work area.'
                    : `Nominate the ${m.role === 'basement' ? 'basement' : 'ground-floor'} space first, then measure it.`}{' '}
                  A footprint is the first input to a layout—not proof that fixtures fit.
                </p>
                <Footprint
                  key={`${projectId}:${m.role}:${m.survey?.revision || 0}`}
                  {...props}
                  role={m.role}
                  onDone={() => {
                    setEditingSurvey(false);
                    setNotice('Footprint saved. The proposal and next step now use this survey.');
                  }}
                />
              </>
            ) : (
              <>
                <h2>
                  {m.role === 'kitchen'
                    ? 'Inspect what you intend to keep.'
                    : 'Establish the service route.'}
                </h2>
                <p>
                  {m.role === 'kitchen'
                    ? 'Before specifying a replacement countertop, establish cabinet condition, support, appliance dimensions and retained service positions.'
                    : 'Ask a qualified plumbing professional to identify the existing waste / vent connection, its elevation and a possible route from the nominated space.'}
                </p>
                <div className="hp-assignment">
                  <span>WHO / WHY</span>
                  <strong>
                    {m.role === 'kitchen'
                      ? 'Site survey + suitable trade'
                      : 'Qualified plumbing professional'}
                  </strong>
                  <p>
                    {m.role === 'kitchen'
                      ? 'The footprint alone cannot establish retained support or compatibility.'
                      : 'Available elevations and routing determine whether a drainage approach can be designed. Photo proximity cannot establish a connection.'}
                  </p>
                </div>
                <button
                  className="hp-primary"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(
                        m.role === 'kitchen'
                          ? 'Investigate retained kitchen cabinet condition and countertop support. Record appliance dimensions and observed service positions. Provide dated photos and a measured sketch; do not assume concealed routes.'
                          : `Investigate the nominated ${m.role} powder-room candidate. Record the waste / vent connection location, elevation, possible route, access constraints and unknown concealed conditions. Provide a dated sketch and photos. Feasibility is not established.`,
                      )
                      .then(() =>
                        setNotice('Investigation request copied. Nothing was sent or booked.'),
                      )
                      .catch(() =>
                        setError(
                          'Clipboard unavailable. Select and copy the investigation text above.',
                        ),
                      )
                  }
                >
                  Copy investigation request ↗
                </button>
                <button className="hp-text-button" onClick={() => setEditingSurvey(true)}>
                  Review or correct the footprint
                </button>
                <p className="hp-fine">
                  No professional contacted. No technical review or construction released.
                </p>
              </>
            )}
            {notice && (
              <p className="hp-feedback" role="status">
                {notice}
              </p>
            )}
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
          </section>
          <details className="hp-brief">
            <summary>Preferences & saved direction</summary>
            {m.questions.map((q, i) => (
              <button
                key={q.id}
                disabled={!q.current}
                onClick={() => {
                  setEditor(i);
                  action.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                <span>{shortQuestions[i] || q.text}</span>
                <small>
                  {q.current && q.answer?.payload.kind === 'photo-planning-answer'
                    ? `${q.answer.payload.disposition === 'direction' ? 'Reported' : q.answer.payload.disposition}: ${q.answer.payload.answer}`
                    : 'Open question'}
                </small>
                <b aria-hidden="true">↗</b>
              </button>
            ))}
          </details>
        </aside>
      </div>
      <details className="hp-more">
        <summary>Change the investigation focus</summary>
        <p>
          These are the three supported studies in the current offline recipe. None is a measured
          layout or personalized feasibility recommendation.
        </p>
        <StudyChoices
          busy={busy || !m.coverage.current}
          selected={m.selection}
          choose={chooseStudy}
        />
      </details>
      <details className="hp-more">
        <summary>Detailed measurements & technical record</summary>
        <CandidateMeasurementsPanel {...props} />
        <button
          className="hp-text-button"
          onClick={() =>
            void controller.setView(projectId, {
              stage: 'technical',
              surface: 'overview',
              tab: 'work',
            })
          }
        >
          Open technical workspace →
        </button>
      </details>
      <button className="hp-text-button" onClick={() => setResearchOpen(!researchOpen)}>
        {researchOpen
          ? 'Close property research'
          : 'Property records, photo evidence & Muse handoff'}{' '}
        ↗
      </button>
      {researchOpen && (
        <div className="hp-research">
          <PropertyIntake {...props} />
        </div>
      )}
      <footer className="hp-footer">
        Saved on this device · Backend off · Imported Muse evidence + local study templates · No
        live assistant
      </footer>
    </div>
  );
}
function StudyChoices({
  selected,
  busy,
  choose,
}: {
  selected: string | null;
  busy: boolean;
  choose: (id: string) => void;
}) {
  return (
    <div className="hp-study-choices">
      {studyChoices.map((s) => (
        <button
          key={s.id}
          disabled={busy}
          aria-pressed={selected === s.id}
          onClick={() => choose(s.id)}
        >
          <span>{s.number}</span>
          <div>
            <strong>{s.title}</strong>
            <small>{s.detail}</small>
            <em>Establish: {s.test}</em>
          </div>
          <b>→</b>
        </button>
      ))}
    </div>
  );
}
function Decision({
  state,
  projectId,
  controller,
  busy,
  index,
  onDone,
}: Props & { index: number; onDone: () => void }) {
  const q = homePlanModel(state, projectId).questions[index];
  const p = q?.answer?.payload;
  const [text, setText] = useState(p?.kind === 'photo-planning-answer' ? p.answer : '');
  const [meaning, setMeaning] = useState<'direction' | 'unsure' | 'deferred'>(
    p?.kind === 'photo-planning-answer' ? p.disposition : 'direction',
  );
  const [error, setError] = useState('');
  // Capture the displayed baseline. Concurrent updates must conflict rather than overwrite.
  const [baseline] = useState({ revision: q?.answer?.revision || 0, research: q?.research });
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!q || !baseline.research) return;
    try {
      await controller.answerPhotoQuestion(
        projectId,
        { kind: 'artifact', id: baseline.research.id, revision: baseline.research.revision },
        q.index,
        baseline.revision,
        text,
        meaning,
        [],
      );
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  if (!q) return <p>Current source-backed questions are needed.</p>;
  return (
    <form className="hp-decision" onSubmit={save}>
      <h2>{shortQuestions[index]}</h2>
      <div className="hp-answer-chips">
        {choices[index]?.map((choice, i) => (
          <button
            key={choice}
            type="button"
            aria-pressed={text === choice}
            onClick={() => {
              setText(choice);
              setMeaning(i === 2 ? 'unsure' : 'direction');
            }}
          >
            {choice}
          </button>
        ))}
      </div>
      <label>
        Your direction
        <textarea
          value={text}
          maxLength={4000}
          placeholder="Tell us what matters, in your own words…"
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <fieldset>
        <legend>How settled is this?</legend>
        {(['direction', 'unsure', 'deferred'] as const).map((d) => (
          <label key={d}>
            <input
              type="radio"
              name="meaning"
              checked={meaning === d}
              onChange={() => setMeaning(d)}
            />
            {d === 'direction' ? 'My direction' : d === 'unsure' ? 'Still unsure' : 'Later'}
          </label>
        ))}
      </fieldset>
      <button className="hp-primary" disabled={busy || !q.current || !text.trim()}>
        Save to my brief →
      </button>
      <p className="hp-fine">
        Your preference shapes the brief. It does not establish technical feasibility.
      </p>
      <details className="hp-question-source">
        <summary>Source question & photo basis</summary>
        <p>{q.text}</p>
        <p>
          Imported Muse interpretation · unreviewed. Current condition and dimensions need site
          evidence.
        </p>
        {q.photos.map((photo) => (
          <a key={photo.id} href={photo.imageUrl} target="_blank" rel="noreferrer">
            {photo.roomType} · original source photo ↗
          </a>
        ))}
      </details>
      {error && <p role="alert">{error} Reopen this question to review its current version.</p>}
    </form>
  );
}
function Footprint({
  state,
  projectId,
  controller,
  busy,
  role,
  onDone,
}: Props & { role: string; onDone: () => void }) {
  const m = homePlanModel(state, projectId);
  const p = m.survey?.payload;
  const [base] = useState(() =>
    p?.kind === 'candidate-measurements'
      ? p.survey
      : emptyCandidateSurvey(
          `location:${crypto.randomUUID()}`,
          role === 'kitchen' ? 'Kitchen work area' : `${role} candidate`,
        ),
  );
  const [baseline] = useState({
    revision: m.survey?.revision || 0,
    address: propertyAddress(state, projectId),
    options: state.artifacts[`${projectId}:scope-options`]?.at(-1)?.revision || 0,
    plan: state.artifacts[`${projectId}:scope-work-plan`]?.at(-1)?.revision || 0,
  });
  const [width, setWidth] = useState(base.values.width?.amount.toString() || '');
  const [length, setLength] = useState(base.values.length?.amount.toString() || '');
  const [widthUnit, setWidthUnit] = useState(base.values.width?.unit || 'in');
  const [lengthUnit, setLengthUnit] = useState(base.values.length?.unit || 'in');
  const [shape, setShape] = useState<CandidateSurvey['shape']>(base.shape);
  const [basis, setBasis] = useState<CandidateSurvey['measurement']>(base.measurement);
  const [example, setExample] = useState(
    p?.kind === 'candidate-measurements' && p.basis === 'example',
  );
  const [error, setError] = useState('');
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    try {
      if (!baseline.address) throw new Error('Save a property address first.');
      await controller.saveCandidateMeasurements(
        projectId,
        role,
        {
          ...base,
          label: String(data.get('location')),
          shape,
          measurement: basis,
          method: String(data.get('method')),
          measuredAt: String(data.get('date')) || null,
          values: {
            ...base.values,
            width: width ? { amount: Number(width), unit: widthUnit } : null,
            length: length ? { amount: Number(length), unit: lengthUnit } : null,
          },
        },
        example ? 'example' : 'user-reported',
        { kind: 'fact', id: baseline.address.id, revision: baseline.address.revision },
        baseline.revision,
        baseline.options,
        baseline.plan,
        [],
      );
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <form className="hp-footprint" onSubmit={save}>
      <div className="hp-measure-sketch" aria-label="Measurement guide, schematic only">
        <svg
          viewBox="0 0 280 160"
          role="img"
          aria-label="Measure width across the space and length along it"
        >
          <path d="M65 35H225V125H65Z" fill="#e9e8dc" stroke="#676c58" strokeWidth="2" />
          <path
            d="M65 18H225M65 12V24M225 12V24M244 35V125M238 35H250M238 125H250"
            stroke="#b15f3e"
            fill="none"
          />
          <text x="145" y="13" textAnchor="middle">
            width
          </text>
          <text x="258" y="84" transform="rotate(90 258 84)" textAnchor="middle">
            length
          </text>
          <text x="145" y="85" textAnchor="middle">
            your nominated space
          </text>
        </svg>
        <small>Measurement guide · not a floor plan</small>
      </div>
      <label>
        Which space?
        <input name="location" required maxLength={160} defaultValue={base.label} />
      </label>
      <div className="hp-dimension-pair">
        {[
          ['Width', width, setWidth, widthUnit, setWidthUnit],
          ['Length', length, setLength, lengthUnit, setLengthUnit],
        ].map(([label, value, setValue, unit, setUnit]) => (
          <label key={label as string}>
            {label as string}
            <div>
              <input
                aria-label={`Footprint ${label}`}
                type="number"
                min="0.001"
                step="any"
                required
                value={value as string}
                onChange={(e) => (setValue as typeof setWidth)(e.target.value)}
              />
              <select
                aria-label={`${label} unit`}
                value={unit as string}
                onChange={(e) =>
                  (setUnit as typeof setWidthUnit)(e.target.value as typeof widthUnit)
                }
              >
                {['in', 'ft', 'mm', 'cm', 'm'].map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </div>
          </label>
        ))}
      </div>
      <label>
        Footprint
        <select value={shape} onChange={(e) => setShape(e.target.value as typeof shape)} required>
          <option value="unknown">Not established</option>
          <option value="rectangular">Rectangle</option>
          <option value="irregular">Irregular / sloping</option>
        </select>
      </label>
      <label>
        Measured boundaries
        <select value={basis} onChange={(e) => setBasis(e.target.value as typeof basis)}>
          <option value="unknown">Not established</option>
          <option value="rough">Rough / approximate</option>
          <option value="finished">Finished wall faces</option>
          <option value="conflicting">Conflicting observations</option>
        </select>
      </label>
      <label>
        Observed date
        <input type="date" name="date" defaultValue={base.measuredAt || ''} />
      </label>
      <label>
        How and where did you measure?
        <input
          name="method"
          required
          maxLength={500}
          defaultValue={base.method}
          placeholder="Tape measure, between finished wall faces…"
        />
      </label>
      <label className="hp-example">
        <input type="checkbox" checked={example} onChange={(e) => setExample(e.target.checked)} />
        Example values, not this property
      </label>
      <button className="hp-primary" disabled={busy}>
        Save footprint →
      </button>
      <p className="hp-fine">
        Other survey fields are preserved. Irregular or rough measurements cannot establish a
        finished rectangular footprint.
      </p>
      {error && <p role="alert">{error} Reopen this editor if the record changed.</p>}
    </form>
  );
}
function HouseDrawing() {
  return (
    <svg className="hp-house-drawing" viewBox="0 0 360 280" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M45 235H322M78 235V92L110 56H278L300 92V235M78 92H300M110 56V37H278V56M87 150H291M87 159H291M78 218H300M93 235V181H128V235M137 235V181H172V235M200 235V181H253V235M253 208H267V235M205 208H253M82 105H116V139H82ZM132 105H166V139H132ZM192 105H226V139H192ZM243 105H277V139H243ZM90 105V139M106 105V139M140 105V139M158 105V139M200 105V139M218 105V139M251 105V139M269 105V139M93 208H128M137 208H172M104 181V208M118 181V208M148 181V208M162 181V208M67 235V247H175M276 235V247H309M94 125H115M144 125H165M205 125H225M254 125H277" />
      </g>
    </svg>
  );
}

function SavedFootprint({ survey, example }: { survey: CandidateSurvey; example: boolean }) {
  const { width, length } = survey.values;
  if (survey.shape !== 'rectangular' || !width || !length || mm(width) <= 0 || mm(length) <= 0)
    return null;
  const scale = Math.min(240 / mm(width), 130 / mm(length));
  const w = mm(width) * scale,
    h = mm(length) * scale,
    x = (340 - w) / 2,
    y = (190 - h) / 2;
  return (
    <figure className="hp-saved-footprint">
      <svg
        viewBox="0 0 340 190"
        role="img"
        aria-label={`Reported rectangular footprint, ${width.amount} ${width.unit} by ${length.amount} ${length.unit}. ${example ? 'Example only.' : 'Unverified site observations.'}`}
      >
        <rect x={x} y={y} width={w} height={h} fill="#e5ebdd" stroke="#718264" strokeWidth="1.5" />
        <path d={`M${x} ${y - 12}h${w}M${x + w + 12} ${y}v${h}`} fill="none" stroke="#b27c5b" />
        <text x="170" y={y - 19} textAnchor="middle">
          {width.amount} {width.unit}
        </text>
        <text x={x + w + 20} y="95" textAnchor="middle" transform={`rotate(90 ${x + w + 20} 95)`}>
          {length.amount} {length.unit}
        </text>
      </svg>
      <figcaption>
        {example ? 'Example footprint' : 'Reported footprint'} · {survey.measurement} boundaries ·
        fixture layout not established
      </figcaption>
    </figure>
  );
}
