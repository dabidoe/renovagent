import { createHash } from 'node:crypto';
import type { Collection } from 'mongodb';
import { DomainError, type StudioDesign } from '@renovagent/contracts';
import type { DesignImageStore } from './design-images.js';
import type { MongoWorkspaceRepository } from './repository.js';
import { readStudioDesign, saveStudioDesign, studioImageHashes } from './studio-designs.js';

type Share = {
  _id: string;
  ownerId: string;
  projectId: string;
  revision: number;
  snapshot: StudioDesign;
  createdAt: string;
  revoked: boolean;
};

// A share publishes one fixed revision and only its referenced images. It is
// never an account session or authority to edit the original workspace.
export class StudioShares {
  readonly shares: Collection<Share>;
  constructor(readonly images: DesignImageStore) {
    this.shares = images.db.collection<Share>('studio_shares');
  }
  async create(
    repo: MongoWorkspaceRepository,
    projectId: string,
    revision: number,
    requestId: string,
  ) {
    const saved = await readStudioDesign(repo, projectId, revision);
    const token = createHash('sha256').update(`${repo.ownerId}\0${requestId}`).digest('base64url');
    const prior = await this.shares.findOne({ _id: token });
    if (prior && (prior.projectId !== projectId || prior.revision !== revision || prior.revoked))
      throw new DomainError('CONFLICT', 'Use a new share request for this revision');
    await this.shares.updateOne(
      { _id: token },
      {
        $setOnInsert: {
          _id: token,
          ownerId: repo.ownerId,
          projectId,
          revision,
          snapshot: saved.snapshot,
          createdAt: new Date().toISOString(),
          revoked: false,
        },
      },
      { upsert: true },
    );
    return { token, revision };
  }
  private async get(token: string) {
    const share = /^[A-Za-z0-9_-]{43}$/.test(token)
      ? await this.shares.findOne({ _id: token, revoked: false })
      : null;
    if (!share) throw new DomainError('NOT_FOUND', 'This shared project is unavailable');
    return share;
  }
  async read(token: string) {
    const share = await this.get(token);
    const snapshot = JSON.parse(
      JSON.stringify(share.snapshot).replace(
        /\/api\/workspace\/design-images\/([a-f0-9]{64})/g,
        `/api/workspace/shared-designs/${token}/images/$1`,
      ),
    ) as StudioDesign;
    return { snapshot, revision: share.revision, createdAt: share.createdAt };
  }
  async image(token: string, sha: string) {
    const share = await this.get(token);
    if (!studioImageHashes(share.snapshot).has(sha))
      throw new DomainError('NOT_FOUND', 'This image is not part of the shared project');
    const image = await this.images.get(share.ownerId, sha);
    if (!image) throw new DomainError('NOT_FOUND', 'Shared image is unavailable');
    return image;
  }
  async copy(token: string, repo: MongoWorkspaceRepository, requestId: string) {
    const share = await this.get(token);
    for (const sha of studioImageHashes(share.snapshot)) {
      const image = await this.images.get(share.ownerId, sha);
      if (!image) throw new DomainError('NOT_FOUND', 'Shared image is unavailable');
      await this.images.put(
        repo.ownerId,
        {
          bytes: image.bytes,
          width: image.record.width,
          height: image.record.height,
          mediaType: image.mediaType,
        },
        image.record.source,
      );
    }
    const snapshot = structuredClone(share.snapshot);
    // Stable for a retried copy, separate from the source's browser storage keys.
    snapshot.project.id = `copy-${createHash('sha256').update(`${repo.ownerId}\0${token}\0${requestId}`).digest('hex').slice(0, 24)}`;
    return saveStudioDesign(repo, this.images, {
      requestId: `share-copy:${requestId}`,
      expectedRevision: 0,
      snapshot,
    });
  }
  async list(ownerId: string, projectId: string) {
    return (
      await this.shares
        .find({ ownerId, projectId, revoked: false })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray()
    ).map((share) => ({ token: share._id, revision: share.revision, createdAt: share.createdAt }));
  }
  async revoke(token: string, ownerId: string) {
    const result = await this.shares.updateOne(
      { _id: token, ownerId },
      { $set: { revoked: true } },
    );
    if (!result.matchedCount) throw new DomainError('NOT_FOUND', 'No such shared project');
    return { revoked: true };
  }
}
