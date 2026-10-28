import {
  DomainError,
  emptyPlanningInputs,
  planningGroups,
  type Workspace,
  type PlanningInputs,
  type PlanningGroup,
  type Command,
  type CommandContext,
  type ArtifactPayload,
  type InputRef,
} from '@unpermitted/contracts';
import { fingerprint } from '../domain/canonical-json.js';
import { latest } from '../domain/invalidate.js';
import {
  planningFacts,
  planningFactSignature,
  physicalKeys,
  localityFactKeys,
} from './fact-context.js';
import { mm, geometry, takeoff, estimate, validateTaskGraph } from './calculators.js';
import { assessDrainage } from './drainage.js';
import { assessCode, halfBathTasks } from './playbook.js';
import { technicalSources, sourceSetVersion } from './sources.js';
export const planningId = (projectId: string, part: string) => `${projectId}:planning:${part}`;
export function readPlanningInputs(state: Workspace, projectId: string): PlanningInputs {
  const inputs = emptyPlanningInputs();
  for (const group of planningGroups) {
    const a = latest(state.artifacts[planningId(projectId, group)]);
    if (a?.payload.kind === 'planning-inputs')
      Object.assign(inputs, { [group]: a.payload.inputs[group] });
  }
  return inputs;
}
const same = (a: unknown, b: unknown) => fingerprint(a) === fingerprint(b);
export function handlePlanning(
  state: Workspace,
  command: Command,
  ctx: CommandContext,
): { type: Workspace['events'][number]['type']; ids: string[] } | null {
  if (command.type !== 'SavePlanningInputs' && command.type !== 'CalculatePlanning') return null;
  const projectId = command.projectId,
    ids: string[] = [];
  function put(
    part: string,
    payload: ArtifactPayload,
    inputRefs: InputRef[],
    evidenceIds: string[] = [],
  ) {
    const id = planningId(projectId, part),
      old = latest(state.artifacts[id]);
    if (old && old.projectId !== projectId)
      throw new DomainError('FORBIDDEN', 'Planning artifact scope mismatch');
    // Canonical deterministic output cannot be replaced by a caller-supplied payload.
    if (
      old &&
      same(old.payload, payload) &&
      same(old.inputRefs, inputRefs) &&
      (!old.factContext ||
        old.factContext.signature ===
          planningFactSignature(state, projectId, old.factContext.keys)) &&
      old.freshness === 'current'
    )
      return old;
    const a = {
      schemaVersion: 1 as const,
      id,
      projectId,
      revision: (old?.revision || 0) + 1,
      lifecycle: 'proposed' as const,
      freshness: 'current' as const,
      inputRefs,
      evidenceIds,
      payload,
      ...(['geometry', 'quantities', 'code', 'drainage'].includes(part)
        ? {
            factContext: {
              keys: ['code', 'drainage'].includes(part) ? localityFactKeys : physicalKeys,
              signature: planningFactSignature(
                state,
                projectId,
                ['code', 'drainage'].includes(part) ? localityFactKeys : physicalKeys,
              ),
            },
          }
        : {}),
      createdAt: ctx.now,
      acceptedAt: null,
    };
    (state.artifacts[id] ||= []).push(a);
    ids.push(id);
    return a;
  }
  if (command.type === 'SavePlanningInputs') {
    if (
      command.payload.inputs.context.unavailableSourceIds.some(
        (id) => !technicalSources.some((s) => s.id === id),
      )
    )
      throw new DomainError('VALIDATION', 'Unknown source availability override');
    for (const g of planningGroups)
      if (
        (latest(state.artifacts[planningId(projectId, g)])?.revision || 0) !==
        command.payload.expectedInputs[g]
      )
        throw new DomainError(
          'CONFLICT',
          'Technical inputs changed in another editor; reload before saving',
        );
    for (const id of command.payload.evidenceIds) {
      const e = state.evidence[id];
      if (
        !e ||
        e.propertyId !== state.projects[projectId].propertyId ||
        (e.projectId !== null && e.projectId !== projectId)
      )
        throw new DomainError('FORBIDDEN', 'Planning evidence outside scope');
    }
    for (const group of planningGroups) {
      const old = latest(state.artifacts[planningId(projectId, group)]);
      if (
        old?.payload.kind === 'planning-inputs' &&
        same(old.payload.inputs[group], command.payload.inputs[group]) &&
        old.payload.basis === command.payload.basis
      )
        continue;
      const inputs = emptyPlanningInputs();
      Object.assign(inputs, { [group]: command.payload.inputs[group] });
      put(
        group,
        { kind: 'planning-inputs', group, inputs, basis: command.payload.basis },
        command.payload.evidenceIds.map((id) => ({ kind: 'evidence', id, revision: 1 })),
        command.payload.evidenceIds,
      );
    }
    return { type: 'PlanningInputsSaved', ids };
  }
  const inputs = readPlanningInputs(state, projectId);
  for (const group of planningGroups)
    if (!latest(state.artifacts[planningId(projectId, group)]))
      throw new DomainError(
        'VALIDATION',
        `Record explicit ${group} inputs (including unknowns) before calculation`,
      );
  const ref = (part: string): InputRef => ({
    kind: 'artifact',
    id: planningId(projectId, part),
    revision: latest(state.artifacts[planningId(projectId, part)])!.revision,
  });
  const sources = technicalSources.map((s) =>
    inputs.context.sourceAvailability === 'unavailable' ||
    inputs.context.unavailableSourceIds.includes(s.id)
      ? { ...s, access: 'unavailable' as const }
      : s,
  );
  put('sources', { kind: 'planning-sources', version: sourceSetVersion, sources }, [
    ref('context'),
  ]);
  const facts = planningFacts(state, projectId),
    factRefs: InputRef[] = facts.map((f) => ({ kind: 'fact', id: f.id, revision: f.revision }));
  const conflicts = facts.filter((f) => {
    const q = f.key === 'finishedWidth' ? inputs.site.width : inputs.site.length;
    return (
      f.value.kind !== 'quantity' ||
      f.value.dimension !== 'length' ||
      !q ||
      f.assertion === 'assumed' ||
      Math.abs(f.value.amount - mm(q)) > 0.01
    );
  });
  const layout = geometry(inputs);
  if (conflicts.length) {
    layout.status = 'needs_review';
    layout.issues.push(
      'Existing sourced room facts conflict with, or do not establish, these technical dimensions. Resolve the observations before relying on this layout.',
    );
  }
  put('geometry', layout, [ref('site'), ref('layout'), ...factRefs]);
  const locationFacts = planningFacts(state, projectId, localityFactKeys);
  const locationRefs: InputRef[] = locationFacts.map((f) => ({
    kind: 'fact',
    id: f.id,
    revision: f.revision,
  }));
  const locationConflicts = locationFacts.filter((f) => {
    const expected =
      f.key === 'jurisdiction'
        ? inputs.context.jurisdiction
        : (inputs.context.locality as unknown as Record<string, unknown>)[f.key];
    const norm = (v: unknown) =>
      String(v ?? '')
        .trim()
        .toLowerCase()
        .replace(/^us-pa$/, 'pa');
    return (
      f.assertion === 'assumed' ||
      f.value.kind !== 'text' ||
      !expected ||
      norm(f.value.text) !== norm(expected)
    );
  });
  const code = assessCode(inputs),
    drainage = assessDrainage(inputs);
  if (locationConflicts.length)
    for (const assessment of [code, drainage]) {
      if (assessment.locality) {
        assessment.locality.status = 'needs_review';
        assessment.locality.jurisdictionId = null;
        assessment.locality.authority = null;
        assessment.locality.unresolved.push('Resolve conflicting sourced locality facts.');
      }
      if (assessment.codeBasis) {
        assessment.codeBasis.generalEdition = null;
        assessment.codeBasis.decision =
          'Edition selection withheld because sourced locality facts conflict with the reported planning context.';
        assessment.codeBasis.missing.push('Resolve conflicting sourced locality facts.');
      }
      for (const check of assessment.checks) {
        check.status = 'needs_review';
        check.applicability = 'unresolved';
        check.rationale =
          'Conflicting sourced locality evidence prevents applying this local rule. Resolve the observations before evaluating it.';
        check.missing.push(
          'Resolve conflicting sourced locality facts before applying local rules.',
        );
        if (check.mapping) {
          check.mapping.status = 'unresolved';
          check.mapping.finding =
            'Conflicting sourced locality evidence prevents using this mapping for the project.';
        }
        if (check.evaluation) {
          check.evaluation.outcome = 'not-evaluated';
          check.evaluation.required = null;
        }
      }
    }
  put('code', code, [ref('context'), ref('sources'), ...locationRefs]);
  put('drainage', drainage, [
    ref('site'),
    ref('context'),
    ref('code'),
    ref('sources'),
    ...locationRefs,
  ]);
  const quantities = takeoff(inputs);
  if (conflicts.length) {
    quantities.status = 'needs_review';
    quantities.missing.push('Resolve conflicting sourced room observations');
    quantities.traces
      .filter((t) => ['Packages to purchase', 'Purchase surplus'].includes(t.label))
      .forEach((t) => (t.value = null));
  }
  put('quantities', quantities, [ref('site'), ref('finish'), ...factRefs]);
  put('cost', estimate(inputs, quantities), [ref('quantities'), ref('finish')]);
  const plan = halfBathTasks();
  validateTaskGraph(plan.tasks);
  put('tasks', plan, [ref('geometry'), ref('code'), ref('drainage'), ref('quantities')]);
  if (ids.length)
    state.messages.push({
      id: `${command.commandId}:planning`,
      projectId,
      role: 'system',
      mode: 'system',
      text: 'Deterministic technical planning saved. Inspect formulas, exact input revisions, source coverage and blocked gates. Code review is incomplete; no construction work is released.',
      evidenceIds: [],
      artifactRefs: ids.map((id) => ({
        kind: 'artifact',
        id,
        revision: latest(state.artifacts[id])!.revision,
      })),
      runId: null,
      at: ctx.now,
    });
  return { type: 'PlanningCalculated', ids };
}
export function planningBasis(state: Workspace, projectId: string, group: PlanningGroup) {
  const p = latest(state.artifacts[planningId(projectId, group)])?.payload;
  return p?.kind === 'planning-inputs' ? p.basis : null;
}
