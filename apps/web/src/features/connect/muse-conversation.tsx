import { useState } from 'react';
import { Glyph } from '../../components/glyph.js';
import { Copy } from './copy-button.js';
import './muse-conversation.css';

const museIcon = new URL('../../assets/brand/muse-app-icon.png', import.meta.url).href;
const EXAMPLES = [
  { id: 'connect', label: 'Connect', prompt: 'Connect to Renovagent.', request: '' },
  {
    id: 'plan',
    label: 'Plan a room',
    prompt: 'Warm white walls. Dark walnut floors.',
    request:
      'Plan warm white walls and dark walnut floors for the room in my photo. Ask me for measurements before pricing, then save the plan and give me the link.',
  },
  {
    id: 'board',
    label: 'Save a find',
    prompt: 'Save this look to my board.',
    request: 'Save this inspiration photo to my Renovagent board.',
  },
] as const;

// Actual committed Muse previews, with an illustrated request and result overlay.
// These are example outcomes, not a real chat transcript or an active connection.
export function MuseConversation({
  initialExample = 'connect',
}: {
  initialExample?: (typeof EXAMPLES)[number]['id'];
}) {
  const [selected, setSelected] = useState(initialExample);
  const example = EXAMPLES.find((e) => e.id === selected)!;
  return (
    <figure className="muse-conversation" aria-label="Muse and Renovagent demo">
      <div className="muse-demo-stage">
        <img
          className="muse-demo-photo"
          src={
            selected === 'board'
              ? './examples/bedroom-refresh/after.jpg'
              : './examples/oakland/image-01-walnut.jpg'
          }
          alt={
            selected === 'board'
              ? 'Muse-generated bedroom restyle'
              : 'Listing room with a Muse-generated walnut floor preview'
          }
          loading="lazy"
        />
        <div className="muse-demo-shade" />
        <div className="muse-demo-top">
          <div className="muse-demo-brand">
            <img src={museIcon} alt="" width={28} height={28} />
            <b>With Muse</b>
            <span>Example</span>
          </div>
          <div className="muse-conversation-tabs" role="group" aria-label="Muse workflow examples">
            {EXAMPLES.map((e) => (
              <button
                key={e.id}
                type="button"
                aria-pressed={e.id === selected}
                onClick={() => setSelected(e.id)}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>
        <div className="muse-demo-overlay" aria-live="polite">
          <p className="muse-demo-prompt">
            <Glyph name="chat" />
            {example.prompt}
          </p>
          <div className="muse-demo-result">
            {selected === 'connect' ? (
              <>
                <div className="muse-demo-result-title">
                  <b>Renovagent</b>
                  <span>Private access · 7 days</span>
                </div>
                <div className="muse-demo-secure">
                  <span>•••• •••• ••••</span>
                  <small>Muse’s secure field</small>
                </div>
              </>
            ) : selected === 'plan' ? (
              <>
                <div className="muse-demo-result-title">
                  <b>A plan to review</b>
                  <Glyph name="right" />
                </div>
                <div className="muse-demo-finishes">
                  <span>
                    <i style={{ background: '#edeae0' }} />
                    Warm white
                  </span>
                  <span>
                    <img src="./finishes/walnut.jpg" alt="" />
                    Dark walnut
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="muse-demo-result-title">
                  <b>Your inspiration board</b>
                  <Glyph name="source" />
                </div>
                <small>Found by Muse · not checked</small>
              </>
            )}
          </div>
          {example.request && (
            <Copy value={example.request} label="Copy this request" className="muse-copy" />
          )}
        </div>
      </div>
      <figcaption>
        Muse-generated {selected === 'board' ? 'restyle' : 'floor preview'} · illustrated workflow
      </figcaption>
    </figure>
  );
}
