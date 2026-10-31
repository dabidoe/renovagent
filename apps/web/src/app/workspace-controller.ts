import {
  validateProjectPhotos,
  type ProjectIntakeInput,
  type ReferenceInput,
} from './project-intake.js';
import { projectReferenceSchema } from '@renovagent/contracts';
import {
  HttpProjectRepository,
  workspaceRequest,
  encodeBlobs,
} from '../adapters/http/project-repository.js';
import { inventoryImportSchema } from '@renovagent/contracts';
import {
  type CandidateSurvey,
  type DesignDirection,
  type InputRef,
  type RoomDimensionsInput,
} from '@renovagent/contracts';
import {
  type Workspace,
  type PlanningInputs,
  type PropertyResearch,
  type PlanningGroup,
  type Command,
  type ProjectView,
  type WorkKind,
  type Run,
  type Fact,
  type BomPayload,
  type CheckoutReviewPayload,
  type Offer,
  type PriceObservation,
  type Product,
  type ScopeDraft,
  DomainError,
} from '@renovagent/contracts';
import {
  propertyAddress,
  researchJobId,
  validateResearchForJob,
  type ProjectRepository,
  type AttachmentBlob,
  type BuiltPlan,
  latest,
  isLocalUploadUrl,
  roomDimensionCommands,
  bomFromScopeDraft,
  buildTierPlans,
  scopeDraftId,
  type PricedOffer,
} from '@renovagent/core';
import { IndexedDbProjectRepository } from '../adapters/indexeddb/project-repository.js';
import {
  blobDigest,
  prepareLegacyImport,
  type LegacyImportPreview,
} from '../adapters/fixtures/import-legacy.js';
const uid = (prefix: string) => `${prefix}:${crypto.randomUUID()}`;
async function prepareReferences(inputs: ReferenceInput[]) {
  if (inputs.length > 20) throw Error('Save up to 20 references at a time.');
  if (inputs.reduce((sum, item) => sum + (item.photos?.length || 0), 0) > 10)
    throw Error('Save up to 10 photos at a time.');
  const checked = inputs.map((item) => {
    const reference = projectReferenceSchema.parse(item.reference);
    const photos = item.photos ?? [];
    validateProjectPhotos(photos);
    if (!reference.url && !photos.length) throw Error('Add a photo or a reference link.');
    return { reference, photos };
  });
  return Promise.all(
    checked.flatMap(({ reference, photos }) =>
      (photos.length ? photos : [null]).map(async (file) => ({
        reference,
        file,
        evidenceId: uid('reference'),
        blobId: file ? uid('blob') : null,
        sha256: file ? await blobDigest(file) : null,
      })),
    ),
  );
}
function referenceEvidence(item: Awaited<ReturnType<typeof prepareReferences>>[number]) {
  const { reference, file } = item;
  return {
    id: item.evidenceId,
    kind: file ? ('attachment' as const) : ('user-observation' as const),
    description: [
      reference.kind === 'room'
        ? 'User-supplied room photo. Original, not analyzed.'
        : `User-saved ${reference.kind} reference; not evidence of existing site conditions.`,
      reference.title,
      reference.url,
      reference.note,
      reference.price &&
        `User-saved price: ${reference.price.minorUnits / 100} ${reference.price.currency}. Not a retrieved offer.`,
    ]
      .filter(Boolean)
      .join('\n'),
    reference,
    ...(file
      ? {
          attachment: {
            blobId: item.blobId!,
            sha256: item.sha256!,
            name: file.name,
            mediaType: file.type,
            role: 'original' as const,
          },
        }
      : {}),
  };
}
const STORAGE_MODE_KEY = 'renovagent-storage-mode';
const LEGACY_STORAGE_MODE_KEY = 'unpermitted-storage-mode';
export const storedMode = () =>
  localStorage.getItem(STORAGE_MODE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_MODE_KEY);
export const setStoredMode = (mode: string) => {
  localStorage.setItem(STORAGE_MODE_KEY, mode);
  localStorage.removeItem(LEGACY_STORAGE_MODE_KEY);
};
export const clearStoredMode = () => {
  localStorage.removeItem(STORAGE_MODE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_MODE_KEY);
};
export const defaultView: ProjectView = {
  surface: 'overview',
  artifactRef: null,
  tab: 'work',
  stage: 'brief',
};
export type Snapshot = {
  workspace: Workspace;
  busy: boolean;
  error: string | null;
  auth: { required: boolean; email: string | null; providers: string[] };
};
const noAuth = () => ({ required: false, email: null as string | null, providers: [] as string[] });
const needsSignIn = (error: unknown) =>
  error instanceof DomainError && error.code === 'FORBIDDEN' && error.message.startsWith('Sign in');
