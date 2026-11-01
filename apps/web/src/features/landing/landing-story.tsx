import { useState } from 'react';
import { Glyph } from '../../components/glyph.js';
import { MuseConversation } from '../connect/muse-conversation.js';
import { exampleScan } from './landing-example.js';
import './landing-story.css';
const museIcon = new URL('../../assets/brand/muse-app-icon.png', import.meta.url).href;

export function ContractorHandoff({ onExample, busy }: { onExample: () => void; busy: boolean }) {
  const [view, setView] = useState<'room' | 'quote'>('room');
  // Bundled with the app: docs/ is not part of the deployed build.
  const roomCapture = new URL('../../assets/previews/room-photo-home.jpg', import.meta.url).href;
  const quoteCapture = new URL('../../assets/previews/room-quote-itemized.jpg', import.meta.url)
    .href;
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
          Plan it with
          <br />
          <em>Muse.</em>
        </h2>
        <p>
          Ask for a paint-and-floor plan. Save the things you find. Pick up in the studio with your
          choices ready to review.
        </p>
        <div className="agent-connection-links">
          <a className="landing-source-link" href="#connect">
            Connect Muse <Glyph name="right" />
          </a>
          <span>
            <img src={museIcon} alt="" width={20} height={20} /> Tested with Muse
          </span>
        </div>
      </div>
      <MuseConversation initialExample="plan" />
    </section>
  );
}
