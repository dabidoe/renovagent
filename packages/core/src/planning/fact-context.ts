import { type Workspace } from '@unpermitted/contracts';
export const physicalKeys = ['finishedWidth', 'finishedLength'];
export function planningFacts(state: Workspace, projectId: string, keys = physicalKeys) {
  const p = state.projects[projectId],
    subjects = new Set([p.id, p.propertyId, ...p.spaceIds]);
  return Object.values(state.facts)
    .map((v) => v.at(-1)!)
    .filter(
      (f) =>
        f.propertyId === p.propertyId &&
        (f.projectId === null || f.projectId === p.id) &&
        subjects.has(f.subjectId) &&
        keys.includes(f.key),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}
export function planningFactSignature(state: Workspace, projectId: string, keys = physicalKeys) {
  return JSON.stringify(planningFacts(state, projectId, keys).map((f) => [f.id, f.revision]));
}

export const localityFactKeys = [
  'jurisdiction',
  'countryCode',
  'regionCode',
  'municipality',
  'postalCode',
];
