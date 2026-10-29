import { captureInputs as capture } from './input-context.js';
import {
  DomainError,
  type Workspace,
  type Command,
  type CommandContext,
  type InputRef,
  type ArtifactPayload,
  type Run,
} from '@unpermitted/contracts';
import { latest, resolveRef, referenceCurrent } from './invalidate.js';
const labels = {
  brief: 'Project brief',
  options: 'Option comparison',
  technical: 'Technical investigation',
  plan: 'Work sequence',
  procurement: 'Procurement & scope',
  execution: 'Progress & change review',
  handover: 'Handover checklist',
};
export const workLabels = labels;
function signature(refs: InputRef[]) {
  return JSON.stringify(refs);
}
export function addMessage(
  state: Workspace,
  projectId: string,
  id: string,
  text: string,
  context: CommandContext,
  options: {
    user?: boolean;
    runId?: string;
    evidenceIds?: string[];
    artifactRefs?: InputRef[];
  } = {},
) {
  if (state.messages.some((m) => m.id === id))
    throw new DomainError('CONFLICT', 'Message already exists');
  const evidenceIds = options.evidenceIds || [];
  evidenceIds.forEach((id) => resolveRef(state, projectId, { kind: 'evidence', id, revision: 1 }));
  if (options.user) {
    if (state.evidence[id]) throw new DomainError('CONFLICT', 'Message evidence ID already exists');
    state.evidence[id] = {
      schemaVersion: 1,
      id,
      propertyId: state.projects[projectId].propertyId,
      projectId,
      revision: 1,
      recordedAt: context.now,
      source: { id, kind: 'user-message', description: text },
    };
  }
  state.messages.push({
    id,
    projectId,
    role: options.user ? 'user' : 'assistant',
    mode: options.user ? 'user' : 'simulated',
    text,
    evidenceIds,
    artifactRefs: options.artifactRefs || [],
    runId: options.runId || null,
    at: context.now,
  });
}
function step(run: Run, state: Run['state'], context: CommandContext, detail: string) {
  run.state = state;
  run.revision++;
  run.history.push({ state, at: context.now, detail });
}
function fixturePayload(state: Workspace, run: Run): ArtifactPayload {
  const p = state.projects[run.projectId];
  const facts = run.inputRefs
    .filter((r) => r.kind === 'fact')
    .map((r) => state.facts[r.id].find((f) => f.revision === r.revision)!);
  const reported =
    facts
      .map(
        (f) =>
          `${f.key}: ${f.value.kind === 'text' ? f.value.text : f.value.kind === 'quantity' ? `${f.value.amount} ${f.value.unit}` : f.value.kind === 'unknown' ? 'Unknown' : JSON.stringify(f.value)}`,
      )
      .join('\n') || 'No structured site facts recorded yet.';
  const limitations =
    'Simulated workflow output. No AI reasoning, photo/document analysis, live prices, code applicability determination, or professional review has occurred.';
  const scopeText = [
    p.name,
    ...facts
      .filter((f) => f.key === 'goal')
      .map((f) => (f.value.kind === 'text' ? f.value.text : '')),
  ].join(' ');
  if (run.kind === 'options' && /flooring|floor replacement/i.test(scopeText))
    return {
      kind: 'option-comparison',
      basis: 'fixture',
      options: [
        {
          id: 'retain-build-up',
          diagram: 'flooring',
          title: 'Retain the existing floor build-up',
          approach:
            'Illustrative approach: investigate whether the existing substrate can support the selected finish after appropriate preparation.',
          tradeoff:
            'Potentially less demolition; existing condition, levels, and compatibility may constrain the finish.',
          unknowns: [
            'Substrate condition and flatness',
            'Moisture and product installation requirements',
            'Transitions, finished heights, and existing damage',
          ],
        },
        {
          id: 'replace-build-up',
          diagram: 'flooring',
          title: 'Replace the floor build-up',
          approach:
            'Illustrative alternative: investigate removal and replacement where the existing assembly is unsuitable.',
          tradeoff:
            'More intervention and disposal; an opportunity to resolve substrate problems and transitions.',
          unknowns: [
            'Underlying condition and hidden services',
            'Removal and disposal scope',
            'Preparation method and a measured material takeoff',
          ],
        },
      ],
    };
  if (run.kind === 'options')
    return {
      kind: 'option-comparison',
      basis: 'fixture',
      options: [
        {
          id: 'retain-services',
          diagram: /bath|toilet|sink/i.test(scopeText) ? 'bathroom' : 'zones',
          title: 'Keep work close to existing services',
          approach: `Illustrative approach for ${p.name}: investigate a configuration that limits changes to existing service routes.`,
          tradeoff: 'Potentially less disruption; existing positions may constrain the layout.',
          unknowns: [
            'Measured finished geometry',
            'Location, condition, and capacity of existing services',
            'Applicable code path and local amendments',
          ],
        },
        {
          id: 'reconfigure',
          diagram: /bath|toilet|sink/i.test(scopeText) ? 'bathroom' : 'zones',
          title: 'Reconfigure for the intended use',
          approach:
            'Illustrative alternative: explore a broader rearrangement after surveying the affected systems.',
          tradeoff: 'More flexibility; potentially more investigation, trades, and alterations.',
          unknowns: [
            'Structural implications',
            'Achievable service routes',
            'Permits, inspections, and a scoped cost estimate',
          ],
        },
      ],
    };
  if (run.kind === 'technical')
    return {
      kind: 'technical-check',
      basis: 'fixture',
      result: 'needs_input',
      summary: `Investigation outline for ${p.name}\n\nReported facts\n${reported}\n\nEvidence to obtain\n• Building use, unit count, stories, and jurisdiction\n• Measured existing/proposed geometry and affected systems\n• Applicable adopted editions, sections, amendments, and exceptions\n\nUser clarification: ${run.answer}\n\n${limitations}`,
    };
  if (run.kind === 'plan' || run.kind === 'execution')
    return {
      kind: 'task-plan',
      tasks: [
        {
          id: 'survey',
          title:
            run.kind === 'execution'
              ? 'Reconcile completed work and existing evidence'
              : 'Survey the space and affected systems',
          deps: [],
          progress: 'not_started',
          readiness: 'needs_review',
        },
        {
          id: 'resolve',
          title: 'Resolve feasibility, technical requirements, and scope',
          deps: ['survey'],
          progress: 'not_started',
          readiness: 'blocked',
        },
        {
          id: 'prepare',
          title: 'Confirm trade responsibilities, permits, and inspection gates',
          deps: ['resolve'],
          progress: 'not_started',
          readiness: 'blocked',
        },
        {
          id: 'work',
          title: 'Define and sequence the approved work packages',
          deps: ['prepare'],
          progress: 'not_started',
          readiness: 'blocked',
        },
        {
          id: 'closeout',
          title: 'Collect acceptance evidence, approvals, and handover records',
          deps: ['work'],
          progress: 'not_started',
          readiness: 'blocked',
        },
      ],
    };
  const sections =
    run.kind === 'procurement'
      ? [
          {
            title: 'Scope package to prepare',
            text: 'Tie each trade’s inclusions, exclusions, and responsibilities to an accepted plan revision.',
          },
          {
            title: 'Before purchasing',
            text: 'Resolve quantities, specifications, compatible substitutions, lead times, storage, and delivery constraints. No quantities, prices, or orders are generated by this simulation.',
          },
          {
            title: 'Quote comparison',
            text: 'Compare quotes against the same scope. Missing work remains an explicit question; no contractor credentials have been verified.',
          },
        ]
      : run.kind === 'handover'
        ? [
            {
              title: 'Records to assemble',
              text: 'As-built scope, inspection outcomes, equipment manuals, receipts, warranties, and maintenance responsibilities.',
            },
            {
              title: 'Unresolved items',
              text: 'No physical completion or inspection has been verified. This is a simulated checklist, not a completion certificate.',
            },
          ]
        : [
            { title: 'The project', text: p.name },
            { title: 'Reported details', text: reported },
            { title: 'Clarification from you', text: run.answer },
            {
              title: 'Next decisions',
              text: 'Establish building context, inspect site evidence, compare viable options, then connect resolved requirements to an order of work.',
            },
          ];
  return {
    kind: 'project-brief',
    sections: [...sections, { title: 'Simulation basis', text: limitations }],
  };
}
export function handleWorkflow(
  state: Workspace,
  command: Command,
  context: CommandContext,
): { type: Workspace['events'][number]['type']; ids: string[] } | null {
  const projectId = command.projectId;
  if (command.type === 'AppendMuseReply') {
    const { planRef, messageId } = command.payload;
    const plan = resolveRef(state, projectId, planRef);
    if (planRef.kind !== 'artifact' || !('payload' in plan) || plan.payload.kind !== 'conversation-plan' || !referenceCurrent(state, projectId, planRef)) throw new DomainError('STALE', 'Muse reply requires a current conversation plan');
    if (state.messages.some(m => m.id === messageId)) throw new DomainError('CONFLICT', 'Reply already exists');
    state.messages.push({ id: messageId, projectId, role: 'assistant', mode: 'muse', text: plan.payload.response, evidenceIds: [], artifactRefs: [planRef], runId: null, at: context.now });
    return { type: 'MessageAppended', ids: [messageId] };
  }
  if (command.type === 'AppendMessage') {
    addMessage(state, projectId, command.payload.messageId, command.payload.text, context, {
      user: true,
      evidenceIds: command.payload.evidenceIds,
    });
    state.drafts[projectId] = {
      text: '',
      evidenceIds: [],
      revision: (state.drafts[projectId]?.revision || 0) + 1,
    };
    return { type: 'MessageAppended', ids: [command.payload.messageId] };
  }
  if (command.type === 'RequestWork') {
    const p = command.payload;
    if (state.runs[p.runId]) throw new DomainError('CONFLICT', 'Run already exists');
    if (
      Object.values(state.runs).some(
        (r) =>
          r.projectId === projectId &&
          r.kind === p.kind &&
          !['succeeded', 'cancelled', 'failed'].includes(r.state),
      )
    )
      throw new DomainError('CONFLICT', 'This kind of work already has an active simulation');
    const inputRefs = capture(state, projectId),
      targetArtifactId = `${projectId}:${p.kind}`;
    state.runs[p.runId] = {
      id: p.runId,
      projectId,
      revision: 1,
      mode: 'simulated',
      fixtureVersion: 1,
      kind: p.kind,
      state: 'queued',
      checkpoint: 0,
      attempt: 1,
      inputRefs,
      inputSignature: signature(inputRefs),
      answerEvidenceId: null,
      targetArtifactId,
      targetRevision: latest(state.artifacts[targetArtifactId])?.revision || 0,
      outputRef: null,
      answer: '',
      question: '',
      error: null,
      history: [
        {
          state: 'queued',
          at: context.now,
          detail: 'Local fixture queued; no model or backend call.',
        },
      ],
    };
    addMessage(
      state,
      projectId,
      `${command.commandId}:message`,
      `Simulation queued: ${labels[p.kind]}. Use “Advance simulation” to step through the saved workflow.`,
      context,
      { runId: p.runId },
    );
    return { type: 'WorkRequested', ids: [p.runId] };
  }
  if (command.type !== 'TransitionRun') return null;
  const p = command.payload,
    run = state.runs[p.runId];
  if (!run || run.projectId !== projectId)
    throw new DomainError('NOT_FOUND', 'Run not found in this project');
  if (run.revision !== p.expectedRunRevision)
    throw new DomainError('CONFLICT', 'Run checkpoint changed');
  if (['succeeded', 'cancelled'].includes(run.state))
    throw new DomainError('VALIDATION', 'Run is terminal');
  if (p.action === 'cancel')
    step(
      run,
      'cancelled',
      context,
      'User cancelled simulation. Existing output and evidence were retained.',
    );
  else if (p.action === 'fail') {
    if (run.state === 'failed' || run.state === 'waiting_for_approval')
      throw new DomainError('VALIDATION', 'Cannot inject failure at this checkpoint');
    run.error = 'Deliberately simulated tool failure. No external tool was called.';
    step(run, 'failed', context, run.error);
  } else if (p.action === 'retry') {
    if (run.state !== 'failed' || run.attempt >= 3)
      throw new DomainError(
        'VALIDATION',
        'Retry requires a failed run and fewer than three attempts',
      );
    run.inputRefs = capture(state, projectId);
    run.inputSignature = signature(run.inputRefs);
    run.targetRevision = latest(state.artifacts[run.targetArtifactId])?.revision || 0;
    run.outputRef = null;
    run.checkpoint = 0;
    run.attempt++;
    run.error = null;
    run.answer = '';
    run.answerEvidenceId = null;
    step(
      run,
      'queued',
      context,
      'Retry queued against current inputs. Prior attempt history retained.',
    );
  } else if (p.action === 'answer') {
    if (run.state !== 'waiting_for_input' || !p.answer?.trim())
      throw new DomainError('VALIDATION', 'This run needs a nonempty clarification');
    run.answer = p.answer.trim();
    const messageId = `${command.commandId}:answer`;
    addMessage(state, projectId, messageId, run.answer, context, {
      user: true,
      runId: run.id,
      evidenceIds: p.evidenceIds || [],
    });
    run.answerEvidenceId = messageId;
    run.inputRefs = capture(state, projectId);
    run.inputSignature = signature(run.inputRefs);
    run.checkpoint = 3;
    step(run, 'running', context, 'Clarification saved; fixture is ready to assemble a proposal.');
    state.drafts[projectId] = {
      text: '',
      evidenceIds: [],
      revision: (state.drafts[projectId]?.revision || 0) + 1,
    };
  } else if (p.action === 'advance') {
    if (run.state === 'queued') {
      run.checkpoint = 1;
      step(
        run,
        'running',
        context,
        'Fixture input snapshot loaded. No source retrieval or analysis performed.',
      );
    } else if (run.state === 'running' && run.checkpoint === 1) {
      run.checkpoint = 2;
      run.question =
        run.kind === 'execution'
          ? 'What work has already happened, and what records or photos are available?'
          : `What should this ${labels[run.kind].toLowerCase()} prioritize? Add useful site details, constraints, or say “unknown.”`;
      step(run, 'waiting_for_input', context, run.question);
      addMessage(state, projectId, `${command.commandId}:question`, run.question, context, {
        runId: run.id,
      });
    } else if (run.state === 'running' && run.checkpoint === 3) {
      const changed =
        signature(capture(state, projectId)) !== run.inputSignature ||
        (latest(state.artifacts[run.targetArtifactId])?.revision || 0) !== run.targetRevision;
      if (changed) {
        run.error =
          'Inputs or the target artifact changed during this attempt. Retry against the current project.';
        step(run, 'failed', context, run.error);
      } else {
        const ref = {
          kind: 'artifact' as const,
          id: run.targetArtifactId,
          revision: run.targetRevision + 1,
        };
        (state.artifacts[ref.id] ||= []).push({
          schemaVersion: 1,
          id: ref.id,
          projectId,
          revision: ref.revision,
          lifecycle: 'proposed',
          freshness: 'current',
          contextSignature: run.inputSignature,
          inputRefs: [
            ...run.inputRefs,
            ...(run.answerEvidenceId
              ? [{ kind: 'evidence' as const, id: run.answerEvidenceId, revision: 1 }]
              : []),
          ],
          evidenceIds: run.answerEvidenceId ? [run.answerEvidenceId] : [],
          payload: fixturePayload(state, run),
          createdAt: context.now,
          acceptedAt: null,
        });
        run.outputRef = ref;
        run.checkpoint = 4;
        step(
          run,
          'waiting_for_approval',
          context,
          'Simulated output saved. User decision required; no work has been approved for construction.',
        );
        addMessage(
          state,
          projectId,
          `${command.commandId}:output`,
          `${labels[run.kind]} is saved as revision ${ref.revision}. Review the artifact beside this conversation. This is simulated work, not verified technical advice.`,
          context,
          { runId: run.id, artifactRefs: [ref] },
        );
      }
    } else throw new DomainError('VALIDATION', 'Advance is unavailable at this checkpoint');
  }
  return { type: 'RunChanged', ids: [run.id, ...(run.outputRef ? [run.outputRef.id] : [])] };
}
export function finishRunsForDecision(
  state: Workspace,
  refs: InputRef[],
  context: CommandContext,
  rejected: boolean,
) {
  for (const run of Object.values(state.runs))
    if (
      run.state === 'waiting_for_approval' &&
      run.outputRef &&
      refs.some((r) => r.id === run.outputRef!.id && r.revision === run.outputRef!.revision)
    )
      step(
        run,
        'succeeded',
        context,
        rejected
          ? 'User declined the simulated proposal. Output retained.'
          : 'User accepted this simulated proposal. This is not professional or code approval.',
      );
}
