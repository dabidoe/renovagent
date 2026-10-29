import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { workspaceMongoConfig } from '../../apps/api/src/database-config.js';

test('web/MCP database selection uses the cluster URI and explicit local selection', async () => {
  const root = await mkdtemp(join(tmpdir(), 'renovagent-database-config-'));
  try {
    await mkdir(join(root, 'server'));
    await writeFile(join(root, '.env'), 'MONGODB_URI="mongodb+srv://example.invalid/root"\n');
    await writeFile(
      join(root, 'server/.env'),
      'MONGODB_URI="mongodb+srv://example.invalid/workspace"\nMONGODB_URI_LOCAL="mongodb://127.0.0.1:27018/local_workspace"\n',
    );
    const cluster = await workspaceMongoConfig({}, root);
    assert.deepEqual(cluster, {
      uri: 'mongodb+srv://example.invalid/workspace',
      target: 'cluster',
      source: 'MONGODB_URI',
    });
    const local = await workspaceMongoConfig({ RENOVAGENT_MONGO_TARGET: 'local' }, root);
    assert.deepEqual(local, {
      uri: 'mongodb://127.0.0.1:27018/local_workspace',
      target: 'local',
      source: 'MONGODB_URI_LOCAL',
    });
    const explicit = await workspaceMongoConfig(
      { RENOVAGENT_MONGO_URI: 'mongodb://127.0.0.1:27018/isolated' },
      root,
    );
    assert.equal(explicit.uri, 'mongodb://127.0.0.1:27018/isolated');
    const environment = await workspaceMongoConfig(
      { MONGODB_URI: 'mongodb+srv://other.invalid/selected' },
      root,
    );
    assert.equal(environment.uri, 'mongodb+srv://other.invalid/selected');
    const atlasDefault = await workspaceMongoConfig(
      { MONGODB_URI: 'mongodb+srv://example.invalid/?retryWrites=true' },
      root,
    );
    assert.equal(
      atlasDefault.uri,
      'mongodb+srv://example.invalid/renovagent_workspace?retryWrites=true',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('database selection has an explicit local fallback and rejects misleading local/invalid config', async () => {
  const root = await mkdtemp(join(tmpdir(), 'renovagent-database-config-'));
  try {
    assert.equal((await workspaceMongoConfig({}, root)).source, 'default-local');
    await assert.rejects(workspaceMongoConfig({ MONGODB_URI: 'not-a-uri' }, root), /Invalid/);
    await assert.rejects(workspaceMongoConfig({ RENOVAGENT_MONGO_TARGET: 'typo' }, root), /TARGET/);
    await assert.rejects(
      workspaceMongoConfig(
        {
          RENOVAGENT_MONGO_TARGET: 'local',
          MONGODB_URI_LOCAL: 'mongodb+srv://example.invalid/remote',
        },
        root,
      ),
      /loopback/,
    );
    assert.equal(
      (await workspaceMongoConfig({ RENOVAGENT_MONGO_TARGET: 'local' }, root)).target,
      'local',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
