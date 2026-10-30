import { useState, type ChangeEvent, type FormEvent } from 'react';
import {
  roomMeasureMethodLabels,
  type FloorPlanSummary,
  type RoomDimension,
  type RoomDimensionsInput,
  type RoomMeasureMethod,
  type ScopeDraft,
  type Workspace,
} from '@renovagent/contracts';
import { roomDimensionFact, scopeDraftId, summarizeFloorPlan } from '@renovagent/core';
import { type WorkspaceController } from '../../app/workspace-controller.js';

const lengthUnits = ['ft', 'in', 'm', 'cm'] as const;
const areaUnits = ['ft2', 'm2'] as const;
type Unit = (typeof lengthUnits)[number] | (typeof areaUnits)[number];
type Entry = { amount: string; unit: Unit };
const dimensions: { key: RoomDimension; label: string; units: readonly Unit[] }[] = [
  { key: 'length', label: 'Floor length', units: lengthUnits },
  { key: 'width', label: 'Floor width', units: lengthUnits },
  { key: 'height', label: 'Ceiling height', units: lengthUnits },
  { key: 'area', label: 'Floor area', units: areaUnits },
  { key: 'perimeter', label: 'Floor perimeter', units: lengthUnits },
];
const unitLabel = (u: Unit) => (u === 'ft2' ? 'sq ft' : u === 'm2' ? 'm²' : u);

// Saved values come back in the units the person typed (originalValue).
function savedEntry(state: Workspace, projectId: string, key: RoomDimension): Entry {
  const units = dimensions.find((d) => d.key === key)!.units;
  const v = roomDimensionFact(state, projectId, key)?.originalValue;
  return v?.kind === 'quantity' && (units as readonly string[]).includes(v.unit)
    ? { amount: String(v.amount), unit: v.unit as Unit }
    : { amount: '', unit: units[0] };
}

