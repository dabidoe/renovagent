// A new route owns one browser draft. Reloading that route resumes only that
// draft; choosing New project always creates another identity.
const CURRENT = 'renovagent.own-project.current-id.v1';
export const OWN_STUDIO_STORE = 'renovagent.own-project.v1';

export function newOwnStudioHash() {
  return `#new-project/own-${crypto.randomUUID()}`;
}

export function ownStudioDraftId(hash: string) {
  return /^#new-project\/(own-[A-Za-z0-9_-]{1,80})$/.exec(hash)?.[1] ?? null;
}

export function ownStudioStore(draftId?: string) {
  return draftId ? `${OWN_STUDIO_STORE}.${draftId}` : OWN_STUDIO_STORE;
}

export function rememberOwnStudio(draftId?: string) {
  try {
    if (draftId) localStorage.setItem(CURRENT, draftId);
    else localStorage.removeItem(CURRENT);
  } catch {
    // The project still works for this visit when recovery storage is blocked.
  }
}

export function resumeOwnStudioHash() {
  try {
    const id = localStorage.getItem(CURRENT);
    if (id && ownStudioDraftId(`#new-project/${id}`)) return `#new-project/${id}`;
  } catch {
    // Retain the older browser-recovery route when storage is unavailable.
  }
  return '#resume-project';
}
