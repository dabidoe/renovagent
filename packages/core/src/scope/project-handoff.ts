import type { ScopeDraft, Workspace } from '@renovagent/contracts';
import type { LocalityInput } from '../planning/code-markets.js';
import { boxRoomModel } from '../geometry/room-model.js';
import { roomAnnotations } from '../geometry/room-annotations.js';
import { readPlanningInputs } from '../planning/commands.js';
import { resolveLocalContext } from '../planning/locality.js';
import { scopeDraftId } from './draft-scope.js';
import { EXAMPLE_TAG } from './example-quotes.js';
import { reviewScope } from './scope-review.js';
import { contractorHandoff } from './contractor-handoff.js';

// One entry point for the web app and the MCP tools: the current scope draft's
// review and contractor handoff, read from workspace state.

function current(state: Workspace, projectId: string) {
  const artifact = state.artifacts[scopeDraftId(projectId)]?.at(-1);
  if (!artifact || artifact.payload.kind !== 'scope-draft') return null;
  return { draft: artifact.payload as ScopeDraft, revision: artifact.revision };
}

// `assumed` is a location to review against without recording it.
export function projectScopeReview(
  state: Workspace,
  projectId: string,
  assumed: LocalityInput | null = null,
) {
  const found = current(state, projectId);
  if (!found) return null;
  const context = readPlanningInputs(state, projectId).context;
  const philadelphia =
    assumed?.regionCode === 'PA' && /^philadelphia$/i.test(assumed.municipality ?? '');
  const local = resolveLocalContext(
    assumed
      ? { ...context, jurisdiction: philadelphia ? 'philadelphia' : 'other', locality: assumed }
      : context,
  );
  return reviewScope(found.draft, { local, locality: assumed });
}

export function projectHandoff(
  state: Workspace,
  projectId: string,
  generatedAt: string,
  assumed: LocalityInput | null = null,
) {
  const found = current(state, projectId);
  const review = projectScopeReview(state, projectId, assumed);
  if (!found || !review) return null;
  // Only the step order, guides and template estimates are used here; a
  // placeholder room stands in because pin placement is not part of a handoff.
  const notes = roomAnnotations(
    boxRoomModel({ lengthM: 1, widthM: 1, heightM: null }),
    found.draft,
    null,
  );
  const project = state.projects[projectId];
  return contractorHandoff({
    projectName: project?.name ?? 'Project',
    propertyName: project ? (state.properties[project.propertyId]?.name ?? null) : null,
    draft: found.draft,
    draftRevision: found.revision,
    steps: notes.steps,
    prep: notes.prep,
    review,
    generatedAt,
    example: found.draft.request.startsWith(EXAMPLE_TAG),
  });
}
