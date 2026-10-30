import type { CSSProperties } from 'react';
import './comparison.css';
import { BrandMark } from '../../components/brand-mark.js';

const vendors = [
  {
    name: 'Homesage',
    plan: 'Starting plan¹',
    price: 75,
    source: 'https://homesage.ai/faq/',
    color: '#20a6b7',
  },
  {
    name: 'Handoff',
    plan: 'Flex',
    price: 149,
    source: 'https://help.handoff.ai/en/articles/13745799-handoff-plans-compared',
    color: '#34465e',
  },
  {
    name: 'JobTread',
    plan: 'One internal user',
    price: 199,
    source: 'https://www.jobtread.com/pricing',
    color: '#ff862e',
  },
  {
    name: 'Handoff',
    plan: 'Pro',
    price: 299,
    source: 'https://help.handoff.ai/en/articles/13745799-handoff-plans-compared',
    color: '#34465e',
  },
  {
    name: 'Handoff',
    plan: 'Scale',
    price: 899,
    source: 'https://help.handoff.ai/en/articles/13745799-handoff-plans-compared',
    color: '#34465e',
  },
];
const columns = ['Renovagent', 'Handoff', 'Homesage', 'JobTread', 'Buildertrend'];
type Status = 'available' | 'partial' | 'unknown';
const rows: { name: string; note: string; statuses: Status[]; labels: string[] }[] = [
  {
    name: 'Itemized scopes',
    note: 'Turn a job into structured work.',
    statuses: ['available', 'available', 'unknown', 'available', 'unknown'],
    labels: [
      'Recipe drafts',
      'Scopes & proposals',
      'Not verified',
      'Specifications',
      'Not verified',
    ],
  },
  {
    name: 'Material planning',
    note: 'Keep requirements and sourcing together.',
    statuses: ['available', 'available', 'unknown', 'available', 'unknown'],
    labels: ['Demo catalog', 'Supplier platform', 'Not verified', 'Cost catalog', 'Not verified'],
  },
  {
    name: 'External agent / MCP',
    note: 'Work through an agent you already use.',
    statuses: ['available', 'available', 'available', 'unknown', 'unknown'],
    labels: ['Muse tested', 'Scale plan', 'MCP access', 'Not verified', 'Not verified'],
  },
  {
    name: 'Persistent projects',
    note: 'Return to the same work and decisions.',
    statuses: ['available', 'available', 'unknown', 'available', 'available'],
    labels: [
      'Versioned records',
      'Project management',
      'Not verified',
      'Project management',
      'Project management',
    ],
  },
  {
    name: 'Contractor collaboration',
    note: 'Keep the scope and review connected.',
    statuses: ['partial', 'available', 'unknown', 'available', 'available'],
    labels: [
      'Accept / decline only',
      'Portals by plan',
      'Not verified',
      'External portals',
      'Client management',
    ],
  },
  {
    name: 'Open-source distribution',
    note: 'License and packaging status.',
    statuses: ['partial', 'unknown', 'unknown', 'unknown', 'unknown'],
    labels: ['Being finalized', 'Not verified', 'Not verified', 'Not verified', 'Not verified'],
  },
];
function Mark({ status, label }: { status: Status; label: string }) {
  return (
    <span className={`capability-status status-${status}`}>
      <b aria-hidden="true">{status === 'available' ? '✓' : status === 'partial' ? '◐' : '—'}</b>
      <span>{label}</span>
    </span>
  );
}
export function Comparison() {
  return (
    <section className="landing-block comparison-section" aria-labelledby="comparison-title">
      <div className="comparison-price-panel">
        <div className="comparison-intro">
          <span className="landing-eyebrow">THE BIGGER PICTURE</span>
          <h2 id="comparison-title">
            A clearer plan.
            <br />
            <em>Before the big spend.</em>
          </h2>
          <p>Planning your home improvement shouldn’t feel like running a construction company.</p>
        </div>
        <div
          className="comparison-chart"
          aria-label="Published monthly software subscription prices"
        >
          <div className="comparison-renovagent">
            <BrandMark size={54} />
            <strong>
              renov<span>agent</span>
            </strong>
            <b>
              Your home.
              <br />
              Your project.
            </b>
            <p>Working prototype</p>
            <small>Muse connected · scope to materials</small>
            <span className="reno-bar" aria-hidden="true" />
          </div>
          <div className="vendor-bars">
            {vendors.map((vendor) => (
              <a
                className="vendor-bar"
                key={`${vendor.name}-${vendor.plan}`}
                href={vendor.source}
                target="_blank"
                rel="noreferrer"
                style={
                  {
                    '--bar-height': `${(vendor.price / 899) * 190}px`,
                    '--bar-color': vendor.color,
                    '--bar-width': `${(vendor.price / 899) * 100}%`,
                  } as CSSProperties
                }
              >
                <span className="vendor-name">
                  {vendor.name}
                  <small>{vendor.plan}</small>
                </span>
                <span className="vendor-value">
                  <b>${vendor.price}</b>
                  <small>/month</small>
                </span>
                <span className="vendor-column" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
        <div className="comparison-chart-footer">
          <a href="https://buildertrend.com/pricing/" target="_blank" rel="noreferrer">
            Buildertrend <b>Custom quote ↗</b>
          </a>
          <span>
            Monthly billing where published. ¹ Homesage FAQ starting rate; credits and promotional
            terms vary. Additional users may cost extra.
          </span>
        </div>
      </div>
      <div className="comparison-capability-panel">
        <div className="capability-heading">
          <div>
            <span className="landing-eyebrow">LOOK PAST THE PRICE TAG</span>
            <h3>Compare what matters.</h3>
          </div>
          <div className="capability-legend">
            <span>
              <b className="legend-available">✓</b> Available
            </span>
            <span>
              <b className="legend-partial">◐</b> Partial / planned
            </span>
            <span>— Not verified</span>
          </div>
        </div>
        <table className="capability-table">
          <caption className="sr-only">
            Published capability comparison. Not verified does not mean unavailable. Renovagent
            capabilities refer to the current prototype.
          </caption>
          <thead>
            <tr>
              <th scope="col">Capability</th>
              {columns.map((name) => (
                <th scope="col" key={name}>
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name}>
                <th scope="row">{row.name}</th>
                {row.statuses.map((status, index) => (
                  <td key={columns[index]}>
                    <Mark status={status} label={row.labels[index]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mobile-capabilities">
          {rows.map((row) => (
            <article key={row.name}>
              <div>
                <h4>{row.name}</h4>
                <Mark status={row.statuses[0]} label={row.labels[0]} />
              </div>
              <p>{row.note}</p>
              <details>
                <summary>Compare other tools</summary>
                <ul>
                  {columns.slice(1).map((name, index) => (
                    <li key={name}>
                      <strong>{name}</strong>
                      <Mark status={row.statuses[index + 1]} label={row.labels[index + 1]} />
                    </li>
                  ))}
                </ul>
              </details>
            </article>
          ))}
        </div>
        <div className="comparison-footnote">
          <p>
            Independent snapshot · October 29, 2026. Products serve different audiences;
            availability varies by plan. “Not verified” does not mean absent. Renovagent is a
            prototype; public pricing and licensing are being finalized.
          </p>
          <div>
            Sources:{' '}
            <a
              href="https://www.handoff.ai/official-information-about-handoff"
              target="_blank"
              rel="noreferrer"
            >
              Handoff
            </a>
            <a href="https://homesage.ai/faq/" target="_blank" rel="noreferrer">
              Homesage
            </a>
            <a href="https://www.jobtread.com/pricing" target="_blank" rel="noreferrer">
              JobTread
            </a>
            <a
              href="https://buildertrend.com/frequently-asked-questions/"
              target="_blank"
              rel="noreferrer"
            >
              Buildertrend
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
