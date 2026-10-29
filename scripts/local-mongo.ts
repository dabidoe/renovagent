// Real local mongod, with an explicit persistent dbPath. Never use an ephemeral test database for app state.
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const dbPath = resolve('.local/mongo');
await mkdir(dbPath, { recursive: true });
const mongo = new MongoMemoryServer({
  binary: { version: '8.0.16', downloadDir: resolve('.local/mongodb-binaries') },
  instance: {
    port: 27018,
    ip: '127.0.0.1',
    dbPath,
    dbName: 'unpermitted_workspace',
    storageEngine: 'wiredTiger',
  },
});
await mongo.start(true);
console.log('Persistent local MongoDB ready on 127.0.0.1:27018');
const stop = async () => {
  await mongo.stop({ doCleanup: false });
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
