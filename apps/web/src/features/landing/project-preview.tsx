import { useState } from 'react';
import { lineTotalMinor } from '@renovagent/core';
import { Glyph } from '../../components/glyph.js';
import { costMaterials, costLabor, laborTotalMinor, costMoney as money } from './cost-demo.js';
import './project-preview.css';
import './cost-demo.css';
const groups = [
  { id: 'all', label: 'All materials' },
  { id: 'plumbing', label: 'Plumbing' },
  { id: 'tile', label: 'Tile prep' },
  { id: 'fixings', label: 'Fixings & supplies' },
];
export function ProjectPreview() {
  const [view, setView] = useState<'materials' | 'labor'>('materials');
  const [group, setGroup] = useState('all');
  const visible = costMaterials.filter((item) => group === 'all' || item.group === group);
  return (
    <div className="cost-demo" aria-label="Bathroom materials and labor breakdown">
      <div className="cost-demo-heading">
        <div>
          <h3>The details behind the finish.</h3>
          <p>Bathroom refresh · From the pipe to the last screw.</p>
        </div>
        <div className="cost-view-switch" role="group" aria-label="Cost breakdown views">
          <button aria-pressed={view === 'materials'} onClick={() => setView('materials')}>
            <Glyph name="materials" />
            Materials
          </button>
          <button aria-pressed={view === 'labor'} onClick={() => setView('labor')}>
            <Glyph name="clock" />
            Labor
          </button>
        </div>
      </div>
      {view === 'materials' ? (
        <>
          <div className="cost-material-filters" role="group" aria-label="Material categories">
            {groups.map((item) => (
              <button
                key={item.id}
                aria-pressed={group === item.id}
                onClick={() => setGroup(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="cost-product-grid">
            {visible.map((item) => (
              <article className="cost-product" key={item.id}>
                <a
                  href={item.source}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${item.brand} ${item.name}, view retail reference`}
                >
                  <img
                    src={item.photo}
                    alt={`${item.brand} ${item.name}`}
                    width={150}
                    height={150}
                    loading="lazy"
                  />
                </a>
                <span className="cost-product-brand">{item.brand}</span>
                <h4>{item.name}</h4>
                <p>
                  {item.quantity} × {item.pack}
                </p>
                <div className="cost-product-price">
                  <strong>{money(lineTotalMinor(item.quantity, item.unitMinor))}</strong>
                  <span>{money(item.unitMinor)} each</span>
                </div>
                <a className="cost-source" href={item.source} target="_blank" rel="noreferrer">
                  {item.retailer} <Glyph name="right" />
                </a>
              </article>
            ))}
          </div>
          <div className="cost-demo-total">
            <div>
              <strong>Materials subtotal</strong>
              <span>{visible.length} product lines · Retail references, Oct 30</span>
            </div>
            <b>
              {money(
                visible.reduce(
                  (sum, item) => sum + lineTotalMinor(item.quantity, item.unitMinor),
                  0,
                ),
              )}
            </b>
          </div>
        </>
      ) : (
        <>
          <div className="cost-labor-summary">
            <span>
              <Glyph name="people" />2 trades
            </span>
            <span>
              <Glyph name="clock" />
              {costLabor.reduce((sum, item) => sum + item.hours, 0)} worker-hours
            </span>
            <small>Labor allowance</small>
          </div>
          <div className="cost-labor-lines">
            {costLabor.map((item) => (
              <article key={item.trade}>
                <img src={item.photo} alt="" width={70} height={70} />
                <div>
                  <h4>{item.trade}</h4>
                  <p>{item.task}</p>
                  <span>
                    {item.hours}h @ {money(item.rateMinor)}/hr
                  </span>
                </div>
                <strong>{money(lineTotalMinor(item.hours, item.rateMinor))}</strong>
              </article>
            ))}
          </div>
          <div className="cost-demo-total">
            <div>
              <strong>Labor allowance</strong>
              <span>Hours × trade rate</span>
            </div>
            <b>{money(laborTotalMinor)}</b>
          </div>
        </>
      )}
    </div>
  );
}
