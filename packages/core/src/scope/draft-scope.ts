import {
  DomainError,
  type BomPayload,
  type Command,
  type CommandContext,
  type InputRef,
  type Product,
  type ScopeDraft,
  type ScopeInput,
  type ScopeInputKey,
  type Workspace,
} from '@renovagent/contracts';
import {
  bathroomNotPriced,
  bathroomPackages,
  bathroomQuestions,
  bathroomRefreshRecipe,
  bathroomRequirements,
  bathroomSources,
  type RecipeValues,
} from './bathroom-refresh.js';

// Recipes are looked up by ID; a new space type adds a registry entry rather
// than special-casing the bathroom in the command path.
const RECIPES = {
  [bathroomRefreshRecipe.id]: {
    ...bathroomRefreshRecipe,
    packages: bathroomPackages,
    requirements: bathroomRequirements,
    questions: bathroomQuestions,
    sources: bathroomSources,
    notPriced: bathroomNotPriced,
  },
} as const;

export function scopeRecipeCurrent(recipe: { id: string; version: number }): boolean {
  const current = RECIPES[recipe.id as keyof typeof RECIPES];
  return !!current && current.version === recipe.version;
}

export const scopeDraftId = (projectId: string) => `${projectId}:scope-draft`;

const INPUTS: { key: ScopeInputKey; label: string; unit: 'ft' | 'in'; factKey?: string }[] = [
  { key: 'floorLengthFt', label: 'Floor length', unit: 'ft', factKey: 'finishedLength' },
  { key: 'floorWidthFt', label: 'Floor width', unit: 'ft', factKey: 'finishedWidth' },
  { key: 'ceilingHeightFt', label: 'Ceiling height', unit: 'ft', factKey: 'ceilingHeight' },
  { key: 'vanityWidthIn', label: 'Vanity width', unit: 'in' },
  { key: 'toiletRoughInIn', label: 'Toilet rough-in', unit: 'in' },
];

const TO_INCHES = { in: 1, ft: 12, cm: 1 / 2.54, m: 100 / 2.54 } as const;
const round = (value: number) => Math.round(value * 100) / 100;

// Workspace facts win over relayed values. Facts are stored canonically in mm.
function currentFact(state: Workspace, projectId: string, key: string) {
  const project = state.projects[projectId];
  const matches = Object.values(state.facts)
    .map((versions) => versions.at(-1)!)
    .filter(
      (fact) =>
        fact.key === key &&
        fact.value.kind === 'quantity' &&
        fact.value.dimension === 'length' &&
        fact.assertion !== 'unknown' &&
        fact.propertyId === project.propertyId &&
        (fact.projectId === null || fact.projectId === projectId),
    )
    .sort((a, b) =>
      a.projectId === b.projectId ? (a.id < b.id ? -1 : 1) : a.projectId === null ? 1 : -1,
    );
  return matches[0];
}

