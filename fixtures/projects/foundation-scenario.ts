import { emptyWorkspace, type Command, type CommandContext } from '@renovagent/contracts';
import { handleCommand } from '@renovagent/core';
export function foundationScenario(context: CommandContext) {
  let state = emptyWorkspace(context.ownerId),
    sequence = 0;
  const commands: Command[] = [];
  function add(command: Command) {
    state = handleCommand(state, command, context).state;
    commands.push(command);
  }
  function envelope(projectId = 'fixture-half-bath') {
    return {
      commandId: `fixture:${++sequence}`,
      projectId,
      baseRevision: state.projects[projectId]?.revision || 0,
      basePropertyRevision: state.properties['fixture-property']?.revision || 0,
    };
  }
  add({
    ...envelope(),
    type: 'CreateProject',
    payload: {
      propertyId: 'fixture-property',
      name: 'Half bath · synthetic test',
      newProperty: { name: 'Fixture home' },
      spaces: [{ id: 'fixture-room', name: 'First-floor room' }],
    },
  });
  add({
    ...envelope('fixture-flooring'),
    type: 'CreateProject',
    payload: {
      propertyId: 'fixture-property',
      name: 'Flooring · synthetic test',
      spaces: [{ id: 'fixture-room', name: 'First-floor room' }],
    },
  });
  add({
    ...envelope(),
    type: 'AttachEvidence',
    payload: {
      scope: 'property',
      evidence: {
        id: 'fixture-measurement',
        kind: 'user-observation',
        description: 'Synthetic measured-width report, not a real site observation.',
      },
    },
  });
  const factPayload = {
    scope: 'property' as const,
    factId: 'fixture-width',
    subjectId: 'fixture-room',
    key: 'finishedWidth',
    supersedesRevision: 0,
    value: {
      kind: 'quantity' as const,
      amount: 1200,
      dimension: 'length' as const,
      unit: 'mm' as const,
    },
    assertion: 'user_reported' as const,
    evidenceIds: ['fixture-measurement'],
  };
  add({ ...envelope(), type: 'RecordFact', payload: factPayload });
  const graph = [
    ['fixture-layout', 'fact', 'fixture-width'],
    ['fixture-materials', 'artifact', 'fixture-layout'],
    ['fixture-estimate', 'artifact', 'fixture-materials'],
    ['fixture-tasks', 'artifact', 'fixture-materials'],
    ['fixture-unrelated', 'evidence', 'fixture-measurement'],
  ] as const;
  for (const [id, kind, inputId] of graph) {
    add({
      ...envelope(),
      type: 'ProposeArtifact',
      payload: {
        artifactId: id,
        supersedesRevision: 0,
        inputRefs: [{ kind, id: inputId, revision: 1 }],
        evidenceIds: [],
        content: {
          kind: 'project-brief',
          sections: [
            { title: id, text: 'Synthetic dependency fixture; no construction conclusion.' },
          ],
        },
      },
    });
    add({
      ...envelope(),
      type: 'AcceptDecision',
      payload: {
        decisionId: `decision:${id}`,
        question: 'Accept this synthetic fixture artifact?',
        artifactRefs: [{ kind: 'artifact', id, revision: 1 }],
      },
    });
  }
  add({
    ...envelope('fixture-flooring'),
    type: 'ProposeArtifact',
    payload: {
      artifactId: 'fixture-shared-dependent',
      supersedesRevision: 0,
      inputRefs: [{ kind: 'fact', id: 'fixture-width', revision: 1 }],
      evidenceIds: [],
      content: {
        kind: 'project-brief',
        sections: [
          { title: 'Shared property dependency', text: 'Synthetic second-project dependency.' },
        ],
      },
    },
  });
  const correction: Command = {
    ...envelope(),
    type: 'RecordFact',
    payload: {
      ...factPayload,
      supersedesRevision: 1,
      value: { ...factPayload.value, amount: 1100 },
    },
  };
  return { commands, correction };
}
