import {
  DomainError,
  emptyWorkspace,
  workspaceSchema,
  migrateWorkspace,
  type CommandContext,
  type CommandResult,
  type Workspace,
} from '@renovagent/contracts';
import {
  validateWorkspaceIntegrity,
  handleCommand,
  type AttachmentBlob,
  type ProjectRepository,
} from '@renovagent/core';
import { openDatabase } from './migrations.js';
const requestValue = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
export class IndexedDbProjectRepository implements ProjectRepository {
  private constructor(
    private db: IDBDatabase,
    private ownerId: string,
  ) {}
  static async open(options: { name: string; ownerId: string; factory?: IDBFactory }) {
    const factory = options.factory || globalThis.indexedDB;
    if (!factory) throw new DomainError('STORAGE', 'IndexedDB is not available');
    return new IndexedDbProjectRepository(
      await openDatabase(options.name, factory),
      options.ownerId,
    );
  }
  private parse(raw: unknown): Workspace {
    const value = workspaceSchema.safeParse(migrateWorkspace(raw) ?? emptyWorkspace(this.ownerId));
    if (!value.success)
      throw new DomainError(
        'STORAGE',
        'Stored workspace needs migration or recovery; original data was preserved',
        { reason: value.error.message },
      );
    if (value.data.ownerId !== this.ownerId)
      throw new DomainError('FORBIDDEN', 'Local database belongs to another owner');
    try {
      validateWorkspaceIntegrity(value.data);
    } catch (e) {
      throw new DomainError(
        'STORAGE',
        'Stored workspace references need recovery; original data was preserved',
        { reason: String(e) },
      );
    }
    return value.data;
  }
  async read(): Promise<Workspace> {
    const tx = this.db.transaction('snapshots', 'readonly');
    return structuredClone(
      this.parse(await requestValue(tx.objectStore('snapshots').get('workspace'))),
    );
  }
  execute(
    command: unknown,
    context: CommandContext,
    blobs: AttachmentBlob[] = [],
  ): Promise<CommandResult> {
    return this.executeBatch([command], context, blobs).then((results) => results[0]);
  }
  async executeBatch(
    commands: unknown[],
    context: CommandContext,
    blobs: AttachmentBlob[] = [],
  ): Promise<CommandResult[]> {
    if (context.ownerId !== this.ownerId)
      return Promise.reject(new DomainError('FORBIDDEN', 'Repository owner mismatch'));
    const digests = new Map(
      await Promise.all(
        blobs.map(async (supplied) => {
          if (!(supplied.blob instanceof Blob))
            throw new DomainError('VALIDATION', 'Attachment must be a Blob');
          const hash = await crypto.subtle.digest('SHA-256', await supplied.blob.arrayBuffer());
          return [
            supplied.id,
            Array.from(new Uint8Array(hash), (n) => n.toString(16).padStart(2, '0')).join(''),
          ] as const;
        }),
      ),
    );
    return new Promise((resolve, reject) => {
      let failure: unknown,
        results: CommandResult[] = [];
      const tx = this.db.transaction(['snapshots', 'blobs'], 'readwrite');
      tx.oncomplete = () => resolve(results);
      tx.onabort = () =>
        reject(
          failure ||
            new DomainError('STORAGE', 'Atomic local write aborted', { reason: tx.error?.message }),
        );
      tx.onerror = () => {
        /* onabort reports transaction failure; no partial results escape. */
      };
      const get = tx.objectStore('snapshots').get('workspace');
      get.onsuccess = () => {
        try {
          let state = this.parse(get.result);
          const original = state;
          const ids = new Set(blobs.map((b) => b.id));
          if (ids.size !== blobs.length)
            throw new DomainError('VALIDATION', 'Duplicate supplied blob IDs');
          for (const command of commands) {
            const outcome = handleCommand(state, command, context);
            state = outcome.state;
            results.push(outcome.result);
          }
          const newAttachments = Object.values(state.evidence)
            .filter((e) => !original.evidence[e.id] && e.source.attachment)
            .map((e) => e.source.attachment!);
          if (new Set(newAttachments.map((a) => a.blobId)).size !== newAttachments.length)
            throw new DomainError('VALIDATION', 'Each attachment must have its own blob ID');
          const existingBlobIds = new Set(
            Object.values(original.evidence).flatMap((e) =>
              e.source.attachment ? [e.source.attachment.blobId] : [],
            ),
          );
          for (const attachment of newAttachments) {
            const supplied = blobs.find((b) => b.id === attachment.blobId);
            if (!supplied || existingBlobIds.has(supplied.id))
              throw new DomainError('VALIDATION', 'New attachment requires a new supplied blob');
            if (
              !supplied.blob.size ||
              supplied.blob.type !== attachment.mediaType ||
              digests.get(supplied.id) !== attachment.sha256
            )
              throw new DomainError(
                'VALIDATION',
                'Attachment content missing or media type mismatch',
              );
          }
          for (const supplied of blobs) {
            const added = newAttachments.some((a) => a.blobId === supplied.id);
            const existing = Object.values(original.evidence).find(
              (e) => e.source.attachment?.blobId === supplied.id,
            )?.source.attachment;
            if (
              !added &&
              (!existing ||
                existing.sha256 !== digests.get(supplied.id) ||
                existing.mediaType !== supplied.blob.type)
            )
              throw new DomainError(
                'VALIDATION',
                'Blob is unused or differs from the committed attachment',
              );
            if (added) tx.objectStore('blobs').add(supplied.blob, supplied.id);
          }
          tx.objectStore('snapshots').put(state, 'workspace');
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
    });
  }
  async readBlob(id: string) {
    // Resolve authorization and data from the same readonly snapshot transaction.
    const tx = this.db.transaction(['snapshots', 'blobs'], 'readonly');
    const stateRequest = requestValue(tx.objectStore('snapshots').get('workspace'));
    const blobRequest = requestValue(tx.objectStore('blobs').get(id));
    const [raw, blob] = await Promise.all([stateRequest, blobRequest]);
    const state = this.parse(raw);
    return Object.values(state.evidence).some((e) => e.source.attachment?.blobId === id)
      ? (blob as Blob | undefined)
      : undefined;
  }
  async exportBackup() {
    const tx = this.db.transaction(['snapshots', 'blobs'], 'readonly');
    const raw = requestValue(tx.objectStore('snapshots').get('workspace'));
    const keys = requestValue(tx.objectStore('blobs').getAllKeys());
    const values = requestValue(tx.objectStore('blobs').getAll());
    const [snapshot, ids, blobs] = await Promise.all([raw, keys, values]);
    return {
      format: 'renovagent-local-backup' as const,
      schemaVersion: 1 as const,
      workspace: this.parse(snapshot),
      blobs: ids.map((id, i) => ({ id: String(id), blob: blobs[i] as Blob })),
    };
  }
  async exportRecoveryBundle() {
    // Read-only escape hatch for unknown/corrupt schemas. Never repairs or discards source data.
    const tx = this.db.transaction(['snapshots', 'blobs'], 'readonly');
    const [rawWorkspace, ids, values] = await Promise.all([
      requestValue(tx.objectStore('snapshots').get('workspace')),
      requestValue(tx.objectStore('blobs').getAllKeys()),
      requestValue(tx.objectStore('blobs').getAll()),
    ]);
    if (rawWorkspace && (typeof rawWorkspace !== 'object' || rawWorkspace.ownerId !== this.ownerId))
      throw new DomainError('FORBIDDEN', 'Cannot export another owner’s recovery data');
    return {
      format: 'renovagent-local-recovery' as const,
      databaseVersion: this.db.version,
      rawWorkspace: rawWorkspace as unknown,
      blobs: ids.map((id, i) => ({ id: String(id), blob: values[i] as Blob })),
    };
  }
  close() {
    this.db.close();
  }
}
