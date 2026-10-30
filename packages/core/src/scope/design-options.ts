import {
  DomainError,
  type Command,
  type CommandContext,
  type DesignDirection,
  type DesignOptions,
  type InputRef,
  type ScopeRequirement,
  type Workspace,
} from '@renovagent/contracts';
import { fingerprint } from '../domain/canonical-json.js';
import {
  compileScopeDraft,
  recipeRequirements,
  reportedFromInputs,
  resolveScopeInputs,
  scopeDraftId,
  scopeRecipe,
  valuesFromInputs,
} from './draft-scope.js';
import { livingRoomOptions, livingRoomPreviewPrompt } from './living-room-refresh.js';

// Option sets per recipe. A new room type registers its options and its
// preview instruction here; the command path stays generic.
const DESIGN_RECIPES: Record<
  string,
  {
    options: typeof livingRoomOptions;
    previewPrompt: (packageIds: string[], direction: DesignDirection) => string;
  }
> = {
  'living-room-refresh': { options: livingRoomOptions, previewPrompt: livingRoomPreviewPrompt },
};

export const designOptionsId = (projectId: string) => `${projectId}:design-options`;

function designRecipe(recipeId: string) {
  const design = Object.hasOwn(DESIGN_RECIPES, recipeId) ? DESIGN_RECIPES[recipeId] : undefined;
  if (!design) throw new DomainError('VALIDATION', `No design options for recipe ${recipeId}`);
  return design;
}

export function designPreviewPrompt(options: DesignOptions, optionId: string): string {
  const option = options.options.find((o) => o.id === optionId);
  if (!option) throw new DomainError('NOT_FOUND', `Unknown design option ${optionId}`);
  return designRecipe(options.recipe.id).previewPrompt(option.packageIds, option.direction);
}

// An option's requirements are recomputed from the recipe and the stored
// inputs, so its costs always follow the current catalog and recipe.
export function designOptionRequirements(
  options: DesignOptions,
  optionId: string,
): ScopeRequirement[] {
  const option = options.options.find((o) => o.id === optionId);
  if (!option) throw new DomainError('NOT_FOUND', `Unknown design option ${optionId}`);
  return recipeRequirements(
    options.recipe.id,
    option.packageIds,
    valuesFromInputs(options.inputs),
    option.direction,
  );
}

// A preview is current only for the direction it was requested for.
export function previewCurrent(option: DesignOptions['options'][number]): boolean {
  return fingerprint(option.preview.forDirection) === fingerprint(option.direction);
}

function store(
  state: Workspace,
  projectId: string,
  ctx: CommandContext,
  payload: DesignOptions,
  inputRefs: InputRef[],
) {
  const id = designOptionsId(projectId);
  const old = state.artifacts[id]?.at(-1);
  (state.artifacts[id] ||= []).push({
    schemaVersion: 1,
    id,
    projectId,
    revision: (old?.revision ?? 0) + 1,
    lifecycle: 'proposed',
    freshness: 'current',
    inputRefs,
    evidenceIds: [],
    payload,
    createdAt: ctx.now,
    acceptedAt: null,
  });
  return { kind: 'artifact' as const, id, revision: (old?.revision ?? 0) + 1 };
}

function current(state: Workspace, projectId: string, expected: number) {
  const old = state.artifacts[designOptionsId(projectId)]?.at(-1);
  if ((old?.revision ?? 0) !== expected)
    throw new DomainError('CONFLICT', 'The design options changed; review the current revision');
  if (old && old.payload.kind !== 'design-options')
    throw new DomainError('CONFLICT', 'Design options identity is occupied');
  return old as (typeof old & { payload: DesignOptions }) | undefined;
}

// The selected option drives the scope draft (and through it the BOM, plans
// and checkout). Re-draft whenever the selection, its direction or inputs move.
function redraftSelected(
  state: Workspace,
  pid: string,
  ctx: CommandContext,
  payload: DesignOptions,
  ref: InputRef,
) {
  const selected = payload.options.find((o) => o.id === payload.selectedOptionId)!;
  const draftId = scopeDraftId(pid);
  const prior = state.artifacts[draftId]?.at(-1);
  if (prior && prior.payload.kind !== 'scope-draft')
    throw new DomainError('CONFLICT', 'Scope draft identity is occupied');
  const { draft, inputRefs } = compileScopeDraft(state, pid, {
    recipeId: payload.recipe.id,
    packageIds: selected.packageIds,
    request: `${payload.request} — option: ${selected.title}`,
    reported: reportedFromInputs(payload.inputs),
    direction: selected.direction,
    expectedDraftRevision: prior?.revision ?? 0,
  });
  (state.artifacts[draftId] ||= []).push({
    schemaVersion: 1,
    id: draftId,
    projectId: pid,
    revision: (prior?.revision ?? 0) + 1,
    lifecycle: 'proposed',
    freshness: 'current',
    inputRefs: [...inputRefs, ref],
    evidenceIds: [],
    payload: draft,
    createdAt: ctx.now,
    acceptedAt: null,
  });
  return draftId;
}

