import { useState } from 'react';
import {
  tierLabels,
  type BomPayload,
  type CheckoutReviewPayload,
  type PurchasePlanPayload,
} from '@renovagent/contracts';

// Read-only commerce renderers shared by Materials and the saved-work viewer.
// Every price surface states its basis: demo/unverified observations stay
// visibly labeled, tax stays excluded, and nothing here is purchasable.

export function money(minor: number, currency: string): string {
  const amount = (minor / 100).toFixed(2);
  return currency === 'USD' ? `$${amount}` : `${amount} ${currency}`;
}

export function shortDate(stamp: string): string {
  return stamp.slice(0, 10);
}

function describeConstraint(c: BomPayload['items'][number]['constraints'][number]): string {
  if (c.operator === 'exists') return `${c.attribute} specified`;
  const value = Array.isArray(c.value) ? c.value.join(' | ') : String(c.value);
  const op = { eq: '=', neq: '≠', lte: '≤', gte: '≥', oneOf: 'one of' }[c.operator];
  return `${c.attribute} ${op} ${value}`;
}

export function BomView({ bom }: { bom: BomPayload }) {
  return (
    <div>
      <p className="work-lede">
        {bom.items.length} material requirements from {bom.templateId} v{bom.templateVersion}.
        Constraints are hard: an offer with an unknown spec is rejected, not assumed to fit. Code
        topics are for contractor verification, not reviewed guidance.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Requirement</th>
              <th>Quantity</th>
              <th>Must satisfy</th>
              <th>Candidates</th>
            </tr>
          </thead>
          <tbody>
            {bom.items.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.description}
                  <div className="small-note">
                    {item.category}
                    {item.codeTopics.length > 0 && ` · verify: ${item.codeTopics.join(', ')}`}
                  </div>
                </td>
                <td>
                  {item.quantity} {item.unit}
                </td>
                <td>
                  {item.constraints.length
                    ? item.constraints.map(describeConstraint).join('; ')
                    : 'No hard constraints'}
                </td>
                <td>{item.candidateProductIds.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BasisBanner({ basis }: { basis: PurchasePlanPayload['basis'] }) {
  if (basis === 'verified') return null;
  return (
    <div className="historical-banner">
      Example prices for planning only — {basis === 'fixture' ? 'all' : 'some'} lines use demo
      observations, not live offers. Verify every price before purchase.
    </div>
  );
}

export function PurchasePlanView({ plan }: { plan: PurchasePlanPayload }) {
  const [showRejected, setShowRejected] = useState(false);
  return (
    <div>
      <h3>
        {tierLabels[plan.tier]} · {money(plan.totals.subtotalMinor, plan.totals.currency)}
      </h3>
      <BasisBanner basis={plan.basis} />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Product</th>
              <th>Qty</th>
              <th>Line total</th>
              <th>Observed</th>
            </tr>
          </thead>
          <tbody>
            {plan.lines.map((line) => (
              <tr key={line.bomItemId}>
                <td>
                  {line.bomItemId}
                  {line.codeTopics.length > 0 && (
                    <div className="small-note">Verify: {line.codeTopics.join(', ')}</div>
                  )}
                </td>
                <td>
                  {line.productName} · {line.retailer}
                  <div className="small-note">{line.sku}</div>
                </td>
                <td>
                  {line.quantity} → {line.purchaseUnits}{' '}
                  {line.purchaseUnits === 1 ? 'unit' : 'units'}
                </td>
                <td>{money(line.lineTotalMinor, line.currency)}</td>
                <td>
                  {shortDate(line.observedAt)} · {line.freshness}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small-note">
        Subtotal {money(plan.totals.subtotalMinor, plan.totals.currency)}
        {plan.totals.shippingMinor > 0 &&
          ` + est. shipping ${money(plan.totals.shippingMinor, plan.totals.currency)}`}
        ; tax excluded. Shipping is an estimate.
      </p>
      {plan.notes
        .filter((note) => !note.startsWith('Prices are dated') && !note.startsWith('Tax excluded'))
        .map((note) => (
          <p key={note} className="small-note">
            {note}
          </p>
        ))}
      {plan.rejected.length > 0 && (
        <p className="small-note">
          <button className="link-button" onClick={() => setShowRejected(!showRejected)}>
            {showRejected ? 'Hide' : 'Show'} {plan.rejected.length} rejected candidates
          </button>
        </p>
      )}
      {showRejected && (
        <ul>
          {plan.rejected.map((candidate) => (
            <li key={candidate.offerId}>
              <span className="small-note">
                {candidate.productId}: {candidate.reasons.join('; ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CheckoutReviewView({ review }: { review: CheckoutReviewPayload }) {
  const lines = review.groups.flatMap((group) => group.lines);
  const unverified = lines.some((line) => line.source === 'example-import');
  return (
    <div>
      <div className="investigation-banner">
        Authorization required · Renovagent never completes purchases. You check out at each
        retailer; accepting this review records your authorization.
      </div>
      {unverified && (
        <div className="historical-banner">
          Includes demo or unverified price observations. Confirm every price at checkout.
        </div>
      )}
      {review.groups.map((group) => (
        <section key={group.retailer} aria-label={`${group.retailer} cart`}>
          <h3>
            {group.retailer} · {money(group.subtotalMinor, group.currency)}
          </h3>
          <ul>
            {group.lines.map((line) => (
              <li key={line.bomItemId}>
                {line.purchaseUnits} × {line.productName} ({line.sku}) ·{' '}
                {money(line.lineTotalMinor, line.currency)} · observed {shortDate(line.observedAt)}{' '}
                {line.freshness}
                {line.url && (
                  <>
                    {' '}
                    ·{' '}
                    <a href={line.url} target="_blank" rel="noreferrer">
                      Product page ↗
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
          {group.cartUrl ? (
            <p>
              <a href={group.cartUrl} target="_blank" rel="noreferrer">
                Open {group.retailer} cart ↗
              </a>{' '}
              <span className="small-note">
                Adds items only; you review and pay at the retailer.
              </span>
            </p>
          ) : (
            <p className="small-note">No cart link for this retailer; add each line manually.</p>
          )}
        </section>
      ))}
      <p className="small-note">
        Total {money(review.totals.subtotalMinor, review.totals.currency)}; tax excluded, shipping
        not included.
      </p>
      <h3>Before you pay</h3>
      <ol>
        {review.checklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
      {review.notes.map((note) => (
        <p key={note} className="small-note">
          {note}
        </p>
      ))}
    </div>
  );
}
