import { useEffect, useRef, useState } from 'react';
import { Glyph } from '../../components/glyph.js';
import { HUTCHINSON } from '../house-example/hutchinson-project.js';
import { BeforeAfter, Room3D } from '../house-example/paint-floor-studio.js';
import {
  FLOOR_STYLES,
  PRESET_COLORS,
  feetInches,
  money,
  roomTakeoff,
  swatchUrl,
  type RoomPick,
} from '../house-example/paint-floor.js';
import './studio-preview.css';

const room = HUTCHINSON.rooms[0]!;
const colors = PRESET_COLORS.filter((c) =>
  ['SW 7008', 'SW 6204', 'SW 9130', 'SW 6244'].includes(c.code),
);
const floors = FLOOR_STYLES.filter((s) => ['light-oak', 'white-oak', 'walnut'].includes(s.id));

// The same photo renderer, room model and quantity engine as the full studio.
// This public example never calls a provider or writes to an owner's workspace.
export function StudioPreview({ onOpen, busy }: { onOpen: () => void; busy: boolean }) {
  const host = useRef<HTMLElement>(null);
  const [awake, setAwake] = useState(false);
  const [view, setView] = useState<'photo' | '3d'>('photo');
  const [pick, setPick] = useState<RoomPick>({
    color: colors[0]!,
    floor: 'lvp',
    floorStyle: 'light-oak',
    included: true,
  });
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setAwake(true);
        observer.disconnect();
      },
      { rootMargin: '200px' },
    );
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const takeoff = roomTakeoff(room, HUTCHINSON.ceilingFt, pick, 'mid');
  const open = () => {
    // Carry this room's choices into the full example without replacing edits
    // the visitor has already made to the other rooms.
    try {
      const key = `renovagent.studio.${HUTCHINSON.id}.picks.v1`;
      const existing = JSON.parse(localStorage.getItem(key) || '{}');
      localStorage.setItem(key, JSON.stringify({ ...existing, [room.id]: pick }));
    } catch {
      // The example still opens when browser storage is unavailable.
    }
    onOpen();
  };
  return (
    <section
      className="landing-block studio-preview"
      id="how-it-works"
      aria-labelledby="studio-preview-title"
      ref={host}
    >
      <div className="studio-preview-heading">
        <div>
          <p className="studio-preview-eyebrow">A room. Your choices.</p>
          <h2 id="studio-preview-title">
            Try the <em>studio.</em>
          </h2>
        </div>
        <p>Change the finishes, compare before and after, then turn the room in 3D.</p>
      </div>
      <div className="studio-preview-shell">
        <div className="studio-preview-toolbar">
          <span>
            <i aria-hidden="true" /> Living & dining <small>Philadelphia · listing example</small>
          </span>
          <span className="studio-preview-size">
            {feetInches(room.size!.xFt)} × {feetInches(room.size!.yFt)}
          </span>
        </div>
        <div className="studio-preview-body">
          <div className="studio-preview-scene">
            {awake ? (
              view === 'photo' ? (
                <BeforeAfter room={room} pick={pick} pending={null} />
              ) : (
                <Room3D
                  room={room}
                  ceilingFt={HUTCHINSON.ceilingFt}
                  pick={pick}
                  renderActions={false}
                />
              )
            ) : (
              <img
                className="studio-preview-placeholder"
                src={room.photo.src}
                alt="Living and dining room from the listing"
                loading="lazy"
              />
            )}
            <div className="studio-preview-view" role="group" aria-label="Room preview view">
              <button
                type="button"
                aria-pressed={view === 'photo'}
                onClick={() => setView('photo')}
              >
                <Glyph name="photo" />
                Before / after
              </button>
              <button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}>
                <Glyph name="layers" />
                3D room
              </button>
            </div>
            <p className="studio-preview-hint">
              {view === 'photo'
                ? 'Drag the divider to see your changes'
                : 'Drag to orbit · scroll to zoom'}
            </p>
          </div>
          <div className="studio-preview-controls">
            <div className="studio-preview-choice">
              <div className="studio-preview-label">
                <h3>Walls</h3>
                <span>{pick.color?.name}</span>
              </div>
              <div className="studio-preview-colors" role="group" aria-label="Preview wall colour">
                {colors.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    aria-label={c.name}
                    title={c.name}
                    aria-pressed={pick.color?.code === c.code}
                    onClick={() => setPick((p) => ({ ...p, color: c }))}
                  >
                    <i style={{ background: c.hex }} />
                    {pick.color?.code === c.code && <Glyph name="check" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="studio-preview-choice">
              <div className="studio-preview-label">
                <h3>Floors</h3>
                <span>{floors.find((s) => s.id === pick.floorStyle)?.label}</span>
              </div>
              <div className="studio-preview-floors" role="group" aria-label="Preview floor style">
                {floors.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={pick.floorStyle === s.id}
                    onClick={() => setPick((p) => ({ ...p, floorStyle: s.id }))}
                  >
                    <img src={swatchUrl(s.id)} alt="" loading="lazy" />
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
              <div
                className="studio-preview-material"
                role="group"
                aria-label="Preview floor material"
              >
                <button
                  type="button"
                  aria-pressed={pick.floor === 'lvp'}
                  onClick={() => setPick((p) => ({ ...p, floor: 'lvp' }))}
                >
                  Vinyl plank
                </button>
                <button
                  type="button"
                  aria-pressed={pick.floor === 'hardwood'}
                  onClick={() => setPick((p) => ({ ...p, floor: 'hardwood' }))}
                >
                  Hardwood
                </button>
              </div>
            </div>
            <div className="studio-preview-cost" aria-live="polite">
              <div>
                <span>Material allowance</span>
                <strong>{money(takeoff.totalMinor)}</strong>
              </div>
              <ul>
                {takeoff.lines.map((line) => (
                  <li key={line.bomItemId}>
                    <span>
                      {line.purchaseUnits} × {line.productName}
                    </span>
                    <b>{money(line.lineTotalMinor)}</b>
                  </li>
                ))}
              </ul>
              <small>Demo catalog · labour quoted separately</small>
            </div>
            <button className="studio-preview-open" type="button" onClick={open} disabled={busy}>
              Explore the whole house <Glyph name="right" />
            </button>
          </div>
        </div>
        <div className="studio-preview-caption">
          <span>Room outline from the listing plan</span>
          <span>Floor previews by Muse · walls by SAM</span>
        </div>
      </div>
    </section>
  );
}
