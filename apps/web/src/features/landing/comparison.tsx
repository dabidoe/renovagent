import { useState } from 'react';
import './comparison.css';
import { BrandMark } from '../../components/brand-mark.js';

const asset = (name: string) => new URL(`../../assets/brands/${name}`, import.meta.url).href;
const capabilities = [
  { key: 'audience', label: 'Built for' },
  { key: 'planning', label: 'Plan the work' },
  { key: 'detail', label: 'See the detail' },
  { key: 'collaboration', label: 'Work together' },
] as const;
type Product = {
  id: string;
  name: string;
  logo?: string;
  plan: string;
  price: number;
  source?: string;
  capabilities: Record<(typeof capabilities)[number]['key'], string>;
};
// Marketing comparison only. Published plan / feature evidence lives in
// docs/landing-v2-competitor-sources.md; $0 describes the local Renovagent build.
const products: Product[] = [
  {
    id: 'renovagent',
    name: 'Renovagent',
    plan: 'Your home project',
    price: 0,
    capabilities: {
      audience: 'Your home project',
      planning: 'Room → scope',
      detail: 'Materials, quantities & labor',
      collaboration: 'Your agent & contractor',
    },
  },
  {
    id: 'jobtread',
    name: 'JobTread',
    logo: 'jobtread.svg',
    plan: 'One internal user',
    price: 199,
    source: 'https://www.jobtread.com/pricing',
    capabilities: {
      audience: 'Construction businesses',
      planning: 'Estimates & budgets',
      detail: 'Cost catalog & takeoffs',
      collaboration: 'Client & vendor portals',
    },
  },
  {
    id: 'buildertrend',
    name: 'Buildertrend',
    logo: 'buildertrend.png',
    plan: 'Starting at',
    price: 499,
    source: 'https://buildertrend.com/pricing-1026/',
    capabilities: {
      audience: 'Construction businesses',
      planning: 'Estimates & selections',
      detail: 'Budgets & allowances',
      collaboration: 'Client communication',
    },
  },
  {
    id: 'handoff',
    name: 'Handoff',
    logo: 'handoff.svg',
    plan: 'Scale',
    price: 899,
    source: 'https://help.handoff.ai/en/articles/13745799-handoff-plans-compared',
    capabilities: {
      audience: 'Construction businesses',
      planning: 'AI scopes & proposals',
      detail: 'Supplier tools & takeoffs',
      collaboration: 'Client & sub portals',
    },
  },
];
const competitors = products.filter((p) => p.id !== 'renovagent');
function ProductLogo({ product }: { product: Product }) {
  if (product.id === 'renovagent')
    return (
      <>
        <BrandMark size={160} lockup />
        <span className="sr-only">Renovagent</span>
      </>
    );
  return (
    <img
      className={`comparison-logo logo-${product.id}`}
      src={asset(product.logo!)}
      alt={product.name}
      width={150}
      height={60}
      loading="lazy"
    />
  );
}
export function Comparison() {
  const [competitor, setCompetitor] = useState('handoff');
  const selected = competitors.find((product) => product.id === competitor)!;
  const renovagent = products[0];
  return (
    <section
      className="landing-block comparison-section"
      id="compare-tools"
      aria-labelledby="comparison-title"
    >
      <div className="comparison-heading">
        <h2 id="comparison-title">
          Built around
          <br />
          <em>your renovation.</em>
        </h2>
        <p>Scope, materials, labor and the people doing the work. Together in one project.</p>
      </div>
      <div className="comparison-panel">
        <table className="comparison-table" id="capability-comparison">
          <caption className="sr-only">
            Compare Renovagent, JobTread, Buildertrend and Handoff planning capabilities.
          </caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Capability</span>
              </th>
              {products.map((product) => (
                <th
                  scope="col"
                  className={product.id === 'renovagent' ? 'reno-cell' : ''}
                  key={product.id}
                >
                  <ProductLogo product={product} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {capabilities.map((capability) => (
              <tr key={capability.key}>
                <th scope="row">{capability.label}</th>
                {products.map((product) => (
                  <td key={product.id} className={product.id === 'renovagent' ? 'reno-cell' : ''}>
                    {product.capabilities[capability.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Monthly plan</th>
              {products.map((product) => (
                <td key={product.id} className={product.id === 'renovagent' ? 'reno-cell' : ''}>
                  {product.source ? (
                    <a
                      href={product.source}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${product.name} ${product.plan}, $${product.price} per month. View plan details.`}
                    >
                      <strong>
                        ${product.price}
                        <small>/mo</small>
                      </strong>
                      <span>{product.plan}</span>
                    </a>
                  ) : (
                    <>
                      <strong>
                        $0<small>/mo</small>
                      </strong>
                      <span>Renovagent</span>
                    </>
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
        <div className="mobile-capability-comparison">
          <div className="mobile-comparison-picker">
            <label htmlFor="comparison-platform">Compare with</label>
            <select
              id="comparison-platform"
              aria-label="Compare platform"
              value={competitor}
              onChange={(event) => setCompetitor(event.target.value)}
            >
              {competitors.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mobile-comparison-card">
            <div className="mobile-comparison-brands">
              <div className="mobile-reno">
                <ProductLogo product={renovagent} />
                <p>{renovagent.capabilities.audience}</p>
              </div>
              <div>
                <ProductLogo product={selected} />
                <p>{selected.capabilities.audience}</p>
              </div>
            </div>
            <dl className="mobile-comparison-details" aria-live="polite">
              {capabilities
                .filter((capability) => capability.key !== 'audience')
                .map((capability) => (
                  <div className="mobile-capability-row" key={capability.key}>
                    <dt>{capability.label}</dt>
                    <dd className="mobile-reno">
                      <span className="sr-only">Renovagent: </span>
                      {renovagent.capabilities[capability.key]}
                    </dd>
                    <dd>
                      <span className="sr-only">{selected.name}: </span>
                      {selected.capabilities[capability.key]}
                    </dd>
                  </div>
                ))}
              <div className="mobile-capability-row mobile-capability-price">
                <dt>Monthly plan</dt>
                <dd className="mobile-reno">
                  <strong>
                    $0<small>/mo</small>
                  </strong>
                  <span>Renovagent</span>
                </dd>
                <dd>
                  <a
                    href={selected.source}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${selected.name} ${selected.plan}, $${selected.price} per month. View plan details.`}
                  >
                    <strong>
                      ${selected.price}
                      <small>/mo</small>
                    </strong>
                    <span>{selected.plan}</span>
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
      <p className="comparison-basis">
        USD / month · Selected plans, October 2026 · Vendor terms apply.
      </p>
    </section>
  );
}
