// Operator script: import a curated catalog into Mongo.
// Usage: node --import tsx scripts/seed-catalog.ts [--uri mongodb://...]
//          [--set retail|demo] [--file catalog.json] [--retire-demo]
// --set retail (default) imports the hand-checked retail reference prices and
// the designer/big-box picks used by curated looks;
// --set demo imports the fictional vanity and living-room fixtures. Load one
// set per database: tier plans take every product in a category, so mixing
// fictional and real products would blend their prices. --retire-demo deletes
// exactly the demo fixture records (by ID) before importing, and nothing else.
// Identical records already present are skipped. File imports must match the
// CatalogImport shape (products/offers/observations).
import { readFile } from 'node:fs/promises';
import { MongoClient } from 'mongodb';
import type { CatalogImport } from '@renovagent/contracts';
import { CatalogStore } from '../apps/api/src/catalog.js';
import { vanityCatalog } from '../fixtures/catalog/vanity-philadelphia.js';
import { livingRoomCatalog } from '../fixtures/catalog/living-room-philadelphia.js';
import { retailReferenceCatalog } from '../fixtures/catalog/retail-reference-2026-10.js';
import { retailInspoCatalog } from '../fixtures/catalog/retail-inspo-2026-10.js';
import { workspaceMongoConfig } from '../apps/api/src/database-config.js';

const option = (name: string) => {
  const flag = process.argv.findIndex((arg) => arg === `--${name}`);
  return (
    process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ??
    (flag >= 0 ? process.argv[flag + 1] : undefined)
  );
};
const demo: CatalogImport = {
  products: [...vanityCatalog.products, ...livingRoomCatalog.products],
  offers: [...vanityCatalog.offers, ...livingRoomCatalog.offers],
  observations: [...vanityCatalog.observations, ...livingRoomCatalog.observations],
};
const retail: CatalogImport = {
  products: [...retailReferenceCatalog.products, ...retailInspoCatalog.products],
  offers: [...retailReferenceCatalog.offers, ...retailInspoCatalog.offers],
  observations: [...retailReferenceCatalog.observations, ...retailInspoCatalog.observations],
};
const set = option('set') ?? 'retail';
if (!['retail', 'demo'].includes(set)) throw new Error(`Unknown --set ${set}; use retail or demo.`);
const uri = option('uri') ?? (await workspaceMongoConfig()).uri;
const file = option('file');
const batch = file ? JSON.parse(await readFile(file, 'utf8')) : set === 'demo' ? demo : retail;
const client = new MongoClient(uri);
await client.connect();
const store = new CatalogStore(client.db());
await store.ensureIndexes();
if (process.argv.includes('--retire-demo')) {
  const ids = (records: { id: string }[]) => ({ _id: { $in: records.map((r) => r.id) } }) as never;
  const removed = await Promise.all([
    store.observations.deleteMany(ids(demo.observations)),
    store.offers.deleteMany(ids(demo.offers)),
    store.products.deleteMany(ids(demo.products)),
  ]);
  console.log(
    `Retired demo fixtures: ${removed.map((r) => r.deletedCount).join(' / ')} ` +
      'observations / offers / products.',
  );
}
const result = await store.importBatch(batch);
console.log(
  `Catalog import (${file ?? set}): ${result.products} products, ${result.offers} offers, ` +
    `${result.observations} observations, ${result.skipped} skipped as duplicates.`,
);
await client.close();
