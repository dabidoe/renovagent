import { useLayoutEffect, useRef, useState } from 'react';
import { materials, money } from './bath-materials.js';
import segments from './hero-segments.json';
const room = new URL('../../assets/examples/bath.jpg', import.meta.url).href;

// Outlines are SAM 3.1 masks of this photo, computed once by
// scripts/hero-segments.ts. The photo is shown mirrored, so the masks are too.
// Prices are the landing's presentation-only allowances, never live offers.
type Id = 'vanity' | 'mirror' | 'shower' | 'floor';
const order: Id[] = ['vanity', 'mirror', 'shower', 'floor'];
const label: Record<Id, string> = {
  vanity: 'Vanity',
  mirror: 'Mirror',
  shower: 'Shower tile',
  floor: 'Floor tile',
};
const seen: Record<Id, string> = {
  vanity: 'Vanity cabinet outlined',
  mirror: 'Mirror outlined',
  shower: 'Tiled shower walls outlined',
  floor: `${segments.objects.floor.count} hex tiles visible`,
};
// Where a pin may sit, in photo pixels, best first. The first one on screen
// and clear of the headline, prompt and card is used.
const anchors: Record<Id, [number, number][]> = {
  vanity: [
    [330, 880],
    [520, 960],
  ],
  mirror: [
    [230, 430],
    [300, 300],
  ],
  shower: [
    [720, 520],
    [880, 640],
    [1100, 700],
  ],
  floor: [
    [700, 1000],
    [1000, 1010],
    [1200, 960],
  ],
};
const { width: W, height: H } = segments;

export function HeroScene() {
  const [active, setActive] = useState<Id>('vanity');
  const [pins, setPins] = useState<Partial<Record<Id, { x: number; y: number }>>>({});
  const scene = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scene.current;
    if (!el) return;
    const place = () => {
      const box = el.getBoundingClientRect();
      // object-fit: cover, anchored centre-bottom, mirrored.
      const scale = Math.max(box.width / W, box.height / H);
      const dx = (box.width - W * scale) / 2,
        dy = box.height - H * scale;
      const hero = el.parentElement!;
      // Text blocks span their column; the words themselves are what a pin
      // must not cover.
      const tight = (n: Element) => {
        const range = document.createRange();
        range.selectNodeContents(n);
        return range.getBoundingClientRect();
      };
      const blocked = [
        ...[...hero.querySelectorAll('.landing-copy h1, .landing-copy p')].map(tight),
        ...[...hero.querySelectorAll('.hero-launch > *'), card.current]
          .filter((n): n is Element => !!n)
          .map((n) => (n.matches('p') ? tight(n) : n.getBoundingClientRect())),
      ].filter((r) => r.width > 0);
      const free = (x: number, y: number) =>
        x > 16 &&
        x < box.width - 130 &&
        y > 110 &&
        y < box.height - 40 &&
        blocked.every(
          (r) =>
            x + box.left < r.left - 12 ||
            x + box.left > r.right + 12 ||
            y + box.top < r.top - 24 ||
            y + box.top > r.bottom + 24,
        );
      const next: typeof pins = {};
      for (const id of order)
        for (const [ix, iy] of anchors[id]) {
          const x = dx + (W - ix) * scale,
            y = dy + iy * scale;
          if (free(x, y)) {
            next[id] = { x, y };
            break;
          }
        }
      setPins(next);
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(el);
    return () => observer.disconnect();
    // The card's height follows the chosen finish; pins move with it.
  }, [active]);
  const item = materials.find((m) => m.id === active)!;
  return (
    <div className="hero-scene hero-ar-scene" ref={scene}>
      <img
        className="hero-room-image"
        src={room}
        alt="Bathroom with oak vanity, black-framed mirror, white subway-tile shower and charcoal hex floor, each outlined by SAM 3.1"
        width={W}
        height={H}
        fetchPriority="high"
      />
      <div className="hero-room-shade" />
      <svg
        className="hero-ar-outlines"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        <g transform={`translate(${W} 0) scale(-1 1)`}>
          {order.map((id) => (
            <path
              key={id}
              d={segments.objects[id].path}
              className={active === id ? 'ar-object is-active' : 'ar-object'}
              onMouseEnter={() => setActive(id)}
              onClick={() => setActive(id)}
            />
          ))}
        </g>
      </svg>
      <div className="hero-ar-controls">
        {order.map((id) =>
          pins[id] ? (
            <button
              key={id}
              type="button"
              className="hero-ar-target"
              style={{ left: pins[id]!.x, top: pins[id]!.y }}
              onMouseEnter={() => setActive(id)}
              onFocus={() => setActive(id)}
              onClick={() => setActive(id)}
              aria-pressed={active === id}
              aria-controls="hero-ar-breakdown"
              tabIndex={-1}
            >
              <span />
              <b>{label[id]}</b>
            </button>
          ) : null,
        )}
      </div>
      <div className="hero-ar-card" id="hero-ar-breakdown" ref={card}>
        <div className="hero-ar-tabs" role="group" aria-label="Objects in the room">
          {order.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={active === id}
              onClick={() => setActive(id)}
              onMouseEnter={() => setActive(id)}
            >
              {label[id]}
            </button>
          ))}
        </div>
        <div aria-live="polite">
          <div className="hero-ar-card-heading">
            <div>
              <h3>{item.title}</h3>
              <small>
                {item.finish} · {item.kind}
              </small>
            </div>
            <strong>{money(item.price)}</strong>
          </div>
          <dl>
            <div>
              <dt>In the photo</dt>
              <dd>{seen[active]}</dd>
            </div>
            <div>
              <dt>Still to price</dt>
              <dd>{item.missing}</dd>
            </div>
          </dl>
        </div>
        <p>Example prices for this demo, not live offers · Outlines by SAM 3.1</p>
      </div>
    </div>
  );
}
