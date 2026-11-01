import { PhotoPicker } from '../project-start/photo-picker.js';
import { useRef, useState, type CSSProperties } from 'react';
import { lineTotalMinor } from '@renovagent/core';
import { Glyph } from '../../components/glyph.js';
import { BrandMark } from '../../components/brand-mark.js';
import './landing-v2.css';
import { Comparison } from './comparison.js';
import { ProjectPreview } from './project-preview.js';
import { HeroScene } from './hero-scene.js';
import {
  Transformation,
  ContractorHandoff,
  MeasurementProof,
  AgentConnection,
} from './landing-story.js';
import './hero-scene.css';
import './product-experience.css';
import './hero-ar.css';
import './landing-polish.css';

const image = (name: string) => new URL(`../../assets/examples/${name}`, import.meta.url).href;
const starters = [
  { label: 'Renovate a room', text: 'I want to renovate my living room.', icon: 'home' },
  {
    label: 'Diagnose a problem',
    icon: 'activity',
    text: 'I need help figuring out why my dishwasher is not draining.',
  },
  {
    label: 'Review a quote',
    icon: 'file',
    text: 'I want to review a contractor quote and understand what is included.',
  },
];
// Presentation-only allowances: never written into a user's project or offered for checkout.
const materials = [
  {
    id: 'vanity',
    name: 'IKEA ÄNGSJÖN vanity',
    title: 'IKEA ÄNGSJÖN · 36″',
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
    title: '2″ charcoal porcelain hex',
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
        <span className="scene-label scene-label-left">Before</span>
        <span className="scene-label scene-label-right">After</span>
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
      <figcaption>Drag to reveal the transformation</figcaption>
    </figure>
  );
}

