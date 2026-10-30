import {
  DomainError,
  roomDimensionFacts,
  roomDimensionsInputSchema,
  roomMeasureMethodLabels,
  type Command,
  type RoomDimension,
  type Workspace,
} from '@renovagent/contracts';

const order: RoomDimension[] = ['length', 'width', 'height', 'area', 'perimeter'];
const labels = {
  length: 'Floor length',
  width: 'Floor width',
  height: 'Ceiling height',
  area: 'Floor area',
  perimeter: 'Floor perimeter',
};

// Project-scoped room dimension facts, so the web card and any later capture
// path supersede the same records instead of creating a second live fact.
export function roomDimensionFact(state: Workspace, projectId: string, dimension: RoomDimension) {
  const key = roomDimensionFacts[dimension];
  return Object.values(state.facts)
    .map((versions) => versions.at(-1)!)
    .find((f) => f.projectId === projectId && f.subjectId === projectId && f.key === key);
}

// One user observation describing what was measured and how, then one
// RecordFact per supplied dimension. Each command bumps the project revision by
// one; project-scoped evidence and facts leave the property revision alone.
export function roomDimensionCommands(
  state: Workspace,
  projectId: string,
  raw: unknown,
  ids: { commandId: (step: string) => string; evidenceId: string; factId: () => string },
): Command[] {
  const project = state.projects[projectId];
  if (!project) throw new DomainError('NOT_FOUND', `Unknown project ${projectId}`);
  const parsed = roomDimensionsInputSchema.safeParse(raw);
  if (!parsed.success)
    throw new DomainError('VALIDATION', parsed.error.issues[0]?.message || 'Invalid dimensions');
  const input = parsed.data;
  // The form prefills saved values; re-recording an unchanged one would stale
  // every draft and plan that depends on it for nothing.
  const measured = order.filter((d) => {
    const entered = input[d];
    const saved = roomDimensionFact(state, projectId, d)?.originalValue;
    return (
      entered &&
      !(
        saved?.kind === 'quantity' &&
        saved.amount === entered.amount &&
        saved.unit === entered.unit
      )
    );
  });
  if (!measured.length) throw new DomainError('VALIDATION', 'These measurements are already saved');
  const base = { projectId, basePropertyRevision: state.properties[project.propertyId].revision };
  const summary = measured
    .map((d) => `${labels[d]} ${input[d]!.amount} ${input[d]!.unit}`)
    .join(', ');
  const commands: Command[] = [
    {
      ...base,
      commandId: ids.commandId('evidence'),
      baseRevision: project.revision,
      type: 'AttachEvidence',
      payload: {
        scope: 'project',
        evidence: {
          id: ids.evidenceId,
          kind: 'user-observation',
          description:
            `User-measured room dimensions (${roomMeasureMethodLabels[input.method]}; not verified): ${summary}.` +
            (input.notes ? ` Notes: ${input.notes}` : ''),
        },
      },
    },
  ];
  for (const dimension of measured) {
    const old = roomDimensionFact(state, projectId, dimension);
    commands.push({
      ...base,
      commandId: ids.commandId(dimension),
      baseRevision: project.revision + commands.length,
      type: 'RecordFact',
      payload: {
        factId: old?.id || ids.factId(),
        subjectId: projectId,
        key: roomDimensionFacts[dimension],
        scope: 'project',
        supersedesRevision: old?.revision || 0,
        value: {
          kind: 'quantity',
          dimension: dimension === 'area' ? 'area' : 'length',
          ...input[dimension]!,
        },
        assertion: 'user_reported',
        evidenceIds: [ids.evidenceId, ...input.photoEvidenceIds],
      },
    });
  }
  return commands;
}
