import {
  type Command,
  type Workspace,
  type CommandContext,
  type ArtifactPayload,
  emptyWorkspace,
} from '@renovagent/contracts';
import { handleCommand } from '@renovagent/core';
import { IndexedDbProjectRepository } from '../apps/web/src/adapters/indexeddb/project-repository.js';
export const context: CommandContext = { ownerId: 'owner-test', now: '2026-10-27T00:00:00.000Z' };
export const createCommand = (projectId = 'project-a', newProperty = true): Command => ({
  commandId: `create:${projectId}`,
  projectId,
  baseRevision: 0,
  basePropertyRevision: newProperty ? 0 : 1,
  type: 'CreateProject',
  payload: {
    name: projectId,
    propertyId: 'property-a',
    ...(newProperty ? { newProperty: { name: 'Test property' } } : {}),
    spaces: [{ id: 'space-a', name: 'Test space' }],
  },
});
export class Scenario {
  state: Workspace = emptyWorkspace(context.ownerId);
  seq = 0;
  commands: Command[] = [];
  command(type: Command['type'], payload: unknown, projectId = 'project-a'): Command {
    return {
      commandId: `test-command:${++this.seq}`,
      projectId,
      baseRevision: this.state.projects[projectId]?.revision || 0,
      basePropertyRevision: this.state.properties['property-a']?.revision || 0,
      type,
      payload,
    } as Command;
  }
  apply(command: Command) {
    const outcome = handleCommand(this.state, command, context);
    this.state = outcome.state;
    this.commands.push(command);
    return outcome.result;
  }
  create(projectId = 'project-a', isNew = true) {
    return this.apply(createCommand(projectId, isNew));
  }
  evidence(
    id = 'evidence-width',
    scope: 'project' | 'property' = 'property',
    projectId = 'project-a',
  ) {
    return this.apply(
      this.command(
        'AttachEvidence',
        {
          scope,
          evidence: { id, kind: 'user-observation', description: 'Synthetic site observation' },
        },
        projectId,
      ),
    );
  }
  width(amount = 1200) {
    return this.command('RecordFact', {
      scope: 'property',
      factId: 'fact-width',
      subjectId: 'space-a',
      key: 'finishedWidth',
      supersedesRevision: this.state.facts['fact-width']?.at(-1)?.revision || 0,
      value: { kind: 'quantity', amount, dimension: 'length', unit: 'mm' },
      assertion: 'user_reported',
      evidenceIds: ['evidence-width'],
    });
  }
  artifact(
    id: string,
    inputRefs: { kind: 'fact' | 'artifact' | 'evidence'; id: string; revision: number }[],
    projectId = 'project-a',
    content: ArtifactPayload = {
      kind: 'project-brief',
      sections: [{ title: 'Fixture', text: 'Synthetic artifact only' }],
    },
  ) {
    return this.apply(
      this.command(
        'ProposeArtifact',
        {
          artifactId: id,
          supersedesRevision: this.state.artifacts[id]?.at(-1)?.revision || 0,
          inputRefs,
          evidenceIds: [],
          content,
        },
        projectId,
      ),
    );
  }
  accept(id: string, projectId = 'project-a') {
    return this.apply(
      this.command(
        'AcceptDecision',
        {
          decisionId: `decision:${++this.seq}`,
          question: 'Accept this fixture artifact?',
          artifactRefs: [
            { kind: 'artifact', id, revision: this.state.artifacts[id].at(-1)!.revision },
          ],
        },
        projectId,
      ),
    );
  }
}
export async function openTestRepo(factory: IDBFactory, name = crypto.randomUUID()) {
  return IndexedDbProjectRepository.open({ name, ownerId: context.ownerId, factory });
}
