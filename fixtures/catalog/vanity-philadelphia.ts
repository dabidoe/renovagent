import type {
  BomPayload,
  CatalogImport,
  Offer,
  PriceObservation,
  Product,
} from '@renovagent/contracts';

// Curated demo catalog: 30" vanity replacement, Philadelphia 19148.
// Every price is an explicitly labeled example import (historical, demo-only),
// never a live offer. Manufacturers and retailers are fictional.
const OBSERVED_AT = '2026-10-29T14:00:00Z';
const REGION = '19148';
const EXAMPLE_NOTE = 'Example price for demo only; not a live offer.';
const RETAILER = 'Example Depot Philly South';

function product(
  id: string,
  model: string,
  name: string,
  category: string,
  specs: Record<string, string | number | boolean>,
): Product {
  return {
    schemaVersion: 1,
    id,
    manufacturer: 'FixtureWorks',
    model,
    name,
    category,
    identifiers: { mpn: model },
    specs,
    certifications: [],
  };
}

function offer(id: string, productId: string, tier: Offer['tier'], sku: string): Offer {
  return {
    schemaVersion: 1,
    id,
    productId,
    retailer: RETAILER,
    sku,
    fulfillmentRegion: REGION,
    fulfillment: 'both',
    tier,
    packQuantity: 1,
    packUnit: 'ea',
  };
}

function observation(
  id: string,
  offerId: string,
  amountMinor: number,
  stock: PriceObservation['stock'] = 'unknown',
): PriceObservation {
  return {
    schemaVersion: 1,
    id,
    offerId,
    observedAt: OBSERVED_AT,
    unitPrice: { amountMinor, currency: 'USD' },
    stock,
    source: 'example-import',
    freshness: 'historical',
    note: EXAMPLE_NOTE,
  };
}

const P = {
  cabBuilder: product(
    'van-cab-builder',
    'FW-VC30-B',
    'Builder vanity cabinet 30"',
    'vanity-cabinet',
    {
      width_in: 30,
      depth_in: 21,
      mount: 'freestanding',
      material: 'mdf',
    },
  ),
  cabMid: product('van-cab-mid', 'FW-VC30-M', 'Mid-tier vanity cabinet 30"', 'vanity-cabinet', {
    width_in: 30,
    depth_in: 21,
    mount: 'freestanding',
    material: 'plywood',
  }),
  cabHigh: product('van-cab-high', 'FW-VC30-H', 'High-end vanity cabinet 30"', 'vanity-cabinet', {
    width_in: 30,
    depth_in: 22,
    mount: 'freestanding',
    material: 'hardwood',
  }),
  cab36: product('van-cab-36', 'FW-VC36-X', 'Vanity cabinet 36" (too wide)', 'vanity-cabinet', {
    width_in: 36,
    depth_in: 21,
    mount: 'freestanding',
    material: 'mdf',
  }),
  topBuilder: product('van-top-builder', 'FW-VT31-B', 'Cultured marble top 31"', 'vanity-top', {
    width_in: 31,
    holes: 1,
    material: 'cultured-marble',
  }),
  topMid: product('van-top-mid', 'FW-VT31-M', 'Quartz vanity top 31"', 'vanity-top', {
    width_in: 31,
    holes: 1,
    material: 'quartz',
  }),
  topHigh: product('van-top-high', 'FW-VT31-H', 'Granite vanity top 31"', 'vanity-top', {
    width_in: 31,
    holes: 1,
    material: 'granite',
  }),
  fauBuilder: product('van-fau-builder', 'FW-VF1-B', 'Builder single-hole faucet', 'faucet', {
    holes: 1,
    connection: '1/2-fip',
    flow_gpm: 1.5,
    finish: 'chrome',
  }),
  fauMid: product('van-fau-mid', 'FW-VF1-M', 'Mid-tier single-hole faucet', 'faucet', {
    holes: 1,
    connection: '1/2-fip',
    flow_gpm: 1.2,
    finish: 'brushed-nickel',
  }),
  fauHigh: product('van-fau-high', 'FW-VF1-H', 'High-end single-hole faucet', 'faucet', {
    holes: 1,
    connection: '1/2-fip',
    flow_gpm: 1.0,
    finish: 'matte-black',
  }),
  fau3: product('van-fau-3hole', 'FW-VF3-X', 'Widespread 3-hole faucet (wrong holes)', 'faucet', {
    holes: 3,
    connection: '1/2-fip',
    flow_gpm: 1.5,
    finish: 'chrome',
  }),
  drainBuilder: product('van-drain-builder', 'FW-DR-B', 'Builder P-trap kit', 'drain', {
    connection_in: 1.25,
    material: 'plastic',
  }),
  drainMid: product('van-drain-mid', 'FW-DR-M', 'Mid-tier P-trap kit', 'drain', {
    connection_in: 1.25,
    material: 'chrome-brass',
  }),
  drainHigh: product('van-drain-high', 'FW-DR-H', 'High-end P-trap kit', 'drain', {
    connection_in: 1.25,
    material: 'solid-brass',
  }),
  supBuilder: product('van-sup-builder', 'FW-SL-B', 'Builder supply line', 'supply-line', {
    connection: '3/8-comp-x-1/2-fip',
    length_in: 12,
  }),
  supMid: product('van-sup-mid', 'FW-SL-M', 'Mid-tier supply line', 'supply-line', {
    connection: '3/8-comp-x-1/2-fip',
    length_in: 16,
  }),
  supHigh: product('van-sup-high', 'FW-SL-H', 'High-end supply line', 'supply-line', {
    connection: '3/8-comp-x-1/2-fip',
    length_in: 20,
  }),
};

