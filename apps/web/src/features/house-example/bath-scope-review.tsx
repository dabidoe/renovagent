import { useRef, useState, type ReactNode } from 'react';
import { bathroomRequirements, lineTotalMinor, purchaseUnits } from '@renovagent/core';
import { BathModelPreview, type ModelPins } from './bath-model-preview.js';
import { BathReviewIcon } from './bath-review-icon.js';
import exampleMasks from '../landing/hero-segments.json';

const assets = './examples/hutchinson/';
const examplePhoto = new URL('../../assets/examples/bath.webp', import.meta.url).href;
const dimensions = { floorLengthFt: 76 / 12, floorWidthFt: 68 / 12, ceilingHeightFt: 8 };
const floorSqFt = bathroomRequirements('floor-tile', dimensions).find(
  (item) => item.purpose === 'Field floor tile.',
)!.quantity!;
const wallSqFt = bathroomRequirements('paint', dimensions).find(
  (item) => item.purpose === 'Paintable wall area.',
)!.quantity!;
const tiles = {
  ivory: {
    name: 'Glendale Ivory',
    sku: 'GD011224HD1P6',
    caseSqFt: 15.6,
    caseMinor: 2636,
    source: 'https://www.homedepot.com/p/313783852',
    swatch: '#e0cfb2',
    sample: 'poly-haven-interior-tiles.webp',
  },
  gray: {
    name: 'Nova Falls Gray',
    sku: 'NP101224HD1P6',
    caseSqFt: 15.6,
    caseMinor: 2294,
    source: 'https://www.homedepot.com/p/303383377',
    swatch: '#a0a8ad',
    sample: 'ambientcg-tiles074.webp',
  },
} as const;
const windowLabor = { low: 15000, high: 25000 };

const scopes = {
  floor: {
    name: 'Floor',
    title: 'Remove and retile the exposed floor',
    note: 'Check the substrate after demolition. Confirm net tile area, cuts, mortar, grout and the doorway transition before ordering.',
    manualPath: 'M94 1024L127 990L511 882L558 873L599 900L633 946L621 1024Z',
    exampleMask: 'floor',
  },
  vanity: {
    name: 'Vanity',
    title: 'Replace the vanity and sink',
    note: 'Use the separate vanity revisions below to compare the cabinet, price and installation checks.',
    manualPath: 'M176 742L460 694L534 756L530 1000H176Z',
    exampleMask: 'vanity',
  },
  mirror: {
    name: 'Mirror',
    title: 'Retain the mirrored wall cabinet',
    note: 'Three-panel mirrored cabinet above the sink. Retain it and the light bar. Check mounting and door clearance after the vanity changes.',
    manualPath: 'M101 0H579V493H101Z',
    exampleMask: 'mirror',
  },
  paint: {
    name: 'Paint',
    title: 'Prepare and repaint the existing painted surfaces',
    note: 'The bath photo shows extensive wall tile. Measure the exposed paintable surface after deducting tiled sections, the door and the window. Paint coverage, coats and labor still need pricing.',
    manualPath: 'M574 44L665 75L660 456L578 459Z',
    exampleMask: 'shower',
  },
  window: {
    name: 'Window',
    title: 'Replace the window in the existing opening',
    note: 'Measure the opening, identify the frame and installation type, and confirm exterior access and finish repairs. The labor allowance comes from you. Window unit, trim and repairs are pending.',
    manualPath: 'M923 174L1153 46L1157 257L919 323Z',
    exampleMask: null,
  },
} as const;

type Scope = keyof typeof scopes;
const scopeKeys = Object.keys(scopes) as Scope[];
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = (minor: number) => dollars.format(minor / 100);

const existingPins = {
  floor: [29, 92],
  vanity: [23, 82],
  mirror: [25, 29],
  paint: [42, 32],
  window: [69, 19],
} as const;

