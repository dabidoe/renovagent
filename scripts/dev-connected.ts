import { spawn, type ChildProcess } from 'node:child_process';
import { MongoClient } from 'mongodb';
import { workspaceMongoConfig } from '../apps/api/src/database-config.js';
const children: ChildProcess[] = [];
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  for (const child of [...children].reverse()) child.kill('SIGTERM');
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
const start = (args: string[]) => {
  const child = spawn(process.execPath, args, { stdio: 'inherit', env: process.env });
  children.push(child);
  child.on('exit', () => {
    if (!stopping) {
      process.exitCode = 1;
      stop();
    }
  });
  return child;
};
const database = await workspaceMongoConfig();
console.log(`Connected workspace uses Mongo ${database.target} (${database.source}).`);
if (database.target === 'local') start(['--import', 'tsx', 'scripts/local-mongo.ts']);
let ready = false;
for (let attempt = 0; attempt < 120 && !stopping; attempt++) {
  const client = new MongoClient(database.uri, { serverSelectionTimeoutMS: 500 });
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
  start(['--import', 'tsx', 'apps/api/src/server.ts']);
  start(['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '8741', '--strictPort']);
} else {
  stop();
  process.exitCode = 1;
}
