import { useState } from 'react';
import type { Workspace } from '@renovagent/contracts';
import { lineTotalMinor } from '@renovagent/core';
import { type ProjectIntakeInput } from '../../app/project-intake.js';
import { Glyph } from '../../components/glyph.js';
import { PhotoPicker } from './photo-picker.js';
import './project-start.css';
import { ReferenceFields, referenceFromForm } from '../references/reference-fields.js';
const rooms = [
  ['Whole home', 'layers'],
  ['Bathroom', 'pipe'],
  ['Kitchen', 'materials'],
  ['Living room', 'home'],
  ['Bedroom', 'home'],
  ['Outdoor', 'plan'],
  ['Other', 'plus'],
];
export function ProjectStart({
  goal,
  onGoal,
  photos,
  onPhotos,
  properties,
  onCreate,
  onCancel,
  busy,
}: {
  goal: string;
  onGoal: (goal: string) => void;
  photos: File[];
  onPhotos: (files: File[]) => void;
  properties: Workspace['properties'][string][];
  onCreate: (input: ProjectIntakeInput) => Promise<unknown>;
  onCancel: () => void;
  busy: boolean;
}) {
  const [room, setRoom] = useState('');
  const [photoKind, setPhotoKind] = useState<'room' | 'inspiration'>('room');
  const [propertyId, setPropertyId] = useState('');
  const [approach, setApproach] = useState<NonNullable<ProjectIntakeInput['approach']> | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const disabled = busy || saving;
  return (
    <form
      className="project-start-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (disabled) return;
        setError('');
        const form = new FormData(event.currentTarget);
        const address = propertyId
          ? undefined
          : [form.get('street'), form.get('city'), form.get('region'), form.get('postal')]
              .map((v) => String(v || '').trim())
              .filter(Boolean)
              .join(', ');
        const name =
          String(form.get('name') || '').trim() ||
          (room ? `${room} project` : 'Home improvement project');
        const budget = String(form.get('budget') || '').trim();
        setSaving(true);
        try {
          const reference = referenceFromForm(form);
          const referencePhotos = photoKind === 'inspiration' && reference ? photos : [];
          await onCreate({
            name,
            goal:
              goal.trim() ||
              (photoKind === 'inspiration'
                ? 'Help me adapt this inspiration to my space.'
                : 'Help me plan improvements for this room from the attached photos.'),
            propertyId: propertyId || undefined,
            propertyName: address || 'My home',
            address,
            room: room || undefined,
            approach: approach || undefined,
            budgetMinor: budget ? lineTotalMinor(Number(budget), 100) : undefined,
            underway: form.get('underway') === 'on',
            photos: referencePhotos.length ? [] : photos,
            photoKind,
            references: reference ? [{ reference, photos: referencePhotos }] : [],
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setSaving(false);
        }
      }}
    >
      <p className="project-start-intro">
        A room or a whole house. Start with the photos and ideas you have.
      </p>
      <div className="project-start-grid">
        <div className="project-start-main">
          <fieldset>
            <legend>What are you working on?</legend>
            <div className="project-room-options">
              {rooms.map(([label, icon]) => (
                <button
                  type="button"
                  className={label === 'Whole home' ? 'project-whole-home-option' : undefined}
                  key={label}
                  aria-pressed={room === label}
                  onClick={() => setRoom(room === label ? '' : label)}
                  disabled={disabled}
                >
                  <Glyph name={icon} />
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            What would you like to change?
            <textarea
              name="goal"
              aria-label="What would you like to change?"
              value={goal}
              onChange={(event) => onGoal(event.target.value)}
              maxLength={300}
              required={!photos.length}
              placeholder="Replace the vanity, dark floor tile, keep the plumbing where it is…"
              disabled={disabled}
            />
          </label>
          <div className="project-photo-kind" role="group" aria-label="These photos show">
            <button
              type="button"
              aria-pressed={photoKind === 'room'}
              onClick={() => setPhotoKind('room')}
              disabled={disabled}
            >
              My room
            </button>
            <button
              type="button"
              aria-pressed={photoKind === 'inspiration'}
              onClick={() => setPhotoKind('inspiration')}
              disabled={disabled}
            >
              Inspiration
            </button>
          </div>
          <PhotoPicker
            files={photos}
            onChange={onPhotos}
            disabled={disabled}
            title={photoKind === 'inspiration' ? 'Add inspiration images' : 'Add room photos'}
          />
          <details className="project-start-reference">
            <summary>Add inspiration or a product link</summary>
            <ReferenceFields />
          </details>
        </div>
        <div className="project-start-details">
          <fieldset>
            <legend>
              <Glyph name="home" />
              Where’s the project?
            </legend>
            {properties.length > 0 && (
              <label className="project-existing-place">
                Home
                <select
                  aria-label="Choose a home"
                  value={propertyId}
                  onChange={(event) => setPropertyId(event.target.value)}
                  disabled={disabled}
                >
                  <option value="">A new place</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!propertyId && (
              <>
                <p className="project-field-hint">City or postcode is enough to start.</p>
                <label>
                  City / town
                  <input
                    name="city"
                    autoComplete="address-level2"
                    maxLength={100}
                    placeholder="Philadelphia"
                    disabled={disabled}
                  />
                </label>
                <div className="project-location-row">
                  <label>
                    State / region
                    <input
                      name="region"
                      autoComplete="address-level1"
                      maxLength={80}
                      placeholder="PA"
                      disabled={disabled}
                    />
                  </label>
                  <label>
                    ZIP / postcode
                    <input
                      name="postal"
                      autoComplete="postal-code"
                      maxLength={24}
                      placeholder="19125"
                      disabled={disabled}
                    />
                  </label>
                </div>
                <label>
                  Street address <span>optional</span>
                  <input
                    name="street"
                    autoComplete="street-address"
                    maxLength={200}
                    placeholder="Add the address when you’re ready"
                    disabled={disabled}
                  />
                </label>
              </>
            )}
          </fieldset>
          <fieldset>
            <legend>How do you want to tackle it?</legend>
            <div className="project-approach-options">
              {(
                [
                  ['diy', 'DIY'],
                  ['contractor', 'Hire a pro'],
                  ['undecided', 'Not sure yet'],
                ] as const
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={approach === value}
                  onClick={() => setApproach(value)}
                  disabled={disabled}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <details className="project-extra-details">
            <summary>
              A few more details <span>optional</span>
            </summary>
            <label>
              Target budget <span>USD</span>
              <input
                type="number"
                name="budget"
                min="0"
                max="100000000"
                step="1"
                inputMode="decimal"
                placeholder="5,000"
                disabled={disabled}
              />
            </label>
            <label>
              Project name
              <input
                name="name"
                maxLength={300}
                placeholder={room ? `${room} project` : 'Home improvement project'}
                disabled={disabled}
              />
            </label>
            <label className="project-underway">
              <input type="checkbox" name="underway" disabled={disabled} />
              Work is already underway
            </label>
          </details>
        </div>
      </div>
      {error && (
        <p className="project-start-error" role="alert">
          {error}
        </p>
      )}
      <div className="project-start-actions">
        <span>
          <Glyph name="photo" />
          {photos.length
            ? `${photos.length} photo${photos.length === 1 ? '' : 's'} will be saved with your brief.`
            : 'You can add photos and measurements later.'}
        </span>
        <button type="button" className="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={disabled}>
          {saving ? 'Creating your project…' : 'Create project'}
          <Glyph name="right" />
        </button>
      </div>
    </form>
  );
}
