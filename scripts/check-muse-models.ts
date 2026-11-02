// Read-only provider diagnostics. No inference, photos, prompts or database writes.
// Run in the environment being diagnosed: node --import tsx scripts/check-muse-models.ts
import {
  configuredMuseKey,
  MUSE_VISION_MODEL,
  MUSE_IMAGE_MODEL,
  SAM_MODEL,
} from './muse-provider.js';

const key = await configuredMuseKey();
if (!key) {
  console.error('MUSE_API_KEY is not configured.');
  process.exitCode = 1;
} else {
  for (const model of [MUSE_VISION_MODEL, MUSE_IMAGE_MODEL, SAM_MODEL]) {
    try {
      const response = await fetch(`https://api.meta.ai/v1/models/${model}`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(20000),
      });
      // Status plus our requested model ID is sufficient; discard the response body.
      await response.body?.cancel();
      console.log(JSON.stringify({ model, status: response.status, available: response.ok }));
      if (!response.ok) process.exitCode = 1;
    } catch {
      console.log(
        JSON.stringify({ model, available: false, error: 'request failed or timed out' }),
      );
      process.exitCode = 1;
    }
  }
}
