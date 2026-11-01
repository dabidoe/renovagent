import { useState } from 'react';
import { Glyph } from '../../components/glyph.js';
import { BrandMark } from '../../components/brand-mark.js';
import { exampleScope, exampleScan } from './landing-example.js';
import './landing-story.css';
const floorImage = new URL('../../assets/examples/floor.jpg', import.meta.url).href;
const museIcon = new URL('../../assets/brand/muse-app-icon.png', import.meta.url).href;
const icons: Record<string, string> = {
  'removal-protection': 'home',
  'wall-paint': 'paint',
  'carpet-removal': 'layers',
  'lvp-floor': 'tile',
};
const titles: Record<string, string> = {
  'removal-protection': 'Protect the room',
  'wall-paint': 'Prep & paint',
  'carpet-removal': 'Remove the carpet',
  'lvp-floor': 'Flooring, trim & transitions',
};
const packages = exampleScope.packages.filter((p) => p.included);
const quantity = (id: string) => exampleScope.requirements.find((r) => r.id === id)!.quantity!;
const packageDetail: Record<
  string,
  { amount: number; unit: string; title: string; rows: string[][] }
> = {
  'lvp-floor': {
    amount: quantity('lvp-floor:planks'),
    unit: 'sq ft',
    title: 'Oak-look vinyl plank',
    rows: [
      ['Quarter-round trim', `${quantity('lvp-floor:quarter-round')} linear ft`],
      ['Finish', 'Warm natural oak'],
      ['Installation', 'Click-lock plank'],
    ],
  },
  'wall-paint': {
    amount: quantity('wall-paint:walls'),
    unit: 'sq ft',
    title: 'Warm white walls',
    rows: [
      ['Finish coats', '2 coats'],
      ['Surface', 'Walls · 8 ft ceiling'],
      ['Keep', 'Existing stairs & woodwork'],
    ],
  },
  'carpet-removal': {
    amount: quantity('carpet-removal:carpet'),
    unit: 'sq ft',
    title: 'Carpet & pad removal',
    rows: [
      ['Remove', 'Carpet, pad & tack strip'],
      ['Disposal', 'Bag & haul away'],
      ['Prepare', 'Exposed subfloor'],
    ],
  },
  'removal-protection': {
    amount: 1,
    unit: 'room',
    title: 'Protect before you begin',
    rows: [
      ['Cover', 'Stairs & adjoining floors'],
      ['Move', 'Furniture out of the work area'],
      ['Finish', 'Return furniture & clean up'],
    ],
  },
};

