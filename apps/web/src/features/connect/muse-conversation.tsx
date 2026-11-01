import { useState } from 'react';
import { Glyph } from '../../components/glyph.js';
import { Copy } from './copy-button.js';
import './muse-conversation.css';

const museIcon = new URL('../../assets/brand/muse-app-icon.png', import.meta.url).href;
const EXAMPLES = [
  {
    id: 'connect',
    label: 'Connect',
    user: 'Connect to my Renovagent workspace.',
    reply:
      'Share your Renovagent connection address. I’ll ask for your access key in a secure field.',
  },
  {
    id: 'plan',
    label: 'Plan a room',
    user: 'Plan sage walls and oak-look floors for my 13 by 23 foot living room. Save the plan so I can open it.',
    reply: 'I can put the paint and floor choices into a plan for you to review in Renovagent.',
  },
  {
    id: 'board',
    label: 'Save a find',
    user: 'Find a rust velvet pillow and add the link to my Renovagent board.',
    reply: 'I can save a link and a note to your board. You can review it in the studio.',
  },
] as const;

// An illustrated walkthrough, not a screenshot or transcript of a real session.
// Result cards describe supported outcomes without inventing products or prices.
export function MuseConversation({
  initialExample = 'connect',
}: {
  initialExample?: (typeof EXAMPLES)[number]['id'];
}) {
  const [selected, setSelected] = useState(initialExample);
  const example = EXAMPLES.find((e) => e.id === selected)!;
  return (
    <figure className="muse-conversation" aria-label="Example Muse conversation">
      <div className="muse-conversation-window">
        <div className="muse-conversation-bar">
          <span>
            <img src={museIcon} alt="" width={34} height={34} />
            <b>Muse</b>
          </span>
          <span className="muse-conversation-app">
            <Glyph name="connection" />
            Renovagent
          </span>
        </div>
        <div
          className="muse-conversation-tabs"
          role="group"
          aria-label="Muse conversation examples"
        >
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
        <div className="muse-conversation-messages" aria-live="polite">
          <p className="muse-conversation-user">{example.user}</p>
          <div className="muse-conversation-reply">
            <img src={museIcon} alt="Muse" width={24} height={24} />
            <p>{example.reply}</p>
          </div>
          {selected === 'connect' ? (
            <div className="muse-conversation-result is-credential">
              <div>
                <Glyph name="connection" />
                <b>A private connection</b>
              </div>
              <span>Renovagent access key</span>
              <div
                className="muse-conversation-secret"
                aria-label="Illustrated secure credential field"
              >
                •••• •••• •••• ••••
                <Glyph name="check" />
              </div>
              <small>The key goes in a secure field, outside the conversation.</small>
            </div>
          ) : selected === 'plan' ? (
            <div className="muse-conversation-result is-plan">
              <img
                src="./example-room/done-sage-lvp.jpg"
                alt="Illustrative 3D-rendered living room"
                loading="lazy"
              />
              <div>
                <span>Plan to review</span>
                <b>Living room refresh</b>
                <small>Paint, flooring and a materials list</small>
              </div>
            </div>
          ) : (
            <div className="muse-conversation-result is-find">
              <Glyph name="source" />
              <div>
                <span>Your board</span>
                <b>A find to review</b>
                <small>Found by Muse · not checked</small>
              </div>
            </div>
          )}
        </div>
        {selected !== 'connect' && (
          <div className="muse-conversation-copy">
            <Copy value={example.user} label="Copy this request" className="muse-copy" />
          </div>
        )}
      </div>
      <figcaption>Illustrated conversation · wording in Muse may vary</figcaption>
    </figure>
  );
}
