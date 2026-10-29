import { z } from 'zod';
import { DomainError, type Command } from '@renovagent/contracts';
import type { AttachmentBlob } from '@renovagent/core';
export const LEGACY_STORAGE_KEY = 'unpermitted-opening-v1';
const legacySchema = z
  .object({
    facts: z.record(z.unknown()),
    messages: z.array(z.unknown()).default([]),
    photos: z.array(z.object({ name: z.string(), dataUrl: z.string() }).passthrough()).default([]),
  })
  .passthrough();
export type LegacyImportPreview = {
  format: 'opening-v1';
  raw: string;
  facts: { key: string; text: string }[];
  photoCount: number;
  messageCount: number;
  warnings: string[];
};
export function previewLegacyImport(raw: string | null): LegacyImportPreview {
  if (!raw) throw new DomainError('VALIDATION', 'No legacy project found');
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new DomainError('VALIDATION', 'Legacy project is not valid JSON; original was preserved');
  }
  const parsed = legacySchema.safeParse(decoded);
  if (!parsed.success)
    throw new DomainError('VALIDATION', 'Unsupported legacy project shape; original was preserved');
  const source = parsed.data;
  const fields = ['goal', 'location', 'building', 'dimensions', 'budget', 'conditions', 'timeline'];
  const facts = fields.flatMap((key) =>
    typeof source.facts[key] === 'string' && source.facts[key].trim()
      ? [{ key, text: source.facts[key] as string }]
      : [],
  );
  const warnings = [
    'This imports a new project; the current localStorage preview remains unchanged.',
    'Legacy strings remain user-reported text, not verified measurements or technical findings.',
    'Permit booleans, completed-task flags, savings, and inferred compliance are not imported as approvals or completion.',
    'The original legacy JSON is retained as attachment evidence, including conversation and fields not mapped to facts.',
  ];
  if (source.photos.length)
    warnings.push(
      'Legacy reference images may already be compressed. Original camera files cannot be recovered.',
    );
  if (Object.keys(source.facts).some((key) => !fields.includes(key)))
    warnings.push('Some legacy fact keys are not mapped; inspect the retained source JSON.');
  return {
    format: 'opening-v1',
    raw,
    facts,
    photoCount: source.photos.length,
    messageCount: source.messages.length,
    warnings,
  };
}
export async function blobDigest(blob: Blob) {
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(hash), (n) => n.toString(16).padStart(2, '0')).join('');
}
function dataUrlBlob(url: string): Blob {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/.exec(url);
  if (!match)
    throw new DomainError(
      'VALIDATION',
      'Unsupported legacy photo encoding; original was preserved',
    );
  try {
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw Error('Invalid image size');
    return new Blob([bytes], { type: match[1] });
  } catch {
    throw new DomainError('VALIDATION', 'Invalid legacy photo bytes; original was preserved');
  }
}
export async function prepareLegacyImport(
  preview: LegacyImportPreview,
  options: {
    importId: string;
    projectId: string;
    propertyId: string;
    projectName: string;
    propertyName?: string;
    basePropertyRevision: number;
  },
): Promise<{ commands: Command[]; blobs: AttachmentBlob[] }> {
  // Reparse the retained source so a modified preview cannot introduce unreviewed inferred values.
  const reviewed = previewLegacyImport(preview.raw),
    source = legacySchema.parse(JSON.parse(reviewed.raw));
  let revision = 0,
    step = 0;
  const commands: Command[] = [],
    blobs: AttachmentBlob[] = [];
  const envelope = () => ({
    commandId: `${options.importId}:${step++}`,
    projectId: options.projectId,
    baseRevision: revision++,
  });
  commands.push({
    ...envelope(),
    basePropertyRevision: options.basePropertyRevision,
    type: 'CreateProject',
    payload: {
      propertyId: options.propertyId,
      name: options.projectName,
      ...(options.propertyName ? { newProperty: { name: options.propertyName } } : {}),
      spaces: [],
    },
  });
  const snapshotId = `${options.importId}:source`;
  const blobId = `${options.importId}:source-blob`;
  blobs.push({ id: blobId, blob: new Blob([reviewed.raw], { type: 'application/json' }) });
  const sourceDigest = await blobDigest(blobs[0].blob);
  commands.push({
    ...envelope(),
    type: 'AttachEvidence',
    payload: {
      scope: 'project',
      evidence: {
        id: snapshotId,
        kind: 'attachment',
        description:
          'Original opening-v1 local snapshot, unverified. Contains conversation and unmapped legacy fields.',
        attachment: {
          blobId,
          sha256: sourceDigest,
          name: 'legacy-project.json',
          mediaType: 'application/json',
          role: 'original',
        },
      },
    },
  });
  for (const fact of reviewed.facts)
    commands.push({
      ...envelope(),
      type: 'RecordFact',
      payload: {
        scope: 'project',
        factId: `${options.importId}:fact:${fact.key}`,
        subjectId: options.projectId,
        key: `legacy.${fact.key}`,
        supersedesRevision: 0,
        value: { kind: 'text', text: fact.text },
        assertion: 'user_reported',
        evidenceIds: [snapshotId],
      },
    });
  for (const [i, photo] of source.photos.entries()) {
    const id = `${options.importId}:photo:${i}`,
      blobId = `${id}:blob`,
      blob = dataUrlBlob(photo.dataUrl);
    blobs.push({ id: blobId, blob });
    const sha256 = await blobDigest(blob);
    commands.push({
      ...envelope(),
      type: 'AttachEvidence',
      payload: {
        scope: 'project',
        evidence: {
          id,
          kind: 'attachment',
          description:
            'Unanalyzed legacy reference image. Original camera file may be unavailable.',
          attachment: { blobId, sha256, name: photo.name, mediaType: blob.type, role: 'original' },
        },
      },
    });
  }
  return { commands, blobs };
}
