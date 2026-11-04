import {
  sampleForFile,
  tagSampleFile,
  sampleRoomSchema,
  type SampleRoom,
} from '../project-start/sample-rooms.js';
// Browser-only recovery, including the actual files. A failed provider call must
// not turn a reload into a second photo-upload exercise. This is not an account save.
export type OwnIntakeDraft = {
  idea: string;
  where: string;
  ceiling: string;
  photos: File[];
  plans: File[];
};
type StoredFile = { blob: Blob; name: string; lastModified: number; sample?: SampleRoom };
type StoredDraft = Omit<OwnIntakeDraft, 'photos' | 'plans'> & {
  photos: StoredFile[];
  plans: StoredFile[];
};
const DATABASE = 'renovagent-own-intake';
let writes: Promise<unknown> = Promise.resolve();
const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
async function access<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction('drafts', mode);
      const request = action(tx.objectStore('drafts'));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () =>
        reject(tx.error ?? request.error ?? new Error('Draft storage failed'));
    });
  } finally {
    db.close();
  }
}
const storeFile = (file: File): StoredFile => ({
  blob: file,
  sample: sampleForFile(file),
  name: file.name,
  lastModified: file.lastModified,
});
const restoreFile = (file: StoredFile) => {
  const restored = new File([file.blob], file.name, {
    type: file.blob.type,
    lastModified: file.lastModified,
  });
  const sample = sampleRoomSchema.safeParse(file.sample);
  return sample.success ? tagSampleFile(restored, sample.data) : restored;
};
export async function loadOwnIntake(draftId?: string): Promise<OwnIntakeDraft | null> {
  await writes.catch(() => {});
  const draft = await access<StoredDraft | undefined>('readonly', (store) =>
    store.get(draftId ?? 'current'),
  );
  return draft
    ? { ...draft, photos: draft.photos.map(restoreFile), plans: draft.plans.map(restoreFile) }
    : null;
}
export function saveOwnIntake(draft: OwnIntakeDraft | null, draftId?: string): Promise<void> {
  // Serialize saves and clears, including the last keystroke before Build.
  const next = writes
    .catch(() => {})
    .then(async () => {
      if (!draft) await access('readwrite', (store) => store.delete(draftId ?? 'current'));
      else
        await access('readwrite', (store) =>
          store.put(
            {
              ...draft,
              photos: draft.photos.map(storeFile),
              plans: draft.plans.map(storeFile),
            } satisfies StoredDraft,
            draftId ?? 'current',
          ),
        );
    });
  writes = next;
  return next;
}

// Provider navigation must wait for the actual file transaction to finish.
export async function flushOwnIntakeSave() {
  await writes;
}
