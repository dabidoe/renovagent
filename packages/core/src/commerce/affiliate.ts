import { affiliateRowSchema, type AffiliateRow, type CatalogImport } from '@renovagent/contracts';

// Deterministic affiliate-row normalization: the same feed rows always yield
// the same catalog IDs, so re-imports are duplicate-safe no-ops.
export function normalizeAffiliateRows(
  raw: unknown,
  defaults: { region: string; observedAt: string; tier?: AffiliateRow['tier'] },
): CatalogImport {
  const rows = (Array.isArray(raw) ? raw : []).map((row, index) => {
    const parsed = affiliateRowSchema.safeParse(row);
    if (!parsed.success)
      throw new Error(`Affiliate row ${index} invalid: ${parsed.error.issues[0]?.message}`);
    return parsed.data;
  });
  const products: CatalogImport['products'] = [];
  const offers: CatalogImport['offers'] = [];
  const observations: CatalogImport['observations'] = [];
  for (const row of rows) {
    const productId = row.productId ?? `aff-${slug(row.retailer)}-${slug(row.sku)}`;
    const region = row.region ?? defaults.region;
    const offerId = `off-${slug(row.retailer)}-${slug(row.sku)}-${slug(region)}`;
    if (!products.some((p) => p.id === productId))
      products.push({
        schemaVersion: 1,
        id: productId,
        manufacturer: row.brand ?? row.retailer,
        model: row.model ?? row.sku,
        name: row.name,
        category: 'affiliate-import',
        identifiers: row.upc ? { upc: row.upc } : {},
        specs: {},
        certifications: [],
      });
    if (!offers.some((o) => o.id === offerId))
      offers.push({
        schemaVersion: 1,
        id: offerId,
        productId,
        retailer: row.retailer,
        sku: row.sku,
        fulfillmentRegion: region,
        ...(row.url ? { url: row.url } : {}),
        fulfillment: 'both',
        tier: row.tier ?? defaults.tier ?? 'mid',
        packQuantity: 1,
        packUnit: 'ea',
      });
    if (row.price !== undefined)
      observations.push({
        schemaVersion: 1,
        id: `obs-${slug(offerId)}-${defaults.observedAt.replaceAll(/[^0-9]/g, '').slice(0, 14)}`,
        offerId,
        observedAt: defaults.observedAt,
        unitPrice: {
          amountMinor: Math.round(row.price * 100),
          currency: row.currency ?? 'USD',
        },
        stock: row.availability ?? 'unknown',
        source: 'retailer-api',
        freshness: 'recent',
      });
  }
  return { products, offers, observations };
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'item'
  );
}
