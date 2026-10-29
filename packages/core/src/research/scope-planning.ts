import {
  candidateSurveyDependency,
  saveCandidateMeasurements,
  candidateSurveyRefs,
} from './candidate-measurements.js';
import {
  DomainError,
  type ArtifactPayload,
  type Command,
  type CommandContext,
  type InputRef,
  type Workspace,
} from '@renovagent/contracts';
import { captureInputs, inputSignature } from '../domain/input-context.js';
import { fingerprint } from '../domain/canonical-json.js';
import { referenceCurrent, resolveRef } from '../domain/invalidate.js';
import { photoQuestions } from './photo-answers.js';
import {
  scopeOptionDefinitions,
  scopeQuestionBindings,
  scopeRecipeVersion,
} from './scope-recipe.js';
type Dependency = Extract<
  ArtifactPayload,
  { kind: 'project-options' }
>['options'][number]['dependencies'][number];
export function scopePlanningCoverage(state: Workspace, projectId: string) {
  const questions = photoQuestions(state, projectId);
  const missing = scopeQuestionBindings.filter((text) => !questions.some((q) => q.text === text));
  return {
    supported: !missing.length && questions.length === 6,
    current: questions.length > 0 && questions.every((q) => q.current),
    reason:
      missing.length || questions.length !== 6
        ? 'This local recipe covers the six kitchen/powder-room study questions only. Other question sets need a reviewed recipe binding; no generic layout is substituted.'
        : '',
    recipe: scopeRecipeVersion,
  };
}
export function scopeAnswerRefs(state: Workspace, projectId: string): InputRef[] {
  return photoQuestions(state, projectId).flatMap((q) =>
    q.answer ? [{ kind: 'artifact' as const, id: q.answer.id, revision: q.answer.revision }] : [],
  );
}
export function scopePlanningRefs(state: Workspace, pid: string): InputRef[] {
  const research = state.artifacts[`${pid}:property-research`]?.at(-1);
  const refs = captureInputs(state, pid).filter((r) => {
    const a =
      r.kind === 'artifact'
        ? state.artifacts[r.id]?.find((a) => a.revision === r.revision)
        : undefined;
    return a?.payload.kind !== 'candidate-measurements' || referenceCurrent(state, pid, r);
  });
  if (research) refs.push({ kind: 'artifact', id: research.id, revision: research.revision });
  for (const role of ['kitchen', 'ground-floor', 'basement'])
    refs.push(...candidateSurveyDependency(state, pid, role).inputRefs);
  return [...new Map(refs.map((r) => [`${r.kind}:${r.id}:${r.revision}`, r])).values()];
}
export function compileProjectOptions(
  state: Workspace,
  projectId: string,
): Extract<ArtifactPayload, { kind: 'project-options' }> {
  const coverage = scopePlanningCoverage(state, projectId);
  if (!coverage.supported) throw new DomainError('VALIDATION', coverage.reason);
  if (!coverage.current)
    throw new DomainError('STALE', 'Current source research is required before compiling options');
  const questions = photoQuestions(state, projectId);
  const dependenciesFor = (indexes: readonly number[]): Dependency[] =>
    indexes.map((index) => {
      const q = questions.find((question) => question.text === scopeQuestionBindings[index])!;
      const a = q.answer?.payload;
      return {
        id: `direction-${index}`,
        title: q.text,
        kind: 'direction',
        status:
          a?.kind === 'photo-planning-answer' && a.disposition === 'direction'
            ? 'reported'
            : 'missing',
        detail:
          a?.kind === 'photo-planning-answer'
            ? `${a.disposition === 'direction' ? 'Reported direction; option compatibility still needs reconciliation' : a.disposition === 'unsure' ? 'Still unsure' : 'Deferred'}: ${a.answer}`
            : 'No saved answer. Confirm this preference before developing this option.',
        photoIds: q.photoIds,
        inputRefs: q.answer
          ? [{ kind: 'artifact', id: q.answer.id, revision: q.answer.revision }]
          : [],
      };
    });
  return {
    kind: 'project-options',
    recipe: scopeRecipeVersion,
    basis: 'deterministic-proposal',
    constructionRelease: 'blocked',
    options: scopeOptionDefinitions.map((definition) => {
      const direction = dependenciesFor(definition.questions);
      const photoIds = [...new Set(direction.flatMap((d) => d.photoIds))];
      const gate = (
        id: string,
        title: string,
        kind: Dependency['kind'],
        detail: string,
        status: Dependency['status'] = 'missing',
      ): Dependency => ({
        id,
        title,
        kind,
        status,
        detail,
        photoIds: ['direction', 'measurement', 'feasibility'].includes(kind) ? photoIds : [],
        inputRefs: [],
      });
      const roles =
        definition.id === 'kitchen-only'
          ? ['kitchen']
          : ['kitchen', definition.id === 'ground-floor-powder' ? 'ground-floor' : 'basement'];
      const surveys = roles.map((role) => candidateSurveyDependency(state, projectId, role));
      const survey = gate(
        'survey',
        'Candidate-specific measured survey',
        'measurement',
        definition.measurement + '\n' + surveys.map((survey) => survey.detail).join('\n'),
        surveys.every((survey) => survey.status === 'needs-review') ? 'needs-review' : 'missing',
      );
      survey.inputRefs = surveys.flatMap((survey) => survey.inputRefs);
      return {
        id: definition.id,
        title: definition.title,
        summary: definition.summary,
        scope: [...definition.scope],
        exclusions: [...definition.exclusions],
        fit: 'needs-reconciliation',
        feasibility: 'blocked',
        dependencies: [
          ...direction,
          gate(
            'scope-fit',
            'Reconcile this option with your reported direction',
            'direction',
            'Free-text preferences are quoted above, not classified as yes/no. Explicitly reconcile conflicts, partial answers and scope exclusions before selecting a design.',
            'needs-review',
          ),
          survey,
          gate(
            'feasibility',
            'Qualified site and services feasibility',
            'feasibility',
            definition.feasibility,
            'unsupported',
          ),
          gate(
            'code',
            'Local applicability and design review',
            'code',
            'Confirm the authority, building/use, filing basis, adopted provisions and local amendments for this exact scope. Existing limited bathroom checks do not establish coverage of this option. Qualified review remains open.',
            'unsupported',
          ),
          gate(
            'permits',
            'Permit and inspection path',
            'permit',
            'Confirm required permits, approved design documents and inspection hold points with the relevant authority. No permit or inspection outcome has been recorded.',
          ),
          gate(
            'resources',
            'Measured scope, selections and sourced budget',
            'resources',
            'No complete takeoff, current quotes, product compatibility review, contractor vetting or procurement authorization is attached.',
          ),
        ],
      };
    }),
  };
}
export function compileProjectWorkPlan(
  option: Extract<ArtifactPayload, { kind: 'project-options' }>['options'][number],
): Extract<ArtifactPayload, { kind: 'project-work-plan' }> {
  const gates = option.dependencies;
  const by = (...ids: string[]) => gates.filter((d) => ids.includes(d.id));
  const direction = gates.filter((d) => d.kind === 'direction');
  const photoIds = [...new Set(gates.flatMap((d) => d.photoIds))];
  const powder = option.id !== 'kitchen-only';
  const steps: Extract<ArtifactPayload, { kind: 'project-work-plan' }>['steps'] = [];
  const add = (
    id: string,
    title: string,
    kind: (typeof steps)[number]['kind'],
    description: string,
    dependsOn: string[],
    blockers: Dependency[],
  ) => {
    steps.push({
      id,
      title,
      kind,
      description,
      dependsOn,
      status:
        kind === 'survey' && blockers.every((b) => b.status === 'needs-review')
          ? 'needs-review'
          : kind === 'scope' || kind === 'survey'
            ? 'needs-input'
            : kind === 'qualified-review' || kind === 'design'
              ? 'needs-review'
              : 'blocked',
      completion: 'not-reported',
      blockers,
      photoIds,
    });
  };
  add(
    'scope',
    'Reconcile scope and nominate the study area',
    'scope',
    'Compare every quoted response with this option. Resolve missing/deferred choices, existing-bath scope, circulation constraints and exclusions. This study choice does not accept a design or authorize physical work.',
    [],
    direction,
  );
  add(
    'survey',
    'Collect the candidate-specific measured survey',
    'survey',
    by('survey')[0].detail,
    ['scope'],
    by('survey'),
  );
  add(
    'services',
    'Investigate existing conditions and service routes',
    'qualified-review',
    by('feasibility')[0].detail,
    ['scope'],
    by('feasibility'),
  );
  add(
    'design',
    'Resolve layout, local code applicability and technical design',
    'design',
    'Use the survey and qualified investigation together. Develop a measured layout and reconcile structural, plumbing, electrical and exhaust provisions and local amendments. Unsupported checks remain blocked.',
    ['survey', 'services'],
    by('survey', 'feasibility', 'code'),
  );
  add(
    'prepare',
    'Resolve approvals, specifications, budget and job preparation',
    'preparation',
    'Confirm permit requirements/approvals and inspection sequence; finalize compatible selections, a measured takeoff, sourced pricing/quotes and trade responsibilities. No purchasing is authorized.',
    ['design'],
    by('permits', 'resources'),
  );
  add(
    'protect',
    'Plan protection, isolation and selective demolition',
    'physical-work',
    'Conditional future work only: qualified isolation and protection before any approved removal. Reconfirm retained items and concealed-condition controls. Do not start from this proposal.',
    ['prepare'],
    by('scope-fit', 'feasibility', 'code', 'permits'),
  );
  add(
    'rough',
    powder
      ? 'Complete approved structural and services rough work'
      : 'Complete any approved substrate or service alterations',
    'physical-work',
    powder
      ? 'Only after released design: execute the approved structural/support, water, waste/vent, electrical and ventilation scope for the selected location. Routes and methods are currently undetermined.'
      : 'Only carry out alterations actually required by the reviewed kitchen design. Retained service positions do not establish capacity, condition or compliance.',
    ['protect'],
    by('survey', 'feasibility', 'code', 'permits'),
  );
  add(
    'rough-hold',
    'Hold for required rough-work review and inspections',
    'inspection',
    'Keep work accessible. Record actual required inspection/review results before concealment; scheduling or user acceptance is not a passed inspection.',
    ['rough'],
    by('code', 'permits'),
  );
  add(
    'finish',
    'Complete approved surfaces, cabinetry and fixtures',
    'physical-work',
    'After applicable rough hold points pass: complete specified substrate/surfaces, cabinets/countertops, appliance or fixture connections and finishing. Product specifications and quantities remain unresolved.',
    ['rough-hold'],
    by('resources', 'code', 'permits'),
  );
  add(
    'final',
    'Complete testing, required final inspections and handover',
    'handover',
    'Record qualified testing/commissioning, applicable final authority outcomes, defects and corrections, product information and actual costs. No step is marked complete by this plan.',
    ['finish'],
    by('feasibility', 'code', 'permits', 'resources'),
  );
  validateScopeSequence(steps);
  return {
    kind: 'project-work-plan',
    recipe: scopeRecipeVersion,
    basis: 'deterministic-proposal',
    constructionRelease: 'blocked',
    optionId: option.id,
    optionTitle: option.title,
    steps,
  };
}
export function validateScopeSequence(
  steps: Extract<ArtifactPayload, { kind: 'project-work-plan' }>['steps'],
) {
  const seen = new Set<string>();
  for (const step of steps) {
    if (seen.has(step.id) || step.dependsOn.some((id) => !seen.has(id)))
      throw new DomainError(
        'VALIDATION',
        'Work sequence must be unique, acyclic and ordered after its predecessors',
      );
    if (
      !step.blockers.length ||
      step.completion !== 'not-reported' ||
      (['physical-work', 'inspection', 'handover', 'preparation'].includes(step.kind) &&
        step.status !== 'blocked')
    )
      throw new DomainError('VALIDATION', 'Unsupported work cannot be released or marked complete');
    seen.add(step.id);
  }
}
export function storeScopeArtifact(
  state: Workspace,
  command: Command,
  ctx: CommandContext,
  id: string,
  expected: number,
  payload: ArtifactPayload,
  inputRefs: InputRef[],
) {
  const pid = command.projectId;
  const old = state.artifacts[id]?.at(-1);
  if ((old?.revision || 0) !== expected)
    throw new DomainError(
      'CONFLICT',
      'The saved options or work plan changed; review the current revision',
    );
  if (old && old.payload.kind !== payload.kind)
    throw new DomainError('CONFLICT', 'Planning artifact identity is occupied');
  const revision = (old?.revision || 0) + 1;
  (state.artifacts[id] ||= []).push({
    schemaVersion: 1,
    id,
    projectId: pid,
    revision,
    lifecycle: 'proposed',
    freshness: 'current',
    inputRefs,
    evidenceIds: [],
    payload,
    contextSignature: inputSignature(state, pid),
    createdAt: ctx.now,
    acceptedAt: null,
  });
  const ref: InputRef = { kind: 'artifact', id, revision };
  state.messages.push({
    id: `${command.commandId}:${payload.kind}:output`,
    projectId: pid,
    role: 'system',
    mode: 'system',
    text: `Compiled locally: ${payload.kind === 'project-options' ? 'three conditional project options' : 'a sequenced work plan for the selected study option'}. Reported direction is retained; measurements and qualified feasibility remain unresolved. Backend off; no construction is released.`,
    evidenceIds: [],
    artifactRefs: [ref],
    runId: null,
    at: ctx.now,
  });
  state.views[pid] = {
    ...state.views[pid],
    stage: payload.kind === 'project-options' ? 'options' : 'plan',
    surface: 'artifact',
    tab: 'work',
    artifactRef: ref,
  };
  return id;
}

