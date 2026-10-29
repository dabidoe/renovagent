import { createHash } from 'node:crypto';
import type { Collection, Db } from 'mongodb';
import { DomainError, id } from '@renovagent/contracts';

export type PhotoJobFile = {
  _id: string;
  ownerId: string;
  jobId: string;
  name: string;
  text: string;
  sha256: string;
};

// Private execution inputs/receipts live outside the bounded workspace aggregate.
// HTTP reads still require a saved photo hash and a job in the caller's workspace.
export function photoJobFile(
  ownerId: string,
  jobId: string,
  name: string,
  text: string,
): PhotoJobFile {
  id.parse(ownerId);
  id.parse(jobId);
  if (
    !name.endsWith('.json') ||
    !name
      .split('/')
      .every((part) => /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(part) && !part.includes('..')) ||
    Buffer.byteLength(text) > 14 * 1024 * 1024
  )
    throw new DomainError('VALIDATION', 'Invalid private photo job file');
  JSON.parse(text);
  const sha256 = createHash('sha256').update(text).digest('hex');
  return {
    _id: createHash('sha256')
      .update(JSON.stringify([ownerId, jobId, name]))
      .digest('hex'),
    ownerId,
    jobId,
    name,
    text,
    sha256,
  };
}

export class PhotoJobFiles {
  readonly collection: Collection<PhotoJobFile>;
  constructor(db: Db) {
    this.collection = db.collection<PhotoJobFile>('photo_job_files');
  }
  async get(ownerId: string, jobId: string, name: string) {
    const key = photoJobFile(ownerId, jobId, name, '{}');
    const record = await this.collection.findOne({ _id: key._id, ownerId, jobId, name });
    if (!record) return null;
    if (photoJobFile(ownerId, jobId, name, record.text).sha256 !== record.sha256)
      throw new DomainError('STORAGE', 'Private photo file checksum mismatch');
    return record.text;
  }
  async put(ownerId: string, jobId: string, name: string, text: string) {
    const record = photoJobFile(ownerId, jobId, name, text);
    // Cached inputs are immutable. Never replace original pixels on a retry.
    await this.collection.updateOne(
      { _id: record._id },
      { $setOnInsert: record },
      { upsert: true },
    );
    if ((await this.get(ownerId, jobId, name)) !== text)
      throw new DomainError('CONFLICT', 'Private photo file already has different content');
  }
}
