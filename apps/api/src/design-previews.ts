import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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
import { runMuse } from '../../../scripts/muse-provider.js';
import { normalizeImage, type DesignImageStore } from './design-images.js';
import type { MongoWorkspaceRepository } from './repository.js';

export type PreviewResult = { bytes: Uint8Array; provider: string; model: string; runId?: string };
export interface PreviewProvider {
  generate(input: { image: Uint8Array; prompt: string }): Promise<PreviewResult>;
}

// Muse image editing through the CLI's image_generation tool. Each call runs
// in a throwaway workspace that holds only a copy of the source photo; shell
// and web tools, reminders, personal context and contributor mode are off.
export class MusePreviewProvider implements PreviewProvider {
  async generate({ image, prompt }: { image: Uint8Array; prompt: string }) {
    const dir = await mkdtemp(join(tmpdir(), 'renovagent-preview-'));
    try {
      const source = join(dir, 'room.jpg');
      await writeFile(source, image);
      const events = await runMuse(
        [
          'exec',
          '--json',
          '--workspace',
          dir,
          '--reasoning-effort',
          'low',
          '--contributor-mode',
          'off',
          '--no-session-log',
          '--disable-shell',
          '--disable-web-tools',
          '--disable-reminders',
          '--no-foreign-personal-context',
          '--max-model-steps',
          '4',
          `Call the image_generation tool exactly once with image_paths [${JSON.stringify(source)}] and this prompt: ${JSON.stringify(prompt)}. Do not call any other tool. Then reply with only the saved file path.`,
        ],
        240000,
      );
      let model: string | undefined, runId: string | undefined;
      for (const line of events.split('\n')) {
        let event: { payload_type?: string; payload?: Record<string, unknown> };
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }
        const payload = event.payload ?? {};
        if (event.payload_type === 'run.model.configured') model = String(payload.model_id ?? '');
        if (event.payload_type === 'run.terminal.completed')
          runId = (payload.run_stream as { id?: string } | undefined)?.id;
      }
      // The result is the image file the tool wrote into this throwaway
      // workspace; the model's reply text is not trusted as a path.
      const output = join(dir, 'generated_images');
      const files = (await readdir(output).catch(() => [] as string[])).filter((name) =>
        /\.(png|jpe?g|webp)$/i.test(name),
      );
      if (!files.length || !model)
        throw new DomainError('VALIDATION', 'Muse returned no preview image');
      const newest = (
        await Promise.all(
          files.map(async (name) => ({ name, at: (await stat(join(output, name))).mtimeMs })),
        )
      ).sort((a, b) => b.at - a.at)[0];
      return {
        bytes: new Uint8Array(await readFile(join(output, newest.name))),
        provider: 'Muse CLI image_generation tool',
        model,
        ...(runId ? { runId } : {}),
      };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
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
