import {
  studioDesignSaveRequestSchema,
  type StudioDesignSaveRequest,
  type StudioDesign,
} from '@renovagent/contracts';
export type StudioSaveMeta = { projectId: string; revision: number };

export function pendingStudioSave(raw: unknown): StudioDesignSaveRequest | null {
  const parsed = studioDesignSaveRequestSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
export function restorePendingStudioDesign<T extends StudioSaveMeta & { snapshot: StudioDesign }>(
  saved: T,
  pending: StudioDesignSaveRequest | null,
): T {
  return pending?.projectId === saved.projectId && pending.expectedRevision === saved.revision
    ? { ...saved, snapshot: pending.snapshot }
    : saved;
}

// One serialized writer. A lost reply replays the exact persisted command before
// newer edits, so retries cannot create a duplicate project or silently drop edits.
export class StudioSync {
  private active: Promise<StudioSaveMeta> | null = null;
  private pending: StudioDesignSaveRequest | null;
  private meta: StudioSaveMeta | null;
  private acknowledged: string;
  constructor(
    private options: {
      meta: StudioSaveMeta | null;
      acknowledged: string;
      pending: unknown;
      send: (request: StudioDesignSaveRequest) => Promise<StudioSaveMeta>;
      persist: (pending: StudioDesignSaveRequest | null) => void;
      onSaved: (meta: StudioSaveMeta, json: string) => void;
      requestId: () => string;
    },
  ) {
    this.meta = options.meta;
    this.acknowledged = options.acknowledged;
    this.pending = options.pending ? studioDesignSaveRequestSchema.parse(options.pending) : null;
  }
  get hasPending() {
    return !!this.pending;
  }
  sync(snapshot: StudioDesign): Promise<StudioSaveMeta> {
    if (this.active) return this.active.then(() => this.sync(snapshot));
    const task = this.flush(snapshot);
    this.active = task;
    void task
      .finally(() => {
        if (this.active === task) this.active = null;
      })
      .catch(() => {});
    return task;
  }
  private async sendPending() {
    const request = this.pending!;
    const meta = await this.options.send(request);
    this.meta = meta;
    this.acknowledged = JSON.stringify(request.snapshot);
    this.options.onSaved(meta, this.acknowledged);
    this.pending = null;
    this.options.persist(null);
  }
  private async flush(snapshot: StudioDesign) {
    if (this.pending) await this.sendPending();
    if (this.meta && JSON.stringify(snapshot) === this.acknowledged) return this.meta;
    this.pending = studioDesignSaveRequestSchema.parse({
      requestId: this.options.requestId(),
      ...(this.meta ? { projectId: this.meta.projectId } : {}),
      expectedRevision: this.meta?.revision ?? 0,
      snapshot,
    });
    this.options.persist(this.pending);
    await this.sendPending();
    return this.meta!;
  }
}