function MaterialScene() {
  const [selected, setSelected] = useState('vanity');
  const [openProduct, setOpenProduct] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [included, setIncluded] = useState<string[]>(materials.map((item) => item.id));
  const active = materials.find((item) => item.id === selected)!;
  const total = materials
    .filter((item) => included.includes(item.id))
    .reduce((sum, item) => sum + lineTotalMinor(1, item.price), 0);
  return (
    <div className="material-demo product-experience">
      <div className="annotated-room">
        <img
          src={image('workspace-bath.jpg')}
          alt="Illustrative bathroom with selectable material callouts"
          width={1600}
          height={1200}
          loading="lazy"
        />
        <span className="scene-label">Hover or tap to look closer</span>
        {materials.map((item) => (
          <div
            key={item.id}
            className={`product-anchor product-anchor-${item.id}`}
            style={{ '--product-x': item.x, '--product-y': item.y } as CSSProperties}
            onMouseEnter={() => {
              setSelected(item.id);
              setOpenProduct(item.id);
            }}
            onMouseLeave={() => {
              if (window.matchMedia('(hover: hover)').matches) setOpenProduct(null);
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setOpenProduct(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpenProduct(null);
            }}
          >
            <button
              className="material-pin"
              onClick={() => {
                setSelected(item.id);
                setOpenProduct(item.id);
              }}
              onFocus={() => {
                setSelected(item.id);
                setOpenProduct(item.id);
              }}
              aria-label={`Inspect ${item.name}, ${money(item.price)}`}
              aria-expanded={openProduct === item.id}
              aria-controls={`product-popover-${item.id}`}
            >
              <Glyph
                name={item.id === 'vanity' ? 'pipe' : item.id === 'mirror' ? 'file' : 'tile'}
              />
            </button>
            <div
              className="product-popover"
              id={`product-popover-${item.id}`}
              hidden={openProduct !== item.id}
            >
              <button
                className="product-popover-close"
                aria-label={`Close ${item.name} preview`}
                onClick={() => setOpenProduct(null)}
              >
                <Glyph name="close" />
              </button>
              <div className="product-popover-heading">
                <img src={image(`product-${item.id}.jpg`)} alt="" width={88} height={88} />
                <div>
                  <span>{item.finish.replace(' concept', '')}</span>
                  <h3>{item.title}</h3>
                  <strong>{money(item.price)}</strong>
                  <small>{item.spec.replace(' concept', '')}</small>
                </div>
              </div>
              <div className="product-additions">
                <strong>Behind the price</strong>
                <dl>
                  {(item.id === 'vanity'
                    ? [
                        ['2 supply lines', '$24'],
                        ['Fittings & stops', '$38'],
                        ['Screws & anchors', '$12'],
                      ]
                    : item.id === 'floor'
                      ? [['Mortar + grout + trim', '$126']]
                      : item.id === 'mirror'
                        ? [['Anchors & blocking', '$18']]
                        : [
                            ['Backer & waterproofing', '$220'],
                            ['Mortar + grout + trim', '$165'],
                          ]
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="product-image-strip" aria-label="Explore finish products">
        {materials.map((item) => (
          <button
            key={item.id}
            aria-label={`Preview ${item.name}`}
            aria-pressed={selected === item.id}
            onClick={() => {
              setSelected(item.id);
              setOpenProduct(item.id);
            }}
          >
            <img
              src={image(`product-${item.id}.jpg`)}
              alt=""
              width={100}
              height={100}
              loading="lazy"
            />
            <span>{item.name}</span>
            <strong>{money(item.price)}</strong>
          </button>
        ))}
      </div>
      <details
        className="material-receipt-disclosure"
        open={listOpen}
        onToggle={(event) => setListOpen(event.currentTarget.open)}
      >
        <summary>
          Product breakdown <span>{money(total)} subtotal</span>
        </summary>
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
              Generated style image, not an exact product photo. Concept sizes and fit are
              unverified.
            </small>
          </div>
          <p className="receipt-disclaimer">
            Example subtotal: one retail reference (Oct 29, 2026) and three demo allowances. Labor,
            tax, delivery and unlisted parts are not priced.
          </p>
        </div>
      </details>
    </div>
  );
}

function BathroomDemo({ onExample, busy }: { onExample: () => void; busy: boolean }) {
  const [mode, setMode] = useState<'compare' | 'materials' | 'measure' | 'work'>('compare');
  return (
    <section
      id="product-proof"
      className="landing-block bathroom-demo"
      aria-labelledby="bathroom-demo-title"
    >
      <h2 id="bathroom-demo-title" className="showcase-title">
        See your space transform.
      </h2>
      <div hidden={mode !== 'compare'}>
        <RealityPlan />
      </div>
      <div hidden={mode !== 'materials'}>
        <MaterialScene />
      </div>
      <div hidden={mode !== 'measure'}>
        <MeasurementProof onExample={onExample} busy={busy} />
      </div>
      <div className="proof-work-packages" hidden={mode !== 'work'}>
        <ProjectPreview />
      </div>
      <div className="demo-toolbar">
        <div className="demo-mode-switch" role="group" aria-label="Product proof views">
          <button aria-pressed={mode === 'compare'} onClick={() => setMode('compare')}>
            <Glyph name="home" /> Design previews
          </button>
          <button aria-pressed={mode === 'materials'} onClick={() => setMode('materials')}>
            <Glyph name="materials" /> Materials
          </button>
          <button aria-pressed={mode === 'measure'} onClick={() => setMode('measure')}>
            <Glyph name="plan" /> Scan & measure
          </button>
          <button aria-pressed={mode === 'work'} onClick={() => setMode('work')}>
            <Glyph name="people" /> Work & costs
          </button>
        </div>
      </div>
    </section>
  );
}

export function Landing({
  prompt,
  onPrompt,
  photos,
  onPhotos,
  onStart,
  onExample,
  onOwnProject,
  onExamples,
  busy,
}: {
  prompt: string;
  onPrompt: (text: string) => void;
  photos: File[];
  onPhotos: (files: File[]) => void;
  onStart: () => void;
  onExample: () => void;
  onOwnProject: () => void;
  onExamples: () => void;
  busy: boolean;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const focusIdea = () => {
    input.current?.scrollIntoView({ block: 'center' });
    input.current?.focus({ preventScroll: true });
  };
  return (
    <div className="landing landing-v2 landing-refined landing-cinematic">
      <section className="landing-hero" aria-labelledby="landing-title">
        <HeroScene />
        <div className="landing-copy">
          <div className="prompt-intro">
            <h1 id="landing-title">
              Turn your space
              <br />
              into a <em>plan.</em>
            </h1>
            <p>The room you imagine. The work it takes.</p>
          </div>
        </div>
        <div className="hero-launch">
          <form
            className="prompt-start launch-prompt"
            onSubmit={(event) => {
              event.preventDefault();
              onStart();
            }}
          >
            <p id="project-setup-hint" className="sr-only">
              Next, add your place and project details.
            </p>
            <label htmlFor="start-prompt" className="sr-only">
              What would you like to improve?
            </label>
            <textarea
              id="start-prompt"
              ref={input}
              maxLength={300}
              aria-describedby="project-setup-hint"
              rows={2}
              value={prompt}
              onChange={(event) => onPrompt(event.target.value)}
              placeholder="I want to redo my bathroom. Where do I start?"
            />
            <div>
              <PhotoPicker compact files={photos} onChange={onPhotos} disabled={busy} />
              <button className="send" disabled={busy}>
                {busy ? 'Opening…' : 'Start a project'}
                <Glyph name="right" />
              </button>
            </div>
          </form>
          <p className="hero-paint-line">
            <button type="button" onClick={onOwnProject}>
              {photos.length
                ? `Imagine it on ${photos.length === 1 ? 'this photo' : `these ${photos.length} photos`}`
                : 'Try paint & floors on your photos'}{' '}
              <span aria-hidden="true">→</span>
            </button>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={onExamples}>
              See listing examples <span aria-hidden="true">→</span>
            </button>
          </p>
          <p className="hero-agent-line">
            <img
              src={new URL('../../assets/brand/muse-app-icon.png', import.meta.url).href}
              alt=""
              width={20}
              height={20}
            />
            <a href="#connect">
              Connect with Muse or your agent <span aria-hidden="true">↗</span>
            </a>
          </p>
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
                <Glyph name={starter.icon} />
              </button>
            ))}
          </div>
        </div>
      </section>

      <Transformation />
      <BathroomDemo onExample={onExample} busy={busy} />
      <ContractorHandoff onExample={onExample} busy={busy} />
      <AgentConnection />
      <Comparison />

      <footer className="landing-footer">
        <div className="footer-invitation">
          <h2>
            Got a room in mind?
            <br />
            <em>Let’s make a plan.</em>
          </h2>
          <button className="landing-primary" onClick={focusIdea}>
            Start your project <Glyph name="right" />
          </button>
        </div>
        <div className="footer-signature">
          <a href="#" aria-label="Renovagent home">
            <BrandMark size={150} lockup />
          </a>
          <span>Built for the home you’re imagining.</span>
          <nav aria-label="Footer navigation">
            <a href="#product-proof">Explore</a>
            <a href="#compare-tools">Compare</a>
            <a href="https://github.com/dabidoe/unpermitted-ai" target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
