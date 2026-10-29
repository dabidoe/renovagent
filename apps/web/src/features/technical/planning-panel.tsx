import { useState } from 'react';
import {
  type Workspace,
  type PlanningInputs,
  type PlanningGroup,
  planningGroups,
  planningInputsSchema,
} from '@renovagent/contracts';
import {
  readPlanningInputs,
  planningId,
  latest,
  technicalSources,
  halfBathPlaybookVersion,
} from '@renovagent/core';
import { type WorkspaceController } from '../../app/workspace-controller.js';
export function PlanningPanel({
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
  const [inputs, setInputs] = useState(() => readPlanningInputs(state, projectId));
  const [revisions, setRevisions] = useState(
    () =>
      Object.fromEntries(
        planningGroups.map((g) => [
          g,
          latest(state.artifacts[planningId(projectId, g)])?.revision || 0,
        ]),
      ) as Record<PlanningGroup, number>,
  );
  const [units, setUnits] = useState<Record<string, string>>({});
  const [referenceIds, setReferenceIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [basis, setBasis] = useState<'user-reported' | 'example'>(() =>
    latest(state.artifacts[planningId(projectId, 'site')])?.payload.kind === 'planning-inputs'
      ? (
          latest(state.artifacts[planningId(projectId, 'site')])!.payload as Extract<
            import('@renovagent/contracts').ArtifactPayload,
            { kind: 'planning-inputs' }
          >
        ).basis
      : 'user-reported',
  );
  const set = (group: PlanningGroup, key: string, value: unknown) =>
    setInputs((p) => ({ ...p, [group]: { ...p[group], [key]: value } }));
  const nested = (
    group: 'locality' | 'filing' | 'systems' | 'electrical',
    key: string,
    value: unknown,
  ) =>
    setInputs((p) => ({
      ...p,
      context: { ...p.context, [group]: { ...p.context[group], [key]: value } },
    }));
  const nestedText = (
    group: 'locality' | 'filing' | 'systems' | 'electrical',
    key: string,
    label: string,
  ) => (
    <label>
      {label}
      <input
        value={String((inputs.context[group] as unknown as Record<string, unknown>)[key] ?? '')}
        onChange={(e) => nested(group, key, e.target.value || (group === 'locality' ? null : ''))}
      />
    </label>
  );
  const nestedChoice = (
    group: 'locality' | 'filing' | 'systems' | 'electrical',
    key: string,
    label: string,
    options: string[],
  ) => (
    <label>
      {label}
      <select
        value={String((inputs.context[group] as unknown as Record<string, unknown>)[key])}
        onChange={(e) => nested(group, key, e.target.value)}
      >
        {options.map((v) => (
          <option key={v} value={v}>
            {v.replaceAll('-', ' ')}
          </option>
        ))}
      </select>
    </label>
  );
  const systemNumber = (
    key:
      | 'circuitAmps'
      | 'basinReceptacleDistanceInches'
      | 'exhaustRatedCfm'
      | 'exhaustRatingPressureInWg',
    label: string,
  ) => (
    <label>
      {label}
      <input
        aria-label={label}
        type="number"
        min="0"
        step="any"
        placeholder="Unknown"
        value={inputs.context.systems[key] ?? ''}
        onChange={(e) =>
          nested('systems', key, e.target.value === '' ? null : Number(e.target.value))
        }
      />
    </label>
  );
  const electricalNumber = (key: 'serviceAmps' | 'basinBelowTopInches', label: string) => (
    <label>
      {label}
      <input
        aria-label={label}
        type="number"
        step="any"
        placeholder="Unknown"
        value={inputs.context.electrical[key] ?? ''}
        onChange={(e) =>
          nested('electrical', key, e.target.value === '' ? null : Number(e.target.value))
        }
      />
    </label>
  );
  const contextNumber = (
    key: 'stories' | 'dwellingUnits' | 'drainDiameterInches',
    label: string,
  ) => (
    <label>
      {label}
      <input
        aria-label={label}
        type="number"
        min="0"
        step="any"
        placeholder="Unknown"
        value={inputs.context[key] ?? ''}
        onChange={(e) => set('context', key, e.target.value === '' ? null : Number(e.target.value))}
      />
    </label>
  );
  const length = (group: 'site' | 'layout', key: string, label: string) => {
    const q = (inputs[group] as unknown as Record<string, PlanningInputs['site']['width']>)[key];
    const unit = q?.unit || units[`${group}:${key}`] || 'mm';
    return (
      <label key={key}>
        {label}
        <div className="measure-input">
          <input
            aria-label={label}
            type="number"
            min="0"
            step="any"
            value={q?.amount ?? ''}
            placeholder="Unknown"
            onChange={(e) =>
              set(
                group,
                key,
                e.target.value === '' ? null : { amount: Number(e.target.value), unit },
              )
            }
          />
          <select
            aria-label={`${label} unit`}
            value={unit}
            onChange={(e) => {
              setUnits((p) => ({ ...p, [`${group}:${key}`]: e.target.value }));
              if (q) set(group, key, { ...q, unit: e.target.value });
            }}
          >
            {['mm', 'cm', 'm', 'in', 'ft'].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
      </label>
    );
  };
  const text = (group: PlanningGroup, key: string, label: string) => (
    <label key={key}>
      {label}
      <input
        value={String((inputs[group] as unknown as Record<string, unknown>)[key] ?? '')}
        onChange={(e) => set(group, key, e.target.value)}
      />
    </label>
  );
  const choice = (group: PlanningGroup, key: string, label: string, options: string[]) => (
    <label>
      {label}
      <select
        value={String((inputs[group] as unknown as Record<string, unknown>)[key])}
        onChange={(e) => set(group, key, e.target.value)}
      >
        {options.map((v) => (
          <option key={v} value={v}>
            {v.replaceAll('-', ' ')}
          </option>
        ))}
      </select>
    </label>
  );
  const number = (key: keyof PlanningInputs['finish'], label: string) => (
    <label>
      {label}
      <input
        aria-label={label}
        type="number"
        min="0"
        step="any"
        placeholder="Unknown"
        value={inputs.finish[key] ?? ''}
        onChange={(e) => set('finish', key, e.target.value === '' ? null : Number(e.target.value))}
      />
    </label>
  );
  const save = async () => {
    try {
      setError('');
      const checked = planningInputsSchema.parse(inputs);
      await controller.savePlanning(projectId, checked, basis, revisions, referenceIds);
      setRevisions(
        Object.fromEntries(
          planningGroups.map((g) => [
            g,
            latest(controller.getSnapshot().workspace.artifacts[planningId(projectId, g)])
              ?.revision || 0,
          ]),
        ) as Record<PlanningGroup, number>,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <section className="planning-editor">
      <p className="eyebrow">TECHNICAL PLANNING · {halfBathPlaybookVersion}</p>
      <h2>Measure. Specify. Calculate.</h2>
      <p>
        Real local calculations from explicit inputs. Blank means unknown. Source applicability and
        construction gates remain separate from arithmetic.
      </p>
      <div className="investigation-banner">
        Code coverage is incomplete and has no qualified reviewer. No code minimum, route or price
        is filled in automatically.
      </div>
      <button
        className="text-button"
        disabled={busy}
        onClick={() => {
          const e = readPlanningInputs(state, projectId);
          e.site = {
            width: { amount: 5, unit: 'ft' },
            length: { amount: 7, unit: 'ft' },
            measurement: 'finished',
            drainRun: { amount: 8, unit: 'ft' },
            drainFall: { amount: 2, unit: 'in' },
          };
          e.layout = {
            toiletModel: 'Example fixture A · synthetic',
            toiletWidth: { amount: 16, unit: 'in' },
            toiletProjection: { amount: 28, unit: 'in' },
            toiletCenterX: { amount: 18, unit: 'in' },
            basinModel: 'Example basin · synthetic',
            basinWidth: { amount: 20, unit: 'in' },
            basinDepth: { amount: 16, unit: 'in' },
            basinX: { amount: 34, unit: 'in' },
            minimumSide: { amount: 15, unit: 'in' },
            minimumFront: { amount: 21, unit: 'in' },
            door: 'unknown',
          };
          e.finish = {
            specification: 'Example floor finish · synthetic',
            wasteBasis: 'Example allowance selected by user, not a product recommendation',
            wasteBps: 1000,
            packageAreaM2: 1,
            inventoryAreaM2: 0,
            inventorySpecification: '',
            packagePriceMinor: null,
            currency: 'USD',
            priceSource: '',
            priceDate: null,
          };
          e.context = {
            ...e.context,
            jurisdiction: 'philadelphia',
            applicationDate: '2026-10-27',
            building: 'one-two-family-townhouse',
            scope: 'new-half-bath',
            accessibility: 'unknown',
            sourceAvailability: 'available',
            locality: {
              countryCode: 'US',
              regionCode: 'PA',
              municipality: 'Philadelphia',
              postalCode: null,
              propertyReference: 'Synthetic reference property',
              boundaryBasis: 'user-reported',
            },
            filing: {
              kind: 'new',
              completeness: 'reported-complete',
              selectedEdition: '2021',
              originalEdition: 'unknown',
              withinOriginalScope: 'unknown',
              originalPermitReference: '',
            },
            stories: 2,
            dwellingUnits: 1,
            separateEgress: 'yes',
            roomUse: 'private-dwelling',
            drainageMethod: 'philadelphia-single-stack',
            drainDiameterInches: 3,
            ventMethod: 'unknown',
            unavailableSourceIds: [],
          };
          setInputs(e);
          setBasis('example');
        }}
      >
        Load explicitly labeled example inputs
      </button>
      {basis === 'example' && (
        <p className="status warning-status">
          Example inputs · synthetic measurements and specifications
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <details open>
          <summary>01 / Finished room & observed route</summary>
          <div className="planning-fields">
            {length('site', 'width', 'Finished room width')}
            {length('site', 'length', 'Finished room length')}
            {choice('site', 'measurement', 'Measurement basis', [
              'unknown',
              'rough',
              'finished',
              'conflicting',
            ])}
            {length('site', 'drainRun', 'Measured drain horizontal run')}
            {length('site', 'drainFall', 'Available drain fall')}
          </div>
        </details>
        <details>
          <summary>02 / Named fixtures & layout constraints</summary>
          <p>
            Toilet against back wall, facing the room length. Basin against opposite wall.
            Coordinates begin at the left finished wall. This method supports one rectangular
            configuration.
          </p>
          <div className="planning-fields">
            {text('layout', 'toiletModel', 'Toilet model / cut sheet')}
            {length('layout', 'toiletWidth', 'Toilet width')}
            {length('layout', 'toiletProjection', 'Toilet projection')}
            {length('layout', 'toiletCenterX', 'Toilet centerline from left wall')}
            {text('layout', 'basinModel', 'Basin model / cut sheet')}
            {length('layout', 'basinWidth', 'Basin width')}
            {length('layout', 'basinDepth', 'Basin depth')}
            {length('layout', 'basinX', 'Basin left edge from left wall')}
            {length('layout', 'minimumSide', 'Manufacturer minimum centerline clearance')}
            {length('layout', 'minimumFront', 'Manufacturer minimum front clearance')}
            {choice('layout', 'door', 'Door / obstruction survey', [
              'unknown',
              'surveyed-clear',
              'conflict',
            ])}
          </div>
        </details>
        <details>
          <summary>03 / Floor specification, packages & sourced price</summary>
          <p>
            Area takeoff only. Coverage, waste and inventory must be supplied. No pipe lengths or
            accessory quantities are inferred.
          </p>
          <div className="planning-fields">
            {text('finish', 'specification', 'Floor finish specification')}
            {number('packageAreaM2', 'Package coverage (m²)')}
            {number('wasteBps', 'Waste allowance (basis points; 1000 = 10%)')}
            {text('finish', 'wasteBasis', 'Allowance rationale')}
            {number('inventoryAreaM2', 'Usable inventory (m²; enter 0 if none)')}
            {text('finish', 'inventorySpecification', 'Inventory specification (must match)')}
            {number('packagePriceMinor', 'Package price (minor units; USD cents)')}
            {text('finish', 'currency', 'Currency (USD, CAD, EUR or GBP)')}
            {text('finish', 'priceSource', 'Price source / quote reference')}
            <label>
              Price date
              <input
                type="date"
                value={inputs.finish.priceDate || ''}
                onChange={(e) => set('finish', 'priceDate', e.target.value || null)}
              />
            </label>
          </div>
        </details>
        <details>
          <summary>04 / Jurisdiction, scope & code basis</summary>
          <div className="planning-fields">
            {choice('context', 'jurisdiction', 'Jurisdiction', [
              'unknown',
              'philadelphia',
              'other',
            ])}
            <label>
              Complete application received date
              <input
                type="date"
                value={inputs.context.applicationDate || ''}
                onChange={(e) => set('context', 'applicationDate', e.target.value || null)}
              />
            </label>
            {choice('context', 'building', 'Building classification', [
              'unknown',
              'one-two-family-townhouse',
              'other',
            ])}
            {choice('context', 'scope', 'Work scope', [
              'unknown',
              'new-half-bath',
              'replacement-only',
              'other',
            ])}
            {contextNumber('stories', 'Stories')}
            {contextNumber('dwellingUnits', 'Dwelling units')}
            {choice('context', 'separateEgress', 'Separate means of egress', [
              'unknown',
              'yes',
              'no',
            ])}
            {choice('context', 'roomUse', 'Fixture use', [
              'unknown',
              'private-dwelling',
              'public-or-employee',
              'common-area',
            ])}
            {nestedChoice('filing', 'kind', 'Filing type', [
              'unknown',
              'new',
              'issued-permit-amendment',
              'expired-resubmission',
            ])}
            {nestedChoice('filing', 'completeness', 'Complete filing basis', [
              'unknown',
              'reported-complete',
              'incomplete',
            ])}
            {nestedChoice('filing', 'selectedEdition', 'Reported edition election', [
              'unknown',
              'not-specified',
              '2018',
              '2021',
            ])}
            {nestedChoice('filing', 'originalEdition', 'Original issued-permit edition', [
              'unknown',
              '2018',
              '2021',
            ])}
            {nestedText('filing', 'originalPermitReference', 'Original permit evidence reference')}
            {nestedChoice(
              'filing',
              'withinOriginalScope',
              'Amendment within original permitted scope',
              ['unknown', 'yes', 'no'],
            )}
            {choice('context', 'accessibility', 'Accessibility applicability', [
              'unknown',
              'requires-review',
              'not-established',
            ])}
            {choice('context', 'sourceAvailability', 'Curated source access', [
              'available',
              'unavailable',
            ])}
          </div>
        </details>
        <details>
          <summary>05 / Local property context & authority boundary</summary>
          <p>
            Reported location stays separate from verified authority and market coverage. A ZIP or
            postal city never selects code, prices, stores or contractor credentials.
          </p>
          <div className="planning-fields">
            {nestedText('locality', 'countryCode', 'Country code (e.g. US)')}
            {nestedText('locality', 'regionCode', 'State / region code (e.g. PA)')}
            {nestedText('locality', 'municipality', 'Municipality')}
            {nestedText('locality', 'postalCode', 'Postal code (optional)')}
            {nestedText(
              'locality',
              'propertyReference',
              'Property / parcel evidence reference (optional)',
            )}
            {nestedChoice('locality', 'boundaryBasis', 'Municipal boundary basis', [
              'unknown',
              'user-reported',
            ])}
          </div>
        </details>
        <details>
          <summary>06 / Local drainage method & source coverage</summary>
          <div className="planning-fields">
            {choice('context', 'drainageMethod', 'Drainage design method', [
              'unknown',
              'philadelphia-single-stack',
              'other',
            ])}
            {contextNumber('drainDiameterInches', 'Nominal drain diameter (inches)')}
            {choice('context', 'ventMethod', 'Proposed vent method', [
              'unknown',
              'outdoor-vent',
              'aav-for-water-closet',
              'aav-for-lavatory',
              'mixed-methods',
            ])}
          </div>
          <p>
            Mark any inaccessible source below. Retrieving a source does not provide qualified
            review. Unknown or ambiguous provisions cannot release work.
          </p>
          {technicalSources
            .filter((s) => s.access === 'retrieved')
            .map((source) => (
              <label className="planning-attestation" key={source.id}>
                <input
                  type="checkbox"
                  checked={inputs.context.unavailableSourceIds.includes(source.id)}
                  onChange={(e) =>
                    set(
                      'context',
                      'unavailableSourceIds',
                      e.target.checked
                        ? [...inputs.context.unavailableSourceIds, source.id]
                        : inputs.context.unavailableSourceIds.filter((id) => id !== source.id),
                    )
                  }
                />
                Unavailable for this work: {source.title}
              </label>
            ))}
        </details>
        <details>
          <summary>07 / Electrical &amp; exhaust observations</summary>
          <p>
            Reported observations only. Complete adopted electrical provisions and local exhaust
            amendment reconciliation remain blocked. Equipment ratings and visible devices do not
            verify installation.
          </p>
          <div className="planning-fields">
            {nestedChoice('systems', 'dwellingForm', 'Actual dwelling form', [
              'unknown',
              'detached',
              'twin-or-duplex',
              'rowhouse-townhouse',
              'other',
            ])}
            {systemNumber('circuitAmps', 'Reported bathroom circuit rating (A)')}
            {nestedChoice('systems', 'circuitServes', 'Circuit serves', [
              'unknown',
              'single-bathroom',
              'multiple-bathrooms',
              'other',
            ])}
            {systemNumber('basinReceptacleDistanceInches', 'Basin-to-receptacle distance (inches)')}
            {nestedChoice('systems', 'gfci', 'Reported GFCI protection', [
              'unknown',
              'reported-present',
              'reported-absent',
            ])}
            {nestedText(
              'systems',
              'electricalRecord',
              'Electrical drawing / circuit record reference',
            )}
            {nestedChoice('systems', 'exhaustStrategy', 'Proposed ventilation strategy', [
              'unknown',
              'window',
              'mechanical',
            ])}
            {nestedChoice('systems', 'exhaustOperation', 'Fan operation', [
              'unknown',
              'intermittent',
              'continuous',
            ])}
            {systemNumber('exhaustRatedCfm', 'Fan rated airflow (cfm)')}
            {systemNumber(
              'exhaustRatingPressureInWg',
              'Rating static pressure (inch water column)',
            )}
            {nestedChoice('systems', 'exhaustDischarge', 'Reported exhaust discharge', [
              'unknown',
              'outdoors',
              'attic',
              'crawlspace',
              'interior',
            ])}
            {nestedText('systems', 'exhaustRecord', 'Fan cut sheet / route record reference')}
          </div>
        </details>
        <details>
          <summary>08 / Electrical code path &amp; basin measurement basis</summary>
          <p>
            Use actual reported service and measurement records. This narrow IRC comparison does not
            cover the NEC alternative, full wiring design or verified installation. Unknown facts
            keep evaluation blocked.
          </p>
          <div className="planning-fields">
            {nestedChoice('electrical', 'designBasis', 'Reported electrical design basis', [
              'unknown',
              'irc-part-viii',
              'nec-alternative',
            ])}
            {nestedChoice('electrical', 'serviceVoltage', 'Service voltage system', [
              'unknown',
              '120-240',
              'other',
            ])}
            {nestedChoice('electrical', 'servicePhase', 'Service phase', [
              'unknown',
              'single',
              'other',
            ])}
            {electricalNumber('serviceAmps', 'Service rating (A)')}
            {nestedChoice('electrical', 'basinMeasurement', 'Basin distance measured from', [
              'unknown',
              'outside-edge',
            ])}
            {nestedChoice('electrical', 'basinMount', 'Basin receptacle mounting', [
              'unknown',
              'adjacent-wall-partition',
              'countertop',
              'cabinet-side-face',
              'other',
            ])}
            {electricalNumber(
              'basinBelowTopInches',
              'Receptacle below basin/countertop (inches; negative = above)',
            )}
            {nestedChoice('electrical', 'countertopAssemblyListed', 'Countertop assembly listing', [
              'unknown',
              'reported-listed',
              'reported-not-listed',
            ])}
          </div>
        </details>
        <label>
          Supporting files / observations (optional)
          <select
            multiple
            aria-label="Supporting technical evidence"
            value={referenceIds}
            onChange={(e) => setReferenceIds(Array.from(e.target.selectedOptions, (o) => o.value))}
          >
            {Object.values(state.evidence)
              .filter(
                (e) =>
                  e.projectId === projectId &&
                  (e.source.kind === 'attachment' || e.source.kind === 'user-observation'),
              )
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.source.attachment?.name || e.source.description.slice(0, 100)}
                </option>
              ))}
          </select>
        </label>
        <label className="planning-attestation">
          <input
            type="checkbox"
            checked={basis === 'user-reported'}
            onChange={(e) => setBasis(e.target.checked ? 'user-reported' : 'example')}
          />
          Use these as my reported inputs (otherwise retain example labeling).
        </label>
        {error && (
          <p role="alert" className="error-banner">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy} type="submit">
          Save inputs & calculate
        </button>
        <span className="small-note">
          Saved through validated commands. No AI or backend. Existing revisions remain in history.
        </span>
      </form>
    </section>
  );
}