// The full form; mounted only while editing, so it starts from the saved values.
export function RoomDimensionsForm({
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
  const [values, setValues] = useState(
    () =>
      Object.fromEntries(
        dimensions.map(({ key }) => [key, savedEntry(state, projectId, key)]),
      ) as Record<RoomDimension, Entry>,
  );
  const [method, setMethod] = useState<RoomMeasureMethod>('tape-measure');
  const [notes, setNotes] = useState('');
  const [evidence, setEvidence] = useState<File | undefined>();
  const [plan, setPlan] = useState<FloorPlanSummary | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const draft = state.artifacts[scopeDraftId(projectId)]?.at(-1);

  // Parsing only proposes values; nothing is recorded until the person saves.
  async function importPlan(e: ChangeEvent<HTMLInputElement>) {
    setError('');
    setSaved('');
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const summary = summarizeFloorPlan(JSON.parse(text));
      const set = (amount: number | null, unit: Unit) =>
        amount === null ? null : { amount: String(amount), unit };
      setValues((v) => ({
        ...v,
        area: set(summary.floorAreaM2, 'm2') ?? v.area,
        perimeter: set(summary.perimeterM, 'm') ?? v.perimeter,
        height: set(summary.ceilingHeightM, 'm') ?? v.height,
      }));
      setPlan(summary);
      setMethod('floor-plan-file');
      setEvidence(new File([text], file.name, { type: 'application/json' }));
    } catch (err) {
      setPlan(null);
      setError(
        err instanceof SyntaxError
          ? 'That file is not JSON. Export the plan as RoomPlan or OpenPlan3D JSON.'
          : err instanceof Error
            ? err.message
            : String(err),
      );
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaved('');
    const entry = (key: RoomDimension) =>
      values[key].amount.trim() === ''
        ? null
        : { amount: Number(values[key].amount), unit: values[key].unit };
    // Units are constrained per field by the selects; the core schema re-checks them.
    const input = {
      length: entry('length'),
      width: entry('width'),
      height: entry('height'),
      area: entry('area'),
      perimeter: entry('perimeter'),
      method,
      notes,
    } as Omit<RoomDimensionsInput, 'photoEvidenceIds'>;
    try {
      await controller.recordRoomDimensions(projectId, input, evidence);
      setEvidence(undefined);
      setPlan(null);
      setSaved('Saved as your reported measurements. Confirm them on site before ordering.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <p>
        Enter what you measured, or import a floor plan from an iPhone LiDAR scan (RoomPlan JSON) or
        an{' '}
        <a href="https://openplan3d.com" target="_blank" rel="noreferrer">
          OpenPlan3D
        </a>{' '}
        export. Leave a value blank if you don&apos;t know it. Floor area and perimeter from a plan
        replace length × width. Nothing here is verified.
      </p>
      <form className="candidate-editor" onSubmit={save} aria-label="Room dimensions">
        <label>
          Import floor plan (optional)
          <input
            type="file"
            accept=".json,application/json"
            aria-label="Floor plan file"
            onChange={(e) => void importPlan(e)}
          />
        </label>
        {plan && (
          <div role="status" aria-label="Imported floor plan">
            <p>
              {plan.format === 'roomplan-capture' ? 'RoomPlan scan' : 'OpenPlan3D plan'}:{' '}
              {plan.wallCount} walls, {plan.openings.length} doors/windows
              {plan.spaces.length ? `, spaces: ${plan.spaces.join(', ')}` : ''}. Confidence:{' '}
              {plan.confidence.high} high, {plan.confidence.medium} medium, {plan.confidence.low}{' '}
              low. Review the values below, then save.
            </p>
            <ul>
              {plan.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="candidate-dimensions">
          {dimensions.map(({ key, label, units }) => (
            <label key={key}>
              {label}
              <span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  aria-label={label}
                  value={values[key].amount}
                  onChange={(e) =>
                    setValues({ ...values, [key]: { ...values[key], amount: e.target.value } })
                  }
                />
                <select
                  aria-label={`${label} unit`}
                  value={values[key].unit}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      [key]: { ...values[key], unit: e.target.value as Unit },
                    })
                  }
                >
                  {units.map((u) => (
                    <option key={u} value={u}>
                      {unitLabel(u)}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          ))}
        </div>
        <div className="candidate-metadata">
          <label>
            How you measured
            <select
              aria-label="Measurement method"
              value={method}
              onChange={(e) => setMethod(e.target.value as RoomMeasureMethod)}
            >
              {Object.entries(roomMeasureMethodLabels).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </label>
          {!plan && (
            <label>
              Photo (optional)
              <input
                type="file"
                accept="image/*"
                aria-label="Measurement photo"
                onChange={(e) => setEvidence(e.target.files?.[0])}
              />
            </label>
          )}
          <label>
            Notes
            <input
              aria-label="Measurement notes"
              value={notes}
              maxLength={2000}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
        {draft?.freshness === 'stale' && (
          <p role="status">
            The scope draft was made before these measurements. Ask Muse to re-draft the scope to
            update quantities.
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        {saved && <p role="status">{saved}</p>}
        <button type="submit" disabled={busy}>
          Save measurements
        </button>
      </form>
    </>
  );
}

// What is recorded, in one line: "14 × 12 ft floor · 8 ft ceiling".
function measuredLine(state: Workspace, projectId: string) {
  const v = (key: RoomDimension) => {
    const e = savedEntry(state, projectId, key);
    return e.amount ? `${e.amount} ${unitLabel(e.unit)}` : null;
  };
  const length = savedEntry(state, projectId, 'length');
  const width = savedEntry(state, projectId, 'width');
  const parts = [
    length.amount && width.amount
      ? `${length.amount} × ${width.amount} ${unitLabel(width.unit)} floor`
      : (v('length') && `${v('length')} long`) || (v('width') && `${v('width')} wide`),
    v('area') && `${v('area')} floor`,
    v('height') && `${v('height')} ceiling`,
  ].filter(Boolean);
  return parts.join(' · ');
}

// One line once something is measured; the form opens on demand.
export function RoomDimensionsCard({
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
  const recorded = dimensions.some(({ key }) => roomDimensionFact(state, projectId, key));
  // Follows what is recorded until the person opens or closes it.
  const [editing, setEditing] = useState<boolean | null>(null);
  const open = editing ?? !recorded;
  const draft = state.artifacts[scopeDraftId(projectId)]?.at(-1);
  const example =
    draft?.payload.kind === 'scope-draft' &&
    (draft.payload as ScopeDraft).request.startsWith('[Example fixture]');
  return (
    <section className="room-measure" aria-label="Room measurements">
      <div className="room-measure-row">
        <span>
          <strong>Measurements</strong>{' '}
          {recorded ? measuredLine(state, projectId) : 'Not measured yet'}
          {example && <span className="room3d-tag">Example</span>}
        </span>
        <button type="button" className="link-button" onClick={() => setEditing(!open)}>
          {open ? 'Close' : recorded ? 'Edit' : 'Add measurements'}
        </button>
        <span className="room-measure-soon" title="Scan the room with your phone's camera">
          Measure with your phone · coming soon
        </span>
      </div>
      {!open && draft?.freshness === 'stale' && (
        <p role="status" className="small-note">
          The scope draft was made before these measurements. Ask Muse to re-draft the scope to
          update quantities.
        </p>
      )}
      {open && (
        <RoomDimensionsForm
          state={state}
          projectId={projectId}
          controller={controller}
          busy={busy}
        />
      )}
    </section>
  );
}
