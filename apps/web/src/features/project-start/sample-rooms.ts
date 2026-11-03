import { z } from 'zod';

// UI asset metadata only. This never supplies room facts or model results.
export const sampleRoomSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(1).max(100),
  roomType: z.string().trim().min(1).max(100),
  file: z.string().regex(/^[a-z0-9-]+\.jpg$/),
  source: z.string().trim().min(1).max(300),
  license: z.string().trim().min(1).max(300),
  suggestions: z.array(z.string().trim().min(3).max(300)).max(6),
});
export type SampleRoom = z.infer<typeof sampleRoomSchema>;
export function parseSampleRooms(value: unknown): SampleRoom[] {
  if (!Array.isArray(value)) throw new Error('Sample room manifest must be a list.');
  const seen = new Set<string>();
  return value.flatMap((entry) => {
    const parsed = sampleRoomSchema.safeParse(entry);
    if (!parsed.success || seen.has(parsed.data.id)) return [];
    seen.add(parsed.data.id);
    return [parsed.data];
  });
}
export const sampleThumbnail = (room: SampleRoom) =>
  `/starter-rooms/${room.file.replace(/\.jpg$/, '-thumb.jpg')}`;
const fileSamples = new WeakMap<File, SampleRoom>();
export function tagSampleFile(file: File, room: SampleRoom) {
  fileSamples.set(file, room);
  return file;
}
export const sampleForFile = (file: File) => fileSamples.get(file);
export async function fetchSampleFile(room: SampleRoom): Promise<File> {
  const response = await fetch(`/starter-rooms/${room.file}`);
  if (!response.ok) throw new Error(`Sample photo could not be fetched (HTTP ${response.status}).`);
  const blob = await response.blob();
  if (!blob.size || !blob.type.startsWith('image/jpeg'))
    throw new Error('Sample photo must be a nonempty JPEG.');
  return tagSampleFile(new File([blob], room.file, { type: 'image/jpeg' }), room);
}
// Browser-local provenance follows the uploaded image hash, without changing API/domain contracts.
const provenanceKey = (sha: string) => `renovagent.sample-room.${sha}`;
const uploadedSamples = new Map<string, SampleRoom>();
export function rememberSampleUpload(file: File, sha: string) {
  const sample = sampleForFile(file);
  if (!sample) return;
  uploadedSamples.set(sha, sample);
  try {
    localStorage.setItem(provenanceKey(sha), JSON.stringify(sample));
  } catch {
    /* Still available for this visit. */
  }
}
export function sampleForPhoto(src: string): SampleRoom | undefined {
  const sha = /\/design-images\/([a-f0-9]{64})$/.exec(src)?.[1];
  if (!sha) return;
  if (uploadedSamples.has(sha)) return uploadedSamples.get(sha);
  try {
    const parsed = sampleRoomSchema.safeParse(
      JSON.parse(localStorage.getItem(provenanceKey(sha)) || 'null'),
    );
    return parsed.success ? parsed.data : undefined;
  } catch {
    return;
  }
}