export function handleScopePlanning(state: Workspace, command: Command, ctx: CommandContext) {
  if (command.type === 'SaveCandidateMeasurements') {
    const pid = command.projectId,
      p = command.payload;
    const options = state.artifacts[`${pid}:scope-options`]?.at(-1),
      plan = state.artifacts[`${pid}:scope-work-plan`]?.at(-1);
    if (
      (options?.revision || 0) !== p.expectedOptionsRevision ||
      (plan?.revision || 0) !== p.expectedPlanRevision
    )
      throw new DomainError(
        'CONFLICT',
        'The option or selected work plan changed; reload before saving the survey',
      );
    const current = (a: typeof options) =>
      !!a &&
      a.lifecycle !== 'rejected' &&
      referenceCurrent(state, pid, { kind: 'artifact', id: a.id, revision: a.revision });
    const originalView = state.views[pid] ? structuredClone(state.views[pid]) : undefined;
    const refreshOptions = current(options),
      refreshPlan = current(plan);
    const ids = saveCandidateMeasurements(state, command, ctx);
    if (refreshOptions && options && scopePlanningCoverage(state, pid).current) {
      const payload = compileProjectOptions(state, pid);
      ids.push(
        storeScopeArtifact(
          state,
          command,
          ctx,
          options.id,
          options.revision,
          payload,
          scopePlanningRefs(state, pid),
        ),
      );
      if (
        refreshPlan &&
        plan?.payload.kind === 'project-work-plan' &&
        plan.inputRefs.some(
          (r) => r.kind === 'artifact' && r.id === options.id && r.revision === options.revision,
        )
      ) {
        const optionId = plan.payload.optionId;
        const option = payload.options.find((o) => o.id === optionId);
        if (option)
          ids.push(
            storeScopeArtifact(
              state,
              command,
              ctx,
              plan.id,
              plan.revision,
              compileProjectWorkPlan(option),
              [{ kind: 'artifact', id: options.id, revision: options.revision + 1 }],
            ),
          );
      }
    }
    const generatedIds = new Set([
      `${command.commandId}:project-options:output`,
      `${command.commandId}:project-work-plan:output`,
    ]);
    const regenerated = state.messages.filter((m) => generatedIds.has(m.id));
    const savedMessage = state.messages.find((m) => m.id === `${command.commandId}:measurements`);
    if (savedMessage && regenerated.length) {
      savedMessage.artifactRefs.push(...regenerated.flatMap((m) => m.artifactRefs));
      savedMessage.text += ` Updated ${regenerated.map((m) => m.artifactRefs.map((r) => `${r.id.endsWith(':scope-options') ? 'options' : 'work sequence'} r${r.revision}`).join(', ')).join(' and ')}; earlier revisions remain in history.`;
      state.messages = state.messages.filter((m) => !generatedIds.has(m.id));
    }
    if (originalView) {
      const ref = originalView.artifactRef;
      if (
        originalView.surface === 'artifact' &&
        ref &&
        ((refreshOptions && ref.id === options?.id && ref.revision === options.revision) ||
          (refreshPlan && ref.id === plan?.id && ref.revision === plan.revision))
      ) {
        const latest = state.artifacts[ref.id]?.at(-1);
        state.views[pid] = {
          ...originalView,
          artifactRef: { ...ref, revision: latest?.revision || ref.revision },
        };
      } else state.views[pid] = originalView;
    }
    return { type: 'ArtifactProposed' as const, ids };
  }
  if (command.type !== 'BuildProjectOptions' && command.type !== 'PlanProjectOption') return null;
  const pid = command.projectId;
  const store = (id: string, expected: number, payload: ArtifactPayload, refs: InputRef[]) =>
    storeScopeArtifact(state, command, ctx, id, expected, payload, refs);
  if (command.type === 'BuildProjectOptions') {
    const p = command.payload;
    if (
      p.researchRef.kind !== 'artifact' ||
      p.researchRef.id !== `${pid}:property-research` ||
      !referenceCurrent(state, pid, p.researchRef)
    )
      throw new DomainError(
        'STALE',
        'Reopen the current property research before building options',
      );
    const expected = [...p.answerRefs].sort((a, b) => a.id.localeCompare(b.id));
    const actual = scopeAnswerRefs(state, pid).sort((a, b) => a.id.localeCompare(b.id));
    if (fingerprint(expected) !== fingerprint(actual))
      throw new DomainError(
        'CONFLICT',
        'Saved answers changed. Review the current direction before building options',
      );
    const surveys = candidateSurveyRefs(state, pid).sort((a, b) => a.id.localeCompare(b.id));
    if (
      (surveys.length || p.surveyRefs) &&
      fingerprint(surveys) !==
        fingerprint([...(p.surveyRefs || [])].sort((a, b) => a.id.localeCompare(b.id)))
    )
      throw new DomainError(
        'CONFLICT',
        'Candidate survey set changed. Review current measurements before rebuilding options',
      );
    const payload = compileProjectOptions(state, pid);
    const refs = scopePlanningRefs(state, pid);
    return {
      type: 'ArtifactProposed' as const,
      ids: [store(`${pid}:scope-options`, p.expectedOptionsRevision, payload, refs)],
    };
  }
  const p = command.payload;
  if (p.optionsRef.kind !== 'artifact' || p.optionsRef.id !== `${pid}:scope-options`)
    throw new DomainError('VALIDATION', 'Choose this project’s compiled options');
  const source = resolveRef(state, pid, p.optionsRef);
  if (!referenceCurrent(state, pid, p.optionsRef))
    throw new DomainError(
      'STALE',
      'Options are stale. Rebuild them from the current direction before planning',
    );
  if (!('payload' in source) || source.payload.kind !== 'project-options')
    throw new DomainError('VALIDATION', 'Expected compiled project options');
  const option = source.payload.options.find((o) => o.id === p.optionId);
  if (!option) throw new DomainError('VALIDATION', 'Option does not exist in this revision');
  return {
    type: 'ArtifactProposed' as const,
    ids: [
      store(`${pid}:scope-work-plan`, p.expectedPlanRevision, compileProjectWorkPlan(option), [
        p.optionsRef,
      ]),
    ],
  };
}
