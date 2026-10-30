import { createHash } from 'node:crypto';
import {
  DomainError,
  tierLabels,
  type Command,
  type DesignDirection,
  type DesignOptions,
  type ScopeInputKey,
  type Workspace,
} from '@renovagent/contracts';
import {
  bomFromRequirements,
  buildTierPlans,
  designOptionRequirements,
  designOptionsId,
  fingerprint,
  handleCommand,
  previewCurrent,
  recipeRequirements,
  scopeDraftId,
  scopeRecipe,
  type PricedOffer,
} from '@renovagent/core';
import { priceCurrentDraft } from './scope-drafts.js';
import type { CatalogStore } from './catalog.js';
import { normalizeImage, sha256Of, type DesignImageStore } from './design-images.js';
import type { MongoWorkspaceRepository } from './repository.js';

export const designImagePath = (sha256: string) => `/api/workspace/design-images/${sha256}`;

// Store an owner-provided room photo: the original's hash is kept for
// provenance; a bounded JPEG derivative is what options and previews use.
export async function uploadDesignPhoto(
  images: DesignImageStore,
  ownerId: string,
  input: { bytes: Uint8Array; originalName: string; label: string; permission: string },
) {
  const normalized = await normalizeImage(input.bytes);
  const image = await images.put(ownerId, normalized, {
    label: input.label,
    originalName: input.originalName,
    originalSha256: sha256Of(input.bytes),
    permission: input.permission,
  });
  return { image, path: designImagePath(image.sha256) };
}

// Catalog candidates for every priceable requirement a recipe can produce.
async function recipeCatalog(catalog: CatalogStore | undefined, recipeId: string) {
  if (!catalog) return { products: [], priced: [] as PricedOffer[] };
  const recipe = scopeRecipe(recipeId);
  const categories = [
    ...new Set(
      recipeRequirements(
        recipeId,
        recipe.packages.map((p) => p.id),
        {},
      ).flatMap((r) => (r.catalog ? [r.catalog.category] : [])),
    ),
  ];
  const products = await catalog.productsInCategories(categories);
  return { products, priced: await catalog.pricedOffers(products.map((p) => p.id)) };
}

// When a design command re-drafts the preferred option's scope, price that new
// draft in the same update so Materials follows the selection.
function priceIfRedrafted(
  before: Workspace,
  after: Workspace,
  projectId: string,
  commandId: string,
  pricing: Awaited<ReturnType<typeof recipeCatalog>>,
  now: string,
  ownerId: string,
) {
  const id = scopeDraftId(projectId);
  if ((before.artifacts[id]?.length ?? 0) === (after.artifacts[id]?.length ?? 0)) return after;
  return priceCurrentDraft(
    after,
    projectId,
    { ownerId, now },
    {
      commandId: (step) => `${commandId}:${step}`,
      ...pricing,
    },
  );
}

type Reported = { key: ScopeInputKey; amount: number | null; unit: 'ft' | 'in' | 'm' | 'cm' }[];

function commandKey(projectId: string, requestId: string, body: unknown) {
  return createHash('sha256')
    .update(`${projectId}\n${requestId}\n${fingerprint(body)}`)
    .digest('hex')
    .slice(0, 24);
}

// Build three same-room options from a stored photo. Idempotent per request.
export async function buildDesignOptions(
  repository: MongoWorkspaceRepository,
  images: DesignImageStore,
  catalog: CatalogStore | undefined,
  input: {
    requestId: string;
    projectId: string;
    request: string;
    sourcePhotoSha256: string;
    reported: Reported;
  },
) {
  const stored = await images.get(repository.ownerId, input.sourcePhotoSha256);
  if (!stored?.record.source)
    throw new DomainError('NOT_FOUND', 'Upload the room photo in the project first');
  const { record } = stored;
  const sourcePhoto = {
    image: {
      sha256: record.sha256,
      mediaType: record.mediaType,
      width: record.width,
      height: record.height,
      bytes: stored.bytes.byteLength,
    },
    ...record.source!,
  };
  const body = { request: input.request, sourcePhoto, reported: input.reported };
  const commandId = `design-build:${commandKey(input.projectId, input.requestId, body)}`;
  const pricing = await recipeCatalog(catalog, 'living-room-refresh');
  return repository.update((doc) => {
    const state = doc.workspace;
    if (!state.projects[input.projectId])
      throw new DomainError('NOT_FOUND', `Unknown project ${input.projectId}`);
    const replay = !!state.commands[commandId];
    const now = new Date().toISOString();
    if (!replay)
      doc.workspace = handleCommand(
        state,
        {
          commandId,
          projectId: input.projectId,
          baseRevision: state.projects[input.projectId].revision,
          type: 'BuildDesignOptions',
          payload: {
            recipeId: 'living-room-refresh',
            ...body,
            expectedRevision:
              state.artifacts[designOptionsId(input.projectId)]?.at(-1)?.revision ?? 0,
          },
        } as Command,
        { ownerId: repository.ownerId, now },
      ).state;
    if (!replay)
      doc.workspace = priceIfRedrafted(
        state,
        doc.workspace,
        input.projectId,
        commandId,
        pricing,
        now,
        repository.ownerId,
      );
    return { replay, ref: currentRef(doc.workspace, input.projectId) };
  });
}

