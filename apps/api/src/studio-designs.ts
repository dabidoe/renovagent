import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  DomainError,
  id,
  studioDesignSaveRequestSchema,
  type Command,
} from '@renovagent/contracts';
import {
  handleCommand,
  projectHandoff,
  projectScopeReview,
  scopeDraftId,
  EXAMPLE_TAG,
  studioItemBudget,
} from '@renovagent/core';
import { draftProjectScope } from './scope-drafts.js';
import type { CatalogStore } from './catalog.js';
import { startAgentProject } from './agent-projects.js';
import type { MongoWorkspaceRepository } from './repository.js';
import type { DesignImageStore } from './design-images.js';

export const saveStudioDesignSchema = studioDesignSaveRequestSchema;

export async function readStudioDesign(
  repo: MongoWorkspaceRepository,
  projectId: string,
  revision?: number,
) {
  const { workspace } = await repo.read();
  const versions = workspace.artifacts[`${projectId}:studio-design`];
  const artifact = revision ? versions?.find((a) => a.revision === revision) : versions?.at(-1);
  if (!workspace.projects[projectId] || artifact?.payload.kind !== 'studio-design')
    throw new DomainError('NOT_FOUND', 'No studio design in this workspace');
  return {
    projectId,
    revision: artifact.revision,
    artifactRef: { kind: 'artifact' as const, id: artifact.id, revision: artifact.revision },
    snapshot: artifact.payload,
  };
}

export async function saveStudioDesign(
  repo: MongoWorkspaceRepository,
  images: DesignImageStore | undefined,
  raw: unknown,
) {
  const input = saveStudioDesignSchema.parse(raw);
  const hashes = new Set(
    [
      ...JSON.stringify(input.snapshot).matchAll(
        /\/api\/workspace\/design-images\/([a-f0-9]{64})/g,
      ),
    ].map((m) => m[1]!),
  );
  for (const draft of Object.values(input.snapshot.styling))
    if (draft.inspo) hashes.add(draft.inspo.sha256);
  for (const hash of [
    ...(input.snapshot.intake?.analysis?.photos ?? []),
    ...(input.snapshot.intake?.analysis?.plans ?? []),
  ])
    hashes.add(hash);
  for (const hash of hashes)
    if (!images || !(await images.get(repo.ownerId, hash)))
      throw new DomainError('NOT_FOUND', 'A studio image is missing from this owner’s workspace');
  const roomIds = new Set(input.snapshot.project.rooms.map((r) => r.id));
  if (
    roomIds.size !== input.snapshot.project.rooms.length ||
    [
      ...Object.keys(input.snapshot.picks),
      ...Object.keys(input.snapshot.inspired),
      ...Object.keys(input.snapshot.styling),
      ...Object.keys(input.snapshot.renderSignatures),
      ...Object.keys(input.snapshot.items ?? {}),
      ...Object.keys(input.snapshot.placements ?? {}),
      ...Object.keys(input.snapshot.modelRenders ?? {}),
    ].some((id) => !roomIds.has(id))
  )
    throw new DomainError('VALIDATION', 'Studio selections must reference this project’s rooms');
  for (const [id, draft] of Object.entries(input.snapshot.styling)) {
    if (draft.source !== input.snapshot.project.rooms.find((r) => r.id === id)!.photo.src)
      throw new DomainError(
        'VALIDATION',
        'Styling choices must reference this room’s source photo',
      );
  }
  for (const list of Object.values(input.snapshot.items ?? {})) {
    if (new Set(list.map((i) => i.id)).size !== list.length)
      throw new DomainError('VALIDATION', 'Room items need unique identities');
  }
  for (const [roomId, placements] of Object.entries(input.snapshot.placements ?? {})) {
    const items = input.snapshot.items?.[roomId] ?? [];
    if (
      new Set(placements.map((p) => p.id)).size !== placements.length ||
      placements.some((p) => !items.some((item) => item.id === p.itemId))
    )
      throw new DomainError(
        'VALIDATION',
        '3D objects must have unique identities and reference an item in the same room',
      );
  }
  if (!input.projectId && input.expectedRevision !== 0)
    throw new DomainError('CONFLICT', 'A first save must start at revision zero');
  const projectId =
    input.projectId ??
    (
      await startAgentProject(repo, {
        requestId: `studio:${input.requestId}`,
        name: input.snapshot.project.address || 'My room design',
        brief:
          'Room design saved from the studio. Photo-derived sizes remain estimates. Paint-and-floor prices are demo material allowances; furniture, lighting, labour and fit checks remain unresolved.',
      })
    ).projectId;
  const artifactId = `${projectId}:studio-design`;
  const commandId = `studio-save:${createHash('sha256').update(`${projectId}\0${input.requestId}`).digest('hex').slice(0, 32)}`;
  await repo.update((doc) => {
    const state = doc.workspace;
    const project = state.projects[projectId];
    if (!project) throw new DomainError('NOT_FOUND', 'Unknown project in this workspace');
    const prior = state.commands[commandId];
    const command: Command = {
      commandId,
      projectId,
      baseRevision: prior ? prior.result.projectRevision - 1 : project.revision,
      type: 'ProposeArtifact',
      payload: {
        artifactId,
        supersedesRevision: input.expectedRevision,
        inputRefs: [],
        evidenceIds: [],
        content: input.snapshot,
      },
    };
    doc.workspace = handleCommand(state, command, {
      ownerId: repo.ownerId,
      now: new Date().toISOString(),
    }).state;
  });
  return readStudioDesign(repo, projectId, input.expectedRevision + 1);
}

