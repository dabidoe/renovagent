import { useState } from 'react';
import type { WorkspaceController } from '../../app/workspace-controller.js';
import { workspaceRequest } from '../../adapters/http/project-repository.js';
import { vanityTemplate } from '../../../../../fixtures/catalog/vanity-philadelphia.js';
import { buildCheckoutReview, buildTierPlans, latest, type PricedOffer } from '@renovagent/core';
import {
  tierLabels,
  type Artifact,
  type CheckoutReviewPayload,
  type Offer,
  type PriceObservation,
  type Product,
  type PurchasePlanPayload,
  type Tier,
} from '@renovagent/contracts';

const TIERS: Tier[] = ['builder', 'mid', 'high'];

function money(minor: number, currency: string): string {
  const amount = (minor / 100).toFixed(2);
  return currency === 'USD' ? `$${amount}` : `${amount} ${currency}`;
}

function shortDate(stamp: string): string {
  return stamp.slice(0, 10);
}

export function PurchasePlans({
  controller,
  projectId,
}: {
  controller: WorkspaceController;
  projectId: string;
}) {
  const state = controller.getSnapshot().workspace;
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const bom = latest(state.artifacts[`${projectId}:bom`]);
  const bomPayload = bom?.payload.kind === 'bom' ? bom.payload : null;
  const plans = TIERS.map((tier) => {
    const artifact = latest(state.artifacts[`${projectId}:purchase-plan:${tier}`]);
    return {
      tier,
      artifact:
        artifact?.payload.kind === 'purchase-plan'
          ? (artifact as Artifact & { payload: PurchasePlanPayload })
          : null,
    };
  });
  const run = async (label: string, work: () => Promise<void>) => {
    setBusy(label);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };
  const startFromTemplate = () =>
    run('template', async () => {
      await controller.proposeBom(projectId, vanityTemplate);
    });
  const buildPlans = () =>
    run('build', async () => {
      if (!bom || !bomPayload) throw Error('Build the bill of materials first.');
      const productIds = [...new Set(bomPayload.items.flatMap((item) => item.candidateProductIds))];
      const catalog = (await workspaceRequest(
        `/catalog/offers?productIds=${productIds.map(encodeURIComponent).join(',')}`,
      )) as { products: Product[]; offers: Offer[]; observations: PriceObservation[] };
      const products = new Map(catalog.products.map((p) => [p.id, p]));
      const observations = new Map(catalog.observations.map((o) => [o.offerId, o]));
      const priced: PricedOffer[] = [];
      for (const offer of catalog.offers) {
        const product = products.get(offer.productId);
        const observation = observations.get(offer.id);
        if (product && observation) priced.push({ offer, product, observation });
      }
      await controller.proposePurchasePlans(
        projectId,
        { id: bom.id, revision: bom.revision },
        buildTierPlans(bomPayload, priced),
      );
    });
  return (
    <div>
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={() => setError('')}>Dismiss</button>
        </div>
      )}
      {!bomPayload && (
        <div className="prompt-empty">
          <h3>Start from a measured template.</h3>
          <p>
            The Philadelphia vanity-replacement template lists 5 material items with dimensions,
            compatibility constraints, and code topics for contractor verification.
          </p>
          <button className="primary" disabled={!!busy} onClick={() => void startFromTemplate()}>
            {busy === 'template' ? 'Saving…' : 'Build bill of materials'}
          </button>
        </div>
      )}
      {bomPayload && (
        <>
          <p className="small-note">
            {bomPayload.items.length} BOM items from {bomPayload.templateId} v
            {bomPayload.templateVersion}.{' '}
            <button className="link-button" disabled={!!busy} onClick={() => void buildPlans()}>
              {busy === 'build' ? 'Building…' : 'Find offers & rebuild tier plans'}
            </button>
          </p>
          {plans.every((p) => !p.artifact) && !busy && (
            <p className="small-note">
              No purchase plans yet. Rebuild to match compatible offers at three tiers.
            </p>
          )}
          {plans.map(({ tier, artifact }) => {
            if (!artifact) return null;
            const reviewRecord = latest(state.artifacts[`${projectId}:checkout-review:${tier}`]);
            const review =
              reviewRecord?.payload.kind === 'checkout-review'
                ? (reviewRecord as Artifact & { payload: CheckoutReviewPayload })
                : null;
            return (
              <PlanCard
                key={tier}
                tier={tier}
                artifact={artifact}
                review={review}
                onDecide={(reject) =>
                  void run(`decide-${tier}`, () =>
                    controller.decide(projectId, artifact.id, artifact.revision, reject),
                  )
                }
                busy={busy === `decide-${tier}`}
                onCheckout={() =>
                  void run(`checkout-${tier}`, async () => {
                    const productIds = [
                      ...new Set(artifact.payload.lines.map((line) => line.productId)),
                    ];
                    const catalog = (await workspaceRequest(
                      `/catalog/offers?productIds=${productIds.map(encodeURIComponent).join(',')}`,
                    )) as { offers: Offer[] };
                    const reviewPayload = buildCheckoutReview(
                      artifact.payload,
                      { id: artifact.id, revision: artifact.revision },
                      new Map(catalog.offers.map((offer) => [offer.id, offer])),
                    );
                    await controller.proposeCheckoutReview(projectId, tier, reviewPayload);
                  })
                }
                checkoutBusy={busy === `checkout-${tier}`}
              />
            );
          })}
        </>
      )}
    </div>
  );
}

