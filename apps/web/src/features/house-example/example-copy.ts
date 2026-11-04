import { studioDesignSchema, type StudioDesign } from '@renovagent/contracts';
import type { HouseProject } from './paint-floor.js';

// Only this history entry may resume its private draft. Never read a template's
// old shared browser namespace or saved-project/pending-command pointers.
export function openExampleCopy(
  project: HouseProject,
  seed: StudioDesign | undefined,
  state: unknown,
  read: (key: string) => string | null,
  newId: () => string,
) {
  const pointer = (
    state as { renovagentExampleCopy?: { sourceId?: string; scope?: string } } | null
  )?.renovagentExampleCopy;
  const resumed =
    pointer?.sourceId === project.id &&
    typeof pointer.scope === 'string' &&
    /^example-copy-[a-f0-9-]{36}$/.test(pointer.scope);
  const scope = resumed ? pointer.scope! : `example-copy-${newId()}`;
  let draft: StudioDesign | undefined;
  if (resumed) {
    try {
      const parsed = studioDesignSchema.safeParse(
        JSON.parse(read(`renovagent.studio.${scope}.saved.v1.draft`) || 'null'),
      );
      if (parsed.success && parsed.data.project.id === scope) draft = parsed.data;
    } catch {
      /* Keep the template usable if recovery storage is unavailable. */
    }
  }
  return {
    scope,
    resumed: !!resumed,
    project: structuredClone(draft?.project ?? project),
    seed: draft ?? (seed ? structuredClone(seed) : undefined),
  };
}