const O = {
  cabBuilder: offer('offer-van-cab-builder', P.cabBuilder.id, 'builder', 'FW-SKU-VC30-B'),
  cabMid: offer('offer-van-cab-mid', P.cabMid.id, 'mid', 'FW-SKU-VC30-M'),
  cabHigh: offer('offer-van-cab-high', P.cabHigh.id, 'high', 'FW-SKU-VC30-H'),
  cab36: offer('offer-van-cab-36', P.cab36.id, 'builder', 'FW-SKU-VC36-X'),
  topBuilder: offer('offer-van-top-builder', P.topBuilder.id, 'builder', 'FW-SKU-VT31-B'),
  topMid: offer('offer-van-top-mid', P.topMid.id, 'mid', 'FW-SKU-VT31-M'),
  topHigh: offer('offer-van-top-high', P.topHigh.id, 'high', 'FW-SKU-VT31-H'),
  fauBuilder: offer('offer-van-fau-builder', P.fauBuilder.id, 'builder', 'FW-SKU-VF1-B'),
  fauMid: offer('offer-van-fau-mid', P.fauMid.id, 'mid', 'FW-SKU-VF1-M'),
  fauHigh: offer('offer-van-fau-high', P.fauHigh.id, 'high', 'FW-SKU-VF1-H'),
  fau3: offer('offer-van-fau-3hole', P.fau3.id, 'mid', 'FW-SKU-VF3-X'),
  drainBuilder: offer('offer-van-drain-builder', P.drainBuilder.id, 'builder', 'FW-SKU-DR-B'),
  drainMid: offer('offer-van-drain-mid', P.drainMid.id, 'mid', 'FW-SKU-DR-M'),
  drainHigh: offer('offer-van-drain-high', P.drainHigh.id, 'high', 'FW-SKU-DR-H'),
  supBuilder: offer('offer-van-sup-builder', P.supBuilder.id, 'builder', 'FW-SKU-SL-B'),
  supMid: offer('offer-van-sup-mid', P.supMid.id, 'mid', 'FW-SKU-SL-M'),
  supHigh: offer('offer-van-sup-high', P.supHigh.id, 'high', 'FW-SKU-SL-H'),
};

