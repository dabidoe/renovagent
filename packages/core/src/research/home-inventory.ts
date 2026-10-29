import {
  DomainError,
  type Artifact,
  type Workspace,
  type Command,
  type CommandContext,
  type InputRef,
} from '@renovagent/contracts';
import { referenceCurrent, resolveRef } from '../domain/invalidate.js';
import { addMessage } from '../domain/workflow.js';
export const inventoryId = (pid: string) => `${pid}:photo-inventory`;
export const inventoryDirectionId = (pid: string, sourceRevision: number, itemId: string) =>
  `${pid}:inventory-direction:r${sourceRevision}:${itemId}`;
export function homeInventory(state: Workspace, pid: string) {
  const inventory = state.artifacts[inventoryId(pid)]?.at(-1);
  return inventory?.payload.kind === 'photo-inventory' ? inventory : undefined;
}
export function inventoryDirections(state: Workspace, pid: string, inventory: Artifact) {
  return Object.values(state.artifacts)
    .map((v) => v.at(-1)!)
    .filter(
      (a) =>
        a &&
        a.projectId === pid &&
        a.payload.kind === 'inventory-direction' &&
        a.inputRefs.some(
          (r) =>
            r.kind === 'artifact' && r.id === inventory.id && r.revision === inventory.revision,
        ),
    );
}
export function handleHomeInventory(state: Workspace, command: Command, ctx: CommandContext) {
  if (command.type !== 'ImportPhotoInventory' && command.type !== 'SetInventoryDirection')
    return null;
  const pid = command.projectId;
  function store(
    id: string,
    expected: number,
    payload: Artifact['payload'],
    refs: InputRef[],
    evidenceIds: string[] = [],
  ) {
    const old = state.artifacts[id]?.at(-1);
    if ((old && old.payload.kind !== payload.kind) || (old?.revision || 0) !== expected)
      throw new DomainError(
        'CONFLICT',
        'This record changed. Reload the current item before saving.',
      );
    (state.artifacts[id] ||= []).push({
      schemaVersion: 1,
      id,
      projectId: pid,
      revision: expected + 1,
      lifecycle: 'proposed',
      freshness: 'current',
      createdAt: ctx.now,
      acceptedAt: null,
      inputRefs: refs,
      evidenceIds,
      payload,
    });
    return id;
  }
  if (command.type === 'ImportPhotoInventory') {
    const p = command.payload;
    const source = resolveRef(state, pid, p.researchRef);
    if (
      p.researchRef.kind !== 'artifact' ||
      p.researchRef.id !== `${pid}:property-research` ||
      !('payload' in source) ||
      source.payload.kind !== 'property-research' ||
      !referenceCurrent(state, pid, p.researchRef)
    )
      throw new DomainError('STALE', 'Import current property photo research first.');
    for (const photo of p.inventory.photos) {
      const original = source.payload.photoReview?.photos.find(
        (i) => i.id === photo.id && i.status === 'reviewed',
      );
      if (!original || original.sha256 !== photo.sha256)
        throw new DomainError(
          'VALIDATION',
          'Inventory must match the exact inspected image bytes.',
        );
    }
    return [store(inventoryId(pid), p.expectedInventoryRevision, p.inventory, [p.researchRef])];
  }
  if (command.type === 'SetInventoryDirection') {
    const p = command.payload;
    const source = resolveRef(state, pid, p.inventoryRef);
    if (
      p.inventoryRef.kind !== 'artifact' ||
      p.inventoryRef.id !== inventoryId(pid) ||
      !('payload' in source) ||
      source.payload.kind !== 'photo-inventory' ||
      !referenceCurrent(state, pid, p.inventoryRef)
    )
      throw new DomainError(
        'STALE',
        'Photo inventory changed. Review the current image before saving direction.',
      );
    const item = source.payload.items.find((i) => i.id === p.itemId);
    if (!item) throw new DomainError('VALIDATION', 'The selected item is not in this inventory.');
    if ((p.disposition === 'exclude') !== (p.identification === 'rejected'))
      throw new DomainError(
        'VALIDATION',
        'Reject a misidentified object explicitly; it cannot also enter the work scope.',
      );
    const id = inventoryDirectionId(pid, source.revision, item.id);
    const direction = {
      kind: 'inventory-direction' as const,
      itemId: p.itemId,
      disposition: p.disposition,
      identification: p.identification,
      correctedLabel: p.correctedLabel,
      note: p.note,
      verification: 'user-reported' as const,
    };
    store(id, p.expectedDirectionRevision, direction, [p.inventoryRef], [p.messageId]);
    addMessage(
      state,
      pid,
      p.messageId,
      `${p.correctedLabel || item.label}: ${p.disposition}. Identification ${p.identification}. ${p.note}`,
      ctx,
      {
        user: true,
        evidenceIds: [],
        artifactRefs: [{ kind: 'artifact', id, revision: p.expectedDirectionRevision + 1 }],
      },
    );
    return [id];
  }
  return null;
}
