import {
  DomainError,
  type Artifact,
  type CheckoutReviewPayload,
  type InputRef,
  type PurchasePlanPayload,
  type Workspace,
} from '@renovagent/contracts';
import { referenceCurrent, resolveRef } from '../domain/invalidate.js';
import { planBasis } from './plans.js';
import { purchaseUnits } from './pricing.js';

// Proposal-grade commerce payloads are checked against the artifacts they name.
// Schema validity alone never makes purchasing math trusted: every total,
// line identity and dependency is recomputed here. Catalog provenance (that an
// offer and price really exist) needs the catalog and is checked at the server.

function invalid(message: string): never {
  throw new DomainError('VALIDATION', message);
}

function sameRef(a: InputRef, b: InputRef) {
  return a.kind === b.kind && a.id === b.id && a.revision === b.revision;
}

function currentSource(
  state: Workspace,
  projectId: string,
  ref: InputRef,
  inputRefs: InputRef[],
  label: string,
): Artifact {
  if (ref.kind !== 'artifact' || !inputRefs.some((input) => sameRef(input, ref)))
    invalid(`The ${label} revision must be one of the proposal's input references`);
  const source = resolveRef(state, projectId, ref) as Artifact;
  if (source.lifecycle === 'rejected')
    throw new DomainError('STALE', `The referenced ${label} was declined`);
  if (!referenceCurrent(state, projectId, ref))
    throw new DomainError(
      'STALE',
      `The referenced ${label} is not current; rebuild from the latest revision`,
    );
  return source;
}

// Tiered slots (`<project>:purchase-plan:<tier>`) must hold that tier's content.
function checkTierSlot(projectId: string, artifactId: string, kind: string, tier: string) {
  const prefix = `${projectId}:${kind}:`;
  if (artifactId.startsWith(prefix) && artifactId.slice(prefix.length) !== tier)
    invalid(`${artifactId} must hold the ${artifactId.slice(prefix.length)} tier, not ${tier}`);
}

export function validatePurchasePlan(
  state: Workspace,
  projectId: string,
  artifactId: string,
  plan: PurchasePlanPayload,
  inputRefs: InputRef[],
): void {
  if (plan.bomRef.kind !== 'artifact' || state.artifacts[plan.bomRef.id] === undefined)
    invalid('Purchase plan must name an existing BOM artifact');
  const bomArtifact = currentSource(state, projectId, plan.bomRef, inputRefs, 'BOM');
  if (bomArtifact.payload.kind !== 'bom') invalid('Purchase plan bomRef must name a BOM artifact');
  checkTierSlot(projectId, artifactId, 'purchase-plan', plan.tier);
  const items = new Map(bomArtifact.payload.items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  for (const line of plan.lines) {
    const item = items.get(line.bomItemId);
    const at = `purchase plan line ${line.bomItemId}`;
    if (!item) invalid(`${at} is not in the referenced BOM`);
    if (seen.has(line.bomItemId)) invalid(`${at} appears more than once`);
    seen.add(line.bomItemId);
    if (!item.candidateProductIds.includes(line.productId))
      invalid(`${at}: product ${line.productId} is not a BOM candidate`);
    if (line.quantity !== item.quantity) invalid(`${at}: quantity differs from the BOM`);
    if (line.purchaseUnits !== purchaseUnits(line.quantity, line.packQuantity))
      invalid(`${at}: purchase units do not match quantity and pack size`);
    if (line.lineTotalMinor !== line.purchaseUnits * line.unitPriceMinor)
      invalid(`${at}: line total is not units × unit price`);
    if (line.currency !== plan.totals.currency) invalid(`${at}: currency differs from the plan`);
    if (
      line.codeTopics.length !== item.codeTopics.length ||
      line.codeTopics.some((topic) => !item.codeTopics.includes(topic))
    )
      invalid(`${at}: code topics differ from the BOM`);
  }
  if (plan.totals.subtotalMinor !== plan.lines.reduce((sum, line) => sum + line.lineTotalMinor, 0))
    invalid('Purchase plan subtotal is not the sum of its lines');
  if (plan.basis !== planBasis(plan.lines))
    invalid(`Purchase plan basis must be ${planBasis(plan.lines)} for its line sources`);
}

const CHECKED_LINE_FIELDS = [
  'offerId',
  'productId',
  'productName',
  'retailer',
  'sku',
  'quantity',
  'purchaseUnits',
  'unitPriceMinor',
  'lineTotalMinor',
  'currency',
  'observedAt',
  'freshness',
  'source',
] as const;

export function validateCheckoutReview(
  state: Workspace,
  projectId: string,
  artifactId: string,
  review: CheckoutReviewPayload,
  inputRefs: InputRef[],
): void {
  const planArtifact = currentSource(
    state,
    projectId,
    review.purchasePlanRef,
    inputRefs,
    'purchase plan',
  );
  if (planArtifact.payload.kind !== 'purchase-plan')
    invalid('Checkout review must reference a purchase plan');
  const plan = planArtifact.payload;
  checkTierSlot(projectId, artifactId, 'checkout-review', plan.tier);
  const expected = new Map(plan.lines.map((line) => [line.bomItemId, line]));
  const retailers = new Set<string>();
  let count = 0;
  for (const group of review.groups) {
    if (retailers.has(group.retailer))
      invalid(`Checkout review repeats retailer ${group.retailer}`);
    retailers.add(group.retailer);
    if (group.currency !== plan.totals.currency)
      invalid('Checkout review currency differs from the plan');
    if (group.subtotalMinor !== group.lines.reduce((sum, line) => sum + line.lineTotalMinor, 0))
      invalid(`Checkout review subtotal for ${group.retailer} is not the sum of its lines`);
    if (group.cartUrl) {
      const url = new URL(group.cartUrl);
      if (
        group.retailer.toLowerCase() !== 'amazon' ||
        url.protocol !== 'https:' ||
        url.hostname !== 'www.amazon.com' ||
        url.pathname !== '/gp/aws/cart/add.html'
      )
        invalid(`Checkout review cart link for ${group.retailer} is not a supported cart link`);
    }
    for (const line of group.lines) {
      count += 1;
      const planned = expected.get(line.bomItemId);
      if (!planned) invalid(`Checkout review line ${line.bomItemId} is not in the purchase plan`);
      if (line.retailer !== group.retailer)
        invalid(`Checkout review line ${line.bomItemId} is grouped under the wrong retailer`);
      for (const field of CHECKED_LINE_FIELDS)
        if (line[field] !== planned[field])
          invalid(
            `Checkout review line ${line.bomItemId}: ${field} differs from the purchase plan`,
          );
      expected.delete(line.bomItemId);
    }
  }
  if (expected.size || count !== plan.lines.length)
    invalid('Checkout review must contain every purchase plan line exactly once');
  if (
    review.totals.subtotalMinor !== plan.totals.subtotalMinor ||
    review.totals.currency !== plan.totals.currency
  )
    invalid('Checkout review totals differ from the purchase plan');
}
