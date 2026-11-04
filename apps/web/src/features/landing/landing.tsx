import { PhotoPicker } from '../project-start/photo-picker.js';
import { useRef } from 'react';
import { Glyph } from '../../components/glyph.js';
import { BrandMark } from '../../components/brand-mark.js';
import './landing-v2.css';
import { Comparison } from './comparison.js';
import { HeroScene } from './hero-scene.js';
import { StudioPreview } from './studio-preview.js';
import { StudioStory, AgentConnection } from './landing-story.js';
import './hero-scene.css';
import './product-experience.css';
import './hero-ar.css';
import './landing-polish.css';

export function Landing({
  prompt,
  onPrompt,
  photos,
  onPhotos,
  onOwnProject,
  onExamples,
  onDirection,
  busy,
}: {
  prompt: string;
  onPrompt: (text: string) => void;
  photos: File[];
  onPhotos: (files: File[]) => void;
  onOwnProject: (idea?: string) => void;
  onExamples: () => void;
  onDirection: (id: string) => void;
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
              onOwnProject();
            }}
          >
            <p id="project-setup-hint" className="sr-only">
              Next, add your room photo and build it in the studio.
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
              placeholder="Make my dated bathroom feel brighter. Keep the character."
            />
            <div>
              <PhotoPicker sampleRooms compact files={photos} onChange={onPhotos} disabled={busy} />
              <button className="send" disabled={busy}>
                {busy ? 'Opening…' : 'Start a project'}
                <Glyph name="right" />
              </button>
            </div>
          </form>
          {/* "Start a project" opens the studio; these are the two other ways in. */}
          <p className="hero-paint-line">
            <button type="button" onClick={onExamples}>
              Try studio <Glyph name="right" />
            </button>
            <a href="#connect">
              <img
                src={new URL('../../assets/brand/muse-app-icon.png', import.meta.url).href}
                alt=""
                width={20}
                height={20}
              />
              Connect Muse or your agent <Glyph name="right" />
            </a>
          </p>
        </div>
      </section>

      <StudioPreview onOpen={onExamples} busy={busy} />
      <StudioStory onOwnProject={onOwnProject} onDirection={onDirection} busy={busy} />
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
          <nav aria-label="Footer navigation">
            <a href="#product-proof">Explore</a>
            <a href="#compare-tools">Compare</a>
            <a href="/agent-guide.md" target="_blank" rel="noreferrer">
              Agent guide
            </a>
            <a href="https://github.com/dabidoe/renovagent" target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
