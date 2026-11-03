import { technicalSources } from '@renovagent/core';
import './systems-diagram.css';

const source = (id: string) => technicalSources.find((s) => s.id === id)!;
const requirements = [
  {
    id: '01',
    title: '15″ minimum on each side',
    text: 'Toilet centerline to a side wall, partition, vanity or other obstruction.',
    sourceId: 'ipc-2021-clearance',
    section: 'IPC 405.3.1',
  },
  {
    id: '02',
    title: '21″ clear in front',
    text: 'Open space in front of the toilet to a wall, fixture or door.',
    sourceId: 'ipc-2021-clearance',
    section: 'IPC 405.3.1',
  },
  {
    id: '03',
    title: '20 A bathroom circuit',
    text: 'Required basin and countertop receptacles use a 20 A bathroom branch circuit. Other outlets are restricted; a single-bathroom exception applies.',
    sourceId: 'irc-bathroom-circuit',
    section: 'IRC E3703.4',
  },
  {
    id: '04',
    title: 'GFCI + an outlet near the basin',
    text: 'Protect the bathroom’s 120 V receptacle with GFCI. Locate a required outlet within 36″ of the basin’s outside edge; mounting conditions also apply.',
    sourceId: 'irc-bathroom-outlets',
    section: 'IRC E3902.1 · E3901.6',
  },
];

export function SystemsDiagram() {
  return (
    <section className="systems-example" aria-label="Philadelphia bathroom diagram example">
      <div className="systems-example-heading">
        <div>
          <p className="systems-kicker">PHILADELPHIA EXAMPLE · PRIVATE HALF BATH</p>
          <h2>See how the room connects.</h2>
          <p>Fixtures, clearances and electrical requirements in one view.</p>
        </div>
        <span className="systems-coming-soon">
          Diagram editor <b>Coming soon</b>
        </span>
      </div>
      <div className="systems-sheet">
        <div className="systems-sheet-top">
          <span>BATHROOM / SYSTEMS PLAN</span>
          <span>EXAMPLE 01 · SCHEMATIC</span>
        </div>
        <svg
          viewBox="0 0 900 550"
          role="img"
          aria-labelledby="systems-plan-title"
          aria-describedby="systems-plan-description"
        >
          <title id="systems-plan-title">Example half-bath plumbing and electrical diagram</title>
          <desc id="systems-plan-description">
            Toilet and vanity in a sample room. Dimension arrows mark minimum side and front
            clearances. A dashed circuit connects an illustrative panel to the GFCI receptacle near
            the basin; a separate line connects the entrance switch to the light. Routes are
            illustrative.
          </desc>
          <defs>
            <pattern id="systems-grid" width="25" height="25" patternUnits="userSpaceOnUse">
              <path d="M25 0H0V25" fill="none" stroke="#d8e3e7" strokeWidth=".5" />
            </pattern>
            <marker
              id="systems-arrow"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0 0L10 5L0 10" fill="none" stroke="#638691" strokeWidth="1.5" />
            </marker>
          </defs>
          <rect width="900" height="550" fill="url(#systems-grid)" />
          <path d="M110 440V100H790V440H425M265 440H110" className="systems-wall" />
          <path d="M265 440H425" className="systems-door" />
          <g className="systems-fixture">
            <rect x="220" y="120" width="100" height="55" rx="8" />
            <path d="M225 175H315V230C315 290 225 290 225 230Z" />
            <ellipse cx="270" cy="222" rx="28" ry="35" />
            <rect x="470" y="110" width="230" height="105" rx="6" />
            <rect x="520" y="130" width="130" height="65" rx="20" />
            <path d="M585 115V140" />
          </g>
          <g className="systems-label">
            <text x="270" y="315" textAnchor="middle">
              TOILET
            </text>
            <text x="585" y="246" textAnchor="middle">
              VANITY / BASIN
            </text>
          </g>
          <path
            d="M270 110V350M110 335H470M270 278V405M255 278H300M255 405H300"
            className="systems-extension"
          />
          <path
            d="M119 345H260M280 345H460M290 287V397"
            className="systems-dimension"
            markerStart="url(#systems-arrow)"
            markerEnd="url(#systems-arrow)"
          />
          <g className="systems-dim-label">
            <text x="188" y="367" textAnchor="middle">
              15″ MIN
            </text>
            <text x="370" y="367" textAnchor="middle">
              15″ MIN
            </text>
            <text x="310" y="393">
              21″ MIN
            </text>
          </g>
          <path d="M840 399V82H681V107" className="systems-circuit" />
          <rect x="823" y="385" width="34" height="45" rx="4" className="systems-electrical" />
          <path d="M830 397H850M830 408H850M830 419H850" className="systems-circuit" />
          <rect x="667" y="107" width="28" height="40" rx="4" className="systems-electrical" />
          <path d="M675 116V124M686 116V124M675 133H687" className="systems-circuit" />
          <path d="M650 162H680V151" className="systems-dimension" />
          <text x="688" y="180" className="systems-dim-label">
            ≤ 36″
          </text>
          <path d="M140 405H165V320H560" className="systems-light-route" />
          <circle cx="580" cy="320" r="20" className="systems-light" />
          <path d="M566 306L594 334M594 306L566 334" className="systems-light-route" />
          <text x="145" y="407" className="systems-switch">
            S
          </text>
          <g className="systems-label">
            <text x="815" y="465">
              PANEL
            </text>
            <text x="619" y="75">
              20 A · GFCI
            </text>
            <text x="615" y="326">
              LIGHT
            </text>
            <text x="300" y="472">
              ENTRY
            </text>
          </g>
          <g className="systems-pin">
            <circle cx="170" cy="304" r="15" />
            <text x="170" y="309">
              01
            </text>
            <circle cx="345" cy="410" r="15" />
            <text x="345" y="415">
              02
            </text>
            <circle cx="865" cy="290" r="15" />
            <text x="865" y="295">
              03
            </text>
            <circle cx="714" cy="121" r="15" />
            <text x="714" y="126">
              04
            </text>
          </g>
          <text x="110" y="520" className="systems-footnote">
            Schematic · not to scale · illustrative routes
          </text>
        </svg>
        <div className="systems-legend">
          <span>
            <i className="systems-key-fixture" /> Fixtures
          </span>
          <span>
            <i className="systems-key-circuit" /> Bathroom receptacle circuit
          </span>
          <span>
            <i className="systems-key-light" /> Lighting / switch
          </span>
        </div>
      </div>
      <div className="systems-requirement-heading">
        <h3>Code requirements: Philadelphia</h3>
        <a href={source('phila-adoption').url} target="_blank" rel="noreferrer">
          City code basis ↗
        </a>
      </div>
      <div className="systems-requirements">
        {requirements.map((r) => (
          <article key={r.id}>
            <span className="systems-requirement-number">{r.id}</span>
            <div>
              <h4>{r.title}</h4>
              <p>{r.text}</p>
              <a href={source(r.sourceId).url} target="_blank" rel="noreferrer">
                {r.section} ↗
              </a>
            </div>
          </article>
        ))}
      </div>
      <p className="systems-source-note">
        2021 residential example · project applicability and accessibility to check.{' '}
        <a href={source('phila-clearance-amendment').url} target="_blank" rel="noreferrer">
          Philadelphia plumbing amendments ↗
        </a>
      </p>
    </section>
  );
}
