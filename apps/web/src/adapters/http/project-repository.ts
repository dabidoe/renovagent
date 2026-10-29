import {
  DomainError,
  workspaceSchema,
  type CommandContext,
  type CommandResult,
} from '@unpermitted/contracts';
import type { AttachmentBlob, ProjectRepository } from '@unpermitted/core';
export async function workspaceRequest(path: string, body?: unknown) {
  const response = await fetch(`/api/workspace${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: {
      'X-Unpermitted-Client': 'workspace',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({ message: 'Workspace API is unavailable' }));
  if (!response.ok)
    throw new DomainError(result.code || 'STORAGE', result.message || 'Server request failed');
  return result;
}
export async function encodeBlobs(blobs: AttachmentBlob[]) {
  return Promise.all(
    blobs.map(async ({ id, blob }) => {
      let binary = '';
      for (const n of new Uint8Array(await blob.arrayBuffer())) binary += String.fromCharCode(n);
      return { id, mediaType: blob.type, data: btoa(binary) };
    }),
  );
}
function decodeBlobs(blobs: { id: string; mediaType: string; data: string }[]): AttachmentBlob[] {
  return blobs.map((b) => ({
    id: b.id,
    blob: new Blob([Uint8Array.from(atob(b.data), (c) => c.charCodeAt(0))], { type: b.mediaType }),
  }));
}
export class HttpProjectRepository implements ProjectRepository {
  static async open() {
    await workspaceRequest('/session');
    return new HttpProjectRepository();
  }
  async read() {
    return workspaceSchema.parse(await workspaceRequest(''));
  }
  execute(command: unknown, context: CommandContext, blobs: AttachmentBlob[] = []) {
    return this.executeBatch([command], context, blobs).then((r) => r[0]);
  }
  async executeBatch(
    commands: unknown[],
    _context: CommandContext,
    blobs: AttachmentBlob[] = [],
  ): Promise<CommandResult[]> {
    return workspaceRequest('/commands', { commands, blobs: await encodeBlobs(blobs) });
  }
  async readBlob(id: string) {
    const response = await fetch(`/api/workspace/blobs/${encodeURIComponent(id)}`);
    if (response.status === 404) return undefined;
    if (!response.ok) throw Error('Attachment unavailable');
    return response.blob();
  }
  async exportBackup() {
    const data = await workspaceRequest('/backup');
    return {
      format: 'unpermitted-local-backup' as const,
      schemaVersion: 1 as const,
      workspace: workspaceSchema.parse(data.workspace),
      blobs: decodeBlobs(data.blobs),
    };
  }
  async exportRecoveryBundle() {
    const backup = await this.exportBackup();
    return {
      format: 'unpermitted-local-recovery' as const,
      databaseVersion: 1,
      rawWorkspace: backup.workspace,
      blobs: backup.blobs,
    };
  }
  close() {}
}
