import { scopeRecipeVersion } from '../research/scope-recipe.js';
import { type Artifact } from '@unpermitted/contracts';
import { sourceSetVersion } from './sources.js';
import { localProfileVersion } from './locality.js';
import { halfBathPlaybookVersion } from './playbook.js';
export function technicalVersionCurrent(artifact: Artifact): boolean {
  const p = artifact.payload;
  if (p.kind === 'project-options' || p.kind === 'project-work-plan')
    return p.recipe === scopeRecipeVersion;
  if (p.kind === 'planning-sources') return p.version === sourceSetVersion;
  if (p.kind === 'gated-plan') return p.playbook === halfBathPlaybookVersion;
  if (p.kind === 'code-assessment')
    return (
      p.playbook === halfBathPlaybookVersion &&
      (!p.locality || p.locality.profileVersion === localProfileVersion)
    );
  return true;
}
