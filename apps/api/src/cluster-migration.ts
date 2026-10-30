import { createHash } from 'node:crypto';
import { BSON } from 'mongodb';
import type { Db, MongoClient } from 'mongodb';
import { DomainError, emptyWorkspace } from '@renovagent/contracts';
import { checkCatalogReferences, fingerprint, validateCatalogImport } from '@renovagent/core';
import {
  BLOB_COLLECTION,
  checkedWorkspace,
  validateBlobs,
  type Aggregate,
  type BlobRecord,
} from './repository.js';
import { photoJobFile, type PhotoJobFile } from './photo-job-files.js';

// `_id` is a string except for blob records, whose compound ids go through idKey.
export type MigrationRecord = { _id: string; [key: string]: unknown };
export type MigrationSnapshot = Record<string, MigrationRecord[]>;
export const migrationCollections = [
  'workspace_aggregates',
  BLOB_COLLECTION,
  'catalog_products',
  'retailer_offers',
  'price_observations',
  'photo_job_files',
] as const;
export const snapshotHash = (value: unknown) =>
  createHash('sha256')
    .update(fingerprint(BSON.EJSON.serialize(value, { relaxed: false })))
    .digest('hex');
const workspaceContent = ({ workspace, blobs, jobs }: Aggregate) => ({ workspace, blobs, jobs });
// Blob records have compound ids; compare every id by value.
export const idKey = (id: unknown) => (typeof id === 'string' ? id : snapshotHash(id));
const sameId = (a: MigrationRecord, b: MigrationRecord) => idKey(a._id) === idKey(b._id);
const blobBytes = (r: BlobRecord) => Buffer.from(r.bytes.buffer);

export function validateMigration(source: MigrationSnapshot, destination: MigrationSnapshot) {
  const workspaces = source.workspace_aggregates as unknown as Aggregate[];
  if (!workspaces?.length) throw new DomainError('VALIDATION', 'No source workspaces');
  const blobRecords = (source[BLOB_COLLECTION] ?? []) as unknown as BlobRecord[];
  for (const r of blobRecords)
    if (
      !workspaces.some((w) => w._id === r._id.ownerId) ||
      createHash('sha256').update(blobBytes(r)).digest('hex') !== r.sha256
    )
      throw new DomainError(
        'VALIDATION',
        'Attachment outside source workspace or checksum mismatch',
      );
  for (const doc of workspaces) {
    const state = checkedWorkspace(doc.workspace, doc._id);
    // Each workspace's references against its stored (and any still-embedded) bytes.
    const stored = blobRecords
      .filter((r) => r._id.ownerId === doc._id)
      .map((r) => ({
        id: r._id.blobId,
        mediaType: r.mediaType,
        data: blobBytes(r).toString('base64'),
      }));
    validateBlobs(state, [...(doc.blobs ?? []), ...stored]);
    if (doc.jobs.some((j) => ['queued', 'running'].includes(j.status)))
      throw new DomainError(
        'CONFLICT',
        'Finish or cancel active source photo jobs before migration',
      );
    if (
      new Set(doc.jobs.map((j) => j.id)).size !== doc.jobs.length ||
      doc.jobs.some((j) => !state.projects[j.projectId])
    )
      throw new DomainError('VALIDATION', 'Invalid source photo job membership');
  }
  const withoutId = (rows: MigrationRecord[] = []) =>
    rows.map(({ _id, ...row }) => {
      if (row.id !== _id) throw new DomainError('VALIDATION', 'Catalog identity mismatch');
      return row;
    });
  const batch = validateCatalogImport({
    products: withoutId(source.catalog_products),
    offers: withoutId(source.retailer_offers),
    observations: withoutId(source.price_observations),
  });
  checkCatalogReferences(batch, { products: new Set(), offers: new Set() });
  for (const raw of source.photo_job_files ?? []) {
    const file = raw as unknown as PhotoJobFile;
    if (
      !workspaces.some((w) => w._id === file.ownerId && w.jobs.some((j) => j.id === file.jobId)) ||
      snapshotHash(photoJobFile(file.ownerId, file.jobId, file.name, file.text)) !==
        snapshotHash(file)
    )
      throw new DomainError(
        'VALIDATION',
        'Private file outside source workspace or checksum mismatch',
      );
  }
  for (const name of migrationCollections) {
    const rows = source[name] ?? [];
    if (new Set(rows.map((row) => idKey(row._id))).size !== rows.length)
      throw new DomainError('VALIDATION', 'Duplicate migration record');
    for (const row of rows) {
      const prior = (destination[name] ?? []).find((r) => sameId(r, row));
      if (!prior) continue;
      if (name === 'workspace_aggregates') {
        const a = prior as unknown as Aggregate,
          b = row as unknown as Aggregate;
        const blank = { workspace: emptyWorkspace(a._id), blobs: [], jobs: [] };
        // A destination that already moved its (empty) blob list out is still blank.
        if (
          snapshotHash(workspaceContent(a)) === snapshotHash(blank) ||
          snapshotHash(workspaceContent(a)) === snapshotHash(workspaceContent(b))
        )
          continue;
      } else if (snapshotHash(prior) === snapshotHash(row)) continue;
      throw new DomainError(
        'CONFLICT',
        `Destination ${name} already has different content; nothing was overwritten`,
      );
    }
  }
}

export async function readMigrationSnapshot(db: Db): Promise<MigrationSnapshot> {
  const result: MigrationSnapshot = {};
  for (const name of migrationCollections)
    result[name] = await db.collection<MigrationRecord>(name).find({}).sort({ _id: 1 }).toArray();
  return result;
}

// Atlas transactions prevent an interrupted transfer from leaving half a workspace/catalog.
// The caller saves a private backup and rechecks its source snapshot before applying.
export async function applyMigration(client: MongoClient, source: MigrationSnapshot) {
  const session = client.startSession();
  try {
    await session.withTransaction(
      async () => {
        const db = client.db();
        const destination: MigrationSnapshot = {};
        for (const name of migrationCollections)
          destination[name] = await db
            .collection<MigrationRecord>(name)
            .find({}, { session })
            .toArray();
        validateMigration(source, destination);
        for (const name of migrationCollections) {
          const collection = db.collection<MigrationRecord>(name);
          for (const row of source[name] ?? []) {
            const prior = destination[name].find((r) => sameId(r, row));
            if (name === 'workspace_aggregates') {
              if (
                prior &&
                snapshotHash(workspaceContent(prior as unknown as Aggregate)) ===
                  snapshotHash(workspaceContent(row as unknown as Aggregate))
              )
                continue;
              const replacement = {
                ...row,
                version: Math.max(Number(row.version), Number(prior?.version ?? 0)) + 1,
              };
              if (prior) await collection.replaceOne({ _id: row._id }, replacement, { session });
              else await collection.insertOne(replacement, { session });
            } else if (!prior) await collection.insertOne(row, { session });
          }
        }
      },
      { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } },
    );
  } finally {
    await session.endSession();
  }
}
