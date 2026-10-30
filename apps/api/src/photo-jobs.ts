import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { imageSize } from 'image-size';
import { z } from 'zod';
import {
  DomainError,
  type PropertyResearch,
  type Command,
  type Workspace,
} from '@renovagent/contracts';
import {
  latest,
  propertyAddress,
  researchJobId,
  handleCommand,
  savedPhotoReferences,
  localUploadUrl,
} from '@renovagent/core';
import { runPhotoReview, imageBytes } from '../../../scripts/muse-photo-review.js';
import { runInventory } from '../../../scripts/muse-inventory.js';
import { withMuseBudget } from '../../../scripts/muse-provider.js';
import { MongoWorkspaceRepository, type PhotoJob, type Aggregate } from './repository.js';
import { PhotoJobFiles } from './photo-job-files.js';
const root = resolve('.local/photo-jobs');
export const jobRequestSchema = z
  .object({
    requestId: z.string().uuid(),
    projectId: z.string().min(1).max(160),
    photoIds: z.array(z.string().min(1).max(160)).max(8),
    evidenceIds: z.array(z.string().min(1).max(160)).max(8),
  })
  .strict()
  .refine(
    (v) =>
      v.photoIds.length + v.evidenceIds.length > 0 && v.photoIds.length + v.evidenceIds.length <= 8,
    'Choose one to eight images',
  );
