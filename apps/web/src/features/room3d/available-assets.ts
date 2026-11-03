/// <reference types="vite/client" />
import type { StudioAssetId } from '@renovagent/contracts';
import { studioAsset } from '@renovagent/core';

// Restricted fixtures are imported locally, and absent from a clean hosted build.
const localFixtures = import.meta.glob('/public/furniture/bathroom/*.glb', {
  query: '?url',
  import: 'default',
});
export function studioAssetAvailable(id: StudioAssetId) {
  const url = studioAsset(id).url;
  return !url || `/public${url}` in localFixtures;
}
