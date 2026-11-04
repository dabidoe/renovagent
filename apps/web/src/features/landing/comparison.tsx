import { BrandMark } from '../../components/brand-mark.js';
import './comparison.css';

const asset = (name: string) => new URL(`../../assets/brands/${name}`, import.meta.url).href;
const handoffPricing = 'https://help.handoff.ai/en/articles/13745799-handoff-plans-compared';
const jobtreadPricing = 'https://www.jobtread.com/pricing';
const buildertrendPricing = 'https://buildertrend.com/pricing/';
// Monthly references, November 2, 2026. Buildertrend is the owner's supplied
// Advanced-plan benchmark; its current public page quotes per business.
const prices = [
  { id: 'renovagent', name: 'Renovagent', plan: 'Free demo', price: 0 },
  {
    id: 'jobtread',
    name: 'JobTread',
    plan: '1 internal user',
    price: 199,
    source: jobtreadPricing,
    logo: 'jobtread.svg',
  },
  {
    id: 'buildertrend',
    name: 'Buildertrend',
    plan: 'Advanced plan',
    price: 499,
    source: buildertrendPricing,
    logo: 'buildertrend.png',
  },
  {
    id: 'handoff-scale',
    name: 'Handoff',
    plan: 'Scale · 5 seats',
    price: 899,
    source: handoffPricing,
    logo: 'handoff.svg',
  },
];
export function Comparison() {
  return (
    <section
      className="landing-block comparison-section"
      id="compare-tools"
      aria-labelledby="comparison-title"
    >
      <div className="comparison-heading">
        <h2 id="comparison-title">
          Open source.
          <br />
          <em>Not open wallet.</em>
        </h2>
        <p>Keep the monthly overhead at $0.</p>
      </div>
      <div className="comparison-price-panel">
        <ol className="price-ladder" aria-label="Selected monthly software prices in US dollars">
          {prices.map((product) => (
            <li
              key={product.id}
              className={`price-rung ${product.id === 'renovagent' ? 'is-renovagent' : ''}`}
            >
              <div className="price-brand">
                {product.id === 'renovagent' ? (
                  <BrandMark size={130} lockup />
                ) : (
                  <img
                    src={asset(product.logo!)}
                    alt={product.name}
                    width={130}
                    height={52}
                    loading="lazy"
                  />
                )}
              </div>
              <span className="price-product">{product.name}</span>
              <span className="price-plan">{product.plan}</span>
              <strong>
                ${product.price}
                {product.id === 'buildertrend' ? '+' : ''}
                <small>/mo</small>
              </strong>
              {product.source ? (
                <a
                  href={product.source}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${product.name} ${product.plan} pricing source`}
                >
                  Plan details ↗
                </a>
              ) : (
                <a href="https://github.com/dabidoe/renovagent" target="_blank" rel="noreferrer">
                  View the code ↗
                </a>
              )}
            </li>
          ))}
        </ol>
        <div className="comparison-included">
          <b>What $0 gets you</b>
          <ul>
            <li>Photo design concepts</li>
            <li>Paint & floor estimates</li>
            <li>Editable 3D furniture</li>
            <li>Your agent over MCP</li>
          </ul>
        </div>
      </div>
      <p className="comparison-basis">
        USD/mo, selected plans, November 2, 2026. Buildertrend quotes vary.
      </p>
    </section>
  );
}
