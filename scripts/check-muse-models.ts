// Read-only provider diagnostics. No inference, photos, prompts or database writes.
// Run in the environment being diagnosed: node --import tsx scripts/check-muse-models.ts
import { metaAccessMode, museModelAvailability } from './muse-provider.js';

const mode = await metaAccessMode();
console.log(JSON.stringify({ mode }));
const result = await museModelAvailability();
if (!result.configured) {
  console.error(
    'Configure MUSE_API_KEY or both RENOVAGENT_META_BASE_URL and RENOVAGENT_META_TOKEN.',
  );
  process.exitCode = 1;
} else {
  for (const model of result.models) {
    console.log(JSON.stringify(model));
    if (!model.available) process.exitCode = 1;
  }
}
