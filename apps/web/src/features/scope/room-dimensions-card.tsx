import { useState, type FormEvent } from 'react';
import {
  roomMeasureMethodLabels,
  type RoomDimension,
  type RoomMeasureMethod,
  type Workspace,
} from '@renovagent/contracts';
import { roomDimensionFact, scopeDraftId } from '@renovagent/core';
import { type WorkspaceController } from '../../app/workspace-controller.js';

const dimensions: { key: RoomDimension; label: string }[] = [
  { key: 'length', label: 'Floor length' },
  { key: 'width', label: 'Floor width' },
  { key: 'height', label: 'Ceiling height' },
];
const units = ['ft', 'in', 'm', 'cm'] as const;
type Unit = (typeof units)[number];
type Entry = { amount: string; unit: Unit };

// Saved values come back in the units the person typed (originalValue).
function savedEntry(state: Workspace, projectId: string, key: RoomDimension): Entry {
  const v = roomDimensionFact(state, projectId, key)?.originalValue;
  return v?.kind === 'quantity' && (units as readonly string[]).includes(v.unit)
    ? { amount: String(v.amount), unit: v.unit as Unit }
    : { amount: '', unit: 'ft' };
}

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
  const [values, setValues] = useState(
    () =>
      Object.fromEntries(
        dimensions.map(({ key }) => [key, savedEntry(state, projectId, key)]),
      ) as Record<RoomDimension, Entry>,
  );
  const [method, setMethod] = useState<RoomMeasureMethod>('tape-measure');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<File | undefined>();
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const recorded = dimensions.filter(({ key }) => roomDimensionFact(state, projectId, key)).length;
  const draft = state.artifacts[scopeDraftId(projectId)]?.at(-1);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaved('');
    const length = (key: RoomDimension) =>
      values[key].amount.trim() === ''
        ? null
        : { amount: Number(values[key].amount), unit: values[key].unit };
    try {
      await controller.recordRoomDimensions(
        projectId,
        {
          length: length('length'),
          width: length('width'),
          height: length('height'),
          method,
          notes,
        },
        photo,
      );
      setPhoto(undefined);
      setSaved('Saved as your reported measurements. Confirm them on site before ordering.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <details className="candidate-measurements-panel" open={recorded === 0}>
      <summary>Measure this room · {recorded}/3 recorded</summary>
      <p>
        Enter what you measured. Leave a value blank if you don&apos;t know it. Paint, flooring and
        trim quantities use these numbers; nothing here is verified.
      </p>
      <form className="candidate-editor" onSubmit={save} aria-label="Room dimensions">
        <div className="candidate-dimensions">
          {dimensions.map(({ key, label }) => (
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
                    <option key={u}>{u}</option>
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
          <label>
            Photo (optional)
            <input
              type="file"
              accept="image/*"
              aria-label="Measurement photo"
              onChange={(e) => setPhoto(e.target.files?.[0])}
            />
          </label>
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
    </details>
  );
}
