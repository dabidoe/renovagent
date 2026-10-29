import { catalogImportSchema, type CatalogImport } from '@renovagent/contracts';

// Pure import validation: schema, within-batch duplicate IDs, and references
// against IDs the caller confirms already exist. Storage-conflict checks
// (same ID, different content) live with the store, which sees the data.
export function validateCatalogImport(raw: unknown): CatalogImport {
  const batch = catalogImportSchema.parse(raw);
  for (const [label, records] of [
    ['products', batch.products],
    ['offers', batch.offers],
    ['observations', batch.observations],
  ] as const) {
    const ids = records.map((record) => record.id);
    if (new Set(ids).size !== ids.length)
      throw new Error(`Duplicate ${label} IDs in catalog import`);
  }
  return batch;
}

export function checkCatalogReferences(
  batch: CatalogImport,
  existing: { products: Set<string>; offers: Set<string> },
): void {
  const products = new Set([...existing.products, ...batch.products.map((p) => p.id)]);
  const offers = new Set([...existing.offers, ...batch.offers.map((o) => o.id)]);
  for (const offer of batch.offers)
    if (!products.has(offer.productId))
      throw new Error(`Offer ${offer.id} references unknown product ${offer.productId}`);
  for (const observation of batch.observations)
    if (!offers.has(observation.offerId))
      throw new Error(
        `Observation ${observation.id} references unknown offer ${observation.offerId}`,
      );
}

export function sameRecord(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(stripInternal(b));
}

function stripInternal(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripInternal);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value))
      if (key !== '_id') out[key] = stripInternal(entry);
    return out;
  }
  return value;
}
