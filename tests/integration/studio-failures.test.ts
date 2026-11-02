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

test('an empty SAM response is an unavailable preview, never a zero-sized saved mask', async () => {
  const route = studioRoutes({
    images,
    spend: () => {},
    providers: {
      ...providers,
      segment: async () => ({ text: '', model: 'fixture', runId: 'fixture' }),
    },
  });
  await assert.rejects(
    () => route('/studio/walls', 'owner', { sha256 }),
    (error: unknown) =>
      error instanceof DomainError &&
      error.code === 'STORAGE' &&
      /Wall outlines were unavailable/.test(error.message),
  );
});
test('provider failures keep a machine signal in the server log but never leak response text', async () => {
  const warnings: string[] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(' '));
  };
  try {
    const failing = (failure: unknown) =>
      studioRoutes({
        images,
        spend: () => {},
        providers: {
          ...providers,
          read: async () => {
            throw failure;
          },
        },
      });
    const input = { sha256, brief: '', keep: '' };
    const upstream = Error('Meta Model API 503: upstream exploded with secret-token');
    (upstream as unknown as { status: number }).status = 503;
    await assert.rejects(
      () => failing(upstream)('/studio/ideas', 'owner', input),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.code, 'STORAGE');
        assert.match(error.message, /Room ideas.*service unavailable/);
        assert.doesNotMatch(error.message, /exploded|secret-token/);
        return true;
      },
    );
    assert.match(warnings.join('\n'), /\/studio\/ideas: service unavailable \(upstream 503\)/);

    const limited = Error('Meta Model API 429: Rate limit exceeded, retry shortly');
    (limited as unknown as { status: number }).status = 429;
    await assert.rejects(() => failing(limited)('/studio/ideas', 'owner', input), /provider busy/);

    const cut = Error('Meta Model API unreachable');
    (cut as unknown as { code: string }).code = 'ENOTFOUND';
    await assert.rejects(
      () => failing(cut)('/studio/ideas', 'owner', input),
      /provider unreachable/,
    );
    assert.match(warnings.join('\n'), /\(ENOTFOUND\)/);

    const missing = Object.assign(Error('private upstream text and secret-token'), {
      status: 404,
      providerCode: 'model_not_found',
      model: 'muse-spark-1.3',
      endpoint: '/responses',
    });
    await assert.rejects(
      () => failing(missing)('/studio/ideas', 'owner', input),
      /model or endpoint unavailable/,
    );
    assert.match(
      warnings.join('\n'),
      /upstream 404.*endpoint=\/responses model=muse-spark-1\.3 code=model_not_found/,
    );
    assert.doesNotMatch(warnings.join('\n'), /private upstream|secret-token/);

    await assert.rejects(
      () =>
        failing(Error('Muse did not complete this job: failed'))('/studio/ideas', 'owner', input),
      /unexpected provider result/,
    );
  } finally {
    console.warn = warn;
  }
});
