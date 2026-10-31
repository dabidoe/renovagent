import { useState } from 'react';

// Curated looks priced for this room: the server prices each look's real
// products against the plan's quantities and hard rules; nothing is dropped
// silently, so a product that doesn't fit shows why.

type Badge = { publisher: string; title: string; date: string; url: string; label: string };
type LookPick = {
  productId: string;
  productName: string;
  retailer: string;
  url: string | null;
  units: number;
  packQuantity: number;
  packUnit: string;
  unitPriceMinor: number;
  totalMinor: number;
  shippingMinor: number | null;
  observedAt: string;
  seen: 'page' | 'search result';
};
type LookLine =
  | {
      itemId: string;
      purpose: string;
      status: 'priced';
      pick: LookPick;
      alternatives: LookPick[];
    }
  | {
      itemId: string;
      purpose: string;
      status: 'does-not-fit';
      rejected: { productId: string; productName: string; reason: string }[];
    }
  | { itemId: string; purpose: string; status: 'not-in-look' }
  | { itemId: string; purpose: string; status: 'included'; withProductName: string };
export type LookResult = {
  room: string;
  note: string;
  looks: {
    id: string;
    name: string;
    blurb: string;
    style: string[];
    tips: string[];
    totalMinor: number;
    lines: LookLine[];
    notInPlan: { productId: string; productName: string; category: string }[];
    products: {
      productId: string;
      productName: string;
      manufacturer: string;
      category: string;
      retailer: string;
      url: string | null;
      unitPriceMinor: number;
      packQuantity: number;
      packUnit: string;
      observedAt: string;
      badges: Badge[];
    }[];
  }[];
};
export type LooksState =
  | { status: 'working' }
  | { status: 'done'; result: LookResult }
  | { status: 'error'; message: string };

const usd = (minor: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(minor / 100);
// Paint packs carry coverage per gallon; everything else is priced per pack.
const per = (category: string, unit: string, qty: number) =>
  category === 'interior-paint' ? 'per gal' : unit === 'ea' ? 'each' : `per ${qty} ${unit}`;

function ProductLink({ name, url }: { name: string; url: string | null }) {
  return url ? (
    <a href={url} target="_blank" rel="noreferrer">
      {name} ↗
    </a>
  ) : (
    <>{name}</>
  );
}

function Badges({ badges }: { badges: Badge[] }) {
  return (
    <>
      {badges.map((b) => (
        <a
          key={b.url + b.label}
          className="look-badge"
          href={b.url}
          target="_blank"
          rel="noreferrer"
          title={`${b.title} (${b.date})`}
        >
          ★ {b.publisher}: {b.label}
        </a>
      ))}
    </>
  );
}

export function LooksPopup({ state, onClose }: { state: LooksState; onClose: () => void }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const looks = state.status === 'done' ? state.result.looks : [];
  const look = looks.find((l) => l.id === chosen) ?? looks[0];
  return (
    <div className="room3d-popup room3d-review-card looks-card" role="dialog" aria-label="Looks">
      <header>
        <div>
          <span className="room3d-step-phase">Inspo</span>
          <h4>Looks for this room</h4>
          <span className="small-note">Real products, priced for your measurements.</span>
        </div>
        <button type="button" className="room3d-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>
      {state.status === 'working' && <p className="small-note">Pricing the looks…</p>}
      {state.status === 'error' && (
        <p role="alert" className="small-note">
          {state.message}
        </p>
      )}
      {state.status === 'done' && !look && (
        <p className="small-note">No curated looks for this room yet.</p>
      )}
      {look && (
        <>
          <div className="look-tabs" role="tablist">
            {looks.map((l) => (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={l.id === look.id}
                onClick={() => setChosen(l.id)}
              >
                <span>{l.name}</span>
                <strong>{usd(l.totalMinor)}</strong>
              </button>
            ))}
          </div>
          <p className="look-blurb">
            {look.blurb}{' '}
            {look.style.map((s) => (
              <span key={s} className="look-style">
                {s}
              </span>
            ))}
          </p>
          <ul className="best-value-lines">
            {look.lines.map((l) => {
              const product =
                l.status === 'priced'
                  ? look.products.find((p) => p.productId === l.pick.productId)
                  : undefined;
              return (
                <li key={l.itemId}>
                  <div className="room3d-line-head">
                    <strong>{l.purpose}</strong>
                    <strong>{l.status === 'priced' ? usd(l.pick.totalMinor) : '—'}</strong>
                  </div>
                  {l.status === 'priced' && (
                    <>
                      <div>
                        <ProductLink name={l.pick.productName} url={l.pick.url} />{' '}
                        <span className="small-note">
                          · {l.pick.retailer} · {l.pick.units} × {usd(l.pick.unitPriceMinor)}
                          {l.pick.shippingMinor ? ` + ${usd(l.pick.shippingMinor)} shipping` : ''}
                        </span>
                      </div>
                      <div className="small-note">
                        {product && <Badges badges={product.badges} />} shelf price checked{' '}
                        {l.pick.observedAt.slice(0, 10)}
                        {l.pick.seen === 'search result' ? ' (from search results)' : ''}
                      </div>
                      {l.alternatives.map((alt) => {
                        const badges =
                          look.products.find((p) => p.productId === alt.productId)?.badges ?? [];
                        return (
                          <div key={alt.productId} className="small-note">
                            Or <ProductLink name={alt.productName} url={alt.url} /> · {alt.retailer}
                            , +{usd(alt.totalMinor - l.pick.totalMinor)} <Badges badges={badges} />
                          </div>
                        );
                      })}
                    </>
                  )}
                  {l.status === 'does-not-fit' &&
                    l.rejected.map((r) => (
                      <div key={r.productId} className="small-note">
                        Doesn’t fit your plan: {r.productName}, {r.reason}.
                      </div>
                    ))}
                  {l.status === 'included' && (
                    <div className="small-note">Included with {l.withProductName}.</div>
                  )}
                  {l.status === 'not-in-look' && (
                    <div className="small-note">Not part of this look; your plan’s pick stays.</div>
                  )}
                </li>
              );
            })}
          </ul>
          {look.notInPlan.length > 0 && (
            <div className="small-note">
              Also in this look, not in your plan:{' '}
              {look.notInPlan.map((p, i) => {
                const product = look.products.find((x) => x.productId === p.productId);
                return (
                  <span key={p.productId}>
                    {i > 0 && ' · '}
                    <ProductLink name={p.productName} url={product?.url ?? null} />
                    {product &&
                      ` ${usd(product.unitPriceMinor)} ${per(product.category, product.packUnit, product.packQuantity)}`}
                    {product && <Badges badges={product.badges} />}
                  </span>
                );
              })}
            </div>
          )}
          {look.tips.length > 0 && (
            <div className="look-tips">
              <span className="eyebrow">Renovagent tips</span>
              <ul>
                {look.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="small-note">{state.status === 'done' && state.result.note}</p>
        </>
      )}
    </div>
  );
}