export const vanityCatalog: CatalogImport = {
  products: Object.values(P),
  offers: Object.values(O),
  observations: [
    observation('obs-van-cab-builder', O.cabBuilder.id, 14900, 'in_stock'),
    observation('obs-van-cab-mid', O.cabMid.id, 34900),
    observation('obs-van-cab-high', O.cabHigh.id, 89900),
    observation('obs-van-cab-36', O.cab36.id, 19900),
    observation('obs-van-top-builder', O.topBuilder.id, 8900, 'in_stock'),
    observation('obs-van-top-mid', O.topMid.id, 22900),
    observation('obs-van-top-high', O.topHigh.id, 54900),
    observation('obs-van-fau-builder', O.fauBuilder.id, 3900, 'in_stock'),
    observation('obs-van-fau-mid', O.fauMid.id, 12900),
    observation('obs-van-fau-high', O.fauHigh.id, 32900),
    observation('obs-van-fau-3hole', O.fau3.id, 5900),
    observation('obs-van-drain-builder', O.drainBuilder.id, 1200, 'in_stock'),
    observation('obs-van-drain-mid', O.drainMid.id, 2800),
    observation('obs-van-drain-high', O.drainHigh.id, 6500),
    observation('obs-van-sup-builder', O.supBuilder.id, 900, 'in_stock'),
    observation('obs-van-sup-mid', O.supMid.id, 1800),
    observation('obs-van-sup-high', O.supHigh.id, 3500),
  ],
};

export const vanityTemplate: BomPayload = {
  kind: 'bom',
  templateId: 'vanity-replacement',
  templateVersion: 1,
  items: [
    {
      id: 'cabinet-30',
      category: 'vanity-cabinet',
      description: '30 in freestanding vanity cabinet, max 22 in deep',
      quantity: 1,
      unit: 'ea',
      constraints: [
        { attribute: 'width_in', operator: 'eq', value: 30 },
        { attribute: 'depth_in', operator: 'lte', value: 22 },
        { attribute: 'mount', operator: 'eq', value: 'freestanding' },
      ],
      codeTopics: ['phila-permits', 'phila-plumbing-scope'],
      candidateProductIds: [P.cabBuilder.id, P.cabMid.id, P.cabHigh.id, P.cab36.id],
    },
    {
      id: 'top-31',
      category: 'vanity-top',
      description: '31 in vanity top with single-hole sink cutout',
      quantity: 1,
      unit: 'ea',
      constraints: [
        { attribute: 'width_in', operator: 'eq', value: 31 },
        { attribute: 'holes', operator: 'eq', value: 1 },
        {
          attribute: 'material',
          operator: 'oneOf',
          value: ['cultured-marble', 'quartz', 'granite'],
        },
      ],
      codeTopics: ['phila-plumbing-scope'],
      candidateProductIds: [P.topBuilder.id, P.topMid.id, P.topHigh.id],
    },
    {
      id: 'faucet-1',
      category: 'faucet',
      description: 'Single-hole faucet, 1/2 in FIP, max 1.5 gpm',
      quantity: 1,
      unit: 'ea',
      constraints: [
        { attribute: 'holes', operator: 'eq', value: 1 },
        { attribute: 'connection', operator: 'eq', value: '1/2-fip' },
        { attribute: 'flow_gpm', operator: 'lte', value: 1.5 },
      ],
      codeTopics: ['phila-plumbing-scope'],
      candidateProductIds: [P.fauBuilder.id, P.fauMid.id, P.fauHigh.id, P.fau3.id],
    },
    {
      id: 'drain-125',
      category: 'drain',
      description: 'P-trap and drain assembly, 1-1/4 in connection',
      quantity: 1,
      unit: 'ea',
      constraints: [{ attribute: 'connection_in', operator: 'eq', value: 1.25 }],
      codeTopics: ['phila-plumbing-scope', 'phila-single-stack'],
      candidateProductIds: [P.drainBuilder.id, P.drainMid.id, P.drainHigh.id],
    },
    {
      id: 'supply-pair',
      category: 'supply-line',
      description: 'Hot/cold supply lines, 3/8 in comp x 1/2 in FIP',
      quantity: 2,
      unit: 'ea',
      constraints: [{ attribute: 'connection', operator: 'eq', value: '3/8-comp-x-1/2-fip' }],
      codeTopics: ['phila-plumbing-scope'],
      candidateProductIds: [P.supBuilder.id, P.supMid.id, P.supHigh.id],
    },
  ],
};
