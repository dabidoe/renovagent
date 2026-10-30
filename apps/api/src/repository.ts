import { createHash } from 'node:crypto';
import { Binary, MongoClient, MongoServerError, type Collection, type Db } from 'mongodb';
import {
  DomainError,
  emptyWorkspace,
  migrateWorkspace,
  workspaceSchema,
  type Workspace,
  type CommandResult,
} from '@renovagent/contracts';
import { handleCommand, validateWorkspaceIntegrity } from '@renovagent/core';
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
  // Legacy: attachments once lived here and hit Mongo's 16 MB document cap.
  // `ensure()` moves them to `workspace_blobs`; it stays empty afterwards.
  blobs: StoredBlob[];
  jobs: PhotoJob[];
};
// One document per attachment, so an owner's total is no longer capped at
// 16 MB. Each document holds one upload (the API caps a blob at 12 MB base64).
export type BlobRecord = {
  _id: { ownerId: string; blobId: string };
  mediaType: string;
  sha256: string;
  size: number;
  bytes: Binary;
};
export const BLOB_COLLECTION = 'workspace_blobs';
const bytes = (b: StoredBlob) => Buffer.from(b.data, 'base64');
const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');
export function checkedWorkspace(raw: unknown, ownerId = OWNER) {
  const state = workspaceSchema.parse(migrateWorkspace(raw));
  if (state.ownerId !== ownerId) throw new DomainError('FORBIDDEN', 'Workspace owner mismatch');
  validateWorkspaceIntegrity(state);
  return state;
}
const attachmentRefs = (state: Workspace) =>
  Object.values(state.evidence).flatMap((e) => (e.source.attachment ? [e.source.attachment] : []));

