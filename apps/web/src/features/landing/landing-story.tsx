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

export function Transformation() {
  const [selected, setSelected] = useState('lvp-floor');
  const requirements = exampleScope.requirements.filter((r) => r.packageId === selected);
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
            <small>Example scope · r1</small>
          </div>
          <div className="scope-preview-packages" aria-label="Example work packages">
            {packages.map((p) => (
              <button key={p.id} aria-pressed={selected === p.id} onClick={() => setSelected(p.id)}>
                <Glyph name={icons[p.id]} />
                <span>{titles[p.id]}</span>
                <Glyph name="right" />
              </button>
            ))}
          </div>
          <div className="scope-preview-items" aria-live="polite">
            <strong>{titles[selected]}</strong>
            {requirements.slice(0, 3).map((r) => (
              <div key={r.id}>
                <span>{r.purpose}</span>
                <small>
                  {r.quantity === null
                    ? r.status === 'conditional'
                      ? 'Site check'
                      : r.status === 'needs-product-spec'
                        ? 'Product selection'
                        : r.status === 'needs-source'
                          ? 'Allowance unset'
                          : 'Measurement needed'
                    : `${r.quantity} ${r.unit}`}
                </small>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="story-evidence">Example scope · Measurements unconfirmed.</p>
    </section>
  );
}

export function ContractorHandoff({ onExample, busy }: { onExample: () => void; busy: boolean }) {
  return (
    <section
      className="landing-block handoff-section"
      id="contractor-handoff"
      aria-labelledby="handoff-title"
    >
      <div className="handoff-copy">
        <h2 id="handoff-title">
          A scope
          <br />
          <em>worth sharing.</em>
        </h2>
        <button className="prompt-example" onClick={onExample} disabled={busy}>
          Open an example project <Glyph name="right" />
        </button>
      </div>
      <div className="handoff-document" aria-label="Example contractor review packet">
        <div className="handoff-document-top">
          <span>
            <Glyph name="people" /> Contractor review
          </span>
          <small>Example · revision 1</small>
        </div>
        <h3>Living room refresh</h3>
        <div className="handoff-document-files">
          {[
            ['file', 'Scope of work'],
            ['materials', 'Material requirements'],
            ['chat', 'Open questions'],
          ].map(([icon, label]) => (
            <span key={label}>
              <Glyph name={icon} />
              {label}
            </span>
          ))}
        </div>
        <div className="handoff-open-question">
          <Glyph name="activity" />
          <div>
            <strong>Confirm on site</strong>
            <div className="handoff-checks">
              <span>Subfloor</span>
              <span>Dimensions</span>
              <span>Transitions</span>
            </div>
          </div>
        </div>
        <div className="handoff-review-state">
          <span className="review-dot" /> Ready for a contractor’s eyes <Glyph name="right" />
        </div>
        <p className="handoff-boundary">Example packet · Quote collection not connected.</p>
      </div>
    </section>
  );
}

export function MeasurementProof({ onExample, busy }: { onExample: () => void; busy: boolean }) {
  return (
    <div className="measurement-proof">
      <div className="scan-plan">
        <span className="scan-file">
          <Glyph name="plan" /> roomplan.json <small>Example import</small>
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
            Floor area · review before saving
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
        <p className="story-evidence">
          Example import · Separate capture app · Measurements unverified.
        </p>
        <button className="prompt-example" onClick={onExample} disabled={busy}>
          Explore the workspace <Glyph name="right" />
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
      <div className="story-heading">
        <h2 id="agent-title">
          Your project.
          <br />
          <em>Your assistant. Your data.</em>
        </h2>
      </div>
      <div className="agent-visual">
        <div className="agent-visual-source">
          <img src={museIcon} alt="Muse" width={72} height={72} />
          <span>Your assistant</span>
        </div>
        <span className="agent-visual-link" aria-hidden="true">
          <i />
          <Glyph name="connection" />
          <i />
        </span>
        <div className="agent-visual-brand">
          <BrandMark size={210} lockup />
          <span>Your project</span>
        </div>
        <span className="agent-visual-link" aria-hidden="true">
          <i />
          <Glyph name="right" />
          <i />
        </span>
        <div className="agent-visual-result">
          <Glyph name="code" />
          <span>Your source code</span>
        </div>
      </div>
      <div className="agent-story-bottom">
        <p>
          MCP tools · Local connection · Tested with Muse
          <br />
          <small>AI proposes. You decide.</small>
        </p>
        <a
          className="landing-source-link"
          href="https://github.com/dabidoe/unpermitted-ai"
          target="_blank"
          rel="noreferrer"
        >
          <Glyph name="code" /> View source on GitHub <Glyph name="right" />
        </a>
      </div>
      <p className="story-evidence">Local setup in repository · License unspecified.</p>
    </section>
  );
}
