import { photoInventorySchema, type Workspace, DomainError } from '@renovagent/contracts';
import { resolveRef, validateArtifactGraph } from './invalidate.js';
export function validateWorkspaceIntegrity(state: Workspace) {
  const require = (value: unknown, message: string): void => {
    if (!value) throw new DomainError('VALIDATION', message);
  };
  for (const [id, p] of Object.entries(state.properties))
    require(p.id === id && p.ownerId === state.ownerId, 'Invalid property identity/owner');
  for (const [id, s] of Object.entries(state.spaces))
    require(s.id === id && state.properties[s.propertyId], 'Invalid space parent/identity');
  for (const [id, p] of Object.entries(state.projects))
    require(p.id === id &&
      state.properties[p.propertyId] &&
      p.spaceIds.every(
        (id) => state.spaces[id]?.propertyId === p.propertyId,
      ), 'Invalid project parent/space identity');
  const projectFor = (projectId: string | null, propertyId: string) => {
    require(state.properties[propertyId], 'Missing property');
    if (projectId)
      require(state.projects[projectId]?.propertyId === propertyId, 'Invalid record scope');
  };
  const sharedScope = (projectId: string | null, propertyId: string, evidenceId: string) => {
    const e = state.evidence[evidenceId];
    require(e &&
      e.propertyId === propertyId &&
      (e.projectId === null || e.projectId === projectId), 'Missing or out-of-scope evidence');
  };
  const blobIds = new Set<string>();
  for (const [id, e] of Object.entries(state.evidence)) {
    require(id === e.id && id === e.source.id, 'Invalid evidence identity');
    projectFor(e.projectId, e.propertyId);
    const a = e.source.attachment;
    if (a) {
      require(!blobIds.has(a.blobId), 'Duplicate attachment blob identity');
      blobIds.add(a.blobId);
      if (a.role === 'derived') {
        sharedScope(e.projectId, e.propertyId, a.originalEvidenceId!);
        require(state.evidence[a.originalEvidenceId!]?.source.attachment?.role ===
          'original', 'Derived media lacks original attachment');
      }
    }
  }
  for (const [id, versions] of Object.entries(state.facts))
    for (const [i, f] of versions.entries()) {
      require(f.id === id &&
        f.revision === i + 1 &&
        f.supersedesRevision === (i || null), 'Invalid fact revision chain');
      projectFor(f.projectId, f.propertyId);
      require(f.projectId
        ? f.subjectId === f.projectId
        : f.subjectId === f.propertyId ||
            state.spaces[f.subjectId]?.propertyId === f.propertyId, 'Invalid fact subject');
      f.evidenceIds.forEach((id) => sharedScope(f.projectId, f.propertyId, id));
      require(!f.inputRefs.length, 'Derived facts are not supported in Slice 1');
    }
  for (const [id, versions] of Object.entries(state.artifacts))
    for (const [i, a] of versions.entries()) {
      require(a.id === id &&
        a.revision === i + 1 &&
        state.projects[a.projectId], 'Invalid artifact revision chain/scope');
      a.inputRefs.forEach((ref) => resolveRef(state, a.projectId, ref));
      a.evidenceIds.forEach((id) =>
        resolveRef(state, a.projectId, { kind: 'evidence', id, revision: 1 }),
      );
      if (a.payload.kind === 'photo-inventory') photoInventorySchema.parse(a.payload);
      if (a.payload.kind === 'evidence-index')
        a.payload.evidenceIds.forEach((id) =>
          resolveRef(state, a.projectId, { kind: 'evidence', id, revision: 1 }),
        );
    }
  for (const [id, d] of Object.entries(state.decisions)) {
    require(d.id === id &&
      d.actorId === state.ownerId &&
      state.projects[d.projectId], 'Invalid decision scope/identity');
    for (const ref of d.artifactRefs) {
      require(ref.kind === 'artifact', 'Decision must reference artifacts');
      resolveRef(state, d.projectId, ref);
    }
  }
  const eventIds = new Set<string>();
  for (const e of state.events) {
    require(state.projects[e.projectId] &&
      e.projectRevision <= state.projects[e.projectId].revision &&
      !eventIds.has(e.id), 'Invalid event scope/revision/identity');
    eventIds.add(e.id);
  }
  for (const [id, entry] of Object.entries(state.commands))
    require(id === entry.result.commandId &&
      state.projects[entry.result.projectId] &&
      entry.result.eventIds.every((id) => eventIds.has(id)), 'Invalid idempotency record');
  if (state.activeProjectId)
    require(state.projects[state.activeProjectId], 'Invalid active project');
  for (const [projectId, draft] of Object.entries(state.drafts)) {
    require(state.projects[projectId], 'Draft project missing');
    if (draft.photoReply) {
      const source = resolveRef(state, projectId, {
        kind: 'artifact',
        id: draft.photoReply.researchId,
        revision: draft.photoReply.researchRevision,
      });
      require('payload' in source &&
        source.payload.kind === 'property-research' &&
        source.payload.photoReview?.planning?.questions[
          draft.photoReply.questionIndex
        ], 'Draft question missing from source review');
    }
    draft.evidenceIds.forEach((id) =>
      resolveRef(state, projectId, { kind: 'evidence', id, revision: 1 }),
    );
  }
  for (const [projectId, view] of Object.entries(state.views)) {
    require(state.projects[projectId], 'View project missing');
    if (view.artifactRef) resolveRef(state, projectId, view.artifactRef);
  }
  for (const [id, run] of Object.entries(state.runs)) {
    require(run.id === id && state.projects[run.projectId], 'Invalid run scope');
    run.inputRefs.forEach((ref) => resolveRef(state, run.projectId, ref));
    if (run.outputRef) resolveRef(state, run.projectId, run.outputRef);
    if (run.answerEvidenceId)
      resolveRef(state, run.projectId, { kind: 'evidence', id: run.answerEvidenceId, revision: 1 });
  }
  const messageIds = new Set<string>();
  for (const message of state.messages) {
    require(state.projects[message.projectId] &&
      !messageIds.has(message.id), 'Invalid message scope or duplicate');
    messageIds.add(message.id);
    message.evidenceIds.forEach((id) =>
      resolveRef(state, message.projectId, { kind: 'evidence', id, revision: 1 }),
    );
    message.artifactRefs.forEach((ref) => resolveRef(state, message.projectId, ref));
    if (message.runId)
      require(state.runs[message.runId]?.projectId ===
        message.projectId, 'Message run scope mismatch');
  }
  validateArtifactGraph(state);
}