export function BathScopeReview({
  vanityMinor,
  revised,
  difference,
  vanityPicker,
  vanityName,
  scopeHref,
  showScope,
  grayTile,
  focusFloor,
  floorSwapHref,
  vanitySource,
  vanityModel,
  installNote,
}: {
  vanityMinor: number;
  revised: boolean;
  difference: number;
  vanityPicker: ReactNode;
  vanityName: string;
  scopeHref: string;
  showScope: boolean;
  grayTile: boolean;
  focusFloor: boolean;
  floorSwapHref: string;
  vanitySource: string;
  vanityModel: string;
  installNote: string;
}) {
  const [conceptPins, setConceptPins] = useState<ModelPins>(existingPins);
  const tile = tiles[grayTile ? 'gray' : 'ivory'];
  const cases = purchaseUnits(floorSqFt, tile.caseSqFt);
  const tileTotal = lineTotalMinor(cases, tile.caseMinor);
  const [selected, select] = useState<Scope>(focusFloor ? 'floor' : 'vanity');
  const tileDialog = useRef<HTMLDialogElement>(null);
  const [annotation, setAnnotation] = useState<'vanity' | 'mirror' | null>(null);
  const [view, setView] = useState<'bath' | 'sam' | 'plan' | 'concept'>('concept');
  const views = [
    { id: 'bath', icon: 'photo', label: 'Existing photo' },
    { id: 'concept', icon: 'concept', label: 'Proposed room' },
    { id: 'plan', icon: 'plan', label: 'Floor plan' },
    { id: 'sam', icon: 'scan', label: 'SAM example' },
  ] as const;
  const scope = scopes[selected];
  const budget = vanityMinor + tileTotal;
  const mask = scope.exampleMask ? exampleMasks.objects[scope.exampleMask] : null;
  const floorConcept = selected === 'floor' && view === 'bath';
  const scene =
    view === 'sam'
      ? { image: examplePhoto, width: exampleMasks.width, height: exampleMasks.height }
      : floorConcept || view === 'concept'
        ? { image: assets + 'vanity-oak-concept.jpg', width: 1536, height: 1024 }
        : { image: assets + 'photo-09.jpg', width: 1500, height: 1000 };
  const paths = view === 'concept' ? undefined : view === 'sam' ? mask?.path : scope.manualPath;

  const range = money(budget + windowLabor.low) + '–' + money(budget + windowLabor.high);
  function pick(key: Scope) {
    select(key);
    setAnnotation(key === 'vanity' || key === 'mirror' ? key : null);
    if (view === 'plan') setView('bath');
  }

  if (showScope)
    return (
      <section className="bath-schedule" aria-label="Scope and estimate">
        <div className="bath-budget-head">
          <span>Partial budget</span>
          <strong>{range}</strong>
          {revised && <small>+{money(difference)} vs. white freestanding</small>}
        </div>
        <div className="bath-punch-heading">
          <h2>Contractor checklist</h2>
          <button type="button" onClick={() => window.print()}>
            Print
          </button>
        </div>
        <div className="bath-table-frame">
          <table className="bath-punch-table">
            <thead>
              <tr>
                <th>Work</th>
                <th>Quantity</th>
                <th>Price basis</th>
                <th>Before quoting</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">
                  <BathReviewIcon name="vanity" />
                  Vanity
                </th>
                <td>1 vanity and sink</td>
                <td>
                  <a href={vanitySource} target="_blank" rel="noreferrer">
                    {vanityModel}
                  </a>
                  <strong>{money(vanityMinor)} materials</strong>
                </td>
                <td>
                  {installNote} Confirm cabinet fit, faucet and drain alignment. Price removal and
                  hookup.
                </td>
              </tr>
              <tr>
                <th scope="row">
                  <BathReviewIcon name="mirror" />
                  Mirror
                </th>
                <td>1 existing cabinet</td>
                <td>Keep</td>
                <td>
                  Retain the three-panel mirrored cabinet and light bar. Check mounting and door
                  clearance.
                </td>
              </tr>
              <tr>
                <th scope="row">
                  <BathReviewIcon name="floor" />
                  Floor
                </th>
                <td>
                  {floorSqFt} sq ft gross
                  <br />
                  {cases} cases before deductions and waste
                </td>
                <td>
                  <a href={tile.source} target="_blank" rel="noreferrer">
                    {tile.name}
                  </a>
                  <strong>{money(tileTotal)} materials</strong>
                </td>
                <td>
                  Check the substrate. Measure the net area and price mortar, grout, transition and
                  labor.
                </td>
              </tr>
              <tr>
                <th scope="row">
                  <BathReviewIcon name="paint" />
                  Paint
                </th>
                <td>{wallSqFt} sq ft gross walls</td>
                <td>Unpriced</td>
                <td>Measure exposed painted area. Verify prep, primer, coats and labor.</td>
              </tr>
              <tr>
                <th scope="row">
                  <BathReviewIcon name="window" />
                  Window
                </th>
                <td>1 window</td>
                <td>
                  <strong>
                    {money(windowLabor.low)}–{money(windowLabor.high)}
                  </strong>
                  Owner labor allowance
                </td>
                <td>Measure the opening. Confirm unit, exterior access, trim and repairs.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="vanity-note">
          Listing plan 6′4″ × 5′8″ · 8′ ceiling assumed. Excludes unpriced materials, other labor,
          tax and delivery.
        </p>
      </section>
    );

  return (
    <section className="bath-scope" aria-label="Bathroom scope">
      <div className="bath-workspace">
        <aside className="bath-tool-rail" aria-label="Viewer tools">
          <div role="group" aria-label="Views">
            {views.map((item) => (
              <button
                key={item.id}
                type="button"
                title={item.label}
                aria-label={item.label}
                aria-pressed={view === item.id}
                onClick={() => {
                  if (item.id === 'bath' && selected === 'floor') select('vanity');
                  setView(item.id);
                }}
              >
                <BathReviewIcon name={item.icon} />
              </button>
            ))}
          </div>
          <div role="group" aria-label="Work items">
            {scopeKeys.map((key) => (
              <button
                key={key}
                type="button"
                title={scopes[key].name}
                aria-label={scopes[key].name}
                aria-pressed={view !== 'plan' && selected === key}
                onClick={() => pick(key)}
              >
                <BathReviewIcon name={key} />
              </button>
            ))}
          </div>
          <a href={scopeHref} title="Scope and estimate" aria-label="Scope and estimate">
            <BathReviewIcon name="scope" />
          </a>
        </aside>
        <figure className="vanity-visual">
          {view === 'plan' ? (
            <svg
              className="bath-plan-detail"
              viewBox="526 200 252 194"
              role="img"
              aria-label="Upper-floor listing plan detail with the full bath highlighted"
            >
              <image href={assets + 'photo-21.jpg'} width="1333" height="1000" />
              <path d="M598 238H727V341H675V352H629L598 305Z" />
            </svg>
          ) : (
            <div className="bath-scope-image" style={{ aspectRatio: scene.width / scene.height }}>
              <img
                style={view === 'concept' ? { visibility: 'hidden' } : undefined}
                src={scene.image}
                alt={
                  view === 'sam'
                    ? 'Example bathroom for SAM highlighting'
                    : 'Hutchinson bathroom reference'
                }
                width={scene.width}
                height={scene.height}
              />
              {view === 'concept' && (
                <BathModelPreview
                  key={String(revised) + String(grayTile)}
                  onPins={setConceptPins}
                  floating={revised}
                  grayTile={grayTile}
                />
              )}
              {paths && (
                <svg viewBox={`0 0 ${scene.width} ${scene.height}`} aria-hidden="true">
                  {floorConcept && (
                    <defs>
                      <pattern
                        id="bath-floor-texture"
                        width="190"
                        height="190"
                        patternUnits="userSpaceOnUse"
                      >
                        <rect width="190" height="190" fill={tile.swatch} />
                        <image
                          href={assets + 'material-samples/' + tile.sample}
                          width="190"
                          height="190"
                          opacity=".6"
                        />
                      </pattern>
                    </defs>
                  )}
                  <path
                    d={paths}
                    fillRule="evenodd"
                    style={
                      floorConcept
                        ? {
                            fill: 'url(#bath-floor-texture)',
                            fillOpacity: 0.72,
                            stroke: tile.swatch,
                          }
                        : undefined
                    }
                  />
                </svg>
              )}
              {annotation && (view === 'concept' || view === 'bath') && (
                <section
                  className="bath-annotation"
                  role="region"
                  aria-label={annotation === 'vanity' ? 'Vanity annotation' : 'Mirror annotation'}
                >
                  <button
                    className="bath-annotation-close"
                    aria-label="Close annotation"
                    type="button"
                    onClick={() => setAnnotation(null)}
                  >
                    ×
                  </button>
                  <span>Existing</span>
                  <strong>
                    {annotation === 'vanity' ? 'Painted standard vanity' : 'Mirrored wall cabinet'}
                  </strong>
                  <p>
                    {annotation === 'vanity'
                      ? 'Standard sink · two-handle faucet'
                      : 'Three mirrored panels · light bar above'}
                  </p>
                  {annotation === 'vanity' ? (
                    <>
                      <span>Proposed</span>
                      <strong>{vanityName}</strong>
                      <p>{money(vanityMinor)} · Vanity and sink</p>
                      {vanityPicker}
                    </>
                  ) : (
                    <p>Keep · Check mounting and door clearance.</p>
                  )}
                </section>
              )}
              {(view === 'concept' || (view === 'bath' && !floorConcept)) &&
                scopeKeys.map((key) => {
                  const [x, y] = (view === 'concept' ? conceptPins : existingPins)[key];
                  return (
                    <button
                      key={key}
                      className="bath-pin"
                      type="button"
                      aria-label={'Highlight ' + scopes[key].name.toLowerCase()}
                      aria-pressed={selected === key && annotation === key}
                      style={{ left: x + '%', top: y + '%' }}
                      onClick={() => pick(key)}
                    >
                      <BathReviewIcon name={key} />
                    </button>
                  );
                })}
            </div>
          )}
          <figcaption>
            {view === 'concept'
              ? '3D concept · Generic fixtures · Fit unverified'
              : view === 'plan'
                ? 'Listing plan · Full bath'
                : view === 'sam'
                  ? mask
                    ? `SAM 3.1 · ${mask.phrase} on the sample photo`
                    : 'Window mask unavailable'
                  : floorConcept
                    ? tile.name + ' · Illustrative texture'
                    : 'Existing · Manual highlight'}
          </figcaption>
        </figure>
        <div className="bath-stage-footer">
          <div className="bath-current">
            <BathReviewIcon name={selected} />
            <strong>{scope.name}</strong>
          </div>

          {selected === 'floor' && (
            <button
              className="bath-swap"
              type="button"
              onClick={() => tileDialog.current?.showModal()}
            >
              Swap <BathReviewIcon name="concept" />
            </button>
          )}
          <a className="bath-budget-trigger" href={scopeHref}>
            <span>Partial budget</span>
            <strong>{range}</strong>
            <BathReviewIcon name="scope" />
          </a>
        </div>
      </div>
      <dialog className="vanity-dialog" ref={tileDialog} aria-labelledby="bath-tile-title">
        <header className="vanity-dialog-head">
          <h2 id="bath-tile-title">Swap floor tile</h2>
          <form method="dialog">
            <button type="submit" aria-label="Close tile swap">
              ×
            </button>
          </form>
        </header>
        <p>Texture samples are illustrative. Product links show the exact tile.</p>
        <div className="bath-choice-list">
          {Object.entries(tiles).map(([id, item]) => (
            <a
              key={id}
              href={floorSwapHref.split('?')[0] + (id === 'gray' ? '?tile=gray' : '?tile=ivory')}
              aria-current={item === tile ? 'page' : undefined}
              onClick={() => tileDialog.current?.close()}
            >
              <span className="bath-swatch-choice">
                <img
                  src={assets + 'material-samples/' + item.sample}
                  width="34"
                  height="34"
                  alt=""
                />
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.sku}</small>
                </span>
              </span>
              <strong>{money(item.caseMinor)}/case</strong>
            </a>
          ))}
        </div>
      </dialog>
    </section>
  );
}