// A complete snapshot (import, backup, migration): exactly one matching blob per reference.
export function validateBlobs(state: Workspace, blobs: StoredBlob[]) {
  if (new Set(blobs.map((b) => b.id)).size !== blobs.length)
    throw new DomainError('VALIDATION', 'Duplicate attachment IDs');
  const refs = attachmentRefs(state);
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
      sha256(bytes(blob)) !== ref.sha256
    )
      throw new DomainError('VALIDATION', 'Attachment content or hash mismatch');
  }
}
export class MongoWorkspaceRepository {
  constructor(
    readonly collection: Collection<Aggregate>,
    readonly blobStore: Collection<BlobRecord>,
    readonly ownerId: string = OWNER,
  ) {}
  static forDb(db: Db, ownerId = OWNER) {
    return new MongoWorkspaceRepository(
      db.collection<Aggregate>('workspace_aggregates'),
      db.collection<BlobRecord>(BLOB_COLLECTION),
      ownerId,
    );
  }
  forUser(userId: string) {
    return new MongoWorkspaceRepository(this.collection, this.blobStore, userId);
  }
  async ensure() {
    await this.collection.updateOne(
      { _id: this.ownerId },
      {
        $setOnInsert: { version: 0, workspace: emptyWorkspace(this.ownerId), blobs: [], jobs: [] },
      },
      { upsert: true },
    );
    await this.blobStore.createIndex({ '_id.ownerId': 1, '_id.blobId': 1 });
    await this.moveEmbeddedBlobs();
  }
  // Idempotent: copies are content-checked, and the aggregate is cleared only
  // after every embedded blob is stored.
  async moveEmbeddedBlobs() {
    const doc = await this.collection.findOne({ _id: this.ownerId });
    if (!doc?.blobs?.length) return;
    await this.putBlobs(doc.blobs);
    await this.update((d) => {
      d.blobs = [];
    });
  }
  // Insert-if-absent. Orphans from a later failed commit are unreferenced and harmless.
  async putBlobs(blobs: StoredBlob[]) {
    for (const blob of blobs) {
      const data = bytes(blob);
      const record: BlobRecord = {
        _id: { ownerId: this.ownerId, blobId: blob.id },
        mediaType: blob.mediaType,
        sha256: sha256(data),
        size: data.length,
        bytes: new Binary(data),
      };
      try {
        await this.blobStore.insertOne(record);
      } catch (error) {
        if (!(error instanceof MongoServerError && error.code === 11000)) throw error;
        const prior = await this.blobStore.findOne(
          { _id: record._id },
          { projection: { bytes: 0 } },
        );
        if (prior?.sha256 !== record.sha256 || prior.mediaType !== record.mediaType)
          throw new DomainError('VALIDATION', 'Cannot overwrite an attachment');
      }
    }
  }
  async readBlob(blobId: string) {
    const record = await this.blobStore.findOne({ _id: { ownerId: this.ownerId, blobId } });
    return record ? { mediaType: record.mediaType, bytes: Buffer.from(record.bytes.buffer) } : null;
  }
  // Exact compound ids use the _id index; queries on `_id.*` subfields scan the
  // whole collection (every owner's attachments).
  private storedMeta(blobIds: string[]) {
    return this.blobStore
      .find(
        { _id: { $in: blobIds.map((blobId) => ({ ownerId: this.ownerId, blobId })) } },
        { projection: { bytes: 0 } },
      )
      .toArray();
  }
  // References this commit adds have stored bytes with the same type and hash;
  // earlier ones were checked when they were committed.
  private async assertStored(state: Workspace, before: Workspace) {
    const refs = attachmentRefs(state);
    if (new Set(refs.map((a) => a.blobId)).size !== refs.length)
      throw new DomainError('VALIDATION', 'Attachment IDs must be unique');
    const known = new Set(attachmentRefs(before).map((r) => `${r.blobId}\n${r.sha256}`));
    const added = refs.filter((r) => !known.has(`${r.blobId}\n${r.sha256}`));
    if (!added.length) return;
    const stored = await this.storedMeta(added.map((r) => r.blobId));
    for (const ref of added) {
      const blob = stored.find((b) => b._id.blobId === ref.blobId);
      if (!blob || blob.mediaType !== ref.mediaType || blob.sha256 !== ref.sha256 || !blob.size)
        throw new DomainError('VALIDATION', 'Attachment content or hash mismatch');
    }
  }
  // Backup only; served by the owner index created in ensure().
  async listBlobs(): Promise<StoredBlob[]> {
    const records = await this.blobStore
      .find({ '_id.ownerId': this.ownerId })
      .sort({ '_id.ownerId': 1, '_id.blobId': 1 })
      .toArray();
    return records.map((r) => ({
      id: r._id.blobId,
      mediaType: r.mediaType,
      data: Buffer.from(r.bytes.buffer).toString('base64'),
    }));
  }
  static async connect(uri: string) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    const repository = MongoWorkspaceRepository.forDb(client.db());
    await repository.ensure();
    await repository.adoptLegacyDatabase(client);
    return { repository, client };
  }
  // One-time rename adoption: if the new default database is empty but the
  // pre-rename database holds the local workspace, copy it once. Custom
  // database names and per-user aggregates are never touched.
  private async adoptLegacyDatabase(client: MongoClient) {
    if (this.ownerId !== OWNER || client.db().databaseName !== 'renovagent_workspace') return;
    if (Object.keys((await this.read()).workspace.projects).length) return;
    const legacy = await client
      .db('unpermitted_workspace')
      .collection<Aggregate>('workspace_aggregates')
      .findOne({ _id: OWNER });
    if (!legacy || !Object.keys(legacy.workspace.projects).length) return;
    await this.update((doc) => {
      doc.workspace = legacy.workspace;
      doc.blobs = legacy.blobs;
      doc.jobs = legacy.jobs;
    });
    await this.moveEmbeddedBlobs();
  }
  async read() {
    const doc = await this.collection.findOne({ _id: this.ownerId });
    if (!doc) throw new DomainError('STORAGE', 'Workspace is unavailable');
    checkedWorkspace(doc.workspace, this.ownerId);
    return doc;
  }
  async update<T>(apply: (doc: Aggregate) => T | Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const doc = await this.read(),
        version = doc.version;
      const result = await apply(doc);
      checkedWorkspace(doc.workspace, this.ownerId);
      // Snapshot, idempotency records, events and jobs commit in ONE atomic CAS.
      // Attachment bytes are stored first (immutable, content-checked), so a
      // committed reference always has its bytes; no multi-document transaction.
      if (Buffer.byteLength(JSON.stringify(doc)) > 14 * 1024 * 1024)
        throw new DomainError(
          'STORAGE',
          'Workspace exceeds the 14 MB local Mongo aggregate limit. Original state was preserved.',
        );
      doc.version = version + 1;
      const saved = await this.collection.replaceOne({ _id: this.ownerId, version }, doc);
      if (saved.modifiedCount === 1) return result;
    }
    throw new DomainError('CONFLICT', 'Workspace changed; reload and retry');
  }
  async importWorkspace(raw: unknown, blobs: StoredBlob[]) {
    const state = checkedWorkspace(raw, this.ownerId);
    validateBlobs(state, blobs);
    const existing = await this.read();
    if (Object.keys(existing.workspace.projects).length || existing.jobs.length)
      throw new DomainError(
        'CONFLICT',
        'Mongo already contains a workspace. Open that workspace; the local original remains intact.',
      );
    await this.putBlobs(blobs);
    return this.update((doc) => {
      if (Object.keys(doc.workspace.projects).length || doc.jobs.length)
        throw new DomainError(
          'CONFLICT',
          'Mongo already contains a workspace. Open that workspace; the local original remains intact.',
        );
      doc.workspace = state;
      return state;
    });
  }
  async execute(commands: unknown[], supplied: StoredBlob[] = []): Promise<CommandResult[]> {
    if (new Set(supplied.map((b) => b.id)).size !== supplied.length)
      throw new DomainError('VALIDATION', 'Duplicate attachment IDs');
    // Check bytes against the references this batch would create before storing
    // any, so wrong bytes are never kept under an id the retry needs.
    if (supplied.length) {
      const stored = await this.storedMeta(supplied.map((b) => b.id));
      for (const blob of supplied) {
        const prior = stored.find((r) => r._id.blobId === blob.id);
        if (prior && (prior.sha256 !== sha256(bytes(blob)) || prior.mediaType !== blob.mediaType))
          throw new DomainError('VALIDATION', 'Cannot overwrite an attachment');
      }
      this.matchSupplied(this.apply((await this.read()).workspace, commands).state, supplied);
    }
    await this.putBlobs(supplied);
    return this.update(async (doc) => {
      const { state, results } = this.apply(doc.workspace, commands);
      this.matchSupplied(state, supplied);
      await this.assertStored(state, doc.workspace);
      doc.workspace = state;
      return results;
    });
  }
  private apply(start: Workspace, commands: unknown[]) {
    let state = start;
    const results: CommandResult[] = [];
    for (const command of commands) {
      const outcome = handleCommand(state, command, {
        ownerId: this.ownerId,
        now: new Date().toISOString(),
      });
      state = outcome.state;
      results.push(outcome.result);
    }
    return { state, results };
  }
  // Every supplied blob belongs to a reference in the state, with its type and hash.
  private matchSupplied(state: Workspace, supplied: StoredBlob[]) {
    const refs = attachmentRefs(state);
    for (const blob of supplied) {
      const ref = refs.find((r) => r.blobId === blob.id);
      if (!ref) throw new DomainError('VALIDATION', 'Attachment bytes and evidence must match');
      if (ref.mediaType !== blob.mediaType || sha256(bytes(blob)) !== ref.sha256)
        throw new DomainError('VALIDATION', 'Attachment content or hash mismatch');
    }
  }
}
