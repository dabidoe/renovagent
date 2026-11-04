// The URL chooses the page; a saved active project never chooses the home page.
import { ownStudioDraftId } from '../features/house-example/own-studio-route.js';
export const landingAnchors = new Set([
  '#product-proof',
  '#studio-possibilities',
  '#agent-connection',
  '#compare-tools',
]);

export function canonicalPublicHash(hash: string) {
  if (hash === '#examples') return '#studio';
  if (hash === '#your-project') return '#new-project';
  return hash;
}

export function publicRoute(hash: string) {
  hash = canonicalPublicHash(hash);
  if (ownStudioDraftId(hash) || hash === '#resume-project') return 'studio';
  if (hash === '#notebook' || /^#project\/[A-Za-z0-9_:%-]+\/notebook$/.test(hash)) return 'studio';
  if (/^#share\/[A-Za-z0-9_-]{43}$/.test(hash)) return 'studio';
  if (/^#connect\/approve\/[A-Za-z0-9_-]{43}$/.test(hash)) return 'studio';
  if (/^#workspace(?:\/(?:projects|example-room))?$/.test(hash)) return 'workspace';
  if (
    /^#(example-house|new-project|projects|studio|connect|example\/[a-z0-9-]+|plan\/[A-Za-z0-9_-]{22}|design\/[A-Za-z0-9_:%-]+\/[1-9][0-9]*)$/.test(
      hash,
    )
  )
    return 'studio';
  return 'landing';
}