type Photo = { id: string; sourceId: string; pageUrl: string; imageUrl: string; locator: string };
export type StoredPhotoJob = PhotoJob & {
  base: PropertyResearch;
  goal: string;
  photos: Photo[];
  uploads: Record<string, string>;
};
function context(state: Workspace, projectId: string) {
  const address = propertyAddress(state, projectId),
    goal = Object.values(state.facts)
      .map((v) => v.at(-1)!)
      .find((f) => f.projectId === projectId && f.key === 'goal');
  const research = latest(state.artifacts[`${projectId}:property-research`]);
  return { address, goal, research };
}
export function assertJobInputs(state: Workspace, job: PhotoJob) {
  const c = context(state, job.projectId),
    i = job.input;
  if (
    c.address?.id !== i.addressId ||
    c.address.revision !== i.addressRevision ||
    c.goal?.id !== i.goalId ||
    c.goal.revision !== i.goalRevision ||
    (c.research?.revision || 0) !== i.researchRevision ||
    (latest(state.artifacts[`${job.projectId}:photo-inventory`])?.revision || 0) !==
      i.inventoryRevision
  )
    throw new DomainError(
      'STALE',
      'Project goal, address, research or inventory changed during analysis. Results retained for review; request a fresh analysis.',
    );
}
export async function requestPhotoJob(repo: MongoWorkspaceRepository, raw: unknown) {
  const request = jobRequestSchema.parse(raw);
  return repo.update((doc) => {
    const existing = doc.jobs.find((j) => j.requestId === request.requestId);
    if (existing) {
      if (
        existing.projectId !== request.projectId ||
        JSON.stringify(existing.photoIds) !==
          JSON.stringify([...request.photoIds, ...request.evidenceIds])
      )
        throw new DomainError('CONFLICT', 'Request identity reused with different inputs');
      return existing;
    }
    if (doc.jobs.some((j) => j.status === 'queued' || j.status === 'running'))
      throw new DomainError('CONFLICT', 'One photo job may run at a time in this local workspace');
    if (!doc.workspace.projects[request.projectId])
      throw new DomainError('NOT_FOUND', 'Project not found');
    const { address, goal, research } = context(doc.workspace, request.projectId);
    if (address?.value.kind !== 'text' || goal?.value.kind !== 'text')
      throw new DomainError('VALIDATION', 'Save an address and project goal first');
    if (
      research?.payload.kind === 'property-research' &&
      (research.payload.jobId !== researchJobId(request.projectId, address.id, address.revision) ||
        research.payload.address !== address.value.text)
    )
      throw new DomainError(
        'STALE',
        'Refresh property research for the current address and goal before analyzing these references. Uploaded images can be analyzed in a project without prior research.',
      );
    const base: PropertyResearch =
      research?.payload.kind === 'property-research'
        ? structuredClone(research.payload)
        : {
            kind: 'property-research',
            address: address.value.text,
            jobId: researchJobId(request.projectId, address.id, address.revision),
            method: 'user-import',
            verification: 'unreviewed',
            sources: [],
            findings: [],
            images: [],
            nextQuestions: [],
          };
    const refs = savedPhotoReferences(doc.workspace, request.projectId);
    const photos: Photo[] = request.photoIds.map((id) => {
      const p = refs.find((p) => p.id === id);
      if (p && !base.sources.some((s) => s.id === p.sourceId)) base.sources.push(p.source);
      if (!p?.imageUrl || ('blockedReason' in p && p.blockedReason))
        throw new DomainError('VALIDATION', 'Selected source photo is missing or blocked');
      return {
        id: p.id,
        sourceId: p.sourceId,
        pageUrl: p.pageUrl,
        imageUrl: p.imageUrl,
        locator: p.locator || 'Saved source image',
      };
    });
    const uploads: Record<string, string> = {};
    for (const id of request.evidenceIds) {
      const evidence = doc.workspace.evidence[id],
        attachment = evidence?.source.attachment;
      if (
        evidence?.projectId !== request.projectId ||
        !attachment ||
        !/^image\/(jpeg|png|webp)$/.test(attachment.mediaType)
      )
        throw new DomainError('VALIDATION', 'Choose a project JPEG, PNG or WebP attachment');
      const url = localUploadUrl(id);
      const photoId = `upload-${photos.length + 1}`;
      base.sources.push({
        id: photoId,
        title: 'Private project upload; virtual source reference',
        url,
        retrievedAt: evidence.recordedAt,
      });
      photos.push({
        id: photoId,
        sourceId: photoId,
        pageUrl: url,
        imageUrl: url,
        locator: 'Private owner-supplied photo; capture date and condition unverified',
      });
      uploads[url] = attachment.blobId;
    }
    if (
      new Set(photos.map((p) => p.imageUrl)).size !== photos.length ||
      new Set(photos.map((p) => p.id)).size !== photos.length
    )
      throw new DomainError('VALIDATION', 'Choose distinct photos');
    const now = new Date().toISOString();
    const job: StoredPhotoJob = {
      id: randomUUID(),
      requestId: request.requestId,
      projectId: request.projectId,
      photoIds: [...request.photoIds, ...request.evidenceIds],
      status: 'queued',
      stage: 'Waiting for Muse',
      createdAt: now,
      updatedAt: now,
      attempts: 0,
      error: null,
      cancelRequested: false,
      input: {
        addressId: address.id,
        addressRevision: address.revision,
        goalId: goal.id,
        goalRevision: goal.revision,
        researchRevision: research?.revision || 0,
        inventoryRevision:
          latest(doc.workspace.artifacts[`${request.projectId}:photo-inventory`])?.revision || 0,
      },
      base,
      goal: goal.value.text,
      photos,
      uploads,
    };
    doc.jobs.push(job);
    return job;
  });
}
export function publishPhotoJob(
  doc: Aggregate,
  job: PhotoJob,
  research: PropertyResearch,
  inventory: unknown,
) {
  if (job.status === 'succeeded') return;
  if (job.cancelRequested) throw new DomainError('STALE', 'Analysis was cancelled');
  assertJobInputs(doc.workspace, job);
  const state = doc.workspace,
    project = state.projects[job.projectId];
  const command = (index: number, type: Command['type'], payload: unknown) =>
    ({
      commandId: `photo-job:${job.id}:${index}`,
      projectId: job.projectId,
      baseRevision: project.revision + index,
      basePropertyRevision: state.properties[project.propertyId].revision,
      type,
      payload,
    }) as Command;
  const researchId = `${job.projectId}:property-research`,
    revision = job.input.researchRevision + 1;
  const evidenceIds = Object.keys((job as Partial<StoredPhotoJob>).uploads || {}).map(
    (url) => url.split('/').at(-1)!,
  );
  const commands = [
    command(0, 'ProposeArtifact', {
      artifactId: researchId,
      supersedesRevision: job.input.researchRevision,
      inputRefs: [
        { kind: 'fact', id: job.input.addressId, revision: job.input.addressRevision },
        { kind: 'fact', id: job.input.goalId, revision: job.input.goalRevision },
      ],
      evidenceIds,
      content: research,
    }),
    command(1, 'ImportPhotoInventory', {
      researchRef: { kind: 'artifact', id: researchId, revision },
      inventory,
      expectedInventoryRevision: job.input.inventoryRevision,
    }),
  ];
  for (const cmd of commands)
    doc.workspace = handleCommand(doc.workspace, cmd, {
      ownerId: doc.workspace.ownerId,
      now: new Date().toISOString(),
    }).state;
  job.status = 'succeeded';
  job.stage = 'Photo review and regions saved';
  job.completedResearchRevision = revision;
  job.updatedAt = new Date().toISOString();
}
const exists = async (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );
export class PhotoWorker {
  private running = false;
  private stopping = false;
  private readonly workerId = randomUUID();
  private abort?: AbortController;
  private activeId?: string;
  constructor(
    private repo: MongoWorkspaceRepository,
    private files?: PhotoJobFiles,
  ) {}
  async recover() {
    await this.repo.update((doc) => {
      for (const job of doc.jobs)
        if (job.status === 'running' && (!job.leaseExpiresAt || job.leaseExpiresAt < Date.now())) {
          job.status = job.cancelRequested ? 'cancelled' : 'queued';
          job.stage = 'Recovering saved checkpoints';
        }
    });
  }
  async shutdown() {
    this.stopping = true;
    this.abort?.abort();
    for (let i = 0; i < 100 && this.running; i++)
      await new Promise((resolve) => setTimeout(resolve, 30));
    if (this.activeId)
      await this.repo.update((doc) => {
        const job = doc.jobs.find((j) => j.id === this.activeId);
        if (job?.status === 'running' && job.leaseOwner === this.workerId) {
          job.status = 'queued';
          job.leaseExpiresAt = 0;
          job.stage = 'Paused for API restart';
        }
      });
  }
  async cancel(id: string) {
    await this.repo.update((doc) => {
      const job = doc.jobs.find((j) => j.id === id);
      if (!job) throw new DomainError('NOT_FOUND', 'Job not found');
      if (['queued', 'running'].includes(job.status)) {
        job.cancelRequested = true;
        job.status = 'cancelled';
        job.stage = 'Cancelled; completed evidence retained';
      }
    });
    if (this.activeId === id) this.abort?.abort();
  }
  async tick() {
    if (this.running || this.stopping) return;
    const pending = await this.repo.read();
    if (
      pending.jobs.some(
        (j) => j.status === 'running' && (!j.leaseExpiresAt || j.leaseExpiresAt < Date.now()),
      )
    )
      await this.recover();
    if (!(await this.repo.read()).jobs.some((j) => j.status === 'queued')) return;
    this.running = true;
    let id: string | undefined;
    try {
      const job = await this.repo.update((doc) => {
        const j = doc.jobs.find((j) => j.status === 'queued') as StoredPhotoJob | undefined;
        if (!j) return null;
        if (j.attempts >= 2) {
          j.status = 'failed';
          j.error = 'Recovery attempt limit reached. Start a new bounded job.';
          return null;
        }
        j.status = 'running';
        j.leaseOwner = this.workerId;
        j.leaseExpiresAt = Date.now() + 20000;
        j.stage = 'Inspecting attached images with Muse';
        j.attempts++;
        return structuredClone(j);
      });
      if (!job) return;
      id = job.id;
      this.activeId = id;
      this.abort = new AbortController();
      const heartbeat = setInterval(() => {
        void this.repo
          .update((doc) => {
            const current = doc.jobs.find((j) => j.id === id);
            if (!current || current.leaseOwner !== this.workerId || current.cancelRequested) {
              this.abort?.abort();
              return;
            }
            current.leaseExpiresAt = Date.now() + 20000;
          })
          .catch(() => this.abort?.abort());
      }, 5000);
      const timer = setTimeout(() => this.abort?.abort(), 15 * 60 * 1000);
      try {
        await withMuseBudget(this.abort.signal, 6, () => this.perform(job));
      } finally {
        clearTimeout(timer);
        clearInterval(heartbeat);
      }
    } catch (error) {
      if (id)
        await this.repo.update((doc) => {
          const job = doc.jobs.find((j) => j.id === id)!;
          if (job.status === 'cancelled' || job.leaseOwner !== this.workerId) return;
          if (this.stopping) {
            job.status = 'queued';
            job.leaseExpiresAt = 0;
            job.stage = 'Paused for API restart';
            return;
          }
          job.status = error instanceof DomainError && error.code === 'STALE' ? 'stale' : 'failed';
          job.stage = 'No new project artifacts committed';
          job.error =
            error instanceof DomainError
              ? error.message
              : 'Photo analysis did not complete. Saved evidence was retained. Check provider availability or start a new job.';
          job.updatedAt = new Date().toISOString();
        });
    } finally {
      this.running = false;
      this.abort = undefined;
      this.activeId = undefined;
    }
  }
  private async perform(job: StoredPhotoJob) {
    const dir = join(root, job.id);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const doc = await this.repo.read();
    assertJobInputs(doc.workspace, job);
    const load: typeof imageBytes = async (url) => {
      this.abort?.signal.throwIfAborted();
      const index = job.photos.findIndex((p) => p.imageUrl === url);
      if (index < 0) throw Error('Image outside job scope');
      const file = join(dir, `input-${index}.json`);
      const remote = await this.files?.get(this.repo.ownerId, job.id, `input-${index}.json`);
      if (remote) {
        const b = JSON.parse(remote);
        return { ...b, bytes: Buffer.from(b.data, 'base64') };
      }
      if (await exists(file)) {
        const text = await readFile(file, 'utf8');
        await this.files?.put(this.repo.ownerId, job.id, `input-${index}.json`, text);
        const b = JSON.parse(text);
        return { ...b, bytes: Buffer.from(b.data, 'base64') };
      }
      const uploaded = job.uploads[url] ? await this.repo.readBlob(job.uploads[url]) : null;
      const image = uploaded
        ? {
            bytes: uploaded.bytes,
            extension: uploaded.mediaType.split('/')[1],
            sha256: createHash('sha256').update(uploaded.bytes).digest('hex'),
          }
        : await imageBytes(url);
      const dims = imageSize(image.bytes);
      if (!dims.width || !dims.height || dims.width > 30000 || dims.height > 30000)
        throw Error('Unsupported image dimensions');
      await writeFile(
        file,
        JSON.stringify({
          ...image,
          bytes: undefined,
          data: image.bytes.toString('base64'),
          width: dims.width,
          height: dims.height,
        }),
        { flag: 'wx', mode: 0o600 },
      );
      await this.files?.put(
        this.repo.ownerId,
        job.id,
        `input-${index}.json`,
        await readFile(file, 'utf8'),
      );
      return image;
    };
    const manifest = join(dir, 'manifest.json');
    if (!(await exists(manifest)))
      await writeFile(
        manifest,
        JSON.stringify({
          schemaVersion: 1,
          address: job.base.address,
          jobId: job.base.jobId,
          goal: job.goal,
          photos: job.photos,
          baseResearch: job.base,
        }),
        { flag: 'wx', mode: 0o600 },
      );
    let researchPath = join(dir, 'review.json');
    if (!(await exists(researchPath))) {
      const attempt = join(dir, `review-${job.attempts}.json`);
      if (await exists(attempt)) researchPath = attempt;
      else {
        const prior =
          job.attempts > 1 ? join(dir, `review-${job.attempts - 1}.json.evidence`) : undefined;
        await runPhotoReview(
          manifest,
          undefined,
          attempt,
          prior && (await exists(prior)) ? prior : undefined,
          load,
        );
        researchPath = attempt;
      }
      await writeFile(join(dir, 'review.json'), await readFile(researchPath), { mode: 0o600 });
      researchPath = join(dir, 'review.json');
    }
    this.abort?.signal.throwIfAborted();
    await this.repo.update((doc) => {
      const current = doc.jobs.find((j) => j.id === job.id)!;
      if (current.leaseOwner !== this.workerId)
        throw new DomainError('STALE', 'Worker lease changed');
      if (current.cancelRequested) throw new DomainError('STALE', 'Cancelled');
      assertJobInputs(doc.workspace, job);
      current.stage = 'Localizing visible elements';
    });
    const gallery = [];
    for (const p of job.photos) {
      const image = await load(p.imageUrl);
      const dims = imageSize(image.bytes);
      gallery.push({ id: p.id, width: dims.width, height: dims.height });
    }
    const galleryPath = join(dir, 'gallery.json');
    await writeFile(galleryPath, JSON.stringify(gallery), { mode: 0o600 });
    const output = join(dir, 'inventory.json');
    if (!(await exists(output))) {
      const attempt = join(dir, `inventory-${job.attempts}.json`);
      if (!(await exists(attempt)))
        await runInventory(
          researchPath,
          galleryPath,
          attempt,
          job.input.researchRevision + 1,
          load,
        );
      await writeFile(output, await readFile(attempt), { mode: 0o600 });
    }
    const research = JSON.parse(await readFile(researchPath, 'utf8')),
      inventory = JSON.parse(await readFile(output, 'utf8')).inventory;
    await this.repo.update((doc) => {
      const current = doc.jobs.find((j) => j.id === job.id)!;
      if (current.leaseOwner !== this.workerId)
        throw new DomainError('STALE', 'Worker lease changed');
      publishPhotoJob(doc, current, research, inventory);
    });
  }
}
export const publicJob = ({
  id,
  requestId,
  projectId,
  photoIds,
  status,
  stage,
  createdAt,
  updatedAt,
  attempts,
  input,
  error,
  completedResearchRevision,
}: PhotoJob) => ({
  id,
  requestId,
  projectId,
  photoIds,
  status,
  stage,
  createdAt,
  updatedAt,
  attempts,
  input,
  error,
  completedResearchRevision,
});
