import { useState, type CSSProperties } from 'react';
import './comparison.css';
import { BrandMark } from '../../components/brand-mark.js';
import { Glyph } from '../../components/glyph.js';
const asset = (name: string) => new URL(`../../assets/brands/${name}`, import.meta.url).href;
const vendors = [
  {
    name: 'Handoff',
    logo: 'handoff.svg',
    plan: 'Scale',
    audience: 'Contractor software',
    price: 899,
    source: 'https://help.handoff.ai/en/articles/13745799-handoff-plans-compared',
  },
  {
    name: 'JobTread',
    logo: 'jobtread.svg',
    plan: 'One internal user',
    audience: 'Contractor software',
    price: 199,
    source: 'https://www.jobtread.com/pricing',
  },
  {
    name: 'Buildertrend',
    logo: 'buildertrend.png',
    plan: 'Full platform · from',
    audience: 'Contractor software',
    price: 499,
    source: 'https://buildertrend.com/pricing-1026/',
  },
];
type Status = 'available' | 'partial' | 'unknown';
const rows: { name: string; statuses: Status[]; labels: string[] }[] = [
  {
    name: 'Scope of work',
    statuses: ['available', 'available', 'available', 'available'],
    labels: [
      'Versioned scopes',
      'AI scopes & proposals',
      'Estimates & budgets',
      'Estimate worksheet',
    ],
  },
  {
    name: 'Measurements & takeoff',
    statuses: ['available', 'available', 'available', 'available'],
    labels: ['Floor-plan import', 'Scale takeoffs', 'Plan takeoffs', 'Plan takeoffs'],
  },
  {
    name: 'Materials & costs',
    statuses: ['partial', 'available', 'available', 'available'],
    labels: ['Demo catalog prices', 'Supplier tools', 'Cost catalog', 'Selections & budgets'],
  },
  {
    name: 'External assistant / MCP',
    statuses: ['available', 'available', 'available', 'unknown'],
    labels: ['Muse tested', 'Scale plan', 'MCP connector', 'Not confirmed'],
  },
  {
    name: 'Contractor collaboration',
    statuses: ['partial', 'available', 'available', 'available'],
    labels: [
      'Purchase-plan review',
      'Client & sub portals',
      'External portals',
      'Client management',
    ],
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
function VendorLogo({ vendor }: { vendor: (typeof vendors)[number] }) {
  return (
    <img
      className={`official-vendor-logo logo-${vendor.name.toLowerCase()}`}
      src={asset(vendor.logo)}
      alt={vendor.name}
      width={150}
      height={60}
      loading="lazy"
    />
  );
}
export function Comparison() {
  const [selectedVendor, setSelectedVendor] = useState(0);
  return (
    <section
      className="landing-block comparison-section"
      id="compare-tools"
      aria-labelledby="comparison-title"
    >
      <div className="comparison-intro">
        <h2 id="comparison-title">
          Your renovation.
          <br />
          <em>Your budget.</em>
        </h2>
        <p>Your project, alongside the tools built for construction businesses.</p>
      </div>
      <div
        className="price-chart"
        aria-label="Selected monthly software plans, one entry per product"
      >
        <div className="price-chart-renovagent">
          <BrandMark size={180} lockup />
          <strong>
            $0<small>Local prototype</small>
          </strong>
          <p>
            Built around
            <br />
            your project.
          </p>
          <span className="price-chart-zero" aria-hidden="true" />
        </div>
        {[...vendors]
          .sort((a, b) => a.price - b.price)
          .map((vendor) => (
            <a
              className={`price-chart-vendor ${vendor.price === null ? 'quote-vendor' : ''}`}
              key={vendor.name}
              href={vendor.source}
              target="_blank"
              rel="noreferrer"
              style={
                {
                  '--price-height': `${vendor.price === null ? 0 : (vendor.price / 899) * 150}px`,
                  '--price-width': `${vendor.price === null ? 0 : (vendor.price / 899) * 100}%`,
                } as CSSProperties
              }
            >
              <span className="price-chart-audience">{vendor.audience}</span>
              <VendorLogo vendor={vendor} />
              <span className="price-chart-plan">{vendor.plan}</span>
              <strong>
                {vendor.price === null ? 'Custom quote' : `$${vendor.price}`}
                <small>{vendor.price === null ? 'Contact sales' : '/ month'}</small>
              </strong>
              {vendor.price === null ? (
                <span className="price-quote-note">
                  <Glyph name="chat" /> No public monthly rate
                </span>
              ) : (
                <span className="price-chart-column" aria-hidden="true" />
              )}
            </a>
          ))}
      </div>
      <p className="price-chart-basis">
        Selected monthly plans · USD · October 30, 2026. Renovagent: local prototype; AI/hosting
        extra. Vendor terms vary.
      </p>
      <div className="comparison-capability-panel">
        <div className="capability-heading">
          <h3>What’s included.</h3>
          <div className="capability-legend">
            <span>
              <b className="legend-available">✓</b> Available
            </span>
            <span>
              <b className="legend-partial">◐</b> Limited
            </span>
            <span>— Not confirmed</span>
          </div>
        </div>
        <table className="capability-table">
          <caption className="sr-only">
            Published capability comparison. Not confirmed does not mean unavailable. Renovagent
            refers to the current local prototype.
          </caption>
          <thead>
            <tr>
              <th scope="col">Capability</th>
              <th scope="col">
                <BrandMark size={110} lockup />
                <span className="sr-only">Renovagent</span>
              </th>
              {vendors.map((v) => (
                <th scope="col" key={v.name}>
                  <VendorLogo vendor={v} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name}>
                <th scope="row">{row.name}</th>
                {row.statuses.map((status, index) => (
                  <td key={index}>
                    <Mark status={status} label={row.labels[index]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mobile-comparison">
          <div
            className="comparison-vendor-picker"
            role="group"
            aria-label="Choose a competitor to compare"
          >
            {vendors.map((vendor, index) => (
              <button
                key={vendor.name}
                aria-label={`Compare ${vendor.name}`}
                aria-pressed={selectedVendor === index}
                onClick={() => setSelectedVendor(index)}
              >
                <VendorLogo vendor={vendor} />
              </button>
            ))}
          </div>
          <div className="mobile-comparison-columns">
            <span>Renovagent</span>
            <span>{vendors[selectedVendor].name}</span>
          </div>
          <div aria-live="polite">
            {rows.map((row) => (
              <div className="mobile-comparison-row" key={row.name}>
                <h4>{row.name}</h4>
                <div>
                  <Mark status={row.statuses[0]} label={row.labels[0]} />
                  <Mark
                    status={row.statuses[selectedVendor + 1]}
                    label={row.labels[selectedVendor + 1]}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="comparison-footnote">
          <p>Independent comparison · No affiliation. Unconfirmed does not mean unavailable.</p>
          <div>
            Sources:{' '}
            {vendors.map((v) => (
              <a key={v.name} href={v.source} target="_blank" rel="noreferrer">
                {v.name} ↗
              </a>
            ))}
            <a
              href="https://www.jobtread.com/integrations/ai-connector"
              target="_blank"
              rel="noreferrer"
            >
              JobTread MCP ↗
            </a>
            <a
              href="https://buildertrend.com/frequently-asked-questions/"
              target="_blank"
              rel="noreferrer"
            >
              Buildertrend features ↗
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
