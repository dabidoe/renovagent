import { useState } from 'react';
import { lineTotalMinor } from '@renovagent/core';
import { Glyph } from '../../components/glyph.js';
import './project-preview.css';

// Marketing-only mock data, not a takeoff, productivity standard, or project estimate.
// These values never enter the workspace, catalog, or purchase plan.
const materialGroups = [
  {
    id: 'finishes',
    icon: 'tile',
    label: 'Finishes',
    summary: 'Vanity, basin & tile',
    items: [
      ['Vanity + basin', '1 set'],
      ['Wall tile', '80 sq ft'],
      ['Floor tile', '35 sq ft'],
    ],
  },
  {
    id: 'rough',
    icon: 'pipe',
    label: 'Behind the walls',
    summary: 'PEX, fittings & backer',
    items: [
      ['½-inch PEX supply', '25 ft'],
      ['Supply fittings', '8 pcs'],
      ['Tile backer board', '6 sheets'],
    ],
  },
  {
    id: 'fixings',
    icon: 'screw',
    label: 'The small things',
    summary: 'Screws, anchors & sealant',
    items: [
      ['Backer-board screws', '1 box'],
      ['Mounting anchors', '8 pcs'],
      ['Sanitary sealant', '2 tubes'],
    ],
  },
] as const;
const crew = [
  { trade: 'Plumbing', hours: 6, rateMinor: 7500 },
  { trade: 'Tile installation', hours: 24, rateMinor: 6000 },
] as const;
const money = (minor: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(minor / 100);
const sampleLaborMinor = crew.reduce(
  (total, item) => total + lineTotalMinor(item.hours, item.rateMinor),
  0,
);

export function ProjectPreview() {
  const [view, setView] = useState<'materials' | 'labor'>('materials');
  const [group, setGroup] = useState<(typeof materialGroups)[number]['id']>('rough');
  const active = materialGroups.find((item) => item.id === group)!;
  const selectGroup = (id: typeof group) => {
    setGroup(id);
    setView('materials');
  };
  return (
    <div className="project-preview" aria-label="Illustrative bathroom work breakdown">
      <div className="project-preview-scene">
        <img
          src={new URL('../../assets/examples/workspace-bath.jpg', import.meta.url).href}
          alt="Generated bathroom concept with oak vanity, tiled shower and dark floor; annotations link to example work packages"
          width={1600}
          height={1200}
          fetchPriority="high"
        />
        <span className="preview-image-label">
          <Glyph name="home" /> Bathroom concept
        </span>
        <button
          className="preview-pin preview-pin-finishes"
          aria-pressed={view === 'materials' && group === 'finishes'}
          onClick={() => selectGroup('finishes')}
        >
          <Glyph name="tile" />
          <span>Tile & finishes</span>
        </button>
        <button
          className="preview-pin preview-pin-rough"
          aria-pressed={view === 'materials' && group === 'rough'}
          onClick={() => selectGroup('rough')}
        >
          <Glyph name="pipe" />
          <span>Plumbing & prep</span>
        </button>
        <button
          className="preview-pin preview-pin-fixings"
          aria-pressed={view === 'materials' && group === 'fixings'}
          onClick={() => selectGroup('fixings')}
        >
          <Glyph name="screw" />
          <span>Fixings & supplies</span>
        </button>
      </div>
      <div className="preview-workup">
        <div className="preview-workup-heading">
          <strong>The whole job, broken down.</strong>
          <span>Illustrative</span>
        </div>
        <div className="preview-view-switch" role="group" aria-label="Example work breakdown views">
          <button aria-pressed={view === 'materials'} onClick={() => setView('materials')}>
            <Glyph name="materials" /> Materials
          </button>
          <button aria-pressed={view === 'labor'} onClick={() => setView('labor')}>
            <Glyph name="clock" /> Labor
          </button>
        </div>
        <div className="preview-workup-content" aria-live="polite">
          {view === 'materials' ? (
            <>
              <div
                className="preview-material-groups"
                role="group"
                aria-label="Material categories"
              >
                {materialGroups.map((item) => (
                  <button
                    key={item.id}
                    aria-label={item.label}
                    aria-pressed={group === item.id}
                    onClick={() => selectGroup(item.id)}
                  >
                    <Glyph name={item.icon} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
              <div className="preview-package-title">
                <strong>{active.summary}</strong>
                <span>Sample quantities</span>
              </div>
              <dl className="preview-quantity-list">
                {active.items.map(([name, quantity]) => (
                  <div key={name}>
                    <dt>{name}</dt>
                    <dd>{quantity}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <>
              <div className="preview-crew-header">
                <span>Trade</span>
                <span>Hours × rate · line total</span>
              </div>
              <dl className="preview-quantity-list preview-crew-list">
                {crew.map((item) => (
                  <div key={item.trade}>
                    <dt>
                      <Glyph name="people" />
                      {item.trade}
                    </dt>
                    <dd>
                      <span>
                        {item.hours}h @ {money(item.rateMinor)}/hr
                      </span>
                      <b>{money(lineTotalMinor(item.hours, item.rateMinor))}</b>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="preview-hours-note">
                Sample hours and rates for illustration, not a contractor quote.
              </p>
            </>
          )}
        </div>
        <button
          className="preview-labor-total"
          onClick={() => setView(view === 'labor' ? 'materials' : 'labor')}
          aria-label={view === 'labor' ? 'Show sample materials' : 'Show sample labor costs'}
        >
          <span>
            <Glyph name="clock" />
            <span>
              Example labor <strong>{money(sampleLaborMinor)}</strong>
            </span>
          </span>
          <Glyph name="right" />
        </button>
      </div>
      <p className="preview-fixture-note">
        Generated concept · Mock quantities & labor for illustration. Site measurements and
        contractor review required.
      </p>
    </div>
  );
}
