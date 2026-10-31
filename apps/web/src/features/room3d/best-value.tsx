// Best value across tiers: the server filters catalog candidates by the hard
// rules, Jev judges fit and quality from specs, code picks the cheapest fit.

type Pick = {
  productName: string;
  manufacturer: string;
  retailer: string;
  sku: string;
  tier: string;
  units: number;
  packQuantity: number;
  packUnit: string;
  unitPriceMinor: number;
  totalMinor: number;
  shippingMinor: number | null;
  observedAt: string;
  freshness: string;
  source: string;
  fit: number;
  quality: number;
};
export type BestValueResult = {
  model: string | null;
  lines: {
    itemId: string;
    purpose: string;
    quantity: number;
    unit: string;
    pick: Pick | null;
    upgrade: Pick | null;
    passedOver: { key: string; productName: string; totalMinor: number; reason: string }[];
  }[];
  totals: { bestValueMinor: number; midMinor: number | null };
  note: string;
};
export type BestValueState =
  | { status: 'working' }
  | { status: 'done'; result: BestValueResult }
  | { status: 'error'; message: string };

const usd = (minor: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(minor / 100);
const QUALITY = ['basic', 'standard', 'premium'];
const quality = (q: number) => QUALITY[Math.min(2, Math.max(0, Math.round(q)))]!;
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function BestValuePopup({ state, onClose }: { state: BestValueState; onClose: () => void }) {
  return (
    <div className="room3d-popup room3d-review-card" role="dialog" aria-label="Best value">
      <header>
        <div>
          <span className="room3d-step-phase">Products</span>
          <h4>Best value</h4>
          <span className="small-note">
            The cheapest product that fits each item, across every tier.
          </span>
        </div>
        <button type="button" className="room3d-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>
      {state.status === 'working' && <p className="small-note">Jev is checking the products…</p>}
      {state.status === 'error' && (
        <p role="alert" className="small-note">
          {state.message}
        </p>
      )}
      {state.status === 'done' && (
        <>
          <div className="room3d-compare">
            <div>
              <span className="eyebrow">Best value</span>
              <strong>{usd(state.result.totals.bestValueMinor)}</strong>
              <span className="small-note">Materials picked here</span>
            </div>
            <div>
              <span className="eyebrow">Mid tier</span>
              <strong>
                {state.result.totals.midMinor === null ? '—' : usd(state.result.totals.midMinor)}
              </strong>
              <span className="small-note">
                {state.result.totals.midMinor !== null &&
                state.result.totals.midMinor > state.result.totals.bestValueMinor
                  ? `Saves ${usd(state.result.totals.midMinor - state.result.totals.bestValueMinor)}`
                  : 'Same items'}
              </span>
            </div>
          </div>
          <ul className="best-value-lines">
            {state.result.lines.map((l) => (
              <li key={l.itemId}>
                <div className="room3d-line-head">
                  <strong>{l.purpose}</strong>
                  <strong>{l.pick ? usd(l.pick.totalMinor) : '—'}</strong>
                </div>
                {l.pick ? (
                  <>
                    <div>
                      {l.pick.productName}{' '}
                      <span className="small-note">
                        · {l.pick.retailer} · {l.pick.tier} tier · {l.pick.units} ×{' '}
                        {l.pick.packQuantity} {l.pick.packUnit} at {usd(l.pick.unitPriceMinor)}
                      </span>
                    </div>
                    <div className="small-note">
                      <span className="room3d-jev is-high">{pct(l.pick.fit)} fit</span>
                      {quality(l.pick.quality)} quality ·{' '}
                      {l.pick.source === 'example-import'
                        ? 'example price (demo data)'
                        : `price ${l.pick.freshness}`}
                      , observed {l.pick.observedAt.slice(0, 10)}
                      {l.pick.shippingMinor ? ` · + ${usd(l.pick.shippingMinor)} shipping` : ''}
                    </div>
                  </>
                ) : (
                  <div className="small-note">
                    No product in the catalog was judged a fit for this item.
                  </div>
                )}
                {l.passedOver.map((p) => (
                  <div key={p.key} className="small-note">
                    Passed over: {p.productName} ({usd(p.totalMinor)}), {p.reason}.
                  </div>
                ))}
                {l.upgrade && l.pick && (
                  <div className="small-note">
                    Step up: {l.upgrade.productName} ({quality(l.upgrade.quality)}) for{' '}
                    {usd(l.upgrade.totalMinor - l.pick.totalMinor)} more.
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="small-note">
            {state.result.note} Fit and quality by {state.result.model ?? 'Jev'}.
          </p>
        </>
      )}
    </div>
  );
}
