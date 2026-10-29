import { useState, type FormEvent } from 'react';
import {
  emptyCandidateSurvey,
  type CandidateSurvey,
  type Workspace,
  type Artifact,
} from '@renovagent/contracts';
import {
  candidateRoles,
  candidateMeasurement,
  candidateCheck,
  propertyAddress,
  referenceCurrent,
} from '@renovagent/core';
import { type WorkspaceController } from '../../app/workspace-controller.js';
const fieldLabels = {
  width: 'Width',
  length: 'Length',
  minimumHeadroom: 'Minimum headroom',
  clearDoorWidth: 'Clear door opening',
  approachWidth: 'Approach / circulation width',
  drainRun: 'Observed horizontal drain run',
  drainFall: 'Observed available fall',
} as const;
type Field = keyof CandidateSurvey['values'];
const fields = Object.keys(fieldLabels) as Field[];
type Unit = NonNullable<CandidateSurvey['values']['width']>['unit'];
const formValues = (survey: CandidateSurvey) =>
  Object.fromEntries(
    fields.map((key) => [
      key,
      {
        amount: survey.values[key]?.amount.toString() || '',
        unit: survey.values[key]?.unit || 'mm',
      },
    ]),
  ) as Record<Field, { amount: string; unit: Unit }>;
export function CandidateMeasurementsPanel({
  state,
  projectId,
  controller,
  busy,
}: {
  state: Workspace;
  projectId: string;
  controller: WorkspaceController;
  busy: boolean;
}) {
  const [active, setActive] = useState('kitchen');
  const count = candidateRoles.filter((role) =>
    candidateMeasurement(state, projectId, role.id),
  ).length;
  return (
    <details className="candidate-measurements-panel">
      <summary>Candidate measurements · {count}/3 recorded</summary>
      <p>
        Save each location separately. Blank means unknown. A save updates candidate arithmetic and,
        when current, the options and selected work plan. Feasibility stays blocked.
      </p>
      <div className="candidate-tabs" role="group" aria-label="Candidate location">
        {candidateRoles.map((role) => (
          <button
            type="button"
            key={role.id}
            aria-pressed={active === role.id}
            onClick={() => setActive(role.id)}
          >
            {role.label}
          </button>
        ))}
      </div>
      {candidateRoles.map((role) => (
        <div key={`${projectId}:${role.id}`} hidden={active !== role.id}>
          <CandidateEditor
            state={state}
            projectId={projectId}
            controller={controller}
            busy={busy}
            role={role.id}
            label={role.label}
          />
        </div>
      ))}
    </details>
  );
}
function CandidateEditor({
  state,
  projectId,
  controller,
  busy,
  role,
  label,
}: {
  state: Workspace;
  projectId: string;
  controller: WorkspaceController;
  busy: boolean;
  role: string;
  label: string;
}) {
  const record = candidateMeasurement(state, projectId, role),
    payload = record?.payload;
  const currentSurvey = payload?.kind === 'candidate-measurements' ? payload.survey : undefined;
  const address = propertyAddress(state, projectId);
  const [survey, setSurvey] = useState(
    () => currentSurvey || emptyCandidateSurvey(`location:${crypto.randomUUID()}`, label),
  );
  const [values, setValues] = useState(() => formValues(survey));
  const [basis, setBasis] = useState<'user-reported' | 'example'>(
    payload?.kind === 'candidate-measurements' ? payload.basis : 'user-reported',
  );
  const [baseline, setBaseline] = useState(() => ({
    revision: record?.revision || 0,
    addressRef:
      record?.inputRefs.find((r) => r.kind === 'fact') ||
      (address ? { kind: 'fact' as const, id: address.id, revision: address.revision } : null),
  }));
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]),
    [error, setError] = useState(''),
    [saved, setSaved] = useState('');
  const files = Object.values(state.evidence).filter(
    (e) =>
      e.propertyId === state.projects[projectId].propertyId &&
      (e.projectId === null || e.projectId === projectId) &&
      e.source.attachment,
  );
  const stale =
    record &&
    !referenceCurrent(state, projectId, {
      kind: 'artifact',
      id: record.id,
      revision: record.revision,
    });
  const refresh = (newCandidate: boolean) => {
    const current = candidateMeasurement(state, projectId, role);
    const p = current?.payload;
    const next =
      !newCandidate && p?.kind === 'candidate-measurements'
        ? p.survey
        : emptyCandidateSurvey(`location:${crypto.randomUUID()}`, label);
    setSurvey(next);
    setValues(formValues(next));
    setBasis(!newCandidate && p?.kind === 'candidate-measurements' ? p.basis : 'user-reported');
    setBaseline({
      revision: current?.revision || 0,
      addressRef:
        !newCandidate && current
          ? current.inputRefs.find((r) => r.kind === 'fact') || null
          : address
            ? { kind: 'fact', id: address.id, revision: address.revision }
            : null,
    });
    setError('');
    setSaved('');
    setEvidenceIds([]);
  };
  async function save(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaved('');
    if (!baseline.addressRef) {
      setError('Save a property address first.');
      return;
    }
    try {
      const enteredDate = new FormData(e.currentTarget as HTMLFormElement).get('observedDate');
      const data = {
        ...survey,
        measuredAt: typeof enteredDate === 'string' && enteredDate ? enteredDate : null,
        values: Object.fromEntries(
          fields.map((key) => [
            key,
            values[key].amount.trim() === ''
              ? null
              : { amount: Number(values[key].amount), unit: values[key].unit },
          ]),
        ),
      } as CandidateSurvey;
      await controller.saveCandidateMeasurements(
        projectId,
        role,
        data,
        basis,
        baseline.addressRef,
        baseline.revision,
        state.artifacts[`${projectId}:scope-options`]?.at(-1)?.revision || 0,
        state.artifacts[`${projectId}:scope-work-plan`]?.at(-1)?.revision || 0,
        evidenceIds,
      );
      const workspace = controller.getSnapshot().workspace;
      const latest = candidateMeasurement(workspace, projectId, role)!;
      setSurvey(data);
      setBaseline({
        revision: latest.revision,
        addressRef: latest.inputRefs.find((r) => r.kind === 'fact') || null,
      });
      setSaved(
        `Saved ${data.label} · revision ${latest.revision}. Candidate checks updated; construction remains blocked.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  const checks = candidateCheck(state, projectId, role);
  return (
    <form className="candidate-editor" onSubmit={save} aria-label={`${label} measurements`}>
      <p className="small-note">
        {record ? `Saved revision ${record.revision}` : 'No saved measurements'} · project-specific
        candidate · {stale ? 'stale property context' : 'unverified observations'}. Original units
        and revisions are retained.
      </p>
      {baseline.revision !== (record?.revision || 0) && (
        <p role="alert">A newer survey was saved. Reload it before revising.</p>
      )}
      {stale && (
        <p role="alert">
          The property context changed. Start a new candidate survey; old measurements remain in
          history.
        </p>
      )}
      <div className="candidate-metadata">
        <label>
          Location name
          <input
            aria-label={`${label} location name`}
            value={survey.label}
            maxLength={160}
            required
            onChange={(e) => setSurvey({ ...survey, label: e.target.value })}
          />
        </label>
        <label>
          Footprint
          <select
            aria-label="Footprint"
            value={survey.shape}
            onChange={(e) =>
              setSurvey({ ...survey, shape: e.target.value as CandidateSurvey['shape'] })
            }
          >
            <option value="unknown">Unknown</option>
            <option value="rectangular">Measured rectangle</option>
            <option value="irregular">Irregular / sloping footprint</option>
          </select>
        </label>
        <label>
          Measurement basis
          <select
            aria-label="Measurement basis"
            value={survey.measurement}
            onChange={(e) =>
              setSurvey({
                ...survey,
                measurement: e.target.value as CandidateSurvey['measurement'],
              })
            }
          >
            <option value="unknown">Unknown</option>
            <option value="rough">Rough dimensions</option>
            <option value="finished">Finished boundaries</option>
            <option value="conflicting">Conflicting observations</option>
          </select>
        </label>
        <label>
          Observed date
          <input
            type="date"
            name="observedDate"
            aria-label="Observed date"
            value={survey.measuredAt || ''}
            onInput={(e) => {
              const value = e.currentTarget.value;
              setSurvey((previous) => ({ ...previous, measuredAt: value || null }));
            }}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setSurvey((previous) => ({ ...previous, measuredAt: value || null }));
            }}
          />
        </label>
      </div>
      <fieldset>
        <legend>Measured dimensions · leave unknown values blank</legend>
        <div className="candidate-dimensions">
          {fields.map((key) => (
            <label key={key}>
              {fieldLabels[key]}
              <span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  aria-label={`${label} ${fieldLabels[key]}`}
                  value={values[key].amount}
                  onChange={(e) =>
                    setValues({ ...values, [key]: { ...values[key], amount: e.target.value } })
                  }
                />
                <select
                  aria-label={`${label} ${fieldLabels[key]} unit`}
                  value={values[key].unit}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      [key]: { ...values[key], unit: e.target.value as Unit },
                    })
                  }
                >
                  {['mm', 'cm', 'm', 'in', 'ft'].map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Door swing and obstructions
        <select
          aria-label="Door swing and obstructions"
          value={survey.doorSwing}
          onChange={(e) =>
            setSurvey({ ...survey, doorSwing: e.target.value as CandidateSurvey['doorSwing'] })
          }
        >
          <option value="unknown">Not surveyed</option>
          <option value="reported-clear">Reported clear · unverified</option>
          <option value="reported-conflict">Reported conflict</option>
        </select>
      </label>
      <label>
        How and where you measured
        <input
          required
          aria-label="How and where you measured"
          maxLength={500}
          value={survey.method}
          placeholder="Instrument, boundaries and position of the lowest headroom…"
          onChange={(e) => setSurvey({ ...survey, method: e.target.value })}
        />
      </label>
      <label>
        Notes and uncertainty
        <textarea
          aria-label="Notes and uncertainty"
          maxLength={2000}
          value={survey.notes}
          onChange={(e) => setSurvey({ ...survey, notes: e.target.value })}
        />
      </label>
      <label className="candidate-example">
        <input
          type="checkbox"
          checked={basis === 'example'}
          onChange={(e) => setBasis(e.target.checked ? 'example' : 'user-reported')}
        />
        These are example measurements, not observations of this property
      </label>
      {files.length > 0 && (
        <fieldset>
          <legend>Supporting local files · not analyzed</legend>
          {files.map((file) => (
            <label key={file.id}>
              <input
                type="checkbox"
                checked={evidenceIds.includes(file.id)}
                onChange={(e) =>
                  setEvidenceIds(
                    e.target.checked
                      ? [...evidenceIds, file.id]
                      : evidenceIds.filter((id) => id !== file.id),
                  )
                }
              />
              {file.source.attachment!.name}
            </label>
          ))}
        </fieldset>
      )}
      <p className="small-note">
        Drain fall/run is an observation, not a drainage design. No code minimum, fixture fit,
        permit or qualified review is inferred. Unsaved edits stay in this open editor.
      </p>
      <div className="scope-actions">
        <button type="submit" className="primary" disabled={busy || !address}>
          Save {label.toLowerCase()} measurements
        </button>
        <button type="button" className="secondary" onClick={() => refresh(false)}>
          Reload saved candidate
        </button>
        <button type="button" className="link-button" onClick={() => refresh(true)}>
          New candidate · clear measurements
        </button>
      </div>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      {saved && <p role="status">{saved}</p>}
      {checks && <CandidateMeasurementView artifact={checks} />}
    </form>
  );
}
export function CandidateMeasurementView({ artifact }: { artifact: Artifact }) {
  const p = artifact.payload;
  if (p.kind === 'candidate-measurements')
    return (
      <div className="candidate-saved-record">
        <h3>
          {p.survey.label} · {p.basis}
        </h3>
        <p>
          {p.survey.shape} · {p.survey.measurement} boundaries ·{' '}
          {p.survey.measuredAt || 'date unknown'}
        </p>
        <p>Method: {p.survey.method}</p>
        <p>
          Notes / uncertainty:{' '}
          {p.survey.notes || 'No additional notes supplied; conditions remain unverified.'}
        </p>
        <dl>
          {fields.map((key) => (
            <div key={key}>
              <dt>{fieldLabels[key]}</dt>
              <dd>
                {p.survey.values[key]
                  ? `${p.survey.values[key]!.amount} ${p.survey.values[key]!.unit}`
                  : 'Unknown'}
              </dd>
            </div>
          ))}
        </dl>
        <p>Door swing: {p.survey.doorSwing}. No verification or completed survey is recorded.</p>
      </div>
    );
  if (p.kind !== 'candidate-checks') return null;
  return (
    <section className="candidate-check-results">
      <h3>{p.label} · candidate technical checks</h3>
      <p>
        {p.basis} · {p.shape} · {p.surveyBasis} boundaries · shared geometry arithmetic ·
        feasibility / construction blocked
      </p>
      <table>
        <thead>
          <tr>
            <th>Calculation</th>
            <th>Result</th>
            <th>Basis</th>
          </tr>
        </thead>
        <tbody>
          {p.traces.map((t) => (
            <tr key={t.label}>
              <th>{t.label}</th>
              <td>{t.value === null ? 'Unknown' : `${Number(t.value.toFixed(6))} ${t.unit}`}</td>
              <td>{t.formula}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul>
        {p.checks.map((c) => (
          <li key={c.id}>
            <strong>
              {c.title} · {c.status}
            </strong>
            <p>{c.detail}</p>
          </li>
        ))}
      </ul>
      <details>
        <summary>Calculation limits</summary>
        <ul>
          {p.limitations.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
