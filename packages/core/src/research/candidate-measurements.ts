import {
  DomainError,
  emptyPlanningInputs,
  type ArtifactPayload,
  type Workspace,
  type Command,
  type CommandContext,
  type InputRef,
} from '@renovagent/contracts';
import { geometry, mm } from '../planning/calculators.js';
import { referenceCurrent, resolveRef } from '../domain/invalidate.js';
import { propertyAddress } from './property-research.js';
export const candidateRoles = [
  { id: 'kitchen', label: 'Kitchen work area' },
  { id: 'ground-floor', label: 'Ground-floor candidate' },
  { id: 'basement', label: 'Basement candidate' },
] as const;
export const candidateMeasurementId = (pid: string, role: string) => `${pid}:survey:${role}`;
export const candidateCheckId = (pid: string, role: string) => `${pid}:survey-checks:${role}`;
export function candidateMeasurement(state: Workspace, pid: string, role: string) {
  const a = state.artifacts[candidateMeasurementId(pid, role)]?.at(-1);
  return a?.projectId === pid &&
    a.payload.kind === 'candidate-measurements' &&
    a.payload.role === role
    ? a
    : undefined;
}
export function candidateCheck(state: Workspace, pid: string, role: string) {
  const a = state.artifacts[candidateCheckId(pid, role)]?.at(-1);
  return a?.projectId === pid && a.payload.kind === 'candidate-checks' && a.payload.role === role
    ? a
    : undefined;
}
export function checkCandidate(
  payload: Extract<ArtifactPayload, { kind: 'candidate-measurements' }>,
): Extract<ArtifactPayload, { kind: 'candidate-checks' }> {
  const s = payload.survey,
    v = s.values;
  const inputs = emptyPlanningInputs();
  inputs.site = {
    ...inputs.site,
    width: s.shape === 'rectangular' ? v.width : null,
    length: s.shape === 'rectangular' ? v.length : null,
    measurement: s.measurement,
    drainRun: v.drainRun,
    drainFall: v.drainFall,
  };
  const result = geometry(inputs);
  const labels = {
    width: 'width',
    length: 'length',
    minimumHeadroom: 'minimum observed headroom',
    clearDoorWidth: 'clear doorway width',
    approachWidth: 'approach / circulation width',
    drainRun: 'observed drain run',
    drainFall: 'observed available fall',
  };
  const missing: string[] = [];
  for (const key of [
    'width',
    'length',
    'minimumHeadroom',
    'clearDoorWidth',
    'approachWidth',
  ] as const)
    if (v[key] === null) missing.push(labels[key]);
  if (s.shape !== 'rectangular')
    missing.push('supported rectangular footprint (irregular spaces need a measured drawing)');
  if (s.measurement !== 'finished') missing.push('consistent finished-boundary measurements');
  if (s.doorSwing !== 'reported-clear') missing.push('door swing / obstruction survey');
  if (!s.measuredAt) missing.push('measurement date');
  const zero = Object.entries(v)
    .filter(([key, value]) => key !== 'drainFall' && value !== null && mm(value) === 0)
    .map(([key]) => key);
  if (zero.length) missing.push(`positive observed dimensions: ${zero.join(', ')}`);
  if (payload.basis === 'example')
    missing.push('actual site measurements (these values are examples)');
  return {
    kind: 'candidate-checks',
    role: payload.role,
    locationId: s.locationId,
    shape: s.shape,
    surveyBasis: s.measurement,
    label: s.label,
    algorithm: 'candidate-survey/1',
    basis: payload.basis,
    constructionRelease: 'blocked',
    feasibility: 'blocked',
    traces: [
      ...result.traces.filter((t) =>
        ['Floor area', 'Room perimeter', 'Observed drain gradient'].includes(t.label),
      ),
      ...(['minimumHeadroom', 'clearDoorWidth', 'approachWidth'] as const).map((key) => ({
        label: labels[key],
        formula: 'reported length converted to millimetres; no code minimum applied',
        value: v[key] === null ? null : mm(v[key]),
        unit: 'mm',
      })),
    ],
    missing,
    checks: [
      {
        id: 'survey',
        title: 'Candidate survey inputs',
        status:
          zero.length || s.doorSwing === 'reported-conflict'
            ? 'not-supported'
            : missing.length
              ? 'needs-input'
              : 'needs-review',
        detail: missing.length
          ? `Still needed: ${missing.join('; ')}.`
          : 'Basic reported survey fields are present. Cabinet/fixture geometry, openings, service locations and professional review are not established.',
      },
      {
        id: 'shape',
        title: 'Supported geometric arithmetic',
        status:
          s.shape === 'rectangular' &&
          v.width !== null &&
          v.length !== null &&
          mm(v.width) > 0 &&
          mm(v.length) > 0
            ? 'reported'
            : 'needs-input',
        detail:
          'Area and perimeter use the existing shared rectangular geometry engine. Rough/conflicting values remain explicitly provisional; irregular footprints are not treated as rectangles.',
      },
      {
        id: 'fixture-fit',
        title: 'Fixture, cabinet and swept-door fit',
        status: 'blocked',
        detail:
          'No proposed fixture/cabinet specifications, offsets or swept-door geometry are linked to this candidate. Room area alone cannot establish fit.',
      },
      {
        id: 'drainage',
        title: 'Drainage feasibility',
        status: 'blocked',
        detail:
          'Observed gradient is arithmetic only. Connection elevations, pipe sizing, routing, venting, below-slab conditions and qualified method review remain unresolved.',
      },
      {
        id: 'code',
        title: 'Headroom, access and local code applicability',
        status: 'blocked',
        detail:
          'Reported heights/widths have no automatic code pass. Building/use, exact scope, adopted provisions, local amendments and qualified applicability review are not linked to this candidate.',
      },
    ],
    limitations: [
      'User-reported or example measurements; no verification or completed survey is asserted.',
      'Area/perimeter describe the declared rectangle only. They are not a takeoff, structural design or fixture layout.',
      'Observations do not establish concealed services, feasibility, permit/inspection outcomes or construction release.',
    ],
  };
}
export function saveCandidateMeasurements(
  state: Workspace,
  command: Extract<Command, { type: 'SaveCandidateMeasurements' }>,
  ctx: CommandContext,
) {
  const p = command.payload,
    pid = command.projectId;
  if (!candidateRoles.some((r) => r.id === p.role))
    throw new DomainError('VALIDATION', 'This recipe does not support that candidate role');
  const address = propertyAddress(state, pid);
  if (!address || address.value.kind !== 'text')
    throw new DomainError(
      'VALIDATION',
      'Save the property address before recording a candidate survey',
    );
  if (
    p.addressRef.kind !== 'fact' ||
    p.addressRef.id !== address.id ||
    p.addressRef.revision !== address.revision
  )
    throw new DomainError(
      'STALE',
      'Property address changed. Start a new survey for the current property context',
    );
  if (command.basePropertyRevision !== state.properties[state.projects[pid].propertyId].revision)
    throw new DomainError(
      'CONFLICT',
      'Property context changed; review the address before saving measurements',
    );
  if (
    candidateRoles.some(
      (r) =>
        r.id !== p.role &&
        candidateMeasurement(state, pid, r.id)?.payload.kind === 'candidate-measurements' &&
        (
          candidateMeasurement(state, pid, r.id)!.payload as Extract<
            ArtifactPayload,
            { kind: 'candidate-measurements' }
          >
        ).survey.locationId === p.survey.locationId,
    )
  )
    throw new DomainError(
      'VALIDATION',
      'A physical candidate identity cannot be reused for another location role',
    );
  const id = candidateMeasurementId(pid, p.role),
    old = state.artifacts[id]?.at(-1);
  if ((old?.revision || 0) !== p.expectedMeasurementRevision)
    throw new DomainError(
      'CONFLICT',
      'Candidate measurements changed. Reload the saved survey before revising',
    );
  if (old && old.payload.kind !== 'candidate-measurements')
    throw new DomainError('CONFLICT', 'Candidate identity is occupied');
  if (p.survey.measuredAt && p.survey.measuredAt > ctx.now.slice(0, 10))
    throw new DomainError('VALIDATION', 'A future date cannot describe an observed measurement');
  if (!Object.values(p.survey.values).some((value) => value !== null))
    throw new DomainError(
      'VALIDATION',
      'Enter at least one measured dimension; blank fields stay unknown',
    );
  Object.values(p.survey.values).forEach((value) => {
    if (value !== null) mm(value);
  });
  p.evidenceIds.forEach((id) => resolveRef(state, pid, { kind: 'evidence', id, revision: 1 }));
  const evidenceId = `${command.commandId}:survey`;
  if (state.evidence[evidenceId])
    throw new DomainError('CONFLICT', 'Survey evidence identity already exists');
  state.evidence[evidenceId] = {
    schemaVersion: 1,
    id: evidenceId,
    propertyId: state.projects[pid].propertyId,
    projectId: pid,
    revision: 1,
    recordedAt: ctx.now,
    source: {
      id: evidenceId,
      kind: 'user-observation',
      description: `${p.basis === 'example' ? '[Example measurements]' : 'Reported measurements'} ${p.survey.label}. Method: ${p.survey.method}. Observed: ${p.survey.measuredAt || 'date unknown'}. ${p.survey.notes}`,
    },
  };
  const revision = (old?.revision || 0) + 1;
  const payload: Extract<ArtifactPayload, { kind: 'candidate-measurements' }> = {
    kind: 'candidate-measurements',
    role: p.role,
    basis: p.basis,
    survey: p.survey,
  };
  const measurementRef: InputRef = { kind: 'artifact', id, revision };
  (state.artifacts[id] ||= []).push({
    schemaVersion: 1,
    id,
    projectId: pid,
    revision,
    lifecycle: 'proposed',
    freshness: 'current',
    inputRefs: [
      { kind: 'fact', id: address.id, revision: address.revision },
      ...[evidenceId, ...p.evidenceIds].map((id) => ({
        kind: 'evidence' as const,
        id,
        revision: 1,
      })),
    ],
    evidenceIds: [evidenceId, ...p.evidenceIds],
    payload,
    createdAt: ctx.now,
    acceptedAt: null,
  });
  const checkId = candidateCheckId(pid, p.role),
    prior = state.artifacts[checkId]?.at(-1);
  if (prior && prior.payload.kind !== 'candidate-checks')
    throw new DomainError('CONFLICT', 'Candidate check identity is occupied');
  (state.artifacts[checkId] ||= []).push({
    schemaVersion: 1,
    id: checkId,
    projectId: pid,
    revision: (prior?.revision || 0) + 1,
    lifecycle: 'proposed',
    freshness: 'current',
    inputRefs: [measurementRef],
    evidenceIds: [evidenceId],
    payload: checkCandidate(payload),
    createdAt: ctx.now,
    acceptedAt: null,
  });
  state.messages.push({
    id: `${command.commandId}:measurements`,
    projectId: pid,
    role: 'system',
    mode: 'system',
    text: `Saved ${p.survey.label} measurements r${revision} (${p.basis}); candidate-scoped arithmetic updated. Missing survey inputs and unsupported feasibility remain blocked. Backend off.`,
    evidenceIds: [],
    artifactRefs: [
      measurementRef,
      { kind: 'artifact', id: checkId, revision: (prior?.revision || 0) + 1 },
    ],
    runId: null,
    at: ctx.now,
  });
  return [id, checkId];
}
export function candidateSurveyDependency(state: Workspace, pid: string, role: string) {
  const measurement = candidateMeasurement(state, pid, role),
    check = candidateCheck(state, pid, role);
  const current =
    !!measurement &&
    referenceCurrent(state, pid, {
      kind: 'artifact',
      id: measurement.id,
      revision: measurement.revision,
    });
  if (
    !current ||
    !check ||
    check.payload.kind !== 'candidate-checks' ||
    !referenceCurrent(state, pid, { kind: 'artifact', id: check.id, revision: check.revision })
  )
    return {
      status: 'missing' as const,
      detail: `${candidateRoles.find((r) => r.id === role)?.label || role}: ${measurement ? 'saved measurements are stale or checks unavailable; re-observe for the current property.' : 'no candidate measurements saved.'}`,
      inputRefs: [] as InputRef[],
    };
  const c = check.payload;
  return {
    status: c.missing.length ? ('missing' as const) : ('needs-review' as const),
    detail: `${c.label} · ${c.basis} · survey r${measurement.revision}. ${c.traces.map((t) => `${t.label}: ${t.value === null ? 'unknown' : `${t.value} ${t.unit}`}`).join('; ')}. ${c.missing.length ? `Still needed: ${c.missing.join('; ')}.` : 'Basic fields reported; fixture layout, detailed survey and qualified review remain open.'}`,
    inputRefs: [
      { kind: 'artifact' as const, id: measurement.id, revision: measurement.revision },
      { kind: 'artifact' as const, id: check.id, revision: check.revision },
    ],
  };
}

export function candidateSurveyRefs(state: Workspace, pid: string): InputRef[] {
  return candidateRoles.flatMap((role) => {
    const a = candidateMeasurement(state, pid, role.id);
    return a ? [{ kind: 'artifact' as const, id: a.id, revision: a.revision }] : [];
  });
}
