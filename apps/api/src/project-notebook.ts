import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  DomainError,
  id,
  saveProjectEntrySchema,
  type ProjectEntry,
  type Workspace,
  type ProjectNotebookRecord,
} from '@renovagent/contracts';
import { handleCommand } from '@renovagent/core';
import type { MongoWorkspaceRepository } from './repository.js';
import type { DesignImageStore } from './design-images.js';
export type NotebookEntry = ProjectNotebookRecord;

export function notebookEntries(
  workspace: Workspace,
  projectId: string,
  includeRemoved = false,
): NotebookEntry[] {
  if (!workspace.projects[projectId])
    throw new DomainError('NOT_FOUND', 'No such project in this workspace');
  return Object.values(workspace.artifacts)
    .flatMap((versions) => {
      const a = versions.at(-1);
      if (
        !a ||
        a.projectId !== projectId ||
        a.payload.kind !== 'project-entry' ||
        (!includeRemoved && a.payload.deleted)
      )
        return [];
      return [
        {
          id: a.id,
          projectId,
          revision: a.revision,
          updatedAt: a.createdAt,
          content: a.payload.content,
          author: a.payload.author,
          deleted: a.payload.deleted,
        },
      ];
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
}
export function readNotebookEntry(
  workspace: Workspace,
  projectId: string,
  entryId: string,
  revision?: number,
): NotebookEntry {
  if (!workspace.projects[projectId]) throw new DomainError('NOT_FOUND', 'No such project');
  const versions = workspace.artifacts[entryId];
  const a = revision ? versions?.find((v) => v.revision === revision) : versions?.at(-1);
  if (!a || a.projectId !== projectId || a.payload.kind !== 'project-entry')
    throw new DomainError('NOT_FOUND', 'No such notebook entry in this project');
  return {
    id: a.id,
    projectId,
    revision: a.revision,
    updatedAt: a.createdAt,
    content: a.payload.content,
    author: a.payload.author,
    deleted: a.payload.deleted,
  };
}
export class ProjectNotebook {
  constructor(
    readonly repo: MongoWorkspaceRepository,
    readonly images?: DesignImageStore,
  ) {}
  async list(
    projectId: string,
    filters: {
      query?: string;
      room?: string;
      entryType?: string;
      includeRemoved?: boolean;
      offset?: number;
      limit?: number;
    } = {},
  ) {
    const entries = notebookEntries(
      (await this.repo.read()).workspace,
      projectId,
      filters.includeRemoved,
    ).filter(
      (e) =>
        (!filters.room || e.content.room?.toLowerCase() === filters.room.toLowerCase()) &&
        (!filters.entryType || e.content.entryType === filters.entryType) &&
        (!filters.query ||
          JSON.stringify(e.content).toLowerCase().includes(filters.query.toLowerCase())),
    );
    const offset = Math.max(0, filters.offset ?? 0),
      limit = Math.min(100, filters.limit ?? 50);
    return {
      entries: entries.slice(offset, offset + limit),
      total: entries.length,
      nextOffset: offset + limit < entries.length ? offset + limit : null,
    };
  }
  async get(projectId: string, entryId: string, revision?: number) {
    return readNotebookEntry((await this.repo.read()).workspace, projectId, entryId, revision);
  }
  async save(raw: unknown, author: ProjectEntry['author']) {
    const input = saveProjectEntrySchema.parse(raw);
    for (const image of input.content.images)
      if (!this.images || !(await this.images.get(this.repo.ownerId, image.sha256)))
        throw new DomainError(
          'NOT_FOUND',
          'Upload this image to this workspace before adding it to the notebook',
        );
    return this.commit(input, {
      kind: 'project-entry',
      // BSON turns explicit undefined fields into null; omit optional keys before storage.
      content: JSON.parse(JSON.stringify(input.content)),
      author,
      deleted: false,
    });
  }
  async remove(raw: unknown, author: ProjectEntry['author']) {
    const input = z
      .object({
        projectId: id,
        entryId: id,
        requestId: id,
        expectedRevision: z.number().int().positive(),
      })
      .strict()
      .parse(raw);
    const prior = await this.get(input.projectId, input.entryId, input.expectedRevision);
    return this.commit(input, {
      kind: 'project-entry',
      content: prior.content,
      author,
      deleted: true,
    });
  }
  private async commit(
    input: { projectId: string; requestId: string; entryId?: string; expectedRevision: number },
    entry: ProjectEntry,
  ) {
    const digest = createHash('sha256')
      .update(`${input.projectId}\0${input.requestId}`)
      .digest('hex')
      .slice(0, 32);
    const entryId = input.entryId ?? `entry:${digest}`;
    const commandId = `notebook:${digest}`;
    await this.repo.update((doc) => {
      const project = doc.workspace.projects[input.projectId];
      if (!project) throw new DomainError('NOT_FOUND', 'No such project in this workspace');
      const previous = doc.workspace.commands[commandId];
      doc.workspace = handleCommand(
        doc.workspace,
        {
          type: 'SaveProjectEntry',
          commandId,
          projectId: input.projectId,
          baseRevision: previous ? previous.result.projectRevision - 1 : project.revision,
          payload: { entryId, expectedRevision: input.expectedRevision, entry },
        },
        { ownerId: this.repo.ownerId, now: new Date().toISOString() },
      ).state;
    });
    // Pin the response to the revision produced by this command, even after later edits.
    const { workspace } = await this.repo.read();
    return {
      entry: readNotebookEntry(workspace, input.projectId, entryId, input.expectedRevision + 1),
      projectRevision: workspace.projects[input.projectId].revision,
      url: `#project/${encodeURIComponent(input.projectId)}/notebook`,
    };
  }
}
