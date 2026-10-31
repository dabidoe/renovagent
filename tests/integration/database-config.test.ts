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
      envFile: join(root, '.env'),
    });
    const local = await workspaceMongoConfig({ RENOVAGENT_MONGO_TARGET: 'local' }, root);
    assert.deepEqual(local, {
      uri: 'mongodb://127.0.0.1:27018/local_workspace',
      target: 'local',
      source: 'MONGODB_URI_LOCAL',
      envFile: join(root, '.env'),
    });
    // dev:local names its own URI, ahead of an older MONGODB_URI_LOCAL.
    const devLocal = await workspaceMongoConfig(
      {
        RENOVAGENT_MONGO_TARGET: 'local',
        RENOVAGENT_LOCAL_MONGO_URI: 'mongodb://127.0.0.1:27018/renovagent_workspace',
      },
      root,
    );
    assert.equal(devLocal.uri, 'mongodb://127.0.0.1:27018/renovagent_workspace');
    const explicit = await workspaceMongoConfig(
      { RENOVAGENT_MONGO_URI: 'mongodb://127.0.0.1:27018/isolated' },
      root,
    );
    assert.equal(explicit.uri, 'mongodb://127.0.0.1:27018/isolated');
    // A MONGODB_URI inherited from another project never overrides this project's .env.
    const inherited = await workspaceMongoConfig(
      { MONGODB_URI: 'mongodb+srv://other.invalid/OtherProject' },
      root,
    );
    assert.equal(inherited.uri, 'mongodb+srv://example.invalid/workspace');
    // Without a .env (a hosted container), the environment is used.
    const bare = await mkdtemp(join(tmpdir(), 'renovagent-database-config-'));
    const atlasDefault = await workspaceMongoConfig(
      { MONGODB_URI: 'mongodb+srv://example.invalid/?retryWrites=true' },
      bare,
    );
    await rm(bare, { recursive: true, force: true });
    assert.equal(
      atlasDefault.uri,
      'mongodb+srv://example.invalid/renovagent_workspace?retryWrites=true',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('missing configuration is an error; local Mongo only when asked for', async () => {
  const root = await mkdtemp(join(tmpdir(), 'renovagent-database-config-'));
  try {
    await assert.rejects(workspaceMongoConfig({}, root), /No workspace database configured/);
    assert.equal(
      (await workspaceMongoConfig({ RENOVAGENT_MONGO_TARGET: 'local' }, root)).source,
      'local-default',
    );
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

test('a git worktree uses its main checkout settings; an explicit file wins', async () => {
  const main = await mkdtemp(join(tmpdir(), 'renovagent-main-'));
  try {
    const tree = join(main, '.claude/worktrees/feature');
    await mkdir(join(main, '.git/worktrees/feature'), { recursive: true });
    await mkdir(tree, { recursive: true });
    await writeFile(join(tree, '.git'), `gitdir: ${join(main, '.git/worktrees/feature')}\n`);
    await writeFile(join(main, '.env'), 'RENOVAGENT_MONGO_URI="mongodb+srv://main.invalid/db"\n');
    const found = await workspaceMongoConfig({}, tree);
    assert.equal(found.uri, 'mongodb+srv://main.invalid/db');
    assert.equal(found.envFile, join(main, '.env'));
    // The worktree's own .env, when present, comes first.
    await writeFile(join(tree, '.env'), 'RENOVAGENT_MONGO_URI="mongodb+srv://tree.invalid/db"\n');
    assert.equal((await workspaceMongoConfig({}, tree)).uri, 'mongodb+srv://tree.invalid/db');
    // RENOVAGENT_ENV_FILE names the settings outright.
    await writeFile(
      join(main, 'other.env'),
      'RENOVAGENT_MONGO_URI="mongodb+srv://other.invalid/db"\n',
    );
    const named = await workspaceMongoConfig(
      { RENOVAGENT_ENV_FILE: join(main, 'other.env') },
      tree,
    );
    assert.equal(named.uri, 'mongodb+srv://other.invalid/db');
    await assert.rejects(
      workspaceMongoConfig({ RENOVAGENT_ENV_FILE: join(main, 'missing.env') }, tree),
      /not found/,
    );
    // No .git (a container) or a plain checkout: nothing is discovered.
    await assert.rejects(workspaceMongoConfig({}, main + '-absent'), /No workspace database/);
  } finally {
    await rm(main, { recursive: true, force: true });
  }
});
