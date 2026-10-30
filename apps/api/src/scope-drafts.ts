import { createHash } from 'node:crypto';
import {
  DomainError,
  tierLabels,
  type Command,
  type CommandContext,
  type DraftScopePayload,
  type InputRef,
  type ScopeDraft,
  type Workspace,
} from '@renovagent/contracts';
import {
  bomFromScopeDraft,
  buildTierPlans,
  compileScopeDraft,
  fingerprint,
  handleCommand,
  scopeDraftId,
  scopeFactSignature,
  type PricedOffer,
} from '@renovagent/core';
import type { CatalogStore } from './catalog.js';
import type { MongoWorkspaceRepository } from './repository.js';

export type DraftProjectScope = Omit<DraftScopePayload, 'expectedDraftRevision'> & {
  requestId: string;
  projectId: string;
};

// Intent-level service: compile the recipe draft through the validated
// DraftScope command, propose a BOM for the requirements the catalog can price
// (depending on that exact draft revision), and build tier plans from it with
// the same engine the website uses. One atomic workspace update. The command
// key covers the request content, so a retry replays while a changed request
// under the same requestId is drafted anew rather than answered with old work.
export async function draftProjectScope(
  repository: MongoWorkspaceRepository,
  catalog: CatalogStore | undefined,
  input: DraftProjectScope,
) {
  const payload = {
    recipeId: input.recipeId,
    packageIds: input.packageIds,
    request: input.request,
    reported: input.reported,
  };
  const { workspace } = await repository.read();
  if (!workspace.projects[input.projectId])
    throw new DomainError('NOT_FOUND', `Unknown project ${input.projectId}`);
  // Recorded measurements are part of the key too: once a dimension is saved,
  // the same request drafts anew instead of replaying the blocked draft.
  const facts = scopeFactSignature(workspace, input.projectId);
  const key = createHash('sha256')
    .update(`${input.projectId}\n${input.requestId}\n${fingerprint(payload)}\n${facts}`)
    .digest('hex')
    .slice(0, 24);
  const commandId = (step: string) => `mcp-scope:${key}:${step}`;
  let priced: PricedOffer[] = [];
  let products: PricedOffer['product'][] = [];
  if (catalog && !workspace.commands[commandId('draft')]) {
    const preview = compileScopeDraft(workspace, input.projectId, {
      ...payload,
      expectedDraftRevision: 0,
    }).draft;
    const categories = [
      ...new Set(preview.requirements.flatMap((r) => (r.catalog ? [r.catalog.category] : []))),
    ];
    products = await catalog.productsInCategories(categories);
    priced = await catalog.pricedOffers(products.map((product) => product.id));
  }

  return repository.update((doc) => {
    const replay = !!doc.workspace.commands[commandId('draft')];
    if (!replay) {
      const context = { ownerId: repository.ownerId, now: new Date().toISOString() };
      doc.workspace = draftAndPrice(doc.workspace, input.projectId, payload, context, {
        commandId,
        products,
        priced,
      });
    }
    // A replay reports the current draft rather than drafting again.
    return summarize(doc.workspace, input.projectId, replay);
  });
}

