import type { CommandContext, CommandResult, Workspace } from '@renovagent/contracts';
export type AttachmentBlob = { id: string; blob: Blob };
export interface ProjectRepository {
  read(): Promise<Workspace>;
  execute(
    command: unknown,
    context: CommandContext,
    blobs?: AttachmentBlob[],
  ): Promise<CommandResult>;
  executeBatch(
    commands: unknown[],
    context: CommandContext,
    blobs?: AttachmentBlob[],
  ): Promise<CommandResult[]>;
  readBlob(id: string): Promise<Blob | undefined>;
  exportBackup(): Promise<{
    format: 'renovagent-local-backup';
    schemaVersion: 1;
    workspace: Workspace;
    blobs: AttachmentBlob[];
  }>;
  exportRecoveryBundle(): Promise<{
    format: 'renovagent-local-recovery';
    databaseVersion: number;
    rawWorkspace: unknown;
    blobs: AttachmentBlob[];
  }>;
  close(): void;
}