export function Transformation() {
  const [selected, setSelected] = useState('lvp-floor');
  const detail = packageDetail[selected];
  return (
    <section
      className="landing-block transformation-section"
      id="how-it-works"
      aria-labelledby="transformation-title"
    >
      <div className="story-heading">
        <h2 id="transformation-title">
          Your idea. <em>Organized.</em>
        </h2>
      </div>
      <div className="transformation-visual">
        <div className="homeowner-idea">
          <img
            src={floorImage}
            alt="Wood flooring inspiration"
            width={1024}
            height={768}
            loading="lazy"
          />
          <blockquote>“{exampleScope.request}”</blockquote>
          <div className="idea-attachments">
            <span>
              <Glyph name="photo" /> Room photos
            </span>
            <span>
              <Glyph name="plan" /> Rough measurements
            </span>
          </div>
        </div>
        <span className="transformation-arrow" aria-hidden="true">
          <Glyph name="right" />
        </span>
        <div className="scope-preview">
          <div className="scope-preview-top">
            <span>
              <Glyph name="file" /> Living room refresh
            </span>
            <small>20 × 14 ft</small>
          </div>
          <div className="scope-preview-packages" aria-label="Work packages">
            {packages.map((p) => (
              <button
                key={p.id}
                aria-label={titles[p.id]}
                title={titles[p.id]}
                aria-pressed={selected === p.id}
                onClick={() => setSelected(p.id)}
              >
                <Glyph name={icons[p.id]} />
                <span>{titles[p.id]}</span>
                <Glyph name="right" />
              </button>
            ))}
          </div>
          <div className="scope-preview-items" aria-live="polite">
            <div className="scope-quantity">
              <b>{detail.amount}</b>
              <span>
                {detail.unit}
                <small>{detail.title}</small>
              </span>
            </div>
            {detail.rows.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ContractorHandoff({ onExample, busy }: { onExample: () => void; busy: boolean }) {
  const [view, setView] = useState<'room' | 'quote'>('room');
  const roomCapture = new URL('../../../../../docs/previews/room-photo-home.png', import.meta.url)
    .href;
  const quoteCapture = new URL(
    '../../../../../docs/previews/room-quote-itemized.png',
    import.meta.url,
  ).href;
  return (
    <section
      className="landing-block handoff-section"
      id="contractor-handoff"
      aria-labelledby="handoff-title"
    >
      <div className="handoff-copy">
        <h2 id="handoff-title">
          The room. <br />
          The work. <br />
          <em>The price.</em>
        </h2>
        <p>
          Every job pinned where it happens. See what it takes to do it yourself—or what a pro
          quoted.
        </p>
        <div className="handoff-view-switch" role="group" aria-label="Explore the room product">
          <button aria-pressed={view === 'room'} onClick={() => setView('room')}>
            <Glyph name="home" /> Your room
          </button>
          <button aria-pressed={view === 'quote'} onClick={() => setView('quote')}>
            <Glyph name="file" /> Itemized quote
          </button>
        </div>
        <button className="prompt-example" onClick={onExample} disabled={busy}>
          Explore the whole-house project <Glyph name="right" />
        </button>
      </div>
      <figure className="room-product-proof">
        <div className={`room-product-crop is-${view}`}>
          <img
            src={view === 'room' ? roomCapture : quoteCapture}
            alt={
              view === 'room'
                ? 'Renovagent room with work pinned in place, finish choices, DIY costs and example contractor quotes'
                : 'Renovagent contractor quote broken down into materials and labor for each step; example contractor and review'
            }
            width={1440}
            height={1000}
            loading="lazy"
          />
        </div>
        <figcaption>
          {view === 'room'
            ? 'Change a finish. The room and the price change with it.'
            : 'Materials and labor, broken down by the work.'}
        </figcaption>
      </figure>
    </section>
  );
}

export function MeasurementProof({ onExample, busy }: { onExample: () => void; busy: boolean }) {
  return (
    <div className="measurement-proof">
      <div className="scan-plan">
        <span className="scan-file">
          <Glyph name="plan" /> roomplan.json
        </span>
        <svg
          viewBox="0 0 640 470"
          role="img"
          aria-label="Synthetic six by four metre room plan, twenty-four square metres"
        >
          <defs>
            <pattern id="scan-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M24 0H0V24" fill="none" stroke="#dce9fa" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="640" height="470" fill="url(#scan-grid)" />
          <path d="M100 100H540V370H100Z" fill="#edf5ff" stroke="#142038" strokeWidth="9" />
          <path d="M100 100H540" stroke="#0866ff" strokeWidth="9" />
          <path
            d="M100 65H540M100 55V75M540 55V75M575 100V370M565 100H585M565 370H585"
            fill="none"
            stroke="#0866ff"
            strokeWidth="2"
          />
          <text x="320" y="51" textAnchor="middle" fill="#0866ff" fontSize="17">
            6.00 m
          </text>
          <text
            x="595"
            y="240"
            textAnchor="middle"
            fill="#0866ff"
            fontSize="17"
            transform="rotate(90 595 240)"
          >
            4.00 m
          </text>
          <text x="320" y="230" textAnchor="middle" fill="#142038" fontSize="42" fontWeight="600">
            {exampleScan.floorAreaM2} m²
          </text>
          <text x="320" y="260" textAnchor="middle" fill="#64748b" fontSize="15">
            Floor area
          </text>
          {[
            [100, 100],
            [540, 100],
            [540, 370],
            [100, 370],
          ].map(([cx, cy]) => (
            <circle
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              r="7"
              fill="#fff"
              stroke="#0866ff"
              strokeWidth="3"
            />
          ))}
        </svg>
      </div>
      <div className="measurement-proof-copy">
        <h3>
          Bring your scan
          <br />
          into the plan.
        </h3>
        <p>Import RoomPlan or OpenPlan3D. Review and save your measurements.</p>
        <dl>
          <div>
            <dt>Floor area</dt>
            <dd>{exampleScan.floorAreaM2} m²</dd>
          </div>
          <div>
            <dt>Perimeter</dt>
            <dd>{exampleScan.perimeterM} m</dd>
          </div>
          <div>
            <dt>Ceiling height</dt>
            <dd>{exampleScan.ceilingHeightM} m</dd>
          </div>
        </dl>

        <button className="prompt-example" onClick={onExample} disabled={busy}>
          Explore the whole-house project <Glyph name="right" />
        </button>
        <a
          className="scan-source"
          href="https://github.com/laanlabs/openPlan3D"
          target="_blank"
          rel="noreferrer"
        >
          OpenPlan3D · MIT ↗
        </a>
      </div>
    </div>
  );
}

export function AgentConnection() {
  return (
    <section
      className="landing-block agent-story"
      id="agent-connection"
      aria-labelledby="agent-title"
    >
      <div className="agent-story-copy">
        <h2 id="agent-title">
          Your agent.
          <br />
          <em>On the same page.</em>
        </h2>
        <p>
          Bring your room, scope and materials into the conversation. Muse reads your project and
          proposes changes. You decide what makes it into the plan.
        </p>
        <div className="agent-connection-links">
          <span>
            <img src={museIcon} alt="" width={20} height={20} /> Tested with Muse
          </span>
          <a
            className="landing-source-link"
            href="https://github.com/dabidoe/unpermitted-ai"
            target="_blank"
            rel="noreferrer"
          >
            Built on MCP <Glyph name="right" />
          </a>
        </div>
      </div>
      <div
        className="agent-project-visual"
        role="img"
        aria-label="Diagram: Muse connects to your room, scope and material quantities. You approve proposed changes."
      >
        <div className="agent-endpoint">
          <img src={museIcon} alt="Muse" width={76} height={76} />
          <span>Muse</span>
        </div>
        <div className="agent-context-link" aria-hidden="true">
          <i />
          <Glyph name="connection" />
          <i />
        </div>
        <div className="agent-context-sheet">
          <div className="agent-context-heading">
            <div>
              <span>Project context</span>
              <strong>Living room refresh</strong>
            </div>
            <BrandMark size={84} lockup />
          </div>
          <div className="agent-context-room">
            <img
              src="/example-room/done-warm-white-lvp.jpg"
              alt=""
              width={1600}
              height={1000}
              loading="lazy"
            />
            <span>Warm white + natural oak</span>
          </div>
          <dl>
            {[
              ['tile', 'Flooring', `${quantity('lvp-floor:planks')} sq ft`],
              ['paint', 'Walls', `${quantity('wall-paint:walls')} sq ft`],
              ['layers', 'Trim', `${quantity('lvp-floor:quarter-round')} linear ft`],
            ].map(([icon, label, value]) => (
              <div key={label}>
                <dt>
                  <Glyph name={icon} />
                  {label}
                </dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="agent-context-approval">
            <Glyph name="people" />
            <span>You approve every change.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
