// The URL chooses the page; a saved active project never chooses the home page.
export const landingAnchors = new Set([
  '#product-proof',
  '#studio-possibilities',
  '#agent-connection',
  '#compare-tools',
]);

export function publicRoute(hash: string) {
  if (hash === '#notebook' || /^#project\/[A-Za-z0-9_:%-]+\/notebook$/.test(hash)) return 'studio';
  if (/^#share\/[A-Za-z0-9_-]{43}$/.test(hash)) return 'studio';
  if (/^#connect\/approve\/[A-Za-z0-9_-]{43}$/.test(hash)) return 'studio';
  if (/^#workspace(?:\/(?:projects|example-room))?$/.test(hash)) return 'workspace';
  if (
    /^#(example-house|your-project|projects|examples|connect|example\/[a-z0-9-]+|plan\/[A-Za-z0-9_-]{22}|design\/[A-Za-z0-9_:%-]+\/[1-9][0-9]*)$/.test(
      hash,
    )
  )
    return 'studio';
  return 'landing';
}
