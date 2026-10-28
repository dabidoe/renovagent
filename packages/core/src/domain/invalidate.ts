import { planningFactSignature } from '../planning/fact-context.js';
import { technicalVersionCurrent } from '../planning/versions.js';
import { taskReadiness } from '../planning/calculators.js';
import { inputSignature } from './input-context.js';
import { type Workspace, type InputRef, type Artifact, DomainError } from '@unpermitted/contracts';
export const latest = <T>(versions: T[] | undefined): T | undefined => versions?.at(-1);
export function resolveRef(state: Workspace, projectId: string, ref: InputRef) {
  const project = state.projects[projectId];
  const entity =
    ref.kind === 'fact'
      ? state.facts[ref.id]?.find((f) => f.revision === ref.revision)
      : ref.kind === 'artifact'
        ? state.artifacts[ref.id]?.find((a) => a.revision === ref.revision)
        : ref.revision === 1
          ? state.evidence[ref.id]
          : undefined;
  if (!entity)
    throw new DomainError('VALIDATION', `Missing ${ref.kind} revision: ${ref.id}@${ref.revision}`);
  if ('propertyId' in entity && entity.propertyId !== project.propertyId)
    throw new DomainError('FORBIDDEN', 'Reference belongs to another property');
  if (entity.projectId !== null && entity.projectId !== projectId)
    throw new DomainError('FORBIDDEN', 'Reference belongs to another project');
  return entity;
}
export function referenceCurrent(
  state: Workspace,
  projectId: string,
  ref: InputRef,
  visiting = new Set<string>(),
): boolean {
  const entity = resolveRef(state, projectId, ref);
  if (ref.kind === 'fact') return latest(state.facts[ref.id])?.revision === ref.revision;
  if (ref.kind === 'evidence') return true;
  if (latest(state.artifacts[ref.id])?.revision !== ref.revision) return false;
  const a = entity as Artifact;
  if (
    a.freshness !== 'current' ||
    (a.factContext &&
      a.factContext.signature !== planningFactSignature(state, a.projectId, a.factContext.keys)) ||
    !technicalVersionCurrent(a) ||
    (a.contextSignature && a.contextSignature !== inputSignature(state, a.projectId))
  )
    return false;
  if (visiting.has(a.id)) throw new DomainError('VALIDATION', 'Cyclic artifact dependency');
  const next = new Set(visiting).add(a.id);
  return a.inputRefs.every((input) => referenceCurrent(state, projectId, input, next));
}
export function validateArtifactGraph(state: Workspace) {
  const visiting = new Set<string>(),
    visited = new Set<string>();
  function walk(id: string) {
    if (visiting.has(id)) throw new DomainError('VALIDATION', 'Cyclic artifact dependency');
    if (visited.has(id)) return;
    visiting.add(id);
    const a = latest(state.artifacts[id]);
    for (const input of a?.inputRefs || []) {
      resolveRef(state, a!.projectId, input);
      if (input.kind === 'artifact') walk(input.id);
    }
    visiting.delete(id);
    visited.add(id);
  }
  Object.keys(state.artifacts).forEach(walk);
}
export function invalidate(state: Workspace): string[] {
  const changed = new Set<string>();
  // Fixed-point traversal handles transitive dependencies without relying on insertion order.
  let again = true;
  while (again) {
    again = false;
    for (const versions of Object.values(state.artifacts)) {
      for (const artifact of versions) {
        if (artifact.freshness !== 'current') continue;
        if (
          (artifact.factContext &&
            artifact.factContext.signature !==
              planningFactSignature(state, artifact.projectId, artifact.factContext.keys)) ||
          !technicalVersionCurrent(artifact) ||
          (artifact.contextSignature &&
            artifact.contextSignature !== inputSignature(state, artifact.projectId)) ||
          !artifact.inputRefs.every((ref) => referenceCurrent(state, artifact.projectId, ref))
        ) {
          artifact.freshness = 'stale';
          changed.add(artifact.id);
          again = true;
        }
      }
    }
  }
  return [...changed].sort();
}
export function taskViews(state: Workspace, projectId: string) {
  return Object.values(state.artifacts).flatMap<{
    id: string;
    title: string;
    deps: string[];
    progress: string;
    readiness: 'ready' | 'blocked' | 'needs_review';
    planRef: { id: string; revision: number };
    reasons?: string[];
  }>((versions) => {
    const a = latest(versions)!;
    if (a.projectId !== projectId || !['task-plan', 'gated-plan'].includes(a.payload.kind))
      return [];
    const current = referenceCurrent(state, projectId, {
      kind: 'artifact',
      id: a.id,
      revision: a.revision,
    });
    if (a.payload.kind === 'gated-plan')
      return taskReadiness(a.payload.tasks, current).map((t) => ({
        ...t,
        planRef: { id: a.id, revision: a.revision },
        progress: 'not_started' as const,
      }));
    if (a.payload.kind !== 'task-plan') return [];
    return a.payload.tasks.map((task) => ({
      ...task,
      planRef: { id: a.id, revision: a.revision },
      readiness: current ? ('needs_review' as const) : ('blocked' as const),
    }));
  });
}
