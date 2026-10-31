import {
  DomainError,
  type Command,
  type DesignOptions,
  type DesignPreview,
  type Workspace,
} from '@renovagent/contracts';
import {
  designOptionsId,
  designPreviewPrompt,
  fingerprint,
  handleCommand,
  previewCurrent,
} from '@renovagent/core';
import { imageMediaType, museEditImage } from '../../../scripts/muse-provider.js';
import { normalizeImage, type DesignImageStore } from './design-images.js';
import type { MongoWorkspaceRepository } from './repository.js';

export type PreviewResult = { bytes: Uint8Array; provider: string; model: string; runId?: string };
export interface PreviewProvider {
  generate(input: { image: Uint8Array; prompt: string }): Promise<PreviewResult>;
}

// Muse Image editing through the Meta Model API (images/edits): the source
// photo and the direction prompt in, one generated image out.
export class MusePreviewProvider implements PreviewProvider {
  async generate({ image, prompt }: { image: Uint8Array; prompt: string }) {
    const result = await museEditImage({
      image: { bytes: image, mediaType: imageMediaType(image) },
      prompt,
    });
    return { bytes: result.bytes, provider: 'Meta Model API images/edits', model: result.model };
  }
}

const attemptKey = (projectId: string, optionId: string, direction: unknown) =>
  `${projectId}\n${optionId}\n${fingerprint(direction)}`;

function pending(workspace: Workspace, skip: Set<string>) {
  for (const versions of Object.values(workspace.artifacts)) {
    const artifact = versions.at(-1)!;
    if (artifact.payload.kind !== 'design-options' || artifact.lifecycle === 'rejected') continue;
    const options = artifact.payload;
    const option = options.options.find(
      (o) =>
        o.preview.status === 'pending' &&
        previewCurrent(o) &&
        !skip.has(attemptKey(artifact.projectId, o.id, o.direction)),
    );
    if (option) return { artifact, options, option };
  }
  return undefined;
}

// Paid provider calls per option direction before it is recorded as failed.
const MAX_ATTEMPTS = 2;

// One preview at a time per workspace. Results are committed only if the
// option still awaits a preview for the same direction; otherwise discarded.
export class DesignPreviewWorker {
  private running = false;
  private readonly attempts = new Map<string, number>();
  // Directions this process could not record even as failed; never retried
  // here, so a persistent storage fault cannot loop paid generation.
  private readonly exhausted = new Set<string>();
  constructor(
    private readonly repository: MongoWorkspaceRepository,
    private readonly images: DesignImageStore,
    private readonly provider: PreviewProvider,
  ) {}

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      while (await this.once());
    } finally {
      this.running = false;
    }
  }

  private async once(): Promise<boolean> {
    const found = pending((await this.repository.read()).workspace, this.exhausted);
    if (!found) return false;
    const { artifact, options, option } = found;
    const key = attemptKey(artifact.projectId, option.id, option.direction);
    const attempt = (this.attempts.get(key) ?? 0) + 1;
    this.attempts.set(key, attempt);
    let preview: DesignPreview;
    const prompt = designPreviewPrompt(options, option.id);
    try {
      if (attempt > MAX_ATTEMPTS)
        throw new DomainError('STORAGE', 'The preview could not be saved after repeated attempts');
      const source = await this.images.get(
        this.repository.ownerId,
        options.sourcePhoto.image.sha256,
      );
      if (!source) throw new DomainError('NOT_FOUND', 'The source photo is no longer stored');
      const result = await this.provider.generate({ image: source.bytes, prompt });
      const image = await this.images.put(
        this.repository.ownerId,
        await normalizeImage(result.bytes),
      );
      preview = {
        status: 'generated',
        forDirection: option.direction,
        image,
        provenance: {
          kind: 'generated-concept',
          sourcePhotoSha256: options.sourcePhoto.image.sha256,
          prompt,
          provider: result.provider.slice(0, 120),
          model: result.model.slice(0, 120),
          ...(result.runId ? { runId: result.runId.slice(0, 160) } : {}),
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      preview = failed(option.direction, error);
    }
    try {
      await this.record(artifact.projectId, option.id, preview);
    } catch (error) {
      // Commit failed: try to record the failure itself; if even that fails,
      // stop retrying this direction in this process.
      try {
        await this.record(artifact.projectId, option.id, failed(option.direction, error));
      } catch {
        this.exhausted.add(key);
      }
    }
    return true;
  }

  private async record(projectId: string, optionId: string, preview: DesignPreview) {
    await this.repository.update((doc) => {
      const state = doc.workspace;
      const latest = state.artifacts[designOptionsId(projectId)]?.at(-1);
      const option =
        latest?.payload.kind === 'design-options'
          ? (latest.payload as DesignOptions).options.find((o) => o.id === optionId)
          : undefined;
      // The option moved on (new direction or already recorded): discard.
      if (
        !latest ||
        !option ||
        option.preview.status !== 'pending' ||
        fingerprint(option.direction) !== fingerprint(preview.forDirection)
      )
        return;
      const command: Command = {
        commandId: `design-preview:${latest.revision}:${optionId}`,
        projectId,
        baseRevision: state.projects[projectId].revision,
        type: 'RecordDesignPreview',
        payload: { optionId, expectedRevision: latest.revision, preview },
      };
      doc.workspace = handleCommand(state, command, {
        ownerId: this.repository.ownerId,
        now: new Date().toISOString(),
      }).state;
    });
  }
}

function failed(forDirection: DesignPreview['forDirection'], error: unknown): DesignPreview {
  return {
    status: 'failed',
    forDirection,
    error: (error instanceof Error ? error.message : 'Preview generation failed').slice(0, 500),
  };
}
