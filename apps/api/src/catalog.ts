import type { Collection, Db } from 'mongodb';
import {
  DomainError,
  type Offer,
  type PriceObservation,
  type Product,
} from '@renovagent/contracts';
import { checkCatalogReferences, sameRecord, validateCatalogImport } from '@renovagent/core';

// Shared reference data: one catalog for all owners. Writes are curated
// imports (operator-gated at the HTTP layer), never agent prose. Re-importing
// identical records is a no-op; same ID with different content is a conflict.
export class CatalogStore {
  readonly products: Collection<Product>;
  readonly offers: Collection<Offer>;
  readonly observations: Collection<PriceObservation>;

  constructor(db: Db) {
    this.products = db.collection<Product>('catalog_products');
    this.offers = db.collection<Offer>('retailer_offers');
    this.observations = db.collection<PriceObservation>('price_observations');
  }

  async ensureIndexes() {
    await this.offers.createIndex(
      { productId: 1, retailer: 1, sku: 1, fulfillmentRegion: 1 },
      { unique: true },
    );
    await this.observations.createIndex({ offerId: 1, observedAt: 1, source: 1 }, { unique: true });
  }

  async importBatch(raw: unknown): Promise<{
    products: number;
    offers: number;
    observations: number;
    skipped: number;
  }> {
    let batch;
    try {
      batch = validateCatalogImport(raw);
    } catch (error) {
      throw new DomainError('VALIDATION', `Invalid catalog import: ${message(error)}`);
    }
    const [productIds, offerIds] = (await Promise.all([
      this.products.distinct('_id'),
      this.offers.distinct('_id'),
    ])) as unknown as [string[], string[]];
    try {
      checkCatalogReferences(batch, {
        products: new Set(productIds),
        offers: new Set(offerIds),
      });
    } catch (error) {
      throw new DomainError('VALIDATION', message(error));
    }
    let skipped = 0;
    const insertNew = async <T extends { id: string }>(
      collection: Collection<T>,
      records: T[],
      label: string,
    ) => {
      const existing = await collection
        .find({ _id: { $in: records.map((r) => r.id) } } as never)
        .toArray();
      const byId = new Map(existing.map((doc) => [(doc as T).id, doc]));
      const fresh: T[] = [];
      for (const record of records) {
        const prior = byId.get(record.id);
        if (!prior) {
          fresh.push(record);
          continue;
        }
        if (!sameRecord(record, prior))
          throw new DomainError(
            'CONFLICT',
            `${label} ${record.id} already exists with different content`,
          );
        skipped += 1;
      }
      if (fresh.length)
        await collection.insertMany(
          fresh.map((record) => ({ ...record, _id: record.id }) as never),
        );
      return fresh.length;
    };
    try {
      const [products, offers, observations] = await Promise.all([
        insertNew(this.products, batch.products, 'Product'),
        insertNew(this.offers, batch.offers, 'Offer'),
        insertNew(this.observations, batch.observations, 'Observation'),
      ]);
      return { products, offers, observations, skipped };
    } catch (error) {
      if (error instanceof DomainError) throw error;
      if (isDuplicateKey(error))
        throw new DomainError(
          'CONFLICT',
          'Catalog import duplicates an existing offer or observation',
        );
      throw error;
    }
  }

  async offersFor(
    productIds: string[],
    region?: string,
  ): Promise<{
    products: Product[];
    offers: Offer[];
    observations: PriceObservation[];
  }> {
    const offers = await this.offers
      .find({ productId: { $in: productIds }, ...(region ? { fulfillmentRegion: region } : {}) })
      .toArray();
    const products = await this.products
      .find({ id: { $in: [...new Set(offers.map((o) => o.productId))] } })
      .toArray();
    const all = await this.observations
      .find({ offerId: { $in: offers.map((o) => o.id) } })
      .sort({ observedAt: -1 })
      .toArray();
    const latest = new Map<string, PriceObservation>();
    for (const observation of all)
      if (!latest.has(observation.offerId)) latest.set(observation.offerId, observation);
    return { products, offers, observations: [...latest.values()] };
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown import failure';
}

function isDuplicateKey(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: unknown }).code === 11000
  );
}
