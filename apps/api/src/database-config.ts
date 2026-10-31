import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

// The only Mongo that `npm run dev:local` (scripts/local-mongo.ts) starts.
export const LOCAL_URI = 'mongodb://127.0.0.1:27018/renovagent_workspace';

const read = async (path: string) => {
  try {
    return parseEnv(await readFile(path, 'utf8'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
};

// A git worktree (`.git` is a file pointing into <main>/.git/worktrees/...)
// shares its main checkout's configuration. Outside a worktree, or with no
// .git at all (a container), there is nothing to discover.
async function mainCheckout(root: string) {
  try {
    const pointer = (await readFile(resolve(root, '.git'), 'utf8')).match(/^gitdir:\s*(.+)$/m);
    const gitdir = pointer?.[1]?.trim();
    const at = gitdir?.lastIndexOf('/.git/worktrees/') ?? -1;
    return gitdir && at > 0 ? resolve(root, gitdir.slice(0, at)) : null;
  } catch {
    return null;
  }
}

// Project settings from one place: RENOVAGENT_ENV_FILE if set, else this
// checkout's .env and server/.env, else (in a worktree) the main checkout's.
export async function projectEnvFiles(env: NodeJS.ProcessEnv = process.env, root = process.cwd()) {
  const explicit = env.RENOVAGENT_ENV_FILE?.trim();
  if (explicit) {
    const path = resolve(root, explicit);
    const vars = await read(path);
    if (!vars) throw new Error(`RENOVAGENT_ENV_FILE not found: ${path}`);
    return { vars: vars as Record<string, string>, envFile: path };
  }
  const main = await mainCheckout(root);
  for (const dir of main ? [root, main] : [root]) {
    const found = [await read(resolve(dir, '.env')), await read(resolve(dir, 'server/.env'))];
    if (found.some(Boolean))
      return {
        vars: Object.assign({}, ...found.filter(Boolean)) as Record<string, string>,
        envFile: resolve(dir, '.env'),
      };
  }
  return { vars: {} as Record<string, string>, envFile: null };
}

// RENOVAGENT_* settings may override from the environment. Generic names such
// as MONGODB_URI are often inherited from other projects (shell or launchctl),
// so the project's own files win for those; hosts without files use env.
export async function projectEnv(env: NodeJS.ProcessEnv = process.env, root = process.cwd()) {
  const { vars, envFile } = await projectEnvFiles(env, root);
  const merged: Record<string, string> = { ...(env as Record<string, string>) };
  for (const [name, value] of Object.entries(vars) as [string, string][])
    if (!name.startsWith('RENOVAGENT_') || !env[name]?.trim()) merged[name] = value;
  return { env: merged, envFile };
}

// All connected entrypoints use this resolver so web, MCP and scripts cannot
// silently choose different databases. A missing configuration is an error;
// local Mongo is used only when asked for (RENOVAGENT_MONGO_TARGET=local).
export async function workspaceMongoConfig(
  env: NodeJS.ProcessEnv = process.env,
  root = process.cwd(),
) {
  const { env: merged, envFile } = await projectEnv(env, root);
  const value = (name: string) => merged[name]?.trim() || undefined;
  const mode = value('RENOVAGENT_MONGO_TARGET');
  if (mode && mode !== 'local' && mode !== 'configured')
    throw new Error('RENOVAGENT_MONGO_TARGET must be local or configured');
  const name =
    mode === 'local'
      ? ['RENOVAGENT_LOCAL_MONGO_URI', 'MONGODB_URI_LOCAL'].find((key) => value(key))
      : ['RENOVAGENT_MONGO_URI', 'WORKSPACE_MONGODB_URI', 'MONGODB_URI'].find((key) => value(key));
  if (!name && mode !== 'local')
    throw new Error(
      'No workspace database configured. Set RENOVAGENT_MONGO_URI in .env ' +
        '(or point RENOVAGENT_ENV_FILE at your settings), or run `npm run dev:local` ' +
        'for an explicit local Mongo.',
    );
  const supplied = (name && value(name)) || LOCAL_URI;
  // Atlas connection examples omit the database path. Use the existing
  // workspace database name instead of silently reading Mongo's empty 'test'.
  const uri = supplied.replace(
    /^(mongodb(?:\+srv)?:\/\/[^/?#]+)\/?(?=\?|$)/,
    '$1/renovagent_workspace',
  );
  const local = /^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(uri);
  if (!/^mongodb(?:\+srv)?:\/\//.test(uri)) throw new Error('Invalid workspace Mongo URI');
  if (mode === 'local' && !local) throw new Error('Local Mongo selection must use a loopback URI');
  return {
    uri,
    target: local ? ('local' as const) : ('cluster' as const),
    source: name || 'local-default',
    envFile,
  };
}
