import { MuseAnimation } from '../connect/muse-animation.js';
import { useRef, useState } from 'react';
import { STUDIO_DIRECTIONS, DIRECTION_ORIGINAL } from '../house-example/studio-directions.js';
import { Copy } from '../connect/copy-button.js';
import { Glyph } from '../../components/glyph.js';
import { MuseConversation } from '../connect/muse-conversation.js';
import './landing-story.css';
import './studio-story.css';
const museIcon = new URL('../../assets/brand/muse-app-icon.png', import.meta.url).href;

export function StudioStory({
  onOwnProject,
  onDirection,
  busy,
}: {
  onOwnProject: (brief?: string) => void;
  onDirection: (id: string) => void;
  busy: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [original, setOriginal] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const direction = STUDIO_DIRECTIONS[index]!;
  const choose = (next: number) => {
    setIndex((next + STUDIO_DIRECTIONS.length) % STUDIO_DIRECTIONS.length);
    setOriginal(false);
  };
  return (
    <section
      className="landing-block studio-story"
      id="studio-possibilities"
      aria-labelledby="studio-story-title"
    >
      <div className="studio-story-heading">
        <div>
          <p className="studio-story-eyebrow">What would look good here?</p>
          <h2 id="studio-story-title">
            <span className="direction-heading-line">One room.</span>
            <em className="direction-heading-line">Three ways.</em>
          </h2>
        </div>
        <p>
          Lounge, work or host. Pick a direction. <br />
          Then make it yours.
        </p>
      </div>
      <div
        className="direction-carousel"
        role="region"
        aria-roledescription="carousel"
        aria-label="Room design directions"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            choose(index + (e.key === 'ArrowRight' ? 1 : -1));
          }
        }}
      >
        <div className="direction-stage">
          <div
            className="direction-photo"
            onTouchStart={(e) => {
              const t = e.touches[0];
              touch.current = t ? { x: t.clientX, y: t.clientY } : null;
            }}
            onTouchEnd={(e) => {
              const t = e.changedTouches[0],
                start = touch.current;
              touch.current = null;
              if (!t || !start) return;
              const dx = t.clientX - start.x,
                dy = t.clientY - start.y;
              if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3)
                choose(index + (dx < 0 ? 1 : -1));
            }}
          >
            <img
              key={original ? 'original' : direction.id}
              src={original ? DIRECTION_ORIGINAL : direction.image}
              alt={
                original
                  ? 'The original empty Oakland bay-window room before the floor and furnishing concepts'
                  : `Muse concept: ${direction.title}. ${direction.description}`
              }
              width={1600}
              height={1066}
              loading="lazy"
            />
            <div className="direction-photo-top">
              <span>{original ? 'Original listing photo' : 'Rendered with Muse'}</span>
              <button type="button" aria-pressed={original} onClick={() => setOriginal(!original)}>
                <Glyph name="photo" />
                {original ? 'Back to the idea' : 'See original'}
              </button>
            </div>
            <div className="direction-photo-bottom" aria-hidden="true">
              <span>Same windows. A new way to use the room.</span>
              <b>
                {String(index + 1).padStart(2, '0')}
                <i> / 03</i>
              </b>
            </div>
          </div>
          <div className="direction-details">
            <p className="direction-mood">{direction.mood}</p>
            <h3 aria-live="polite">{direction.title}</h3>
            <div className="direction-palette" aria-label="Suggested palette">
              {direction.palette.map((hex) => (
                <span key={hex} style={{ background: hex }} title={hex} />
              ))}
              <small>Suggested palette</small>
            </div>
            <div className="direction-pieces">
              <p>In this direction</p>
              <ul>
                {direction.pieces.map((p) => (
                  <li key={p.asset}>
                    <span>{p.name}</span>
                    <b>{p.count > 1 ? `× ${p.count}` : '01'}</b>
                  </li>
                ))}
              </ul>
            </div>
            <div className="direction-request">
              <div>
                <span>What to say</span>
                <Copy value={direction.request} label="Copy request" className="direction-copy" />
              </div>
              <blockquote>“{direction.request}”</blockquote>
            </div>
            <button
              className="direction-open"
              type="button"
              disabled={busy}
              onClick={() => onDirection(direction.id)}
            >
              Open in studio <Glyph name="right" />
            </button>
            <button
              className="direction-own"
              type="button"
              disabled={busy}
              onClick={() => onOwnProject(direction.ownBrief)}
            >
              Try this with my photo <Glyph name="right" />
            </button>
          </div>
        </div>
        <div className="direction-navigation">
          <div className="direction-options" role="group" aria-label="Choose a room direction">
            {STUDIO_DIRECTIONS.map((d, i) => (
              <button
                key={d.id}
                type="button"
                aria-pressed={i === index}
                aria-label={`Show ${d.title}`}
                onClick={() => choose(i)}
              >
                <img src={d.image} alt="" width={120} height={80} loading="lazy" />
                <span>
                  <small>
                    {String(i + 1).padStart(2, '0')} / {d.mood}
                  </small>
                  <b>{d.title}</b>
                </span>
                <i aria-hidden="true">↗</i>
              </button>
            ))}
          </div>
          <div className="direction-arrows">
            <button
              type="button"
              aria-label="Previous room direction"
              onClick={() => choose(index - 1)}
            >
              <Glyph name="right" />
            </button>
            <button
              type="button"
              aria-label="Next room direction"
              onClick={() => choose(index + 1)}
            >
              <Glyph name="right" />
            </button>
          </div>
        </div>
      </div>
      <p className="direction-note">
        Prepared Muse concepts of one Oakland room. In the studio, 3D starts with an editable
        arrangement; products, dimensions and fit need confirming.
      </p>
    </section>
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
        <div className="agent-story-intro">
          <h2 id="agent-title">
            Plan with
            <br />
            <em>Muse.</em>
          </h2>
          <MuseAnimation variant="home" />
        </div>
        <p>
          Plan a room. Save your finds. Pick up in the studio with your choices ready to review.
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