const signInProviders = (error: unknown): string[] => {
  if (!(error instanceof DomainError)) return [];
  const providers = (error.details as { providers?: unknown }).providers;
  return Array.isArray(providers)
    ? providers.filter((p): p is string => typeof p === 'string')
    : [];
};
export class WorkspaceController {
  private listeners = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private snapshot: Snapshot;
  constructor(
    public repository: ProjectRepository,
    state: Workspace,
  ) {
    this.snapshot = { workspace: state, busy: false, error: null, auth: noAuth() };
  }
  get connected() {
    return this.repository instanceof HttpProjectRepository;
  }
  connectBackend() {
    const work = this.queue.then(async () => {
      this.emit({ busy: true, error: null });
      try {
        const remote = await HttpProjectRepository.open();
        const current = await remote.read();
        if (!Object.keys(current.projects).length) {
          const backup = await this.repository.exportBackup();
          await workspaceRequest('/import', {
            workspace: backup.workspace,
            blobs: await encodeBlobs(backup.blobs),
          });
        }
        const saved = await remote.read();
        this.repository.close();
        this.repository = remote;
        setStoredMode('mongo');
        this.emit({
          workspace: saved,
          auth: {
            required: false,
            email: remote.session.user?.email ?? null,
            providers: remote.session.providers ?? [],
          },
        });
      } catch (error) {
        this.emit({
          error: error instanceof Error ? error.message : 'Cannot connect to Mongo',
          ...(needsSignIn(error)
            ? {
                auth: {
                  required: true,
                  email: null as string | null,
                  providers: signInProviders(error),
                },
              }
            : {}),
        });
        throw error;
      } finally {
        this.emit({ busy: false });
      }
    });
    this.queue = work.catch(() => {});
    return work;
  }
  photoUrl(url: string, sha256?: string) {
    if (this.connected && sha256) return `/api/workspace/photo-assets/${sha256}`;
    if (!this.connected || !isLocalUploadUrl(url)) return url;
    const evidence = this.snapshot.workspace.evidence[url.split('/').at(-1)!];
    const id = evidence?.source.attachment?.blobId;
    return id ? `/api/workspace/blobs/${encodeURIComponent(id)}` : url;
  }
  static async open() {
    if (storedMode() === 'mongo') {
      try {
        const repository = await HttpProjectRepository.open();
        const controller = new WorkspaceController(repository, await repository.read());
        controller.emit({
          auth: {
            required: false,
            email: repository.session.user?.email ?? null,
            providers: repository.session.providers ?? [],
          },
        });
        return controller;
      } catch (error) {
        if (!needsSignIn(error)) throw error;
        const repository = await IndexedDbProjectRepository.open({
          // Frozen pre-rename storage name: renaming the database would orphan
          // existing browser records with no safe copy path.
          name: 'unpermitted-workspace',
          ownerId: 'local-homeowner',
        });
        const controller = new WorkspaceController(repository, await repository.read());
        controller.emit({
          error: 'Sign in to reconnect your shared workspace.',
          auth: { required: true, email: null, providers: signInProviders(error) },
        });
        return controller;
      }
    }
    const repository = await IndexedDbProjectRepository.open({
      // Frozen pre-rename storage name: see above.
      name: 'unpermitted-workspace',
      ownerId: 'local-homeowner',
    });
    return new WorkspaceController(repository, await repository.read());
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  private emit(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }
  clearError = () => this.emit({ error: null, auth: { ...this.snapshot.auth, required: false } });
  async refresh() {
    await this.queue;
    this.emit({ workspace: await this.repository.read(), error: null });
  }
  private mutate<T>(
    build: (
      state: Workspace,
    ) =>
      | Promise<{ commands: Command[]; blobs?: AttachmentBlob[]; value: T }>
      | { commands: Command[]; blobs?: AttachmentBlob[]; value: T },
    quiet = false,
  ): Promise<T> {
    const work = this.queue.then(async () => {
      if (!quiet) this.emit({ busy: true, error: null });
      try {
        const state = await this.repository.read(),
          batch = await build(state);
        await this.repository.executeBatch(
          batch.commands,
          { ownerId: state.ownerId, now: new Date().toISOString() },
          batch.blobs,
        );
        this.emit({ workspace: await this.repository.read() });
        return batch.value;
      } catch (error) {
        try {
          this.emit({ workspace: await this.repository.read() });
        } catch {
          /* Keep current visible state for recovery. */
        }
        const message =
          error instanceof DomainError && error.code === 'CONFLICT'
            ? 'The project changed in another view. Current records were reloaded; review your edit before saving again.'
            : error instanceof Error
              ? error.message
              : String(error);
        this.emit({ error: message });
        throw error;
      } finally {
        if (!quiet) this.emit({ busy: false });
      }
    });
    this.queue = work.catch(() => {});
    return work;
  }
  private command(
    state: Workspace,
    projectId: string,
    type: Command['type'],
    payload: unknown,
  ): Command {
    return {
      commandId: uid('command'),
      projectId,
      baseRevision: state.projects[projectId]?.revision || 0,
      basePropertyRevision: state.properties[state.projects[projectId]?.propertyId]?.revision || 0,
      type,
      payload,
    } as Command;
  }
  setView(projectId: string, patch: Partial<ProjectView> = {}) {
    return this.mutate(
      (state) => ({
        commands: [
          this.command(state, projectId, 'SetWorkspaceView', {
            ...(state.views[projectId] || defaultView),
            ...patch,
          }),
        ],
        value: undefined,
      }),
      true,
    );
  }
  saveDraft(
    projectId: string,
    text: string,
    evidenceIds: string[],
    photoReply?: Workspace['drafts'][string]['photoReply'] | null,
  ) {
    return this.mutate(
      (state) => ({
        commands: [
          this.command(state, projectId, 'SaveDraft', {
            text,
            evidenceIds,
            expectedDraftRevision: state.drafts[projectId]?.revision || 0,
            photoReply:
              photoReply === undefined
                ? state.drafts[projectId]?.photoReply
                : photoReply || undefined,
          }),
        ],
        value: undefined,
      }),
      true,
    );
  }
  async createProject(input: ProjectIntakeInput) {
    const prepared = await prepareReferences([
      ...(input.photos?.length
        ? [{ reference: { kind: input.photoKind ?? 'room' }, photos: input.photos }]
        : []),
      ...(input.references ?? []),
    ]);
    const projectId = uid('project');
    return this.mutate((state) => {
      const propertyId = input.propertyId || uid('property');
      const commands: Command[] = [];
      let revision = 0;
      let propertyRevision = state.properties[propertyId]?.revision || 0;
      const add = (type: Command['type'], payload: unknown) => {
        commands.push({
          commandId: uid('command'),
          projectId,
          baseRevision: revision++,
          basePropertyRevision: propertyRevision,
          type,
          payload,
        } as Command);
        if (
          type === 'CreateProject' ||
          ((type === 'AttachEvidence' || type === 'RecordFact') &&
            (payload as { scope: string }).scope === 'property')
        )
          propertyRevision++;
      };
      add('CreateProject', {
        propertyId,
        name: input.name,
        newProperty: input.propertyId ? undefined : { name: input.propertyName },
        spaces: input.room?.trim() ? [{ id: uid('space'), name: input.room.trim() }] : [],
      });
      for (const item of prepared)
        add('AttachEvidence', { scope: 'project', evidence: referenceEvidence(item) });
      const approachLabels = {
        diy: 'Do it myself',
        contractor: 'Work with a contractor',
        undecided: 'Deciding between DIY and hiring',
      };
      const details = [
        input.room && `Room: ${input.room}`,
        input.approach && `Approach: ${approachLabels[input.approach]}`,
        input.budgetMinor !== undefined &&
          `Target budget (USD): ${(input.budgetMinor / 100).toFixed(2)}`,
      ].filter(Boolean);
      const messageId = uid('message');
      add('AppendMessage', {
        messageId,
        text: `${input.sample ? '[Example fixture] ' : ''}${input.goal}${details.length ? '\n\n' + details.join('\n') : ''}`,
        evidenceIds: prepared.map((p) => p.evidenceId),
      });
      const fact = (key: string, value: Fact['value']) =>
        add('RecordFact', {
          factId: uid('fact'),
          subjectId: projectId,
          key,
          scope: 'project',
          supersedesRevision: 0,
          value,
          assertion: input.sample ? 'assumed' : 'user_reported',
          evidenceIds: [messageId],
        });
      fact('goal', { kind: 'text', text: input.goal });
      fact('startingPoint', {
        kind: 'text',
        text: input.underway
          ? 'Work already underway; completion evidence needs reconciliation.'
          : 'Exploring / planning',
      });
      if (input.approach)
        fact('workApproach', { kind: 'text', text: approachLabels[input.approach] });
      if (input.budgetMinor !== undefined)
        fact('targetBudget', { kind: 'money', minorUnits: input.budgetMinor, currency: 'USD' });
      if (input.address?.trim()) {
        const address = input.address.trim();
        const old = Object.values(state.facts)
          .map((v) => latest(v)!)
          .find(
            (f) =>
              f.propertyId === propertyId && f.projectId === null && f.key === 'propertyAddress',
          );
        const evidenceId = uid('address-observation');
        add('AttachEvidence', {
          scope: 'property',
          evidence: {
            id: evidenceId,
            kind: 'user-observation',
            description: `User-reported property location: ${address}`,
          },
        });
        add('RecordFact', {
          factId: old?.id || uid('fact'),
          subjectId: propertyId,
          key: 'propertyAddress',
          scope: 'property',
          supersedesRevision: old?.revision || 0,
          value: { kind: 'text', text: address },
          assertion: 'user_reported',
          evidenceIds: [evidenceId],
        });
      }
      add('SetWorkspaceView', { ...defaultView, stage: input.underway ? 'execution' : 'brief' });
      return {
        commands,
        blobs: prepared.flatMap((p) => (p.file ? [{ id: p.blobId!, blob: p.file }] : [])),
        value: projectId,
      };
    });
  }
  async saveReferences(projectId: string, inputs: ReferenceInput[]) {
    if (!inputs.length) throw Error('Add a reference first.');
    const prepared = await prepareReferences(inputs);
    return this.mutate((state) => {
      if (!state.projects[projectId]) throw Error('Choose a project first.');
      const commands = prepared.map((item, index) => ({
        ...this.command(state, projectId, 'AttachEvidence', {
          scope: 'project',
          evidence: referenceEvidence(item),
        }),
        baseRevision: state.projects[projectId].revision + index,
      }));
      return {
        commands,
        blobs: prepared.flatMap((item) =>
          item.file ? [{ id: item.blobId!, blob: item.file }] : [],
        ),
        value: prepared.map((item) => item.evidenceId),
      };
    });
  }
  savePropertyAddress(projectId: string, address: string) {
    return this.mutate((state) => {
      const old = propertyAddress(state, projectId),
        evidenceId = uid('address-observation');
      const first = this.command(state, projectId, 'AttachEvidence', {
        scope: 'property',
        evidence: {
          id: evidenceId,
          kind: 'user-observation',
          description: `User-reported property address: ${address}`,
        },
      });
      const second = {
        ...this.command(state, projectId, 'RecordFact', {
          factId: old?.id || uid('fact'),
          subjectId: state.projects[projectId].propertyId,
          key: 'propertyAddress',
          scope: 'property',
          supersedesRevision: old?.revision || 0,
          value: { kind: 'text', text: address.trim() },
          assertion: 'user_reported',
          evidenceIds: [evidenceId],
        }),
        baseRevision: first.baseRevision + 1,
        basePropertyRevision: first.basePropertyRevision! + 1,
      };
      return { commands: [first, second], value: undefined };
    });
  }
  savePropertyResearch(projectId: string, raw: unknown) {
    return this.mutate((state) => {
      const address = propertyAddress(state, projectId);
      if (!address || address.value.kind !== 'text')
        throw Error('Save an address before importing research.');
      const content: PropertyResearch = validateResearchForJob(
        raw,
        address.value.text,
        researchJobId(projectId, address.id, address.revision),
      );
      const artifactId = `${projectId}:property-research`,
        old = latest(state.artifacts[artifactId]);
      const refs = [{ kind: 'fact' as const, id: address.id, revision: address.revision }];
      if (content.photoReview) {
        const goal = Object.values(state.facts)
          .map((versions) => versions.at(-1)!)
          .find((fact) => fact.projectId === projectId && fact.key === 'goal');
        if (!goal) throw Error('Save the project goal before importing visual planning work.');
        refs.push({ kind: 'fact', id: goal.id, revision: goal.revision });
      }
      const commands = [
        this.command(state, projectId, 'ProposeArtifact', {
          artifactId,
          supersedesRevision: old?.revision || 0,
          inputRefs: refs,
          evidenceIds: address.evidenceIds,
          content,
        }),
      ];
      return { commands, value: undefined };
    });
  }
  async sampleProject() {
    const id = await this.createProject({
      name: 'Living room refresh · example',
      goal: 'Repaint and replace the carpet with vinyl plank in a Philadelphia rowhouse living room. All details in this example are synthetic.',
      propertyName: 'Example rowhouse',
      underway: false,
      sample: true,
    });
    // The example opens on an annotated room: synthetic, labelled dimensions
    // and a refresh drafted from them (priced from the demo catalog when connected).
    await this.recordRoomDimensions(id, {
      length: { amount: 14, unit: 'ft' },
      width: { amount: 12, unit: 'ft' },
      height: { amount: 8, unit: 'ft' },
      method: 'tape-measure',
      notes: '[Example fixture] Synthetic living-room dimensions, not a real room.',
    });
    await this.draftScope(
      id,
      'living-room-refresh',
      ['removal-protection', 'wall-paint', 'carpet-removal', 'lvp-floor'],
      '[Example fixture] Repaint and put vinyl plank down in this living room',
      { wallColor: 'warm white', floorFinish: 'vinyl plank' },
    );
    if (this.connected) await this.priceScopeDraft(id).catch(() => {});
    return id;
  }
  importPhotoInventory(projectId: string, raw: unknown) {
    const data = inventoryImportSchema.parse(raw);
    return this.mutate((state) => {
      const first = this.command(state, projectId, 'ImportPhotoInventory', {
        researchRef: data.researchRef,
        inventory: data.inventory,
        expectedInventoryRevision:
          state.artifacts[`${projectId}:photo-inventory`]?.at(-1)?.revision || 0,
      });
      const second = {
        ...this.command(state, projectId, 'SetWorkspaceView', { ...defaultView, stage: 'brief' }),
        baseRevision: first.baseRevision + 1,
      };
      return { commands: [first, second], value: undefined };
    });
  }
  setInventoryDirection(
    projectId: string,
    payload: Omit<Extract<Command, { type: 'SetInventoryDirection' }>['payload'], 'messageId'>,
  ) {
    return this.mutate((state) => ({
      commands: [
        this.command(state, projectId, 'SetInventoryDirection', {
          ...payload,
          messageId: uid('message'),
        }),
      ],
      value: undefined,
    }));
  }
  saveCandidateMeasurements(
    projectId: string,
    role: string,
    survey: CandidateSurvey,
    basis: 'user-reported' | 'example',
    addressRef: InputRef,
    expectedMeasurementRevision: number,
    expectedOptionsRevision: number,
    expectedPlanRevision: number,
    evidenceIds: string[],
  ) {
    return this.mutate((state) => ({
      commands: [
        this.command(state, projectId, 'SaveCandidateMeasurements', {
          role,
          survey,
          basis,
          addressRef,
          expectedMeasurementRevision,
          expectedOptionsRevision,
          expectedPlanRevision,
          evidenceIds,
        }),
      ],
      value: undefined,
    }));
  }
  selectHomeStudy(
    projectId: string,
    optionId: string,
    researchRef: { kind: 'artifact'; id: string; revision: number },
    answerRefs: InputRef[],
    surveyRefs: InputRef[],
    expectedOptionsRevision: number,
    expectedPlanRevision: number,
  ) {
    return this.mutate((state) => {
      const build = this.command(state, projectId, 'BuildProjectOptions', {
        researchRef,
        answerRefs,
        surveyRefs,
        expectedOptionsRevision,
      });
      const plan = {
        ...this.command(state, projectId, 'PlanProjectOption', {
          optionsRef: {
            kind: 'artifact',
            id: `${projectId}:scope-options`,
            revision: expectedOptionsRevision + 1,
          },
          optionId,
          expectedPlanRevision,
        }),
        baseRevision: build.baseRevision + 1,
      };
      const view = {
        ...this.command(state, projectId, 'SetWorkspaceView', {
          ...defaultView,
          stage: 'options',
        }),
        baseRevision: build.baseRevision + 2,
      };
      return { commands: [build, plan, view], value: undefined };
    });
  }
  buildProjectOptions(
    projectId: string,
    researchRef: { kind: 'artifact'; id: string; revision: number },
    answerRefs: { kind: 'artifact' | 'fact' | 'evidence'; id: string; revision: number }[],
    expectedOptionsRevision: number,
    surveyRefs?: InputRef[],
  ) {
    return this.mutate((state) => ({
      commands: [
        this.command(state, projectId, 'BuildProjectOptions', {
          researchRef,
          answerRefs,
          surveyRefs,
          expectedOptionsRevision,
        }),
      ],
      value: undefined,
    }));
  }
  planProjectOption(
    projectId: string,
    optionsRef: { kind: 'artifact'; id: string; revision: number },
    optionId: string,
    expectedPlanRevision: number,
  ) {
    return this.mutate((state) => ({
      commands: [
        this.command(state, projectId, 'PlanProjectOption', {
          optionsRef,
          optionId,
          expectedPlanRevision,
        }),
      ],
      value: undefined,
    }));
  }
  answerPhotoQuestion(
    projectId: string,
    researchRef: { kind: 'artifact'; id: string; revision: number },
    questionIndex: number,
    expectedAnswerRevision: number,
    answer: string,
    disposition: 'direction' | 'unsure' | 'deferred',
    evidenceIds: string[],
  ) {
    return this.mutate((state) => ({
      commands: [
        this.command(state, projectId, 'AnswerPhotoQuestion', {
          researchRef,
          questionIndex,
          expectedAnswerRevision,
          messageId: uid('message'),
          answer,
          disposition,
          evidenceIds,
        }),
      ],
      value: undefined,
    }));
  }
  sendMessage(projectId: string, text: string, evidenceIds: string[]) {
    return this.mutate((state) => ({
      commands: [
        this.command(state, projectId, 'AppendMessage', {
          messageId: uid('message'),
          text: text.trim() || 'Added reference files.',
          evidenceIds,
        }),
      ],
      value: undefined,
    }));
  }
  async savePlanning(
    projectId: string,
    inputs: PlanningInputs,
    basis: 'user-reported' | 'example',
    expectedInputs: Record<PlanningGroup, number>,
    referenceIds: string[] = [],
  ) {
    await this.mutate((state) => {
      const evidenceId = uid('planning-observation');
      const attach = this.command(state, projectId, 'AttachEvidence', {
        scope: 'project',
        evidence: {
          id: evidenceId,
          kind: 'user-observation',
          description: `${basis === 'example' ? 'Synthetic example inputs' : 'User reported technical inputs'}: ${JSON.stringify(inputs)}`,
        },
      });
      const save = {
        ...this.command(state, projectId, 'SavePlanningInputs', {
          inputs,
          basis,
          expectedInputs,
          evidenceIds: [evidenceId, ...referenceIds],
        }),
        baseRevision: attach.baseRevision + 1,
      };
      const calculate = {
        ...this.command(state, projectId, 'CalculatePlanning', {}),
        baseRevision: attach.baseRevision + 2,
      };
      return { commands: [attach, save, calculate], value: undefined };
    });
    await this.setView(projectId, {
      surface: 'artifact',
      stage: 'technical',
      tab: 'work',
      artifactRef: {
        kind: 'artifact',
        id: `${projectId}:planning:geometry`,
        revision:
          this.snapshot.workspace.artifacts[`${projectId}:planning:geometry`].at(-1)!.revision,
      },
    });
  }
  async calculatePlanning(projectId: string) {
    await this.mutate((state) => ({
      commands: [this.command(state, projectId, 'CalculatePlanning', {})],
      value: undefined,
    }));
  }
  requestWork(projectId: string, kind: WorkKind) {
    const runId = uid('run');
    return this.mutate((state) => ({
      commands: [this.command(state, projectId, 'RequestWork', { runId, kind })],
      value: runId,
    }));
  }
  async transition(
    projectId: string,
    runId: string,
    action: 'advance' | 'answer' | 'retry' | 'cancel' | 'fail',
    answer?: string,
  ) {
    await this.mutate((state) => {
      const run = state.runs[runId];
      if (!run) throw Error('Run no longer exists');
      return {
        commands: [
          this.command(state, projectId, 'TransitionRun', {
            runId,
            expectedRunRevision: run.revision,
            action,
            answer,
            evidenceIds:
              action === 'answer' ? state.drafts[projectId]?.evidenceIds || [] : undefined,
          }),
        ],
        value: undefined,
      };
    });
    const run = this.snapshot.workspace.runs[runId];
    if (
      run.outputRef &&
      run.state === 'waiting_for_approval' &&
      this.snapshot.workspace.activeProjectId === projectId
    )
      await this.setView(projectId, {
        surface: 'artifact',
        artifactRef: run.outputRef,
        stage: run.kind,
      });
  }
  proposeBom(projectId: string, bom: BomPayload) {
    return this.mutate((state) => {
      const artifactId = `${projectId}:bom`;
      const old = latest(state.artifacts[artifactId]);
      return {
        commands: [
          this.command(state, projectId, 'ProposeArtifact', {
            artifactId,
            supersedesRevision: old?.revision || 0,
            inputRefs: [],
            evidenceIds: [],
            content: bom,
          }),
        ],
        value: undefined,
      };
    });
  }
  proposePurchasePlans(
    projectId: string,
    bomRef: { id: string; revision: number },
    plans: BuiltPlan[],
  ) {
    return this.mutate((state) => {
      const base = state.projects[projectId]?.revision || 0;
      const commands = plans.map((plan, index) => {
        const artifactId = `${projectId}:purchase-plan:${plan.tier}`;
        const old = latest(state.artifacts[artifactId]);
        return {
          ...this.command(state, projectId, 'ProposeArtifact', {
            artifactId,
            supersedesRevision: old?.revision || 0,
            inputRefs: [{ kind: 'artifact', id: bomRef.id, revision: bomRef.revision }],
            evidenceIds: [],
            content: {
              kind: 'purchase-plan',
              ...plan,
              bomRef: { kind: 'artifact', id: bomRef.id, revision: bomRef.revision },
              builtAt: new Date().toISOString(),
            },
          }),
          baseRevision: base + index,
        };
      });
      return { commands, value: undefined };
    });
  }
  // Drafts the scope from a recipe's packages. Pure domain work: it reads the
  // recorded room facts and runs the same way locally and connected.
  draftScope(
    projectId: string,
    recipeId: string,
    packageIds: string[],
    request: string,
    direction?: DesignDirection,
  ) {
    return this.mutate((state) => ({
      commands: [
        this.command(state, projectId, 'DraftScope', {
          recipeId,
          packageIds,
          request,
          ...(direction ? { direction } : {}),
          reported: [],
          expectedDraftRevision: latest(state.artifacts[scopeDraftId(projectId)])?.revision ?? 0,
        }),
      ],
      value: undefined,
    }));
  }
  // Prices the current scope draft against the shared catalog, as the server's
  // draft_scope does: a BOM tied to the draft revision, then tier plans tied to
  // that BOM. Connected mode only; the catalog lives on the server.
  async priceScopeDraft(projectId: string) {
    if (!this.connected) throw Error('Pricing needs the connected catalog.');
    const catalog = (await workspaceRequest('/catalog/offers')) as {
      products: Product[];
      offers: Offer[];
      observations: PriceObservation[];
    };
    const products = new Map(catalog.products.map((p) => [p.id, p]));
    const observations = new Map(catalog.observations.map((o) => [o.offerId, o]));
    const priced: PricedOffer[] = [];
    for (const offer of catalog.offers) {
      const product = products.get(offer.productId);
      const observation = observations.get(offer.id);
      if (product && observation) priced.push({ offer, product, observation });
    }
    return this.mutate((state) => {
      const draftId = scopeDraftId(projectId);
      const draft = latest(state.artifacts[draftId]);
      if (draft?.payload.kind !== 'scope-draft') throw Error('Plan the work before pricing it.');
      const { bom } = bomFromScopeDraft(draft.payload as ScopeDraft, catalog.products);
      if (!bom) throw Error('Nothing in this scope matches the catalog yet.');
      const plans = buildTierPlans(bom, priced).filter((p) => p.lines.length);
      if (!plans.length) throw Error('The catalog has no current prices for this scope.');
      const base = state.projects[projectId]!.revision;
      const bomId = `${projectId}:bom`;
      const bomRevision = (latest(state.artifacts[bomId])?.revision ?? 0) + 1;
      const bomRef = { kind: 'artifact' as const, id: bomId, revision: bomRevision };
      const commands = [
        this.command(state, projectId, 'ProposeArtifact', {
          artifactId: bomId,
          supersedesRevision: bomRevision - 1,
          inputRefs: [{ kind: 'artifact', id: draftId, revision: draft.revision }],
          evidenceIds: [],
          content: bom,
        }),
        ...plans.map((plan, i) => {
          const artifactId = `${projectId}:purchase-plan:${plan.tier}`;
          return {
            ...this.command(state, projectId, 'ProposeArtifact', {
              artifactId,
              supersedesRevision: latest(state.artifacts[artifactId])?.revision ?? 0,
              inputRefs: [bomRef],
              evidenceIds: [],
              content: {
                kind: 'purchase-plan',
                ...plan,
                bomRef,
                builtAt: new Date().toISOString(),
              },
            }),
            baseRevision: base + 1 + i,
          };
        }),
      ];
      return { commands, value: undefined };
    });
  }
  proposeCheckoutReview(projectId: string, tier: string, review: CheckoutReviewPayload) {
    return this.mutate((state) => {
      const artifactId = `${projectId}:checkout-review:${tier}`;
      const old = latest(state.artifacts[artifactId]);
      return {
        commands: [
          this.command(state, projectId, 'ProposeArtifact', {
            artifactId,
            supersedesRevision: old?.revision || 0,
            inputRefs: [review.purchasePlanRef],
            evidenceIds: [],
            content: review,
          }),
        ],
        value: undefined,
      };
    });
  }
  decide(projectId: string, artifactId: string, revision: number, reject = false) {
    return this.mutate((state) => ({
      commands: [
        this.command(state, projectId, reject ? 'RejectProposal' : 'AcceptDecision', {
          decisionId: uid('decision'),
          question: `${reject ? 'Decline' : 'Accept'} ${artifactId} revision ${revision}`,
          artifactRefs: [{ kind: 'artifact', id: artifactId, revision }],
        }),
      ],
      value: undefined,
    }));
  }
  recordFact(projectId: string, input: { key: string; text: string; fact?: Fact }) {
    return this.mutate((state) => {
      const evidenceId = uid('observation');
      const first = this.command(state, projectId, 'AttachEvidence', {
        scope: input.fact?.projectId === null ? 'property' : 'project',
        evidence: {
          id: evidenceId,
          kind: 'user-observation',
          description: `User reported ${input.key}: ${input.text}`,
        },
      });
      const value =
        input.fact && input.fact.value.kind === 'quantity'
          ? { ...input.fact.originalValue, amount: Number(input.text) }
          : { kind: 'text', text: input.text };
      const second = {
        ...this.command(state, projectId, 'RecordFact', {
          factId: input.fact?.id || uid('fact'),
          subjectId: input.fact?.subjectId || projectId,
          key: input.key,
          scope: input.fact?.projectId === null ? 'property' : 'project',
          supersedesRevision: input.fact?.revision || 0,
          value,
          assertion: 'user_reported',
          evidenceIds: [evidenceId],
        }),
        baseRevision: first.baseRevision + 1,
        basePropertyRevision:
          input.fact?.projectId === null
            ? first.basePropertyRevision! + 1
            : first.basePropertyRevision,
      };
      return { commands: [first, second], value: undefined };
    });
  }
  // The person's own measurements become project facts; an optional photo or
  // floor plan file is attached first as original evidence (the plan keeps its
  // full geometry) and cited by every recorded dimension.
  async recordRoomDimensions(
    projectId: string,
    input: Omit<RoomDimensionsInput, 'photoEvidenceIds'>,
    photo?: File,
  ) {
    const plan = photo?.type === 'application/json';
    if (photo && ((!photo.type.startsWith('image/') && !plan) || photo.size > 20 * 1024 * 1024))
      throw Error('Choose a photo or floor plan file under 20 MB.');
    const photoEvidenceId = photo ? uid('attachment') : null,
      blobId = uid('blob'),
      sha256 = photo ? await blobDigest(photo) : '';
    return this.mutate((state) => {
      const attach = photo
        ? [
            this.command(state, projectId, 'AttachEvidence', {
              scope: 'project',
              evidence: {
                id: photoEvidenceId,
                kind: 'attachment',
                description: plan
                  ? 'Floor plan file supplied by the user (RoomPlan/OpenPlan3D JSON). Not verified.'
                  : 'Room measurement photo supplied by the user. Not analyzed.',
                attachment: {
                  blobId,
                  sha256,
                  name: photo.name,
                  mediaType: photo.type,
                  role: 'original',
                },
              },
            }),
          ]
        : [];
      const measure = roomDimensionCommands(
        state,
        projectId,
        { ...input, photoEvidenceIds: photoEvidenceId ? [photoEvidenceId] : [] },
        {
          commandId: () => uid('command'),
          evidenceId: uid('observation'),
          factId: () => uid('fact'),
        },
      ).map((c) => ({ ...c, baseRevision: c.baseRevision + attach.length }) as Command);
      return {
        commands: [...attach, ...measure],
        blobs: photo ? [{ id: blobId, blob: photo }] : [],
        value: undefined,
      };
    });
  }
  async attachFile(projectId: string, file: File) {
    if (!file.size || file.size > 20 * 1024 * 1024)
      throw Error('Choose a file between 1 byte and 20 MB.');
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowed.includes(file.type))
      throw Error('Choose a JPG, PNG, WebP, GIF, PDF, text, or Word document.');
    const evidenceId = uid('attachment'),
      blobId = uid('blob'),
      sha256 = await blobDigest(file);
    return this.mutate((state) => {
      const attach = this.command(state, projectId, 'AttachEvidence', {
        scope: 'project',
        evidence: {
          id: evidenceId,
          kind: 'attachment',
          description: 'User-supplied local reference. Not analyzed.',
          attachment: { blobId, sha256, name: file.name, mediaType: file.type, role: 'original' },
        },
      });
      const draft = state.drafts[projectId] || { text: '', evidenceIds: [], revision: 0 };
      const save = {
        ...this.command(state, projectId, 'SaveDraft', {
          ...draft,
          evidenceIds: [...draft.evidenceIds, evidenceId],
          expectedDraftRevision: draft.revision,
        }),
        baseRevision: attach.baseRevision + 1,
      };
      // Draft storage has its own schema; omit the read-model revision field.
      if (save.type === 'SaveDraft')
        delete (save.payload as unknown as Record<string, unknown>).revision;
      return { commands: [attach, save], blobs: [{ id: blobId, blob: file }], value: evidenceId };
    });
  }
  async importLegacy(preview: LegacyImportPreview) {
    const unique = crypto.randomUUID();
    return this.mutate(async () => {
      const prepared = await prepareLegacyImport(preview, {
        importId: `import:${unique}`,
        projectId: `project:${unique}`,
        propertyId: `property:${unique}`,
        projectName: 'Imported renovation',
        propertyName: 'Imported property (unverified)',
        basePropertyRevision: 0,
      });
      const last = prepared.commands.at(-1)!;
      prepared.commands.push({
        commandId: uid('command'),
        projectId: last.projectId,
        baseRevision: prepared.commands.length,
        type: 'SetWorkspaceView',
        payload: defaultView,
      });
      return { ...prepared, value: last.projectId };
    });
  }
}
export function projectFacts(state: Workspace, projectId: string) {
  const propertyId = state.projects[projectId]?.propertyId;
  return Object.values(state.facts)
    .map((v) => latest(v)!)
    .filter(
      (f) => f.propertyId === propertyId && (f.projectId === null || f.projectId === projectId),
    );
}
export function projectRuns(state: Workspace, projectId: string): Run[] {
  return Object.values(state.runs)
    .filter((r) => r.projectId === projectId)
    .reverse();
}