export function handleDesignOptions(state: Workspace, command: Command, ctx: CommandContext) {
  const pid = command.projectId;
  if (command.type === 'BuildDesignOptions') {
    const p = command.payload;
    const old = current(state, pid, p.expectedRevision);
    const recipe = scopeRecipe(p.recipeId);
    const design = designRecipe(p.recipeId);
    const { inputs, inputRefs, limits } = resolveScopeInputs(state, pid, p.reported);
    // Rebuilding the same photo with new measurements keeps each option's
    // direction, preview and the person's preference: measurements change
    // quantities and costs, not appearance.
    const carried =
      old &&
      old.payload.recipe.id === recipe.id &&
      old.payload.sourcePhoto.image.sha256 === p.sourcePhoto.image.sha256
        ? old.payload
        : undefined;
    const payload: DesignOptions = {
      kind: 'design-options',
      recipe: { id: recipe.id, version: recipe.version },
      request: p.request,
      sourcePhoto: p.sourcePhoto,
      inputs,
      options: design.options.map((option) => {
        const prior = carried?.options.find((o) => o.id === option.id);
        return prior
          ? { ...option, direction: prior.direction, preview: prior.preview }
          : { ...option, preview: { status: 'pending', forDirection: option.direction } };
      }),
      selectedOptionId: carried?.selectedOptionId ?? null,
      limits: [
        'Concept options from a versioned recipe for one photographed room; not a site survey, design approval or technical review.',
        'Generated previews are concepts, not photographs: they do not establish fit, materials, condition or feasibility.',
        'Costs are recomputed from the catalog at view time; demo catalog prices are labeled examples.',
        ...limits,
      ].slice(0, 10),
    };
    const ref = store(state, pid, ctx, payload, inputRefs);
    const ids = [ref.id];
    if (payload.selectedOptionId) ids.push(redraftSelected(state, pid, ctx, payload, ref));
    return { type: 'ArtifactProposed' as const, ids };
  }
  if (command.type === 'ReviseDesignOptions') {
    const p = command.payload;
    const old = current(state, pid, p.expectedRevision);
    if (!old) throw new DomainError('NOT_FOUND', 'Build design options first');
    const payload = structuredClone(old.payload);
    const option = payload.options.find((o) => o.id === p.optionId);
    if (!option) throw new DomainError('NOT_FOUND', `Unknown design option ${p.optionId}`);
    if (p.direction) {
      option.direction = { ...option.direction, ...p.direction };
      if (!previewCurrent(option))
        option.preview = { status: 'pending', forDirection: option.direction };
    }
    if (p.retryPreview && option.preview.status === 'failed')
      option.preview = { status: 'pending', forDirection: option.direction };
    if (p.select) payload.selectedOptionId = option.id;
    if (fingerprint(payload) === fingerprint(old.payload))
      throw new DomainError('VALIDATION', 'Nothing changed in the design options');
    const ref = store(state, pid, ctx, payload, old.inputRefs);
    const ids = [ref.id];
    if (payload.selectedOptionId && (p.select || payload.selectedOptionId === p.optionId))
      ids.push(redraftSelected(state, pid, ctx, payload, ref));
    return { type: 'ArtifactProposed' as const, ids };
  }
  if (command.type === 'RecordDesignPreview') {
    const p = command.payload;
    const old = current(state, pid, p.expectedRevision);
    if (!old) throw new DomainError('NOT_FOUND', 'Build design options first');
    const payload = structuredClone(old.payload);
    const option = payload.options.find((o) => o.id === p.optionId);
    if (!option) throw new DomainError('NOT_FOUND', `Unknown design option ${p.optionId}`);
    if (option.preview.status !== 'pending' || !previewCurrent(option))
      throw new DomainError('STALE', 'This option no longer awaits a preview');
    if (fingerprint(p.preview.forDirection) !== fingerprint(option.direction))
      throw new DomainError('STALE', 'The preview was made for an earlier direction');
    if (p.preview.status === 'generated') {
      if (!p.preview.image || !p.preview.provenance)
        throw new DomainError('VALIDATION', 'A generated preview needs its image and provenance');
      if (p.preview.provenance.sourcePhotoSha256 !== payload.sourcePhoto.image.sha256)
        throw new DomainError('VALIDATION', 'The preview was not made from this source photo');
    }
    option.preview = p.preview;
    return {
      type: 'ArtifactProposed' as const,
      ids: [store(state, pid, ctx, payload, old.inputRefs).id],
    };
  }
  return undefined;
}
