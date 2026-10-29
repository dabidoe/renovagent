// Operator script: import a curated catalog into Mongo.
// Usage: node --import tsx scripts/seed-catalog.ts [--uri mongodb://...] [--file catalog.json]
// Without --file, imports the demo vanity fixture. File imports must match
// the CatalogImport shape (products/offers/observations).
import { readFile } from 'node:fs/promises';
import { MongoClient } from 'mongodb';
import { CatalogStore } from '../apps/api/src/catalog.js';
import { vanityCatalog } from '../fixtures/catalog/vanity-philadelphia.js';

const option = (name: string) => {
  const flag = process.argv.findIndex((arg) => arg === `--${name}`);
  return (
    process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ??
    (flag >= 0 ? process.argv[flag + 1] : undefined)
  );
};
const uri =
  option('uri') ??
  process.env.WORKSPACE_MONGODB_URI ??
  'mongodb://127.0.0.1:27018/renovagent_workspace';
const file = option('file');
const batch = file ? JSON.parse(await readFile(file, 'utf8')) : vanityCatalog;
const client = new MongoClient(uri);
await client.connect();
const store = new CatalogStore(client.db());
await store.ensureIndexes();
const result = await store.importBatch(batch);
console.log(
  `Catalog import: ${result.products} products, ${result.offers} offers, ` +
    `${result.observations} observations, ${result.skipped} skipped as duplicates.`,
);
await client.close();
