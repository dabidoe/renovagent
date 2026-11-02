import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '@renovagent/contracts';
import { studioRoutes, ceilingSchema, type StudioProviders } from '../../apps/api/src/studio.js';
import type { DesignImageStore } from '../../apps/api/src/design-images.js';

const sha256 = 'a'.repeat(64);
const images = {
  get: async () => ({ bytes: new Uint8Array([255, 216, 255]), record: {} }),
} as unknown as DesignImageStore;
const providers: StudioProviders = {
  segment: async () => {
    throw Error('unused');
  },
  repaint: async () => {
    throw Error('unused');
  },
  read: async () => {
    throw Error('Meta Model API 503: private upstream text and secret-token');
  },
};
test('a provider outage reports a safe room-analysis failure and preserves the distinction from input validation', async () => {
  const route = studioRoutes({ images, providers, spend: () => {} });
  await assert.rejects(
    () => route('/studio/read', 'owner', { photos: [sha256], plans: [] }),
    (error: unknown) => {
      assert.ok(error instanceof DomainError);
      assert.equal(error.code, 'STORAGE');
      assert.match(error.message, /Room analysis.*service unavailable/);
      assert.doesNotMatch(error.message, /secret-token|private upstream/);
      return true;
    },
  );
  await assert.rejects(
    () => route('/studio/read', 'owner', { photos: [], plans: [] }),
    (error: unknown) => error instanceof DomainError && error.code === 'VALIDATION',
  );
});
test('room analysis cannot silently drop an uploaded photo or open an empty project', async () => {
  const route = studioRoutes({
    images,
    spend: () => {},
    providers: {
      ...providers,
      read: async ({ schema }) => ({
        result:
          schema === ceilingSchema ? { estimateFt: 8, basis: 'door' } : { photos: [], plans: [] },
        model: 'fixture',
        runId: 'fixture',
      }),
    },
  });
  await assert.rejects(
    () => route('/studio/read', 'owner', { photos: [sha256], plans: [] }),
    /did not return every room photo/,
  );
});