export function compileScopeDraft(
  state: Workspace,
  projectId: string,
  payload: Extract<Command, { type: 'DraftScope' }>['payload'],
): { draft: ScopeDraft; inputRefs: InputRef[] } {
  const recipe = RECIPES[payload.recipeId as keyof typeof RECIPES];
  if (!recipe) throw new DomainError('VALIDATION', `Unknown scope recipe ${payload.recipeId}`);
  const known = new Set<string>(recipe.packages.map((p) => p.id));
  const unknown = payload.packageIds.filter((id) => !known.has(id));
  if (unknown.length)
    throw new DomainError(
      'VALIDATION',
      `Unknown work packages for ${recipe.id}: ${unknown.join(', ')}. Choose from ${[...known].join(', ')}`,
    );
  const declared = new Set(payload.packageIds);
  if ([...declared].some((id) => id !== 'removal-protection')) declared.add('removal-protection');
  const reported = new Map(payload.reported.map((r) => [r.key, r]));
  if (reported.size !== payload.reported.length)
    throw new DomainError('VALIDATION', 'Each input may be reported once');

  const values: RecipeValues = {};
  const inputs: ScopeInput[] = [];
  const inputRefs: InputRef[] = [];
  const limits: string[] = [];
  for (const { factKey, ...input } of INPUTS) {
    const fact = factKey ? currentFact(state, projectId, factKey) : undefined;
    const relayed = reported.get(input.key);
    const relayedAmount =
      relayed && relayed.amount !== null
        ? round((relayed.amount * TO_INCHES[relayed.unit]) / (input.unit === 'ft' ? 12 : 1))
        : null;
    if (fact && fact.value.kind === 'quantity') {
      const amount = round(fact.value.amount / (input.unit === 'ft' ? 304.8 : 25.4));
      const ref = { kind: 'fact' as const, id: fact.id, revision: fact.revision };
      values[input.key] = amount;
      inputRefs.push(ref);
      inputs.push({ ...input, amount, source: 'workspace-fact', factRef: ref });
      if (relayedAmount !== null && relayedAmount !== amount)
        limits.push(
          `${input.label}: the recorded fact (${amount} ${input.unit}) was used instead of the relayed ${relayedAmount} ${input.unit}.`,
        );
    } else if (relayedAmount !== null) {
      values[input.key] = relayedAmount;
      inputs.push({ ...input, amount: relayedAmount, source: 'agent-relayed' });
    } else
      inputs.push({
        ...input,
        amount: null,
        source: relayed ? 'reported-unknown' : 'not-provided',
      });
  }

  const requirements = recipe.packages
    .filter((p) => declared.has(p.id))
    .flatMap((p) => recipe.requirements(p.id, values));
  const notAsked = new Set(inputs.filter((i) => i.source === 'not-provided').map((i) => i.key));
  const questions = recipe.questions
    .map((q, order) => ({
      ...q,
      order,
      unblocks: requirements.filter((r) => r.blockedBy.some((key) => q.inputKeys.includes(key)))
        .length,
    }))
    .filter((q) => q.unblocks > 0 && q.inputKeys.some((key) => notAsked.has(key)))
    .sort((a, b) => b.unblocks - a.unblocks || a.order - b.order)
    .slice(0, 2)
    .map(({ inputKeys, question, unblocks }) => ({ inputKeys, question, unblocks }));
  const usedSources = new Set(requirements.flatMap((r) => r.sourceIds));

  return {
    inputRefs,
    draft: {
      kind: 'scope-draft',
      recipe: { id: recipe.id, version: recipe.version },
      request: payload.request,
      packages: recipe.packages.map((p) => ({
        id: p.id,
        title: p.title,
        included: declared.has(p.id),
        summary: p.summary,
      })),
      inputs,
      requirements,
      sources: recipe.sources.filter((s) => usedSources.has(s.id)),
      questions,
      notPriced: [...recipe.notPriced],
      limits: [
        'Draft scope from a versioned recipe; not a site survey, design approval or technical review.',
        'Relayed measurements are unverified; conditional items depend on conditions found on site.',
        ...limits,
      ].slice(0, 10),
    },
  };
}

export function handleDraftScope(state: Workspace, command: Command, ctx: CommandContext) {
  if (command.type !== 'DraftScope') return undefined;
  const pid = command.projectId;
  const id = scopeDraftId(pid);
  const old = state.artifacts[id]?.at(-1);
  if ((old?.revision ?? 0) !== command.payload.expectedDraftRevision)
    throw new DomainError('CONFLICT', 'The scope draft changed; review the current revision');
  if (old && old.payload.kind !== 'scope-draft')
    throw new DomainError('CONFLICT', 'Scope draft identity is occupied');
  const { draft, inputRefs } = compileScopeDraft(state, pid, command.payload);
  (state.artifacts[id] ||= []).push({
    schemaVersion: 1,
    id,
    projectId: pid,
    revision: (old?.revision ?? 0) + 1,
    lifecycle: 'proposed',
    freshness: 'current',
    inputRefs,
    evidenceIds: [],
    payload: draft,
    createdAt: ctx.now,
    acceptedAt: null,
  });
  return { type: 'ArtifactProposed' as const, ids: [id] };
}

// Pricing bridge: requirements with a catalog category and a known quantity
// become BOM items whose candidates are the supplied catalog products in that
// category. Everything else stays listed as unpriced in the draft.
export function bomFromScopeDraft(
  draft: ScopeDraft,
  products: Product[],
): { bom: BomPayload | null; pricedIds: string[]; unpricedIds: string[] } {
  const items: BomPayload['items'] = [];
  const pricedIds: string[] = [];
  for (const requirement of draft.requirements) {
    if (
      !requirement.catalog ||
      requirement.status !== 'quantified' ||
      requirement.quantity === null
    )
      continue;
    const candidates = products
      .filter((product) => product.category === requirement.catalog!.category)
      .map((product) => product.id)
      .sort()
      .slice(0, 40);
    if (!candidates.length) continue;
    pricedIds.push(requirement.id);
    items.push({
      id: requirement.id,
      category: requirement.catalog.category,
      description: requirement.specification.slice(0, 500),
      quantity: requirement.quantity,
      unit: requirement.unit,
      constraints: requirement.catalog.constraints,
      codeTopics: requirement.codeTopics,
      candidateProductIds: candidates,
    });
  }
  const priced = new Set(pricedIds);
  return {
    bom: items.length
      ? {
          kind: 'bom',
          templateId: `scope-draft:${draft.recipe.id}`,
          templateVersion: draft.recipe.version,
          items,
        }
      : null,
    pricedIds,
    unpricedIds: draft.requirements.filter((r) => !priced.has(r.id)).map((r) => r.id),
  };
}
