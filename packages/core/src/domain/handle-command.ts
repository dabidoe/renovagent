import { inputSignature } from './input-context.js';
import { validateConversationPlan } from '../research/conversation.js';
import { handleHomeInventory } from '../research/home-inventory.js';
import { handleScopePlanning } from '../research/scope-planning.js';
import { answerPhotoQuestion } from '../research/photo-answers.js';
import { refreshPropertyBrief } from '../research/working-brief.js';
import {
  propertyAddress,
  researchJobId,
  validateResearchForJob,
} from '../research/property-research.js';
import { canonicalValue } from './quantities.js';
import { handlePlanning } from '../planning/commands.js';
import { handleWorkflow, finishRunsForDecision } from './workflow.js';
import {
  commandSchema,
  emptyPlanningInputs,
  workspaceSchema,
  stamp,
  type Workspace,
  type Command,
  type CommandResult,
  type CommandContext,
  DomainError,
} from '@unpermitted/contracts';
import { validateWorkspaceIntegrity } from './validate-workspace.js';
import {
  invalidate,
  latest,
  referenceCurrent,
  resolveRef,
  validateArtifactGraph,
} from './invalidate.js';
export { fingerprint } from './canonical-json.js';
import { fingerprint } from './canonical-json.js';
function validate<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof DomainError) throw e;
    throw new DomainError('VALIDATION', 'Invalid command or workspace', { reason: String(e) });
  }
}
function validateTasks(command: Extract<Command, { type: 'ProposeArtifact' }>) {
  if (command.payload.content.kind !== 'task-plan') return;
  const tasks = command.payload.content.tasks,
    seen = new Set<string>();
  if (new Set(tasks.map((t) => t.id)).size !== tasks.length)
    throw new DomainError('VALIDATION', 'Duplicate task IDs');
  const visiting = new Set<string>();
  function walk(id: string) {
    if (visiting.has(id)) throw new DomainError('VALIDATION', 'Cyclic task dependency');
    if (seen.has(id)) return;
    const t = tasks.find((t) => t.id === id);
    if (!t) throw new DomainError('VALIDATION', 'Missing task dependency');
    visiting.add(id);
    t.deps.forEach(walk);
    visiting.delete(id);
    seen.add(id);
  }
  tasks.forEach((t) => {
    if (t.progress !== 'not_started')
      throw new DomainError('VALIDATION', 'Completion requires a future evidence-backed command');
    walk(t.id);
  });
}
export function handleCommand(
  input: Workspace,
  raw: unknown,
  context: CommandContext,
): { state: Workspace; result: CommandResult; duplicate: boolean } {
  const command = validate(() => commandSchema.parse(raw));
  const checked = validate(() => workspaceSchema.parse(input));
  validate(() => stamp.parse(context.now));
  if (checked.ownerId !== context.ownerId)
    throw new DomainError('FORBIDDEN', 'Workspace owner mismatch');
  validateWorkspaceIntegrity(checked);
  // Additive unknown context fields are semantically absent for legacy command retries.
  const fingerprintValue = structuredClone(command);
  if (fingerprintValue.type === 'SavePlanningInputs') {
    const defaults = emptyPlanningInputs().context;
    const legacyKeys = new Set([
      'jurisdiction',
      'applicationDate',
      'building',
      'scope',
      'accessibility',
      'sourceAvailability',
    ]);
    const contextRecord = fingerprintValue.payload.inputs.context as unknown as Record<
      string,
      unknown
    >;
    for (const [key, value] of Object.entries(defaults))
      if (!legacyKeys.has(key) && fingerprint(contextRecord[key]) === fingerprint(value))
        delete contextRecord[key];
  }
  const signature = fingerprint(fingerprintValue),
    previous = checked.commands[command.commandId];
  if (previous) {
    if (previous.fingerprint !== signature)
      throw new DomainError('IDEMPOTENCY', 'Command ID already used with different content');
    return { state: checked, result: previous.result, duplicate: true };
  }
  const state = structuredClone(checked);
  let project = state.projects[command.projectId];
  let eventType: Workspace['events'][number]['type'];
  let entityIds: string[] = [];
  const requirePropertyRevision = (propertyId: string) => {
    if (command.basePropertyRevision !== state.properties[propertyId].revision)
      throw new DomainError('CONFLICT', 'Property revision changed or precondition missing', {
        currentPropertyRevision: state.properties[propertyId].revision,
      });
  };
  if (command.type === 'CreateProject') {
    if (state.properties[command.projectId] || state.spaces[command.projectId])
      throw new DomainError('CONFLICT', 'Project ID already identifies a property or space');
    if (project || command.baseRevision !== 0)
      throw new DomainError('CONFLICT', 'Project exists or invalid creation revision');
    const payload = command.payload;
    if (
      state.spaces[payload.propertyId] ||
      state.projects[payload.propertyId] ||
      payload.propertyId === command.projectId
    )
      throw new DomainError('CONFLICT', 'Property ID already identifies another subject');
    let property = state.properties[payload.propertyId];
    if (!property) {
      if (!payload.newProperty || command.basePropertyRevision !== 0)
        throw new DomainError('VALIDATION', 'New property details and revision 0 required');
      property = {
        schemaVersion: 1,
        id: payload.propertyId,
        ownerId: context.ownerId,
        name: payload.newProperty.name,
        revision: 0,
      };
      state.properties[property.id] = property;
    } else {
      if (property.ownerId !== context.ownerId)
        throw new DomainError('FORBIDDEN', 'Property owner mismatch');
      if (payload.newProperty)
        throw new DomainError('CONFLICT', 'Cannot replace an existing property');
      requirePropertyRevision(property.id);
    }
    if (new Set(payload.spaces.map((s) => s.id)).size !== payload.spaces.length)
      throw new DomainError('VALIDATION', 'Duplicate space IDs');
    for (const space of payload.spaces) {
      if (state.projects[space.id] || state.properties[space.id] || space.id === command.projectId)
        throw new DomainError('CONFLICT', 'Space ID already identifies another subject');
      const existing = state.spaces[space.id];
      if (existing && (existing.propertyId !== property.id || existing.name !== space.name))
        throw new DomainError('CONFLICT', 'Space identity conflict');
      state.spaces[space.id] = { schemaVersion: 1, ...space, propertyId: property.id };
    }
    property.revision++;
    project = {
      schemaVersion: 1,
      id: command.projectId,
      propertyId: property.id,
      name: payload.name,
      spaceIds: payload.spaces.map((s) => s.id),
      revision: 0,
      createdAt: context.now,
    };
    state.projects[project.id] = project;
    eventType = 'ProjectCreated';
    entityIds = [project.id];
  } else {
    if (!project) throw new DomainError('NOT_FOUND', 'Project not found');
    if (state.properties[project.propertyId]?.ownerId !== context.ownerId)
      throw new DomainError('FORBIDDEN', 'Property owner mismatch');
    if (project.revision !== command.baseRevision)
      throw new DomainError('CONFLICT', 'Project revision changed', {
        currentRevision: project.revision,
      });
    if (command.type === 'SaveDraft' || command.type === 'SetWorkspaceView') {
      if (command.type === 'SaveDraft') {
        if ((state.drafts[project.id]?.revision || 0) !== command.payload.expectedDraftRevision)
          throw new DomainError('CONFLICT', 'Draft changed in another view');
        command.payload.evidenceIds.forEach((id) =>
          resolveRef(state, project.id, { kind: 'evidence', id, revision: 1 }),
        );
        state.drafts[project.id] = {
          text: command.payload.text,
          ...(command.payload.photoReply ? { photoReply: command.payload.photoReply } : {}),
          evidenceIds: command.payload.evidenceIds,
          revision: command.payload.expectedDraftRevision + 1,
        };
      } else {
        if (command.payload.artifactRef) {
          if (command.payload.artifactRef.kind !== 'artifact')
            throw new DomainError('VALIDATION', 'View needs an artifact reference');
          resolveRef(state, project.id, command.payload.artifactRef);
        }
        state.views[project.id] = command.payload;
        state.activeProjectId = project.id;
      }
      const result: CommandResult = {
        commandId: command.commandId,
        projectId: project.id,
        projectRevision: project.revision,
        propertyRevision: state.properties[project.propertyId].revision,
        eventIds: [],
        staleArtifactIds: [],
      };
      state.commands[command.commandId] = { fingerprint: signature, result };
      validateWorkspaceIntegrity(state);
      return { state, result, duplicate: false };
    }
    const workflow =
      handleScopePlanning(state, command, context) ||
      handlePlanning(state, command, context) ||
      handleWorkflow(state, command, context);
    if (workflow) {
      eventType = workflow.type;
      entityIds = workflow.ids;
    } else if (command.type === 'AnswerPhotoQuestion') {
      const id = answerPhotoQuestion(state, command, context);
      eventType = 'MessageAppended';
      entityIds = [id, command.payload.messageId];
    } else if (command.type === 'AttachEvidence') {
      const { scope, evidence } = command.payload;
      if (scope === 'property') requirePropertyRevision(project.propertyId);
      if (state.evidence[evidence.id]) throw new DomainError('CONFLICT', 'Evidence already exists');
      if (evidence.attachment?.originalEvidenceId) {
        const original = resolveRef(state, project.id, {
          kind: 'evidence',
          id: evidence.attachment.originalEvidenceId,
          revision: 1,
        });
        if (!('source' in original) || original.source.attachment?.role !== 'original')
          throw new DomainError('VALIDATION', 'Derived media requires original attachment');
        if (scope === 'property' && original.projectId !== null)
          throw new DomainError(
            'VALIDATION',
            'Shared evidence cannot depend on project-private media',
          );
      }
      state.evidence[evidence.id] = {
        schemaVersion: 1,
        id: evidence.id,
        propertyId: project.propertyId,
        projectId: scope === 'project' ? project.id : null,
        revision: 1,
        source: evidence,
        recordedAt: context.now,
      };
      if (scope === 'property') state.properties[project.propertyId].revision++;
      eventType = 'EvidenceAttached';
      entityIds = [evidence.id];
    } else if (command.type === 'RecordFact') {
      const p = command.payload,
        old = latest(state.facts[p.factId]);
      if (p.scope === 'property') requirePropertyRevision(project.propertyId);
      const scopeId = p.scope === 'project' ? project.id : null;
      if (
        old &&
        (old.propertyId !== project.propertyId ||
          old.projectId !== scopeId ||
          old.subjectId !== p.subjectId ||
          old.key !== p.key)
      )
        throw new DomainError('FORBIDDEN', 'Fact identity/scope is immutable');
      if ((old?.revision || 0) !== p.supersedesRevision)
        throw new DomainError('CONFLICT', 'Fact revision changed', {
          currentFactRevision: old?.revision || 0,
        });
      const subjectValid =
        p.scope === 'project'
          ? p.subjectId === project.id
          : p.subjectId === project.propertyId ||
            state.spaces[p.subjectId]?.propertyId === project.propertyId;
      if (!subjectValid) throw new DomainError('VALIDATION', 'Fact subject outside declared scope');
      for (const evidenceId of p.evidenceIds) {
        const evidence = resolveRef(state, project.id, {
          kind: 'evidence',
          id: evidenceId,
          revision: 1,
        });
        if (p.scope === 'property' && evidence.projectId !== null)
          throw new DomainError('VALIDATION', 'Shared facts need shared evidence');
      }
      if ((p.assertion === 'unknown') !== (p.value.kind === 'unknown'))
        throw new DomainError('VALIDATION', 'Unknown assertions need unknown values');
      const typedHistory = state.facts[p.factId]?.find((f) => f.value.kind !== 'unknown');
      if (typedHistory && p.value.kind !== 'unknown') {
        if (
          typedHistory.value.kind !== p.value.kind ||
          (typedHistory.value.kind === 'quantity' &&
            p.value.kind === 'quantity' &&
            typedHistory.value.dimension !== p.value.dimension)
        )
          throw new DomainError('VALIDATION', 'Fact value type or dimension cannot change');
      }
      // Reject a second ID for the same physical fact: callers must explicitly supersede its revision.
      if (
        Object.entries(state.facts).some(
          ([id, versions]) =>
            id !== p.factId &&
            latest(versions)?.subjectId === p.subjectId &&
            latest(versions)?.key === p.key &&
            latest(versions)?.projectId === scopeId,
        )
      )
        throw new DomainError('CONFLICT', 'Fact key already exists for this subject');
      (state.facts[p.factId] ||= []).push({
        schemaVersion: 1,
        id: p.factId,
        projectId: scopeId,
        propertyId: project.propertyId,
        subjectId: p.subjectId,
        key: p.key,
        revision: p.supersedesRevision + 1,
        supersedesRevision: p.supersedesRevision || null,
        value: canonicalValue(p.value),
        originalValue: p.value,
        assertion: p.assertion,
        verification: null,
        evidenceIds: p.evidenceIds,
        inputRefs: [],
        recordedAt: context.now,
      });
      if (p.scope === 'property') state.properties[project.propertyId].revision++;
      eventType = 'FactRecorded';
      entityIds = [p.factId];
    } else if (
      command.type === 'ImportPhotoInventory' ||
      command.type === 'SetInventoryDirection'
    ) {
      entityIds = handleHomeInventory(state, command, context)!;
      eventType = 'ArtifactProposed';
    } else if (command.type === 'ProposeArtifact') {
      const p = command.payload,
        old = latest(state.artifacts[p.artifactId]);
      if (
        [
          'photo-inventory',
          'inventory-direction',
          'project-options',
          'project-work-plan',
          'candidate-measurements',
          'candidate-checks',
        ].includes(p.content.kind) ||
        p.artifactId.startsWith(`${project.id}:inventory-direction:`) ||
        p.artifactId === `${project.id}:photo-inventory` ||
        p.artifactId.startsWith(`${project.id}:survey:`) ||
        p.artifactId.startsWith(`${project.id}:survey-checks:`) ||
        (old &&
          [
            'photo-inventory',
            'inventory-direction',
            'project-options',
            'project-work-plan',
            'candidate-measurements',
            'candidate-checks',
          ].includes(old.payload.kind))
      )
        throw new DomainError('VALIDATION', 'Use validated project option/plan commands');
      if (
        p.content.kind === 'photo-planning-answer' ||
        old?.payload.kind === 'photo-planning-answer'
      )
        throw new DomainError('VALIDATION', 'Use AnswerPhotoQuestion to record a sourced response');
      if (p.content.kind === 'property-research') {
        const address = propertyAddress(state, project.id);
        if (
          !address ||
          address.value.kind !== 'text' ||
          !p.inputRefs.some(
            (r) => r.kind === 'fact' && r.id === address.id && r.revision === address.revision,
          )
        )
          throw new DomainError(
            'VALIDATION',
            'Property research needs the current address revision',
          );
        const proposed = p.content;
        if (proposed.photoReview) {
          const goal = Object.values(state.facts)
            .map((versions) => versions.at(-1)!)
            .find((fact) => fact.projectId === project.id && fact.key === 'goal');
          if (
            !goal ||
            !p.inputRefs.some(
              (ref) => ref.kind === 'fact' && ref.id === goal.id && ref.revision === goal.revision,
            )
          )
            throw new DomainError(
              'VALIDATION',
              'Visual planning proposals need the current project goal revision',
            );
        }
        if (proposed.photoReview) {
          const goal = Object.values(state.facts)
            .map((v) => v.at(-1))
            .find((f) => f?.projectId === project.id && f.key === 'goal');
          const claimedGoals = [
            proposed.photoReview.goal,
            proposed.photoReview.planning?.goal,
          ].filter((value): value is string => typeof value === 'string');
          if (
            claimedGoals.some((value) => goal?.value.kind !== 'text' || value !== goal.value.text)
          )
            throw new DomainError(
              'STALE',
              'Visual planning describes an earlier goal. Refresh the Muse planning pass before importing it.',
            );
        }
        const blocked = (state.artifacts[p.artifactId] || []).flatMap((a) =>
          a.payload.kind === 'property-research' && a.payload.jobId === proposed.jobId
            ? a.payload.findings.filter((f) => f.blockedReason)
            : [],
        );
        if (
          blocked.some((prior) =>
            proposed.findings.some(
              (f) => f.label === prior.label && f.value === prior.value && !f.blockedReason,
            ),
          )
        )
          throw new DomainError(
            'VALIDATION',
            'This research repeats a blocked claim without its review block. Preserve the block; new evidence requires separate review.',
          );
        validate(() =>
          validateResearchForJob(
            p.content,
            address.value.kind === 'text' ? address.value.text : '',
            researchJobId(project.id, address.id, address.revision),
          ),
        );
      }

      if (
        [
          'planning-inputs',
          'planning-sources',
          'measured-layout',
          'code-assessment',
          'quantity-takeoff',
          'cost-plan',
          'gated-plan',
        ].includes(p.content.kind) ||
        p.artifactId.startsWith(`${project.id}:planning:`)
      )
        throw new DomainError(
          'VALIDATION',
          'Technical artifacts require validated planning commands',
        );
      if (old && old.projectId !== project.id)
        throw new DomainError('FORBIDDEN', 'Artifact belongs to another project');
      if ((old?.revision || 0) !== p.supersedesRevision)
        throw new DomainError('CONFLICT', 'Artifact revision changed');
      p.inputRefs.forEach((ref) => resolveRef(state, project.id, ref));
      p.evidenceIds.forEach((id) =>
        resolveRef(state, project.id, { kind: 'evidence', id, revision: 1 }),
      );
      if (p.content.kind === 'evidence-index')
        p.content.evidenceIds.forEach((id) =>
          resolveRef(state, project.id, { kind: 'evidence', id, revision: 1 }),
        );
      if (p.inputRefs.some((ref) => ref.kind === 'artifact' && ref.id === p.artifactId))
        throw new DomainError('VALIDATION', 'Artifact cannot depend on itself');
      validateTasks(command);
      if (p.content.kind === 'conversation-plan') validateConversationPlan(state, project.id, p.content);
      (state.artifacts[p.artifactId] ||= []).push({
        schemaVersion: 1,
        id: p.artifactId,
        projectId: project.id,
        revision: p.supersedesRevision + 1,
        lifecycle: 'proposed',
        freshness: 'current',
        inputRefs: p.inputRefs,
        evidenceIds: p.evidenceIds,
        payload: p.content,
        ...(p.content.kind === 'conversation-plan' ? { contextSignature: inputSignature(state, project.id) } : {}),
        createdAt: context.now,
        acceptedAt: null,
      });
      validateArtifactGraph(state);
      eventType = 'ArtifactProposed';
      entityIds = [p.artifactId];
    } else if (command.type === 'AcceptDecision' || command.type === 'RejectProposal') {
      const rejected = command.type === 'RejectProposal';
      const p = command.payload;
      if (state.decisions[p.decisionId])
        throw new DomainError('CONFLICT', 'Decision already exists');
      for (const ref of p.artifactRefs) {
        if (ref.kind !== 'artifact')
          throw new DomainError('VALIDATION', 'Decision must refer to artifacts');
        const target = resolveRef(state, project.id, ref);
        if (
          'payload' in target &&
          [
            'photo-inventory',
            'inventory-direction',
            'photo-planning-answer',
            'candidate-measurements',
            'candidate-checks',
          ].includes(target.payload.kind)
        )
          throw new DomainError(
            'VALIDATION',
            'A user response or measurement is revised as an input, not accepted or declined as an agent proposal',
          );
        if (!referenceCurrent(state, project.id, ref))
          throw new DomainError('STALE', 'Cannot accept a stale artifact');
      }
      for (const ref of p.artifactRefs)
        if (
          state.artifacts[ref.id].find((a) => a.revision === ref.revision)!.lifecycle !== 'proposed'
        )
          throw new DomainError('CONFLICT', 'This proposal already has a decision');
      state.decisions[p.decisionId] = {
        schemaVersion: 1,
        id: p.decisionId,
        projectId: project.id,
        question: p.question,
        artifactRefs: p.artifactRefs,
        outcome: rejected ? 'rejected' : 'accepted',
        actorId: context.ownerId,
        acceptedAt: rejected ? null : context.now,
        decidedAt: context.now,
      };
      for (const ref of p.artifactRefs) {
        const a = state.artifacts[ref.id].find((a) => a.revision === ref.revision)!;
        a.lifecycle = rejected ? 'rejected' : 'accepted';
        a.acceptedAt = rejected ? null : context.now;
      }
      finishRunsForDecision(state, p.artifactRefs, context, rejected);
      eventType = rejected ? 'ProposalRejected' : 'DecisionAccepted';
      entityIds = [p.decisionId];
    } else throw new DomainError('VALIDATION', 'Unsupported command');
  }
  if (
    command.type === 'AppendMessage' ||
    command.type === 'AnswerPhotoQuestion' ||
    command.type === 'ImportPhotoInventory' ||
    command.type === 'SetInventoryDirection' ||
    command.type === 'SaveCandidateMeasurements' ||
    command.type === 'RecordFact' ||
    command.type === 'AttachEvidence' ||
    (command.type === 'ProposeArtifact' && ['property-research', 'conversation-plan'].includes(command.payload.content.kind))
  ) {
    const previousBrief = latest(state.artifacts[`${project.id}:working-brief`]);
    const briefId = refreshPropertyBrief(state, project.id, context);
    if (briefId) {
      entityIds.push(briefId);
      const view = state.views[project.id];
      if (
        (command.type === 'AnswerPhotoQuestion' || command.type === 'SaveCandidateMeasurements') &&
        view?.artifactRef?.id === briefId &&
        view.artifactRef.revision === previousBrief?.revision
      )
        view.artifactRef.revision = latest(state.artifacts[briefId])!.revision;
    }
  }
  const staleArtifactIds = invalidate(state);
  for (const run of Object.values(state.runs)) {
    if (
      run.state === 'waiting_for_approval' &&
      run.outputRef &&
      staleArtifactIds.includes(run.outputRef.id)
    ) {
      run.state = 'failed';
      run.revision++;
      run.error = 'The proposal inputs changed. Retry or request fresh simulated work.';
      run.history.push({ state: 'failed', at: context.now, detail: run.error });
    }
  }
  const affectedProjects = new Set(
    staleArtifactIds.map((id) => latest(state.artifacts[id])!.projectId),
  );
  affectedProjects.add(project.id);
  for (const id of affectedProjects) state.projects[id].revision++;
  const events: Workspace['events'] = [
    {
      id: `${command.commandId}:0`,
      commandId: command.commandId,
      projectId: project.id,
      projectRevision: project.revision,
      type: eventType,
      at: context.now,
      entityIds,
    },
  ];
  for (const id of affectedProjects) {
    const stale = staleArtifactIds.filter((a) => latest(state.artifacts[a])!.projectId === id);
    if (stale.length)
      events.push({
        id: `${command.commandId}:${events.length}`,
        commandId: command.commandId,
        projectId: id,
        projectRevision: state.projects[id].revision,
        type: 'ArtifactInvalidated',
        at: context.now,
        entityIds: stale,
      });
  }
  state.events.push(...events);
  const result: CommandResult = {
    commandId: command.commandId,
    projectId: project.id,
    projectRevision: project.revision,
    propertyRevision: state.properties[project.propertyId].revision,
    eventIds: events.map((e) => e.id),
    staleArtifactIds,
  };
  state.commands[command.commandId] = { fingerprint: signature, result };
  validate(() => workspaceSchema.parse(state));
  validateWorkspaceIntegrity(state);
  return { state, result, duplicate: false };
}
