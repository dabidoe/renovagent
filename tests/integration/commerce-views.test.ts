import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildCheckoutReview, buildTierPlans } from '@renovagent/core';
import type { Artifact, PurchasePlanPayload } from '@renovagent/contracts';
import { vanityCatalog, vanityTemplate } from '../../fixtures/catalog/vanity-philadelphia.js';
import { ArtifactView } from '../../apps/web/src/features/work/artifact-view.js';

function plan(): PurchasePlanPayload {
  const products = new Map(vanityCatalog.products.map((p) => [p.id, p]));
  const observations = new Map(vanityCatalog.observations.map((o) => [o.offerId, o]));
  const [builder] = buildTierPlans(
    vanityTemplate,
    vanityCatalog.offers.map((offer) => ({
      offer,
      product: products.get(offer.productId)!,
      observation: observations.get(offer.id)!,
    })),
  );
  return {
    kind: 'purchase-plan',
    ...builder,
    bomRef: { kind: 'artifact', id: 'project-a:bom', revision: 1 },
    builtAt: '2026-10-29T15:00:00.000Z',
  };
}

function render(payload: Artifact['payload']): string {
  const artifact = {
    schemaVersion: 1,
    id: `project-a:${payload.kind}`,
    projectId: 'project-a',
    revision: 1,
    lifecycle: 'proposed',
    freshness: 'current',
    inputRefs: [],
    evidenceIds: [],
    payload,
  } as unknown as Artifact;
  return renderToStaticMarkup(createElement(ArtifactView, { artifact }));
}

test('saved BOM, purchase-plan and checkout-review artifacts render their content', () => {
  const bom = render(vanityTemplate);
  assert.match(bom, /material requirements/);
  for (const item of vanityTemplate.items) assert.ok(bom.includes(item.description), item.id);

  const purchase = render(plan());
  assert.match(purchase, /Builder grade · \$307\.00/);
  assert.match(purchase, /Example prices for planning only/);
  assert.match(purchase, /tax excluded/);

  const review = buildCheckoutReview(
    plan(),
    { id: 'project-a:purchase-plan:builder', revision: 1 },
    new Map(vanityCatalog.offers.map((o) => [o.id, o])),
    { builtAt: '2026-10-29T18:00:00.000Z' },
  );
  const checkout = render(review);
  assert.match(checkout, /Authorization required/);
  assert.match(checkout, /never completes purchases/);
  assert.match(checkout, /demo or unverified/);
  assert.match(checkout, /Before you pay/);
  assert.match(checkout, /\$307\.00/);
});
