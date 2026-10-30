import { emptyWorkspace } from '@renovagent/contracts';
import { compileScopeDraft, handleCommand, summarizeFloorPlan } from '@renovagent/core';

// An isolated example compiled by the same domain code as a real project.
// Never stored in the user's workspace; no site measurements are inferred.
const projectId = 'landing-example';
const ctx = { ownerId: 'landing-example', now: '2026-10-30T12:00:00.000Z' };
const { state } = handleCommand(
  emptyWorkspace(ctx.ownerId),
  {
    commandId: 'landing-create',
    projectId,
    baseRevision: 0,
    basePropertyRevision: 0,
    type: 'CreateProject',
    payload: {
      name: 'Living room refresh · example',
      propertyId: 'landing-house',
      newProperty: { name: 'Example home' },
      spaces: [{ id: 'living-room', name: 'Living room' }],
    },
  },
  ctx,
);
export const exampleScope = compileScopeDraft(state, projectId, {
  recipeId: 'living-room-refresh',
  packageIds: ['carpet-removal', 'lvp-floor', 'wall-paint'],
  request: 'Replace the carpet. Paint the walls warm white. Keep the stairs.',
  reported: [],
  expectedDraftRevision: 0,
}).draft;

// Synthetic single-room RoomPlan-shaped file, not a homeowner scan.
export const exampleScan = summarizeFloorPlan({
  walls: [
    { dimensions: [6, 2.7, 0.1], transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 3, 1.35, 0, 1] },
    { dimensions: [4, 2.7, 0.1], transform: [0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, 6, 1.35, 2, 1] },
    { dimensions: [6, 2.7, 0.1], transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 3, 1.35, 4, 1] },
    { dimensions: [4, 2.7, 0.1], transform: [0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 1.35, 2, 1] },
  ],
  floors: [],
  doors: [],
  windows: [],
  openings: [],
});
