import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

const LOCAL_URI = 'mongodb://127.0.0.1:27018/renovagent_workspace';

// The existing owner configuration names the cluster MONGODB_URI and keeps
// local development in MONGODB_URI_LOCAL. All connected entrypoints use this
// resolver so web and MCP cannot silently choose different defaults.
export async function workspaceMongoConfig(
  env: NodeJS.ProcessEnv = process.env,
  root = process.cwd(),
) {
  const files: Record<string, string> = {};
  for (const path of ['.env', 'server/.env']) {
    try {
      Object.assign(files, parseEnv(await readFile(resolve(root, path), 'utf8')));
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }
  const value = (name: string) => env[name]?.trim() || files[name]?.trim();
  const mode = value('RENOVAGENT_MONGO_TARGET');
  if (mode && mode !== 'local' && mode !== 'configured')
    throw new Error('RENOVAGENT_MONGO_TARGET must be local or configured');
  const name =
    mode === 'local'
      ? 'MONGODB_URI_LOCAL'
      : ['RENOVAGENT_MONGO_URI', 'WORKSPACE_MONGODB_URI', 'MONGODB_URI'].find((key) => value(key));
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
    source: name || 'default-local',
  };
}
