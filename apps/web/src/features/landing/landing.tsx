import { useRef } from 'react';
import { Glyph } from '../../components/glyph.js';

// Illustrative images cropped from the brand concept boards; never a user's home.
const image = (name: string) => new URL(`../../assets/examples/${name}`, import.meta.url).href;

// Idea starters only fill the prompt; they do not promise a finished playbook.
const ideas = [
  { title: 'Update my kitchen', note: 'Cabinets, counters, lighting', img: 'kitchen.jpg' },
  { title: 'Refresh a bathroom', note: 'Vanity, tile, fixtures', img: 'bath.jpg' },
  { title: 'Finish my basement', note: 'From bare walls to a room', img: 'basement.jpg' },
  { title: 'Replace flooring', note: 'Hardwood, vinyl plank, carpet', img: 'floor.jpg' },
];

const features = [
  {
    glyph: 'plan',
    title: 'From photo to plan',
    text: 'Room photos and your measurements become a scoped plan you can revise.',
  },
  {
    glyph: 'source',
    title: 'Sourced requirements',
    text: 'Guidance cites where it came from and flags what still needs review.',
  },
  {
    glyph: 'materials',
    title: 'Materials, three tiers',
    text: 'Quantities come from your scope and are priced from dated catalog offers.',
  },
  {
    glyph: 'connection',
    title: 'Works from Muse',
    text: 'Plan through the same project tools from a Muse conversation.',
  },
];

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
  const fill = (text: string) => {
    onPrompt(`I want to ${text.charAt(0).toLowerCase()}${text.slice(1)}`);
    input.current?.focus();
  };
  return (
    <div className="landing">
      <section className="landing-hero">
        <div className="landing-copy">
          <div className="prompt-intro">
            <h1>
              Turn your space into a <em>plan.</em>
            </h1>
            <p>
              Your agent for renovation planning: scoped work, sourced requirements and a priced
              materials list, all saved to one project.
            </p>
          </div>
          <form
            className="prompt-start"
            onSubmit={(e) => {
              e.preventDefault();
              onStart();
            }}
          >
            <label className="sr-only" htmlFor="start-prompt">
              What would you like to improve?
            </label>
            <textarea
              id="start-prompt"
              ref={input}
              maxLength={300}
              value={prompt}
              onChange={(e) => onPrompt(e.target.value)}
              placeholder="What would you like to improve?"
            />
            <div>
              <span>Give your idea a place to grow</span>
              <button className="send" aria-label="Start a project">
                <Glyph name="arrow" />
              </button>
            </div>
          </form>
          <div className="landing-chips" aria-label="Try an idea">
            <span>Try:</span>
            {ideas.map((idea) => (
              <button key={idea.title} type="button" onClick={() => fill(idea.title)}>
                {idea.title}
              </button>
            ))}
          </div>
        </div>
        <figure className="landing-art">
          <img src={image('hero-blueprint.jpg')} alt="" width={931} height={1100} />
          <figcaption>Illustrative concept</figcaption>
        </figure>
      </section>

      <section className="landing-ideas" aria-labelledby="landing-ideas-title">
        <div className="landing-section-head">
          <h2 id="landing-ideas-title">Start from an idea</h2>
          <button className="prompt-example" disabled={busy} onClick={onExample}>
            {busy ? 'Opening example…' : 'Or explore a clearly labeled example'}{' '}
            <Glyph name="right" />
          </button>
        </div>
        <div className="landing-cards">
          {ideas.map((idea) => (
            <button key={idea.title} type="button" onClick={() => fill(idea.title)}>
              <img src={image(idea.img)} alt="" loading="lazy" width={420} height={388} />
              <strong>{idea.title}</strong>
              <small>{idea.note}</small>
            </button>
          ))}
        </div>
        <p className="landing-note">Images are illustrative, not photos of a real project.</p>
      </section>

      <section className="landing-features" aria-label="What Renovagent does">
        {features.map((f) => (
          <div key={f.title}>
            <Glyph name={f.glyph} />
            <strong>{f.title}</strong>
            <span>{f.text}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
