import type { CatalogImport, Offer, PriceObservation, Product } from '@renovagent/contracts';

// Curated demo catalog: living-room paint and flooring, Philadelphia 19148.
// Every price is an explicitly labeled example import (historical, demo-only),
// never a live offer. Manufacturers and retailers are fictional. Pack sizes
// carry the coverage each pack provides (sq ft per carton/gallon/roll, lin ft
// per piece) as the fictional product's own data, so purchase units round up
// from the measured requirement.
const OBSERVED_AT = '2026-10-29T14:00:00Z';
const REGION = '19148';
const EXAMPLE_NOTE = 'Example price for demo only; not a live offer.';
const RETAILER = 'Example Depot Philly South';

function product(
  id: string,
  model: string,
  name: string,
  category: string,
  specs: Product['specs'],
): Product {
  return {
    schemaVersion: 1,
    id,
    manufacturer: 'FloorWorks Demo Co.',
    model,
    name,
    category,
    identifiers: { mpn: model },
    specs,
    certifications: [],
  };
}

function offer(
  id: string,
  productId: string,
  tier: Offer['tier'],
  sku: string,
  packQuantity: number,
  packUnit: string,
): Offer {
  return {
    schemaVersion: 1,
    id,
    productId,
    retailer: RETAILER,
    sku,
    fulfillmentRegion: REGION,
    fulfillment: 'both',
    tier,
    packQuantity,
    packUnit,
  };
}

function observation(id: string, offerId: string, amountMinor: number): PriceObservation {
  return {
    schemaVersion: 1,
    id,
    offerId,
    observedAt: OBSERVED_AT,
    unitPrice: { amountMinor, currency: 'USD' },
    stock: 'in_stock',
    source: 'example-import',
    freshness: 'historical',
    note: EXAMPLE_NOTE,
  };
}

type Row = [
  key: string,
  category: string,
  name: string,
  tier: Offer['tier'],
  packQuantity: number,
  packUnit: string,
  priceMinor: number,
  specs: Product['specs'],
];

// [key, category, name, tier, pack quantity, pack unit, price per pack, specs]
const ROWS: Row[] = [
  [
    'paint-b',
    'interior-paint',
    'Interior matte wall paint, 1 gal',
    'builder',
    300,
    'sq ft',
    2498,
    { coverage_sqft_per_gal: 300, sheen: 'matte' },
  ],
  [
    'paint-m',
    'interior-paint',
    'Premium interior matte paint, 1 gal',
    'mid',
    400,
    'sq ft',
    4598,
    { coverage_sqft_per_gal: 400, sheen: 'matte' },
  ],
  [
    'paint-h',
    'interior-paint',
    'Designer interior matte paint, 1 gal',
    'high',
    400,
    'sq ft',
    9298,
    { coverage_sqft_per_gal: 400, sheen: 'matte' },
  ],
  [
    'paint-b-eggshell',
    'interior-paint',
    'Interior eggshell wall paint, 1 gal',
    'builder',
    300,
    'sq ft',
    2598,
    { coverage_sqft_per_gal: 300, sheen: 'eggshell' },
  ],
  [
    'paint-b-satin',
    'interior-paint',
    'Interior satin wall paint, 1 gal',
    'builder',
    300,
    'sq ft',
    2798,
    { coverage_sqft_per_gal: 300, sheen: 'satin' },
  ],
  [
    'paint-m-eggshell',
    'interior-paint',
    'Premium interior eggshell paint, 1 gal',
    'mid',
    400,
    'sq ft',
    4798,
    { coverage_sqft_per_gal: 400, sheen: 'eggshell' },
  ],
  [
    'paint-m-satin',
    'interior-paint',
    'Premium interior satin paint, 1 gal',
    'mid',
    400,
    'sq ft',
    4998,
    { coverage_sqft_per_gal: 400, sheen: 'satin' },
  ],
  [
    'paint-h-eggshell',
    'interior-paint',
    'Designer interior eggshell paint, 1 gal',
    'high',
    400,
    'sq ft',
    9498,
    { coverage_sqft_per_gal: 400, sheen: 'eggshell' },
  ],
  [
    'paint-h-satin',
    'interior-paint',
    'Designer interior satin paint, 1 gal',
    'high',
    400,
    'sq ft',
    9798,
    { coverage_sqft_per_gal: 400, sheen: 'satin' },
  ],
  [
    'hw-b',
    'engineered-hardwood',
    'Engineered oak plank 3/8 in, carton',
    'builder',
    22,
    'sq ft',
    7898,
    { thickness_in: 0.375, install: 'floating' },
  ],
  [
    'hw-m',
    'engineered-hardwood',
    'Engineered white oak plank 1/2 in, carton',
    'mid',
    20,
    'sq ft',
    11980,
    { thickness_in: 0.5, install: 'floating' },
  ],
  [
    'hw-h',
    'engineered-hardwood',
    'Wide engineered white oak plank 5/8 in, carton',
    'high',
    18.5,
    'sq ft',
    17575,
    { thickness_in: 0.625, install: 'floating' },
  ],
  [
    'lvp-b',
    'vinyl-plank',
    'Wood-look vinyl click plank 4 mm, carton',
    'builder',
    23.6,
    'sq ft',
    4696,
    { thickness_mm: 4, attached_pad: false },
  ],
  [
    'lvp-m',
    'vinyl-plank',
    'Rigid-core vinyl plank 6 mm with pad, carton',
    'mid',
    21.3,
    'sq ft',
    6369,
    { thickness_mm: 6, attached_pad: true },
  ],
  [
    'lvp-h',
    'vinyl-plank',
    'Rigid-core vinyl plank 8 mm with pad, carton',
    'high',
    19.4,
    'sq ft',
    8536,
    { thickness_mm: 8, attached_pad: true },
  ],
  [
    'ul-b',
    'floor-underlayment',
    'Foam underlayment roll',
    'builder',
    100,
    'sq ft',
    2497,
    { material: 'foam' },
  ],
  [
    'ul-m',
    'floor-underlayment',
    'Foam underlayment with film, roll',
    'mid',
    100,
    'sq ft',
    3998,
    { material: 'foam', vapor_barrier: true },
  ],
  [
    'ul-h',
    'floor-underlayment',
    'Cork underlayment roll',
    'high',
    100,
    'sq ft',
    8995,
    { material: 'cork' },
  ],
  [
    'qr-b',
    'quarter-round',
    'Primed quarter-round, 8 ft',
    'builder',
    8,
    'lin ft',
    698,
    { material: 'mdf' },
  ],
  [
    'qr-m',
    'quarter-round',
    'Pine quarter-round, 8 ft',
    'mid',
    8,
    'lin ft',
    1098,
    { material: 'pine' },
  ],
  [
    'qr-h',
    'quarter-round',
    'Oak quarter-round, 8 ft',
    'high',
    8,
    'lin ft',
    2198,
    { material: 'oak' },
  ],
];

export const livingRoomCatalog: CatalogImport = {
  products: ROWS.map(([key, category, name, , , , , specs]) =>
    product(`lr-${key}`, `FWD-LR-${key.toUpperCase()}`, name, category, specs),
  ),
  offers: ROWS.map(([key, , , tier, packQuantity, packUnit]) =>
    offer(
      `offer-lr-${key}`,
      `lr-${key}`,
      tier,
      `FWD-SKU-LR-${key.toUpperCase()}`,
      packQuantity,
      packUnit,
    ),
  ),
  observations: ROWS.map(([key, , , , , , price]) =>
    observation(`obs-lr-${key}`, `offer-lr-${key}`, price),
  ),
};
