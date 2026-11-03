import test from 'node:test';
import assert from 'node:assert/strict';
import { developmentEnv } from '../../scripts/dev-settings.js';
import { hostingConfigFromEnv, isPublic, secureCookies } from '../../apps/api/src/hosting.js';

test('connected preview stays local with production settings while preserving database and providers', () => {
  const source = {
    RENOVAGENT_PUBLIC_URL: 'https://example.test',
    RENOVAGENT_HOST: '0.0.0.0',
    PORT: '8080',
    RENOVAGENT_STATIC_DIR: 'dist',
    RENOVAGENT_MCP_PUBLIC_URL: 'https://example.test',
    RENOVAGENT_MONGO_URI: 'mongodb://fixture/db',
    MUSE_API_KEY: 'fixture-only',
    GOOGLE_CLIENT_ID: 'fixture',
    GOOGLE_CLIENT_SECRET: 'fixture',
  };
  const env = developmentEnv(source, false);
  const hosting = hostingConfigFromEnv(env);
  assert.deepEqual(hosting, { listenHost: '127.0.0.1', listenPort: 4000 });
  assert.equal(isPublic(hosting), false);
  assert.equal(secureCookies(hosting), false);
  assert.equal(env.RENOVAGENT_MCP_PORT, '4010');
  assert.equal(env.RENOVAGENT_MONGO_URI, source.RENOVAGENT_MONGO_URI);
  assert.equal(env.MUSE_API_KEY, source.MUSE_API_KEY);
  assert.equal(env.GOOGLE_CLIENT_ID, undefined);
  assert.equal(source.PORT, '8080', 'the supplied configuration is not mutated');
});

test('explicit account-mode preview retains sign-in credentials and local networking', () => {
  const env = developmentEnv(
    { GOOGLE_CLIENT_ID: 'fixture', GOOGLE_CLIENT_SECRET: 'fixture' },
    true,
  );
  assert.equal(env.GOOGLE_CLIENT_ID, 'fixture');
  assert.equal(env.GOOGLE_CLIENT_SECRET, 'fixture');
  assert.equal(env.PORT, '4000');
});
