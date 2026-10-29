import { randomBytes } from 'node:crypto';
import type { Collection, Db } from 'mongodb';
import {
  DomainError,
  priceSubmissionSchema,
  type Money,
  type Offer,
  type PriceObservation,
  type PriceSubmission,
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
  readonly submissions: Collection<PriceSubmission>;

  constructor(db: Db) {
    this.products = db.collection<Product>('catalog_products');
    this.offers = db.collection<Offer>('retailer_offers');
    this.observations = db.collection<PriceObservation>('price_observations');
    this.submissions = db.collection<PriceSubmission>('price_submissions');
  }

  async ensureIndexes() {
    await this.offers.createIndex(
      { productId: 1, retailer: 1, sku: 1, fulfillmentRegion: 1 },
      { unique: true },
    );
    await this.observations.createIndex({ offerId: 1, observedAt: 1, source: 1 }, { unique: true });
    await this.products.createIndex({ name: 'text', manufacturer: 'text', model: 'text' });
    await this.offers.createIndex({ sku: 1, retailer: 1 });
    await this.submissions.createIndex({ offerId: 1, status: 1 });
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
    filters: { region?: string; sku?: string; retailer?: string } = {},
  ): Promise<{
    products: Product[];
    offers: Offer[];
    observations: PriceObservation[];
  }> {
    const offers = await this.offers
      .find({
        ...(productIds.length ? { productId: { $in: productIds } } : {}),
        ...(filters.region ? { fulfillmentRegion: filters.region } : {}),
        ...(filters.sku ? { sku: filters.sku } : {}),
        ...(filters.retailer ? { retailer: filters.retailer } : {}),
      })
      .limit(200)
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

  async search(
    query: string,
    category?: string,
  ): Promise<{ products: Product[]; offers: Offer[]; observations: PriceObservation[] }> {
    if (!query.trim()) throw new DomainError('VALIDATION', 'Search needs a query');
    const products = await this.products
      .find({ $text: { $search: query }, ...(category ? { category } : {}) })
      .limit(50)
      .toArray();
    return this.offersFor(products.map((p) => p.id));
  }

  async history(offerId: string, limit = 50): Promise<PriceObservation[]> {
    return this.observations
      .find({ offerId })
      .sort({ observedAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 200))
      .toArray();
  }

  // User-submitted shelf/receipt prices. Local mode records immediately (the
  // owner is the operator); account mode quarantines for operator review.
  async submitObservation(
    observerId: string,
    raw: {
      offerId: string;
      observedAt?: string;
      unitPrice: Money;
      stock: PriceSubmission['stock'];
      shippingEstimate?: Money;
      note?: string;
    },
    options: { autoApprove: boolean },
  ): Promise<{ submission: PriceSubmission; observationId: string | null }> {
    const offer = await this.offers.findOne({ id: raw.offerId });
    if (!offer) throw new DomainError('NOT_FOUND', `Unknown offer ${raw.offerId}`);
    const observedAt = raw.observedAt ?? new Date().toISOString();
    if (Date.parse(observedAt) > Date.now() + 5 * 60 * 1000)
      throw new DomainError('VALIDATION', 'Observation time cannot be in the future');
    const pending = await this.submissions.findOne({
      offerId: raw.offerId,
      observerId,
      observedAt,
      status: 'pending',
    });
    if (pending) return { submission: pending, observationId: null };
    const submission = priceSubmissionSchema.parse({
      schemaVersion: 1,
      id: `sub:${randomBytes(12).toString('hex')}`,
      offerId: raw.offerId,
      observerId,
      observedAt,
      unitPrice: raw.unitPrice,
      stock: raw.stock,
      ...(raw.shippingEstimate ? { shippingEstimate: raw.shippingEstimate } : {}),
      ...(raw.note ? { note: raw.note } : {}),
      status: options.autoApprove ? 'approved' : 'pending',
      ...(options.autoApprove ? { reviewedAt: new Date().toISOString() } : {}),
    });
    await this.submissions.insertOne({ ...submission, _id: submission.id } as never);
    if (!options.autoApprove) return { submission, observationId: null };
    const observationId = await this.recordApproved(submission);
    return { submission, observationId };
  }

  async reviewSubmission(
    id: string,
    approve: boolean,
    reason?: string,
  ): Promise<{ submission: PriceSubmission; observationId: string | null }> {
    const submission = await this.submissions.findOne({ id });
    if (!submission) throw new DomainError('NOT_FOUND', `Unknown submission ${id}`);
    if (submission.status !== 'pending')
      throw new DomainError('CONFLICT', 'Submission was already reviewed');
    const reviewedAt = new Date().toISOString();
    if (!approve) {
      await this.submissions.updateOne(
        { id },
        { $set: { status: 'rejected', reviewedAt, ...(reason ? { reason } : {}) } },
      );
      return {
        submission: {
          ...submission,
          status: 'rejected',
          reviewedAt,
          ...(reason ? { reason } : {}),
        },
        observationId: null,
      };
    }
    const observationId = await this.recordApproved(submission);
    await this.submissions.updateOne(
      { id },
      {
        $set: {
          status: 'approved',
          reviewedAt,
          ...(observationId ? {} : { reason: 'Already recorded' }),
        },
      },
    );
    return {
      submission: {
        ...submission,
        status: 'approved',
        reviewedAt,
        ...(observationId ? {} : { reason: 'Already recorded' }),
      },
      observationId,
    };
  }

  // Approval appends one manual-entry observation unless the same fact is
  // already recorded, preserving the no-duplicate guarantee.
  private async recordApproved(submission: PriceSubmission): Promise<string | null> {
    const existing = await this.observations.findOne({
      offerId: submission.offerId,
      observedAt: submission.observedAt,
      source: 'manual-entry',
    });
    if (existing) return null;
    const observation: PriceObservation = {
      schemaVersion: 1,
      id: `obs:${randomBytes(12).toString('hex')}`,
      offerId: submission.offerId,
      observedAt: submission.observedAt,
      unitPrice: submission.unitPrice,
      stock: submission.stock,
      ...(submission.shippingEstimate ? { shippingEstimate: submission.shippingEstimate } : {}),
      source: 'manual-entry',
      freshness: 'recent',
      ...(submission.note ? { note: submission.note } : {}),
    };
    await this.observations.insertOne({ ...observation, _id: observation.id } as never);
    return observation.id;
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
