import { createHash } from 'node:crypto';
import { MongoClient, type Collection } from 'mongodb';
import {
  DomainError,
  emptyWorkspace,
  migrateWorkspace,
  workspaceSchema,
  type Workspace,
  type CommandResult,
} from '@unpermitted/contracts';
import { handleCommand, validateWorkspaceIntegrity } from '@unpermitted/core';
export const OWNER = 'local-homeowner';
export type StoredBlob = { id: string; mediaType: string; data: string };
export type PhotoJob = {
  id: string;
  requestId: string;
  projectId: string;
  photoIds: string[];
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'stale' | 'cancelled';
  stage: string;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  input: {
    addressId: string;
    addressRevision: number;
    goalId: string;
    goalRevision: number;
    researchRevision: number;
    inventoryRevision: number;
  };
  error: string | null;
  cancelRequested: boolean;
  completedResearchRevision?: number;
  leaseOwner?: string;
  leaseExpiresAt?: number;
};
export type Aggregate = {
  _id: string;
  version: number;
  workspace: Workspace;
  blobs: StoredBlob[];
  jobs: PhotoJob[];
};
const bytes = (b: StoredBlob) => Buffer.from(b.data, 'base64');
export function checkedWorkspace(raw: unknown) {
  const state = workspaceSchema.parse(migrateWorkspace(raw));
  if (state.ownerId !== OWNER) throw new DomainError('FORBIDDEN', 'Workspace owner mismatch');
  validateWorkspaceIntegrity(state);
  return state;
}
export function validateBlobs(state: Workspace, blobs: StoredBlob[]) {
  if (new Set(blobs.map((b) => b.id)).size !== blobs.length)
    throw new DomainError('VALIDATION', 'Duplicate attachment IDs');
  const refs = Object.values(state.evidence).flatMap((e) =>
    e.source.attachment ? [e.source.attachment] : [],
  );
  if (new Set(refs.map((a) => a.blobId)).size !== refs.length)
    throw new DomainError('VALIDATION', 'Attachment IDs must be unique');
  if (refs.length !== blobs.length)
    throw new DomainError('VALIDATION', 'Attachment bytes and evidence must match');
  for (const ref of refs) {
    const blob = blobs.find((b) => b.id === ref.blobId);
    if (
      !blob ||
      blob.mediaType !== ref.mediaType ||
      !bytes(blob).length ||
      createHash('sha256').update(bytes(blob)).digest('hex') !== ref.sha256
    )
      throw new DomainError('VALIDATION', 'Attachment content or hash mismatch');
  }
}
export class MongoWorkspaceRepository {
  constructor(readonly collection: Collection<Aggregate>) {}
  static async connect(uri: string) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    const repository = new MongoWorkspaceRepository(
      client.db().collection<Aggregate>('workspace_aggregates'),
    );
    await repository.collection.updateOne(
      { _id: OWNER },
      { $setOnInsert: { version: 0, workspace: emptyWorkspace(OWNER), blobs: [], jobs: [] } },
      { upsert: true },
    );
    return { repository, client };
  }
  async read() {
    const doc = await this.collection.findOne({ _id: OWNER });
    if (!doc) throw new DomainError('STORAGE', 'Workspace is unavailable');
    checkedWorkspace(doc.workspace);
    return doc;
  }
  async update<T>(apply: (doc: Aggregate) => T): Promise<T> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const doc = await this.read(),
        version = doc.version;
      const result = apply(doc);
      checkedWorkspace(doc.workspace);
      // Embed snapshot, idempotency records, events, attachments and jobs in ONE atomic CAS.
      // This bounded local increment does not need replica-set multi-document transactions.
      if (Buffer.byteLength(JSON.stringify(doc)) > 14 * 1024 * 1024)
        throw new DomainError(
          'STORAGE',
          'Workspace exceeds the 14 MB local Mongo aggregate limit. Original state was preserved.',
        );
      doc.version = version + 1;
      const saved = await this.collection.replaceOne({ _id: OWNER, version }, doc);
      if (saved.modifiedCount === 1) return result;
    }
    throw new DomainError('CONFLICT', 'Workspace changed; reload and retry');
  }
  async importWorkspace(raw: unknown, blobs: StoredBlob[]) {
    const state = checkedWorkspace(raw);
    validateBlobs(state, blobs);
    return this.update((doc) => {
      if (Object.keys(doc.workspace.projects).length || doc.jobs.length)
        throw new DomainError(
          'CONFLICT',
          'Mongo already contains a workspace. Open that workspace; the local original remains intact.',
        );
      doc.workspace = state;
      doc.blobs = blobs;
      return state;
    });
  }
  async execute(commands: unknown[], supplied: StoredBlob[] = []): Promise<CommandResult[]> {
    return this.update((doc) => {
      let state = doc.workspace;
      const results: CommandResult[] = [];
      for (const command of commands) {
        const outcome = handleCommand(state, command, {
          ownerId: OWNER,
          now: new Date().toISOString(),
        });
        state = outcome.state;
        results.push(outcome.result);
      }
      const blobs = [...doc.blobs];
      for (const blob of supplied) {
        const existing = blobs.find((b) => b.id === blob.id);
        if (existing && (existing.data !== blob.data || existing.mediaType !== blob.mediaType))
          throw new DomainError('VALIDATION', 'Cannot overwrite an attachment');
        if (!existing) blobs.push(blob);
      }
      validateBlobs(state, blobs);
      doc.workspace = state;
      doc.blobs = blobs;
      return results;
    });
  }
}
