// Operator script: import the curated demo catalog into Mongo.
// Usage: node --import tsx scripts/seed-catalog.ts [--uri mongodb://...]
import { MongoClient } from 'mongodb';
import { CatalogStore } from '../apps/api/src/catalog.js';
import { vanityCatalog } from '../fixtures/catalog/vanity-philadelphia.js';

const flag = process.argv.findIndex((arg) => arg === '--uri');
const uri =
  process.argv.find((arg) => arg.startsWith('--uri='))?.slice('--uri='.length) ??
  (flag >= 0 ? process.argv[flag + 1] : undefined) ??
  process.env.WORKSPACE_MONGODB_URI ??
  'mongodb://127.0.0.1:27018/renovagent_workspace';
const client = new MongoClient(uri);
await client.connect();
const store = new CatalogStore(client.db());
await store.ensureIndexes();
const result = await store.importBatch(vanityCatalog);
console.log(
  `Catalog import: ${result.products} products, ${result.offers} offers, ` +
    `${result.observations} observations, ${result.skipped} skipped as duplicates.`,
);
await client.close();
