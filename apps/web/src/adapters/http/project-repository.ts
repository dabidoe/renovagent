import {
  DomainError,
  workspaceSchema,
  type CommandContext,
  type CommandResult,
} from '@renovagent/contracts';
import type { AttachmentBlob, ProjectRepository } from '@renovagent/core';
export async function workspaceRequest(path: string, body?: unknown) {
  const response = await fetch(`/api/workspace${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: {
      'X-Renovagent-Client': 'workspace',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({ message: 'Workspace API is unavailable' }));
  if (!response.ok)
    throw new DomainError(result.code || 'STORAGE', result.message || 'Server request failed');
  return result;
}
// Attachments the API accepts as raw staged uploads (POST /blobs/:id, up to
// 20 MiB each): one request per file, no base64, no JSON size cap. Other types
// still travel inline with their command.
const STAGED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
  'application/pdf',
]);
async function stageBlob({ id, blob }: AttachmentBlob) {
  const response = await fetch(`/api/workspace/blobs/${encodeURIComponent(id)}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'X-Renovagent-Client': 'workspace', 'Content-Type': blob.type },
    body: blob,
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({ message: 'Upload failed' }));
    throw new DomainError(result.code || 'STORAGE', result.message || 'Upload failed');
  }
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
export type SessionInfo = {
  mode: string;
  signedIn?: boolean;
  user?: { email: string; guest?: boolean };
  providers?: string[];
  muse?: boolean;
  jev?: boolean;
  // Blender on Modal is configured for high-quality renders.
  render?: boolean;
};
export const signInUrlFor = (provider: string) => `/api/workspace/auth/${provider}`;
export async function accountStatus(): Promise<SessionInfo> {
  return workspaceRequest('/auth/me');
}
export async function signOutAccount(): Promise<void> {
  await workspaceRequest('/auth/logout', {});
}
export class HttpProjectRepository implements ProjectRepository {
  session: SessionInfo = { mode: 'local-single-owner' };
  static async open() {
    const session = (await workspaceRequest('/session')) as SessionInfo;
    if (session.mode === 'account' && !session.signedIn)
      throw new DomainError('FORBIDDEN', 'Sign in to use the shared workspace', {
        providers: session.providers ?? [],
      });
    const repository = new HttpProjectRepository();
    repository.session = session;
    return repository;
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
    const inline: AttachmentBlob[] = [];
    for (const b of blobs)
      if (STAGED_TYPES.has(b.blob.type)) await stageBlob(b);
      else inline.push(b);
    return workspaceRequest('/commands', { commands, blobs: await encodeBlobs(inline) });
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
      format: 'renovagent-local-backup' as const,
      schemaVersion: 1 as const,
      workspace: workspaceSchema.parse(data.workspace),
      blobs: decodeBlobs(data.blobs),
    };
  }
  async exportRecoveryBundle() {
    const backup = await this.exportBackup();
    return {
      format: 'renovagent-local-recovery' as const,
      databaseVersion: 1,
      rawWorkspace: backup.workspace,
      blobs: backup.blobs,
    };
  }
  close() {}
}
