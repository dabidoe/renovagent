import type { ProjectReference } from '@renovagent/contracts';
export const PROJECT_PHOTO_LIMIT = 5;
export type ReferenceInput = { reference: ProjectReference; photos?: File[] };
export const PROJECT_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export type ProjectIntakeInput = {
  name: string;
  goal: string;
  propertyId?: string;
  propertyName: string;
  underway: boolean;
  sample?: boolean;
  address?: string;
  room?: string;
  approach?: 'diy' | 'contractor' | 'undecided';
  budgetMinor?: number;
  photos?: File[];
  photoKind?: 'room' | 'inspiration';
  references?: ReferenceInput[];
};
export function validateProjectPhotos(files: readonly File[]) {
  if (files.length > PROJECT_PHOTO_LIMIT)
    throw new Error(`Choose up to ${PROJECT_PHOTO_LIMIT} photos.`);
  for (const file of files) {
    if (!file.size || file.size > 20 * 1024 * 1024)
      throw new Error('Each photo must be between 1 byte and 20 MB.');
    if (!PROJECT_PHOTO_TYPES.includes(file.type as (typeof PROJECT_PHOTO_TYPES)[number]))
      throw new Error('Use JPG, PNG, WebP or GIF photos.');
    if (!file.name || file.name.length > 300)
      throw new Error('Use photo filenames shorter than 300 characters.');
  }
}

// The New Project intake uploads raw files to /studio/photo, which stages
// JPEG, PNG, WebP, GIF, HEIC and HEIF only. Validate at selection so a bad
// file fails here with a legible message instead of mid-upload (an oversize
// file aborts the connection before the server's error arrives, surfacing as
// "Failed to fetch"; a typeless file fails as "Expected JSON").
export const INTAKE_PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
] as const;
export function validateIntakePhotos(files: readonly File[]) {
  for (const file of files) {
    if (!file.size || file.size > 20 * 1024 * 1024)
      throw new Error(
        `“${file.name || 'Photo'}” must be between 1 byte and 20 MB. Pick a smaller photo.`,
      );
    if (
      !file.type ||
      !INTAKE_PHOTO_TYPES.includes(file.type as (typeof INTAKE_PHOTO_TYPES)[number])
    )
      throw new Error(
        `“${file.name || 'Photo'}” is not a supported photo. Use JPG, PNG, WebP, GIF or HEIC.`,
      );
    if (!file.name || file.name.length > 300)
      throw new Error('Use photo filenames shorter than 300 characters.');
  }
}
