import type { Fact, Workspace } from '@renovagent/contracts';
import {
  boxRoomModel,
  roomDimensionFact,
  roomModelFromPlan,
  type RoomModel,
} from '@renovagent/core';

export type RoomSource = {
  model: RoomModel;
  // The plan file the model was built from, if any.
  evidenceId: string | null;
  label: string;
  warnings: string[];
};

const dims = ['length', 'width', 'height', 'area', 'perimeter'] as const;
const metres = (fact: Fact | undefined) =>
  fact?.value.kind === 'quantity' && fact.value.dimension === 'length'
    ? fact.value.amount / 1000
    : null;

// The plan cited by the current room facts wins; otherwise a box from measured
// length × width. A plan is flagged when newer measurements did not come from it.
export async function loadRoomSource(
  state: Workspace,
  projectId: string,
  readBlob: (blobId: string) => Promise<Blob | undefined>,
): Promise<RoomSource | null> {
  const facts = dims
    .map((d) => roomDimensionFact(state, projectId, d))
    .filter((f): f is Fact => !!f);
  const planEvidence = facts
    .flatMap((f) => f.evidenceIds.map((id) => ({ fact: f, evidence: state.evidence[id] })))
    .filter((e) => e.evidence?.source.attachment?.mediaType === 'application/json')
    .sort((a, b) => b.fact.recordedAt.localeCompare(a.fact.recordedAt))[0];
  if (planEvidence) {
    const attachment = planEvidence.evidence.source.attachment!;
    const blob = await readBlob(attachment.blobId);
    if (blob) {
      const model = roomModelFromPlan(JSON.parse(await blob.text()));
      const newer = facts.filter(
        (f) =>
          f.recordedAt > planEvidence.fact.recordedAt &&
          !f.evidenceIds.includes(planEvidence.evidence.id),
      );
      return {
        model,
        evidenceId: planEvidence.evidence.id,
        label: `From ${attachment.name}`,
        warnings: newer.length
          ? ['Measurements were updated after this plan; the 3D room may be out of date.']
          : [],
      };
    }
  }
  const [length, width, height] = ['length', 'width', 'height'].map((d) =>
    metres(roomDimensionFact(state, projectId, d as (typeof dims)[number])),
  );
  if (length && width)
    return {
      model: boxRoomModel({ lengthM: length, widthM: width, heightM: height }),
      evidenceId: null,
      label: 'Box from your measured length × width',
      warnings: [],
    };
  return null;
}