// "Make it blue", "I like the hardwood one", or retry a failed preview.
export async function reviseDesignOption(
  repository: MongoWorkspaceRepository,
  catalog: CatalogStore | undefined,
  input: {
    requestId: string;
    projectId: string;
    optionId: string;
    direction?: Partial<DesignDirection>;
    select?: boolean;
    retryPreview?: boolean;
  },
) {
  const body = {
    optionId: input.optionId,
    ...(input.direction ? { direction: input.direction } : {}),
    select: input.select ?? false,
    ...(input.retryPreview ? { retryPreview: true } : {}),
  };
  const commandId = `design-revise:${commandKey(input.projectId, input.requestId, body)}`;
  const pricing = await recipeCatalog(catalog, 'living-room-refresh');
  return repository.update((doc) => {
    const state = doc.workspace;
    const replay = !!state.commands[commandId];
    const now = new Date().toISOString();
    const current = state.artifacts[designOptionsId(input.projectId)]?.at(-1);
    if (!current) throw new DomainError('NOT_FOUND', 'Build design options first');
    if (!replay)
      doc.workspace = handleCommand(
        state,
        {
          commandId,
          projectId: input.projectId,
          baseRevision: state.projects[input.projectId].revision,
          type: 'ReviseDesignOptions',
          payload: { ...body, expectedRevision: current.revision },
        } as Command,
        { ownerId: repository.ownerId, now },
      ).state;
    if (!replay)
      doc.workspace = priceIfRedrafted(
        state,
        doc.workspace,
        input.projectId,
        commandId,
        pricing,
        now,
        repository.ownerId,
      );
    return { replay, ref: currentRef(doc.workspace, input.projectId) };
  });
}

function currentRef(state: Workspace, projectId: string) {
  const artifact = state.artifacts[designOptionsId(projectId)].at(-1)!;
  return { kind: 'artifact' as const, id: artifact.id, revision: artifact.revision };
}

function money(minor: number, currency: string) {
  const amount = Math.round(minor / 100).toLocaleString('en-US');
  return currency === 'USD' ? `$${amount}` : `${amount} ${currency}`;
}

// Per-option costs from the current catalog: a builder-to-high materials range
// for the priced requirements, with honest coverage and the biggest unknown.
export async function summarizeDesignOptions(
  workspace: Workspace,
  projectId: string,
  catalog: CatalogStore | undefined,
) {
  const artifact = workspace.artifacts[designOptionsId(projectId)]?.at(-1);
  if (!artifact || artifact.payload.kind !== 'design-options')
    throw new DomainError('NOT_FOUND', 'No design options in this project');
  const options = artifact.payload as DesignOptions;
  const requirements = Object.fromEntries(
    options.options.map((o) => [o.id, designOptionRequirements(options, o.id)]),
  );
  const categories = [
    ...new Set(
      Object.values(requirements)
        .flat()
        .flatMap((r) => (r.catalog ? [r.catalog.category] : [])),
    ),
  ];
  const products = catalog ? await catalog.productsInCategories(categories) : [];
  const priced = catalog ? await catalog.pricedOffers(products.map((p) => p.id)) : [];
  return {
    ref: { kind: 'artifact' as const, id: artifact.id, revision: artifact.revision },
    freshness: artifact.freshness,
    request: options.request,
    sourcePhoto: {
      label: options.sourcePhoto.label,
      path: designImagePath(options.sourcePhoto.image.sha256),
    },
    selectedOptionId: options.selectedOptionId,
    options: options.options.map((option) => {
      const reqs = requirements[option.id];
      const { bom, pricedIds } = bomFromRequirements(options.recipe, reqs, products);
      const plans = bom ? buildTierPlans(bom, priced).filter((p) => p.lines.length) : [];
      const low = plans[0];
      const high = plans.at(-1);
      const blocked = reqs.filter((r) => r.status === 'needs-input');
      const preview =
        option.preview.status === 'generated' && previewCurrent(option) && option.preview.image
          ? {
              status: 'generated',
              path: designImagePath(option.preview.image.sha256),
              label: 'Generated concept — not a photo',
            }
          : {
              status: option.preview.status,
              ...(option.preview.error ? { error: option.preview.error } : {}),
            };
      return {
        id: option.id,
        title: option.title,
        summary: option.summary,
        direction: option.direction,
        retained: option.retained,
        preview,
        materials:
          low && high
            ? {
                range: `${money(low.totals.subtotalMinor, low.totals.currency)}–${money(high.totals.subtotalMinor, high.totals.currency)}`,
                tiers: plans.map((p) => ({
                  tier: tierLabels[p.tier],
                  subtotal: money(p.totals.subtotalMinor, p.totals.currency),
                })),
                basis: plans.every((p) => p.basis === 'verified')
                  ? 'dated price observations'
                  : 'demo example prices, not live offers',
              }
            : null,
        coverage: `Priced ${pricedIds.length} of ${reqs.length} requirements; materials only, tax excluded. Not priced: labor, disposal, delivery.`,
        biggestUnknown: blocked.length
          ? `${blocked[0].purpose} waits on ${blocked[0].blockedBy.join(', ')}`
          : (reqs.find((r) => r.status === 'conditional')?.condition ?? null),
      };
    }),
    limits: options.limits,
  };
}
