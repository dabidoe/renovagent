import { useRef, useState, type CSSProperties } from 'react';
import { lineTotalMinor } from '@renovagent/core';
import { Glyph } from '../../components/glyph.js';
import './landing-v2.css';
import { Comparison } from './comparison.js';

const image = (name: string) => new URL(`../../assets/examples/${name}`, import.meta.url).href;
const starters = [
  { label: 'Renovate a room', text: 'I want to renovate my living room.' },
  {
    label: 'Diagnose a problem',
    text: 'I need help figuring out why my dishwasher is not draining.',
  },
  {
    label: 'Review a quote',
    text: 'I want to review a contractor quote and understand what is included.',
  },
];
// Presentation-only allowances: never written into a user's project or offered for checkout.
const materials = [
  {
    id: 'vanity',
    name: 'Oak-effect vanity cabinet',
    title: 'ÄNGSJÖN · 36-inch cabinet',
    finish: 'Oak effect',
    spec: '36 × 21 × 25⅛ in',
    quantity: '1 cabinet reference',
    check: 'Check wall support, plumbing position and compatible basin.',
    missing: 'Counter, basin, faucet, trap, supply lines and installation.',
    kind: 'Retail reference',
    price: 33900,
    x: 31,
    y: 54,
    basis: 'IKEA · ÄNGSJÖN · cabinet only',
    detail:
      '36-inch reference option. Sink, counter, faucet and installation are extra. Fit and stock have not been checked. The generated image does not depict this exact product.',
    href: 'https://www.ikea.com/us/en/p/aengsjoen-bathroom-vanity-with-drawers-oak-effect-20535355/',
  },
  {
    id: 'mirror',
    name: 'Black-framed mirror',
    title: 'Slim black-frame mirror',
    finish: 'Matte black concept',
    spec: '24 × 32 in concept option',
    quantity: '1 mirror allowance',
    check: 'Measure between the backsplash and light; verify mounting.',
    missing: 'Wall anchors, blocking and installation.',
    kind: 'Demo allowance',
    price: 8500,
    x: 30,
    y: 25,
    basis: 'Demo allowance · supplier TBD',
    detail:
      'An illustrative allowance, not a retrieved offer. Size, mounting and supplier still need selection.',
  },
  {
    id: 'shower',
    name: 'White subway wall tile',
    title: 'Classic subway · gloss white',
    finish: 'Gloss white concept',
    spec: '3 × 6 in concept tile',
    quantity: 'Area still to measure',
    check: 'Confirm coverage, substrate and a complete waterproofing system.',
    missing: 'Waterproofing, backer, mortar, grout, edge trim and labor.',
    kind: 'Demo allowance',
    price: 68000,
    x: 66,
    y: 38,
    basis: 'Demo allowance · supplier TBD',
    detail:
      'Illustrative wall-tile allowance, not a retailer quote or measured takeoff. Shower glass, fixtures and installation are not priced.',
  },
  {
    id: 'floor',
    name: 'Charcoal hex floor mosaic',
    title: 'Hex mosaic · charcoal',
    finish: 'Matte charcoal concept',
    spec: '2 in hex concept tile',
    quantity: 'Area still to measure',
    check: 'Confirm wet-area suitability, substrate and floor transitions.',
    missing: 'Underlayment, mortar, grout, waste and installation.',
    kind: 'Demo allowance',
    price: 24000,
    x: 65,
    y: 84,
    basis: 'Demo allowance · supplier TBD',
    detail:
      'Illustrative tile allowance, not an area-based estimate. Measurements, waste, underlayment, setting materials and installation remain unresolved.',
  },
];
const money = (minor: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(minor / 100);

function RealityPlan() {
  const [split, setSplit] = useState(50);
  return (
    <figure className="reality-figure">
      <div className="reality-stage" style={{ '--split': `${split}%` } as CSSProperties}>
        <img
          src={image('workspace-bath.jpg')}
          alt="Generated renovated bathroom with oak vanity, glass shower and dark hexagonal tile"
          width={1600}
          height={1200}
          loading="lazy"
        />
        <img
          className="reality-before"
          src={image('bath-before.jpg')}
          alt="Generated dated bathroom with fiberglass shower, faded curtain and tan vinyl flooring"
          width={1600}
          height={1200}
          loading="lazy"
        />
        <span className="scene-label scene-label-left">
          Reality <small>Before concept</small>
        </span>
        <span className="scene-label scene-label-right">
          The plan <small>Renovated concept</small>
        </span>
        <div className="reality-divider" aria-hidden="true">
          <span>‹ ›</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={split}
          onChange={(event) => setSplit(Number(event.target.value))}
          aria-label="Bathroom before and after comparison"
          aria-valuetext={`${split}% before, ${100 - split}% renovated`}
        />
      </div>
      <figcaption>
        Drag to explore · Both images are generated illustrations of the same room, not a completed
        renovation or a measured design.
      </figcaption>
    </figure>
  );
}

function MaterialScene() {
  const [selected, setSelected] = useState('vanity');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [included, setIncluded] = useState<string[]>(materials.map((item) => item.id));
  const active = materials.find((item) => item.id === selected)!;
  const total = materials
    .filter((item) => included.includes(item.id))
    .reduce((sum, item) => sum + lineTotalMinor(1, item.price), 0);
  return (
    <div className="material-demo">
      <div className="annotated-room">
        <img
          src={image('workspace-bath.jpg')}
          alt="Illustrative bathroom with selectable material callouts"
          width={1600}
          height={1200}
          loading="lazy"
        />
        <span className="scene-label">
          Explore the materials <small>Interactive illustration</small>
        </span>
        {materials.map((item, index) => (
          <button
            key={item.id}
            className={`material-pin ${selected === item.id ? 'is-selected' : ''}`}
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
            onClick={() => setSelected(item.id)}
            aria-label={`Inspect ${item.name}, ${money(item.price)}`}
            aria-pressed={selected === item.id}
          >
            <span className="pin-dot">{index + 1}</span>
            <span className="pin-card">
              <img
                className="pin-product-image"
                src={image(`product-${item.id}.jpg`)}
                alt=""
                width={64}
                height={64}
              />
              <small>
                {item.id === 'vanity' ? 'IKEA reference · cabinet only' : 'Demo allowance'}
              </small>
              <strong>{item.title}</strong>
              <span className="pin-spec">{item.spec}</span>
              <b>{money(item.price)}</b>
            </span>
          </button>
        ))}
      </div>
      <div className="material-quicklook" aria-live="polite">
        <img src={image(`product-${active.id}.jpg`)} alt="" width={72} height={72} />
        <div>
          <span>{active.kind}</span>
          <strong>{active.title}</strong>
          <small>{active.spec}</small>
          <a href="#material-details" onClick={() => setDetailsOpen(true)}>
            View specs & fit checks ↓
          </a>
        </div>
        <b>{money(active.price)}</b>
      </div>
      <div className="material-receipt">
        <div className="receipt-title">
          <span className="landing-eyebrow">A LOOK INSIDE THE LIST</span>
          <span className="demo-badge">Illustrative</span>
        </div>
        <h3>Every choice has a cost.</h3>
        <p>Try removing an allowance. The subtotal follows.</p>
        <div className="receipt-lines">
          {materials.map((item, index) => (
            <div
              key={item.id}
              className={`receipt-line ${selected === item.id ? 'selected-line' : ''}`}
            >
              <input
                type="checkbox"
                aria-label={`Include ${item.name} in example subtotal`}
                checked={included.includes(item.id)}
                onChange={(event) =>
                  setIncluded(
                    event.target.checked
                      ? [...included, item.id]
                      : included.filter((id) => id !== item.id),
                  )
                }
              />
              <button
                className="receipt-inspect"
                onClick={() => setSelected(item.id)}
                aria-label={`View details for ${item.name}`}
                aria-pressed={selected === item.id}
              >
                <img
                  className="receipt-product-image"
                  src={image(`product-${item.id}.jpg`)}
                  alt=""
                  width={48}
                  height={48}
                  loading="lazy"
                />
                <span>
                  <strong>
                    {index + 1}. {item.name}
                  </strong>
                  <small>{item.basis}</small>
                </span>
                <b>{money(item.price)}</b>
              </button>
            </div>
          ))}
        </div>
        <div className="receipt-total">
          <span>Selected material subtotal</span>
          <strong aria-live="polite" aria-atomic="true">
            {money(total)}
          </strong>
        </div>
        <div className="material-detail" id="material-details" aria-live="polite">
          <div className="product-detail-hero">
            <img
              src={image(`product-${active.id}.jpg`)}
              alt={`Generated style illustration for ${active.name}; not an exact retail product photo`}
              width={140}
              height={140}
              loading="lazy"
            />
            <div>
              <span className="demo-badge">{active.kind}</span>
              <h4>{active.title}</h4>
              <span className="product-detail-price">
                {money(active.price)}
                <small>{active.id === 'vanity' ? 'cabinet only' : 'demo allowance'}</small>
              </span>
            </div>
          </div>
          <details
            className="product-more"
            open={detailsOpen}
            onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
          >
            <summary>Specs, fit & installation details</summary>
            <dl className="product-specs">
              <div>
                <dt>Finish</dt>
                <dd>{active.finish}</dd>
              </div>
              <div>
                <dt>Size / format</dt>
                <dd>{active.spec}</dd>
              </div>
              <div>
                <dt>Quantity basis</dt>
                <dd>{active.quantity}</dd>
              </div>
              <div>
                <dt>Supplier</dt>
                <dd>
                  {active.id === 'vanity'
                    ? 'IKEA · article 205.353.55'
                    : 'Not selected · illustrative option'}
                </dd>
              </div>
            </dl>
            <div className="product-fit-check">
              <Glyph name="activity" />
              <p>
                <b>Check before selecting</b>
                {active.check}
              </p>
            </div>
            <p className="product-exclusions">
              <b>Also account for</b>
              {active.missing}
            </p>
            <p>{active.detail}</p>
            {active.href && (
              <a
                className="product-source-link"
                href={active.href}
                target="_blank"
                rel="noreferrer"
              >
                View source & product details ↗
              </a>
            )}
          </details>
          <small className="product-image-note">
            Generated style image, not an exact product photo. Concept sizes and fit are unverified.
          </small>
        </div>
        <p className="receipt-disclaimer">
          Example subtotal: one retail reference (Oct 29, 2026) and three demo allowances. Labor,
          tax, delivery and unlisted parts are not priced.
        </p>
      </div>
    </div>
  );
}

function BathroomDemo() {
  const [mode, setMode] = useState<'compare' | 'materials'>('compare');
  return (
    <section
      id="reality-plan"
      className="landing-block bathroom-demo"
      aria-labelledby="bathroom-demo-title"
    >
      <div className="v2-section-heading">
        <div>
          <span className="landing-eyebrow">ONE ROOM. A CONNECTED PLAN.</span>
          <h2 id="bathroom-demo-title">See the plan take shape.</h2>
        </div>
        <p>Explore the change. Then inspect the materials, costs and fit checks behind it.</p>
      </div>
      <div className="demo-toolbar">
        <div className="demo-mode-switch" role="group" aria-label="Bathroom example views">
          <button aria-pressed={mode === 'compare'} onClick={() => setMode('compare')}>
            <Glyph name="home" />
            Before / after
          </button>
          <button aria-pressed={mode === 'materials'} onClick={() => setMode('materials')}>
            <Glyph name="materials" />
            Materials & fit
          </button>
        </div>
        <span>Illustrative bathroom example</span>
      </div>
      <div hidden={mode !== 'compare'}>
        <RealityPlan />
      </div>
      <div hidden={mode !== 'materials'}>
        <MaterialScene />
      </div>
    </section>
  );
}

export function Landing({
  prompt,
  onPrompt,
  onStart,
  onExample,
  busy,
}: {
  prompt: string;
  onPrompt: (text: string) => void;
  onStart: () => void;
  onExample: () => void;
  busy: boolean;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const focusIdea = () => {
    input.current?.scrollIntoView({ block: 'center' });
    input.current?.focus({ preventScroll: true });
  };
  return (
    <div className="landing landing-v2 landing-refined">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <span className="landing-eyebrow">YOUR HOME IMPROVEMENT AGENT</span>
          <div className="prompt-intro">
            <h1 id="landing-title">
              Turn your space
              <br />
              into a <em>plan.</em>
            </h1>
            <p>
              Tell us what you want to fix or change. Give your ideas, scope and materials one place
              to live.
            </p>
          </div>
          <form
            className="prompt-start launch-prompt"
            onSubmit={(event) => {
              event.preventDefault();
              onStart();
            }}
          >
            <label htmlFor="start-prompt" className="sr-only">
              What would you like to improve?
            </label>
            <textarea
              id="start-prompt"
              ref={input}
              maxLength={300}
              rows={2}
              value={prompt}
              onChange={(event) => onPrompt(event.target.value)}
              placeholder="I want to redo my bathroom. Where do I start?"
            />
            <div>
              <span>A rough idea is enough to begin</span>
              <button className="send" disabled={busy} aria-label="Start a project">
                <Glyph name="arrow" />
              </button>
            </div>
          </form>
          <div className="landing-starters" aria-label="Project idea starters">
            {starters.map((starter) => (
              <button
                key={starter.label}
                onClick={() => {
                  onPrompt(starter.text);
                  input.current?.focus();
                }}
              >
                {starter.label}
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
        </div>
        <figure className="landing-art">
          <img
            src={image('hero-blueprint.jpg')}
            alt="Illustrative cutaway house blending a home with its blueprint"
            width={1145}
            height={1374}
          />
          <figcaption>
            From the idea to the details<span>Illustrative concept</span>
          </figcaption>
        </figure>
      </section>

      <div className="project-thread" aria-label="Project workflow">
        <svg viewBox="0 0 1000 44" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 22 C130 2 200 42 330 22 S535 2 665 22 S870 42 1000 22" />
        </svg>
        {['Your idea', 'Clear scope', 'Materials', 'Handoff'].map((text, index) => (
          <span key={text}>
            <b>0{index + 1}</b>
            {text}
          </span>
        ))}
      </div>

      <BathroomDemo />

      <section
        className="landing-block workflow-section"
        id="how-it-works"
        aria-labelledby="workflow-title"
      >
        <div className="v2-section-heading">
          <div>
            <span className="landing-eyebrow">FROM “I’M THINKING…” TO “HERE’S THE SCOPE.”</span>
            <h2 id="workflow-title">You don’t need to speak contractor.</h2>
          </div>
          <button className="prompt-example" disabled={busy} onClick={onExample}>
            {busy ? 'Opening example…' : 'Open an example project'}
            <Glyph name="right" />
          </button>
        </div>
        <div className="workflow-cards">
          {[
            {
              icon: 'chat',
              title: 'Start with what you know',
              text: 'Describe the room, the problem or the change you have in mind. Unknowns stay visible.',
            },
            {
              icon: 'plan',
              title: 'Give the work some structure',
              text: 'Keep work packages, measurements, assumptions and material requirements together.',
            },
            {
              icon: 'people',
              title: 'Bring a clearer scope',
              text: 'Review the proposed materials and keep changes tied to the project revision.',
            },
          ].map((step, index) => (
            <article key={step.title}>
              <div>
                <span>0{index + 1}</span>
                <Glyph name={step.icon} />
              </div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
        <details className="workflow-status">
          <summary>What’s working, and what’s next</summary>
          <p>
            Structured scope drafts, revision tracking and contractor accept / decline are
            implemented. Share links, contractor counterproposals and quote comparison are in
            development. Technical guidance still requires qualified review.
          </p>
        </details>
      </section>

      <Comparison />

      <section className="landing-block agent-strip">
        <Glyph name="connection" />
        <div>
          <span className="landing-eyebrow">BUILT FOR YOUR AGENT</span>
          <h2>Start in Muse. Keep the project.</h2>
          <p>
            The same project tools connect the conversation to saved scope and material proposals.
            Your facts, revisions and approval boundaries stay with the project.
          </p>
          <details>
            <summary>Connection availability</summary>
            <p>
              Authenticated MCP reads and a separate QA brief write/read were tested with Muse
              through temporary HTTPS. Stable hosted access is in development.
            </p>
          </details>
        </div>
      </section>

      <footer className="landing-footer">
        <div>
          <strong>Your project starts with an idea.</strong>
          <span>Bring the rough version.</span>
        </div>
        <button className="landing-primary" onClick={focusIdea}>
          Start your project
          <Glyph name="right" />
        </button>
      </footer>
    </div>
  );
}
