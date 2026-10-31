import { useState } from 'react';
const room = new URL('../../assets/examples/bath.jpg', import.meta.url).href;
// Landing fixtures only: reference cabinet plus illustrative parts and labor.
// No live pricing or project facts are created by these annotations.
const products = {
  vanity: {
    title: 'IKEA ÄNGSJÖN',
    image: 'product-vanity.jpg',
    price: '$339',
    basis: '36″ oak-effect vanity cabinet',
    rows: [
      ['2 supply lines + fittings + fixings', '$74'],
      ['Plumbing · 6h @ $75/hr', '$450'],
    ],
  },
  floor: {
    title: 'Charcoal hex mosaic',
    image: 'product-floor.jpg',
    price: '$240',
    basis: '2″ porcelain · matte finish',
    rows: [
      ['Mortar + grout + edge trim', '$126'],
      ['Tile work · 24h @ $60/hr', '$1,440'],
    ],
  },
} as const;
export function HeroScene() {
  const [active, setActive] = useState<'vanity' | 'floor'>('vanity');
  const product = products[active];
  return (
    <div className="hero-scene hero-ar-scene">
      <img
        className="hero-room-image"
        src={room}
        alt="Bathroom concept with oak vanity and charcoal floor, selectable object outlines show example materials and labor"
        width={1448}
        height={1086}
        fetchPriority="high"
      />
      <div className="hero-room-shade" />
      <svg
        className="hero-ar-outlines"
        viewBox="0 0 1448 1086"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        <g
          className={active === 'vanity' ? 'ar-object is-active' : 'ar-object'}
          onMouseEnter={() => setActive('vanity')}
          onClick={() => setActive('vanity')}
        >
          <polygon points="1440,650 900,585 790,625 795,1080 1440,1080" />
          {[
            [1440, 650],
            [900, 585],
            [790, 625],
            [795, 1080],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="7" />
          ))}
        </g>
        <g
          className={active === 'floor' ? 'ar-object is-active' : 'ar-object'}
          onMouseEnter={() => setActive('floor')}
          onClick={() => setActive('floor')}
        >
          <polygon points="20,1080 100,950 560,900 780,1020 780,1080" />
          {[
            [100, 950],
            [560, 900],
            [780, 1020],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="7" />
          ))}
        </g>
      </svg>
      <div className="hero-ar-controls" aria-label="Explore objects in the room">
        {(['vanity', 'floor'] as const).map((id) => (
          <button
            key={id}
            className={`hero-ar-target ar-target-${id}`}
            onMouseEnter={() => setActive(id)}
            onFocus={() => setActive(id)}
            onClick={() => setActive(id)}
            aria-label={`Inspect ${id === 'vanity' ? 'vanity' : 'floor'} example`}
            aria-pressed={active === id}
            aria-controls="hero-ar-breakdown"
          >
            <span />
            <b>{id === 'vanity' ? 'Vanity' : 'Floor tile'}</b>
          </button>
        ))}
      </div>
      <div className="hero-ar-card" id="hero-ar-breakdown" aria-live="polite">
        <div className="hero-ar-card-heading">
          <img
            src={new URL(`../../assets/examples/${product.image}`, import.meta.url).href}
            alt=""
            width={54}
            height={54}
          />
          <div>
            <h3>{product.title}</h3>
            <small>{product.basis}</small>
          </div>
          <strong>{product.price}</strong>
        </div>
        <dl>
          {product.rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
