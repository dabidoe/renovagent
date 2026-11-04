import { createHash } from 'node:crypto';
import type { Collection } from 'mongodb';
import { DomainError, type StudioDesign } from '@renovagent/contracts';
import type { DesignImageStore } from './design-images.js';
import type { MongoWorkspaceRepository } from './repository.js';
import { readStudioDesign, saveStudioDesign, studioImageHashes } from './studio-designs.js';
import { startAgentProject } from './agent-projects.js';
import { notebookEntries, ProjectNotebook, type NotebookEntry } from './project-notebook.js';

type Share = {
  _id: string;
  ownerId: string;
  projectId: string;
  revision: number;
  snapshot?: StudioDesign;
  notebook?: NotebookEntry[];
  name?: string;
  brief?: string;
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
    revision: number | undefined,
    requestId: string,
  ) {
    const { workspace } = await repo.read();
    const project = workspace.projects[projectId];
    if (!project) throw new DomainError('NOT_FOUND', 'No such project');
    const hasStudio =
      workspace.artifacts[`${projectId}:studio-design`]?.at(-1)?.payload.kind === 'studio-design';
    const saved = hasStudio ? await readStudioDesign(repo, projectId, revision) : null;
    if (!saved && revision !== undefined && revision !== project.revision)
      throw new DomainError('CONFLICT', 'Share the current notebook revision');
    revision = saved?.revision ?? project.revision;
    const notebook = notebookEntries(workspace, projectId);
    const brief = workspace.artifacts[`${projectId}:agent-brief`]?.at(-1);
    const briefText =
      brief?.payload.kind === 'project-brief'
        ? brief.payload.sections.map((s) => `${s.title}: ${s.text}`).join('\n')
        : undefined;
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
          ...(saved ? { snapshot: saved.snapshot } : {}),
          notebook,
          name: project.name,
          ...(briefText ? { brief: briefText } : {}),
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
    const published = JSON.parse(
      JSON.stringify({ snapshot: share.snapshot, notebook: share.notebook ?? [] }).replace(
        /\/api\/workspace\/design-images\/([a-f0-9]{64})/g,
        `/api/workspace/shared-designs/${token}/images/$1`,
      ),
    );
    return {
      ...published,
      name: share.name ?? share.snapshot?.project.address,
      brief: share.brief,
      revision: share.revision,
      createdAt: share.createdAt,
    };
  }
  private hashes(share: Share) {
    const hashes = share.snapshot ? studioImageHashes(share.snapshot) : new Set<string>();
    for (const entry of share.notebook ?? [])
      for (const image of entry.content.images) hashes.add(image.sha256);
    return hashes;
  }
  async image(token: string, sha: string) {
    const share = await this.get(token);
    if (!this.hashes(share).has(sha))
      throw new DomainError('NOT_FOUND', 'This image is not part of the shared project');
    const image = await this.images.get(share.ownerId, sha);
    if (!image) throw new DomainError('NOT_FOUND', 'Shared image is unavailable');
    return image;
  }
  async copy(token: string, repo: MongoWorkspaceRepository, requestId: string) {
    const share = await this.get(token);
    for (const sha of this.hashes(share)) {
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
    const copyId = createHash('sha256')
      .update(`${repo.ownerId}\0${token}\0${requestId}`)
      .digest('hex')
      .slice(0, 24);
    let saved;
    if (share.snapshot) {
      const snapshot = structuredClone(share.snapshot);
      snapshot.project.id = `copy-${copyId}`;
      saved = await saveStudioDesign(repo, this.images, {
        requestId: `share-copy:${copyId}`,
        expectedRevision: 0,
        snapshot,
      });
    } else
      saved = await startAgentProject(repo, {
        requestId: `notebook-copy:${copyId}`,
        name: share.name ?? 'Shared project',
        brief: share.brief || 'Independent copy of a shared project notebook.',
      });
    const notebook = new ProjectNotebook(repo, this.images);
    for (const entry of share.notebook ?? [])
      await notebook.save(
        {
          projectId: saved.projectId,
          requestId: `copy-entry:${createHash('sha256').update(`${copyId}\0${entry.id}`).digest('hex').slice(0, 32)}`,
          content: entry.content,
        },
        { kind: 'owner', name: `Copied from shared notebook · ${entry.author.name}`.slice(0, 120) },
      );
    return { ...saved, view: share.snapshot ? 'design' : 'notebook' };
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
