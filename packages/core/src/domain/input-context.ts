import { type Workspace, type InputRef } from '@unpermitted/contracts';
export function captureInputs(state: Workspace, projectId: string): InputRef[] {
  const project = state.projects[projectId];
  const facts = Object.values(state.facts)
    .map((v) => v.at(-1)!)
    .filter(
      (f) =>
        f.propertyId === project.propertyId && (f.projectId === null || f.projectId === projectId),
    );
  const evidence = Object.values(state.evidence).filter(
    (e) =>
      e.propertyId === project.propertyId &&
      (e.projectId === null || e.projectId === projectId) &&
      e.source.kind !== 'user-message',
  );
  // Direction records join workflow context without becoming physical facts.
  // Keep stale responses in this review's capture: dependent output must remain blocked
  // until the review is replaced. A new research revision never inherits old answers.
  const research = state.artifacts[`${projectId}:property-research`]?.at(-1);
  const answers = Object.values(state.artifacts)
    .map((v) => v.at(-1)!)
    .filter(
      (a) =>
        a &&
        a &&
        a.projectId === projectId &&
        a.payload.kind === 'photo-planning-answer' &&
        a.inputRefs.some(
          (r) => r.kind === 'artifact' && r.id === research?.id && r.revision === research.revision,
        ),
    );
  const surveys = Object.values(state.artifacts)
    .map((v) => v.at(-1))
    .filter((a) => a?.projectId === projectId && a.payload.kind === 'candidate-measurements');
  const inventory = state.artifacts[`${projectId}:photo-inventory`]?.at(-1);
  const inventoryContext = Object.values(state.artifacts)
    .map((v) => v.at(-1)!)
    .filter(
      (a) =>
        a &&
        a.projectId === projectId &&
        (a.payload.kind === 'photo-inventory' ||
          (a.payload.kind === 'inventory-direction' &&
            a.inputRefs.some((r) => r.id === inventory?.id && r.revision === inventory.revision))),
    );
  return [
    ...inventoryContext.map((a) => ({ kind: 'artifact' as const, id: a.id, revision: a.revision })),
    ...surveys.map((a) => ({ kind: 'artifact' as const, id: a!.id, revision: a!.revision })),
    ...answers.map((a) => ({ kind: 'artifact' as const, id: a.id, revision: a.revision })),
    ...facts.map((f) => ({ kind: 'fact' as const, id: f.id, revision: f.revision })),
    ...evidence.map((e) => ({ kind: 'evidence' as const, id: e.id, revision: 1 })),
  ].sort((a, b) =>
    `${a.kind}:${a.id}` < `${b.kind}:${b.id}`
      ? -1
      : `${a.kind}:${a.id}` > `${b.kind}:${b.id}`
        ? 1
        : 0,
  );
}
export const inputSignature = (state: Workspace, projectId: string) =>
  JSON.stringify(captureInputs(state, projectId));
