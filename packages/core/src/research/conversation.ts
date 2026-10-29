import {
  conversationPlanSchema,
  DomainError,
  type Workspace,
  type ConversationPlan,
  type InputRef,
  type Command,
} from '@renovagent/contracts';
import { referenceCurrent, latest } from '../domain/invalidate.js';
import { captureInputs, inputSignature } from '../domain/input-context.js';
export function conversationSignature(state: Workspace, projectId: string) {
  return JSON.stringify({
    inputs: inputSignature(state, projectId),
    artifacts: Object.values(state.artifacts)
      .map((v) => v.at(-1)!)
      .filter(
        (a) =>
          a.projectId === projectId &&
          a.payload.kind !== 'project-brief' &&
          a.payload.kind !== 'conversation-plan',
      )
      .map((a) => [a.id, a.revision, a.freshness]),
    messages: state.messages.filter((m) => m.projectId === projectId).map((m) => m.id),
  });
}
export function conversationInputs(state: Workspace, projectId: string): InputRef[] {
  const refs = [
    ...captureInputs(state, projectId),
    ...Object.values(state.artifacts)
      .map((v) => v.at(-1)!)
      .filter(
        (a) =>
          a.projectId === projectId &&
          !['project-brief', 'conversation-plan'].includes(a.payload.kind),
      )
      .map((a) => ({ kind: 'artifact' as const, id: a.id, revision: a.revision })),
  ];
  return refs.filter(
    (r, i) =>
      refs.findIndex((v) => v.kind === r.kind && v.id === r.id) === i &&
      referenceCurrent(state, projectId, r),
  );
}
const aliases = {
  mm: '(?:mm|millimeters?|millimetres?)',
  cm: '(?:cm|centimeters?|centimetres?)',
  m: '(?:m|meters?|metres?)',
  ft: "(?:ft|feet|foot|')",
  in: '(?:in|inches?|\")',
};
export function validateConversationPlan(
  state: Workspace,
  projectId: string,
  raw: unknown,
): ConversationPlan {
  const plan = conversationPlanSchema.parse(raw);
  const known = Object.values(state.artifacts).flatMap((v) =>
    v
      .filter((a) => a.projectId === projectId && a.payload.kind === 'property-research')
      .flatMap((a) =>
        a.payload.kind === 'property-research' ? a.payload.photoReview?.photos || [] : [],
      ),
  );
  if (plan.inputPhotos.some((p) => !known.some((k) => k.id === p.id && k.sha256 === p.sha256)))
    throw new DomainError('VALIDATION', 'Photo basis is not saved project evidence');
  if (
    [...plan.options, ...plan.missingMeasurements].some((p) =>
      p.photoIds.some((id) => !plan.inputPhotos.some((i) => i.id === id)),
    )
  )
    throw new DomainError('VALIDATION', 'Unknown planning photo reference');
  for (const observation of plan.observations) {
    const m = state.messages.find(
      (m) => m.id === observation.sourceMessageId && m.projectId === projectId && m.role === 'user',
    );
    const number = String(observation.amount).replace('.', '\\.');
    const literal = new RegExp(
      `(?:^|[^0-9.])${number}\\s*${aliases[observation.unit]}(?:$|[^a-z])`,
      'i',
    );
    if (
      !m ||
      !m.text.includes(observation.quote) ||
      !m.text.toLowerCase().includes(observation.location.toLowerCase()) ||
      !literal.test(observation.quote)
    )
      throw new DomainError(
        'VALIDATION',
        'Measurement proposal must quote the owner’s explicit value, units and location',
      );
  }
  return plan;
}
export function conversationObservationCommands(
  state: Workspace,
  projectId: string,
  planRef: InputRef,
  requestId: string,
): Command[] {
  if (planRef.kind !== 'artifact' || !referenceCurrent(state, projectId, planRef))
    throw new DomainError('STALE', 'Review the current plan before saving reported measurements');
  const artifact = state.artifacts[planRef.id].find((a) => a.revision === planRef.revision)!;
  if (artifact.payload.kind !== 'conversation-plan')
    throw new DomainError('VALIDATION', 'Not a conversation plan');
  const plan = validateConversationPlan(state, projectId, artifact.payload);
  if (!plan.observations.length)
    throw new DomainError('VALIDATION', 'No explicit measurements to save');
  const commands = plan.observations.map((o, index) => {
    const slug = o.location
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!slug) throw new DomainError('VALIDATION', 'Use a named measurement location');
    const factId = `${projectId}:chat:${o.key}:${slug}`,
      old = latest(state.facts[factId]);
    return {
      commandId: `chat-save:${requestId}:${index}`,
      projectId,
      baseRevision: state.projects[projectId].revision + index,
      basePropertyRevision: state.properties[state.projects[projectId].propertyId].revision,
      type: 'RecordFact',
      payload: {
        scope: 'project',
        factId,
        subjectId: projectId,
        key: `reported.${o.key}.${slug}.${o.basis}`,
        supersedesRevision: old?.revision || 0,
        value: { kind: 'quantity', amount: o.amount, dimension: 'length', unit: o.unit },
        assertion: 'user_reported',
        evidenceIds: [o.sourceMessageId],
      },
    } as Command;
  });
  if (
    new Set(commands.map((c) => (c.type === 'RecordFact' ? c.payload.factId : ''))).size !==
    commands.length
  )
    throw new DomainError('VALIDATION', 'Duplicate proposed measurements');
  return commands;
}