function draftAndPrice(
  initial: Workspace,
  projectId: string,
  payload: Omit<DraftScopePayload, 'expectedDraftRevision'>,
  context: CommandContext,
  catalog: {
    commandId: (step: string) => string;
    products: PricedOffer['product'][];
    priced: PricedOffer[];
  },
): Workspace {
  let state = initial;
  const apply = (step: string, type: Command['type'], body: unknown) => {
    state = handleCommand(
      state,
      {
        commandId: catalog.commandId(step),
        projectId,
        baseRevision: state.projects[projectId].revision,
        type,
        payload: body,
      } as Command,
      context,
    ).state;
  };
  const draftId = scopeDraftId(projectId);
  apply('draft', 'DraftScope', {
    ...payload,
    expectedDraftRevision: state.artifacts[draftId]?.at(-1)?.revision ?? 0,
  });
  const draft = state.artifacts[draftId].at(-1)!;
  const { bom } = bomFromScopeDraft(draft.payload as ScopeDraft, catalog.products);
  if (!bom) return state;
  const bomId = `${projectId}:bom`;
  apply('bom', 'ProposeArtifact', {
    artifactId: bomId,
    supersedesRevision: state.artifacts[bomId]?.at(-1)?.revision ?? 0,
    inputRefs: [{ kind: 'artifact', id: draftId, revision: draft.revision }],
    evidenceIds: [],
    content: bom,
  });
  const bomRef: InputRef = {
    kind: 'artifact',
    id: bomId,
    revision: state.artifacts[bomId].at(-1)!.revision,
  };
  for (const plan of buildTierPlans(bom, catalog.priced)) {
    if (!plan.lines.length) continue;
    const planId = `${projectId}:purchase-plan:${plan.tier}`;
    apply(`plan-${plan.tier}`, 'ProposeArtifact', {
      artifactId: planId,
      supersedesRevision: state.artifacts[planId]?.at(-1)?.revision ?? 0,
      inputRefs: [bomRef],
      evidenceIds: [],
      content: { kind: 'purchase-plan', ...plan, bomRef, builtAt: context.now },
    });
  }
  return state;
}

function money(minor: number, currency: string) {
  return currency === 'USD'
    ? `$${(minor / 100).toFixed(2)}`
    : `${(minor / 100).toFixed(2)} ${currency}`;
}

function summarize(state: Workspace, projectId: string, replay: boolean) {
  const draftId = scopeDraftId(projectId);
  const artifact = state.artifacts[draftId].at(-1)!;
  const draft = artifact.payload as ScopeDraft;
  const draftRef = { kind: 'artifact' as const, id: draftId, revision: artifact.revision };
  const bom = state.artifacts[`${projectId}:bom`]?.at(-1);
  const bomCurrent =
    bom?.payload.kind === 'bom' &&
    bom.inputRefs.some(
      (ref) => ref.kind === 'artifact' && ref.id === draftId && ref.revision === artifact.revision,
    );
  const plans = bomCurrent
    ? (['builder', 'mid', 'high'] as const).flatMap((tier) => {
        const plan = state.artifacts[`${projectId}:purchase-plan:${tier}`]?.at(-1);
        if (
          plan?.payload.kind !== 'purchase-plan' ||
          !plan.inputRefs.some((ref) => ref.id === bom.id && ref.revision === bom.revision)
        )
          return [];
        const p = plan.payload;
        return [
          {
            tier: tierLabels[tier],
            planRef: { kind: 'artifact' as const, id: plan.id, revision: plan.revision },
            materialsSubtotal: money(p.totals.subtotalMinor, p.totals.currency),
            pricedRequirements: p.lines.length,
            priceBasis:
              p.basis === 'verified'
                ? 'dated observations'
                : 'demo example prices, not live offers',
          },
        ];
      })
    : [];
  const count = (status: string) => draft.requirements.filter((r) => r.status === status).length;
  const priceable = bomCurrent && bom.payload.kind === 'bom' ? bom.payload.items.length : 0;
  return {
    replay,
    draftRef,
    bomRef:
      bom && bomCurrent ? { kind: 'artifact' as const, id: bom.id, revision: bom.revision } : null,
    packages: draft.packages.filter((p) => p.included).map((p) => p.title),
    requirements: {
      total: draft.requirements.length,
      quantified: count('quantified'),
      needsMeasurement: count('needs-input'),
      needsProductSelection: count('needs-product-spec'),
      conditional: count('conditional'),
      allowanceUnset: count('needs-source'),
      catalogPriceable: priceable,
    },
    materialsPricing: plans,
    coverage: `Catalog prices cover ${priceable} of ${draft.requirements.length} requirements. Not priced: ${draft.notPriced.join(', ').toLowerCase()}. Subtotals are materials only for the priced items, tax excluded — not a project estimate.`,
    nextQuestions: draft.questions.map((q) => q.question),
    note: 'Proposed draft only. Ask the next questions conversationally; "I don\'t know" is a valid answer and is kept. Relayed values are unverified. Open the draft in the project files for every requirement, quantity basis and source.',
  };
}
