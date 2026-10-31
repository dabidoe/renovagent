// One launcher for the connected product: the workspace API, the MCP HTTP
// listener and Vite, all started with the same resolved project settings
// (database, provider keys), from whichever checkout or worktree runs it.
//   npm run dev:connected   the configured database (Atlas); refuses if none
//   npm run dev:local       an explicit local Mongo on 27018, started here
//   npm run dev:accounts    as dev:connected, with Google/Meta sign-in
import { spawn, type ChildProcess } from 'node:child_process';
import { MongoClient } from 'mongodb';
import { LOCAL_URI, projectEnv, workspaceMongoConfig } from '../apps/api/src/database-config.js';

const local = process.argv.includes('--local');
const { env } = await projectEnv();
// Sign-in is opt-in. Google/Meta login settings exported in a shell would
// otherwise put the demo behind a login and an empty per-account workspace;
// without them the API runs one shared workspace. --accounts keeps sign-in.
const accounts = process.argv.includes('--accounts');
const SIGN_IN = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'GOOGLE_CALLBACK_URL',
  'META_APP_ID',
  'META_APP_SECRET',
  'META_REDIRECT_URI',
];
if (!accounts) for (const name of SIGN_IN) delete env[name];
if (local) {
  env.RENOVAGENT_MONGO_TARGET = 'local';
  env.RENOVAGENT_LOCAL_MONGO_URI = LOCAL_URI;
}
let database;
try {
  database = await workspaceMongoConfig(env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
console.log(
  accounts
    ? 'Sign-in: on (Google/Meta settings).'
    : 'Sign-in: off, one shared workspace (npm run dev:accounts to require sign-in).',
);
console.log(
  `Workspace database: ${database.target} (${database.source}` +
    `${database.envFile ? `, settings from ${database.envFile}` : ''}).`,
);

const children: ChildProcess[] = [];
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  for (const child of [...children].reverse()) child.kill('SIGTERM');
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
// A required child exiting stops everything; an optional one only warns.
const start = (label: string, args: string[], optional = false) => {
  const child = spawn(process.execPath, args, { stdio: 'inherit', env });
  children.push(child);
  child.on('exit', (code) => {
    if (stopping) return;
    if (optional) {
      console.warn(`${label} exited (${code}); the website and API keep running.`);
      return;
    }
    process.exitCode = 1;
    stop();
  });
  return child;
};

if (database.target === 'local')
  start('Local Mongo', ['--import', 'tsx', 'scripts/local-mongo.ts']);
let ready = false;
for (let attempt = 0; attempt < 120 && !stopping; attempt++) {
  const client = new MongoClient(database.uri, { serverSelectionTimeoutMS: 2000 });
  try {
    await client.connect();
    ready = true;
    break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } finally {
    await client.close();
  }
}
if (ready && !stopping) {
  start('Workspace API', ['--import', 'tsx', 'apps/api/src/server.ts']);
  start('MCP HTTP', ['--import', 'tsx', 'apps/api/src/mcp-http.ts'], true);
  start('Vite', [
    'node_modules/vite/bin/vite.js',
    '--host',
    '127.0.0.1',
    '--port',
    '8741',
    '--strictPort',
  ]);
} else {
  console.error('The workspace database did not answer; nothing else was started.');
  stop();
  process.exitCode = 1;
}