export async function prepareStudioHandoff(
  repo: MongoWorkspaceRepository,
  catalog: CatalogStore | undefined,
  raw: unknown,
) {
  const input = z
    .object({
      projectId: id,
      revision: z.number().int().positive(),
      roomId: z.string().min(1).max(500),
      requestId: id,
    })
    .strict()
    .parse(raw);
  const saved = await readStudioDesign(repo, input.projectId, input.revision);
  const current = await readStudioDesign(repo, input.projectId);
  if (current.revision !== input.revision)
    throw new DomainError(
      'CONFLICT',
      'Open the latest saved design before preparing its work plan',
    );
  const room = saved.snapshot.project.rooms.find((r) => r.id === input.roomId);
  if (!room) throw new DomainError('NOT_FOUND', 'This room is not in the saved design');
  const before = (await repo.read()).workspace;
  if (
    saved.snapshot.project.rooms.length > 1 &&
    Object.values(before.facts).some((versions) => {
      const fact = versions.at(-1);
      return (
        fact?.projectId === input.projectId &&
        ['floorLengthFt', 'floorWidthFt', 'ceilingHeightFt'].includes(fact.key)
      );
    })
  )
    throw new DomainError(
      'VALIDATION',
      'This project has recorded dimensions. Review which room they belong to before preparing a room-specific scope.',
    );
  const pick = saved.snapshot.picks[room.id];
  const packageIds = [
    ...(pick?.color ? ['wall-paint'] : []),
    ...(pick && pick.floor !== 'keep'
      ? [
          ...(/carpet/i.test(room.existingFloor) ? ['carpet-removal'] : []),
          pick.floor === 'hardwood' ? 'hardwood-floor' : 'lvp-floor',
        ]
      : []),
  ];
  if (!packageIds.length)
    throw new DomainError(
      'VALIDATION',
      'Choose paint or a new floor before preparing the finish work plan',
    );
  const reported = [
    {
      key: 'floorWidthFt' as const,
      amount: room.size && !room.sizeNote ? room.size.xFt : null,
      unit: 'ft' as const,
    },
    {
      key: 'floorLengthFt' as const,
      amount: room.size && !room.sizeNote ? room.size.yFt : null,
      unit: 'ft' as const,
    },
    {
      key: 'ceilingHeightFt' as const,
      amount: !saved.snapshot.project.ceilingNote ? saved.snapshot.project.ceilingFt : null,
      unit: 'ft' as const,
    },
  ];
  const floorFinish =
    pick?.floor === 'keep'
      ? 'Keep existing floor'
      : `${pick?.floorStyle ?? 'Chosen'} ${pick?.floor === 'hardwood' ? 'engineered hardwood' : 'vinyl plank'}`;
  const request = `${saved.snapshot.basis === 'listing-example' ? EXAMPLE_TAG : ''}Paint and floor work for ${room.title} (${room.id}), from saved studio revision ${saved.revision}. Furniture and lighting are separate proposals; any owner allowances are not retailer quotes or installation prices.`;
  const summary = await draftProjectScope(repo, catalog, {
    requestId: input.requestId,
    projectId: input.projectId,
    recipeId: 'living-room-refresh',
    packageIds,
    reported,
    sourceDesignRef: saved.artifactRef,
    request,
    direction: {
      wallColor: pick?.color?.name ?? 'Keep existing walls',
      floorFinish,
      paintSheen: pick?.sheen ?? 'eggshell',
    },
  });
  const { workspace } = await repo.read();
  const markdown = projectHandoff(workspace, input.projectId, new Date().toISOString(), null);
  const review = projectScopeReview(workspace, input.projectId, null);
  const draft = workspace.artifacts[scopeDraftId(input.projectId)]?.at(-1);
  if (
    !markdown ||
    draft?.freshness !== 'current' ||
    draft.payload.kind !== 'scope-draft' ||
    draft.payload.request !== request
  )
    throw new DomainError(
      'CONFLICT',
      'The design changed while the work plan was prepared; save and try again',
    );
  const roomItems = saved.snapshot.items?.[room.id] ?? [];
  const dollar = (minor: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(minor / 100);
  const inline = (value: string) => value.replace(/[\r\n]/g, ' ');
  const itemAppendix = roomItems.length
    ? `\n\n## Furniture & decor · separate owner proposals\n\nSaved studio revision ${saved.revision}. These items are not included in the finish scope above. Allowances are owner budgets, not verified prices. Dimensions, fit, product availability and installation remain unchecked.\n\n${roomItems
        .map((item) => {
          const total = studioItemBudget([item]).lines[0]!.totalMinor;
          return `- ${inline(item.name)} — ${item.action === 'keep' ? 'Keep existing' : `${item.action}; quantity ${item.quantity ?? 'unknown'}; allowance each ${item.unitAllowanceMinor === null ? 'not priced' : dollar(item.unitAllowanceMinor)}; total ${total === null ? 'not priced' : dollar(total)}`}${item.url ? `; owner product link: ${item.url}` : ''}`;
        })
        .join('\n')}\n`
    : '';
  return {
    markdown: markdown + itemAppendix,
    coverage: summary.coverage,
    sourceRevision: saved.revision,
    roomId: room.id,
    questions: summary.nextQuestions,
    checks: review?.findings ?? [],
  };
}
