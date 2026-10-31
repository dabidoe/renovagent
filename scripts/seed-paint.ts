// Load a brand's published swatch file (.ase) into the shared catalog:
//   npm run seed:paint -- --brand "Sherwin-Williams" --collection ColorSnap --file path/to/file.ase
// Brand files are downloaded by the owner from the brand's site and are not
// kept in this repository.
import { readFile } from 'node:fs/promises';
import { MongoClient } from 'mongodb';
import { paintColorsFrom, parseAse } from '@renovagent/core';
import { CatalogStore } from '../apps/api/src/catalog.js';
import { projectEnv, workspaceMongoConfig } from '../apps/api/src/database-config.js';

const option = (name: string) => {
  const flag = process.argv.indexOf(`--${name}`);
  return flag >= 0 ? process.argv[flag + 1] : undefined;
};
const brand = option('brand'),
  collection = option('collection') ?? 'Colors',
  file = option('file');
if (!brand || !file) {
  console.error(
    'Usage: npm run seed:paint -- --brand <name> [--collection <name>] --file <file.ase>',
  );
  process.exit(1);
}
const colors = paintColorsFrom(brand, collection, parseAse(new Uint8Array(await readFile(file))));
if (!colors.length) throw new Error('No RGB colours found in that file');
const { env } = await projectEnv();
const db = await workspaceMongoConfig(env);
const client = new MongoClient(db.uri);
try {
  await client.connect();
  const store = new CatalogStore(client.db());
  await store.ensureIndexes();
  const result = await store.importPaint(colors);
  console.log(
    `${brand} ${collection}: ${colors.length} colours (${result.upserted} new, ${result.modified} updated) into ${db.target} (${db.source})`,
  );
} finally {
  await client.close();
}