function PlanCard({
  tier,
  artifact,
  review,
  onDecide,
  busy,
  onCheckout,
  checkoutBusy,
}: {
  tier: Tier;
  artifact: Artifact & { payload: PurchasePlanPayload };
  review: (Artifact & { payload: CheckoutReviewPayload }) | null;
  onDecide: (reject: boolean) => void;
  busy: boolean;
  onCheckout: () => void;
  checkoutBusy: boolean;
}) {
  const plan = artifact.payload;
  const [showRejected, setShowRejected] = useState(false);
  return (
    <section aria-label={`${tierLabels[tier]} purchase plan`}>
      <h3>
        {tierLabels[tier]} · {money(plan.totals.subtotalMinor, plan.totals.currency)}
      </h3>
      {plan.basis !== 'verified' && (
        <div className="historical-banner">
          Example prices for planning only — {plan.basis === 'fixture' ? 'all' : 'some'} lines use
          demo observations, not live offers. Verify every price before purchase.
        </div>
      )}
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
                {line.quantity} → {line.purchaseUnits} {line.purchaseUnits === 1 ? 'unit' : 'units'}
              </td>
              <td>{money(line.lineTotalMinor, line.currency)}</td>
              <td>
                {shortDate(line.observedAt)} · {line.freshness}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small-note">
        Subtotal {money(plan.totals.subtotalMinor, plan.totals.currency)}
        {plan.totals.shippingMinor > 0 &&
          ` + est. shipping ${money(plan.totals.shippingMinor, plan.totals.currency)}`}
        ; tax excluded. Shipping is an estimate.
      </p>
      {plan.notes
        .filter((note) => note.startsWith('No acceptable'))
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
      <p className="small-note">
        {artifact.lifecycle === 'accepted'
          ? 'Accepted.'
          : artifact.lifecycle === 'rejected'
            ? 'Declined.'
            : 'Proposal — needs review.'}{' '}
        Revision {artifact.revision}
        {artifact.freshness !== 'current' && ' · inputs changed since build'}.
      </p>
      {artifact.lifecycle === 'proposed' && (
        <div>
          <button className="secondary" disabled={busy} onClick={() => onDecide(false)}>
            {busy ? 'Saving…' : 'Accept plan'}
          </button>{' '}
          <button className="link-button" disabled={busy} onClick={() => onDecide(true)}>
            Decline
          </button>
        </div>
      )}
      <p className="small-note">
        {review ? (
          <>
            Checkout review r{review.revision} saved
            {review.lifecycle !== 'proposed' ? ` · ${review.lifecycle}` : ''}. Open it in the
            Project record, check out at the retailer, and accept it to record your authorization.
          </>
        ) : (
          'No checkout review yet.'
        )}{' '}
        <button className="link-button" disabled={checkoutBusy} onClick={onCheckout}>
          {checkoutBusy
            ? 'Preparing…'
            : review
              ? 'Rebuild checkout review'
              : 'Prepare checkout review'}
        </button>
      </p>
    </section>
  );
}
