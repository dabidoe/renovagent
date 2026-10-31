import { lineTotalMinor } from '@renovagent/core';
const photo = (name: string) => new URL(`../../assets/products/${name}.jpg`, import.meta.url).href;
// Dated public retail references, not live offers. Quantities are a landing fixture.
// Source/photo provenance: docs/landing-material-price-sources.md.
export const costMaterials = [
  {
    id: 'pex',
    group: 'plumbing',
    brand: 'SharkBite',
    name: '½″ red PEX-B tubing',
    pack: '25 ft coil',
    quantity: 1,
    unitMinor: 1515,
    photo: photo('pex-coil'),
    retailer: 'SupplyHouse',
    source: 'https://www.supplyhouse.com/SharkBite-U860R25-1-2-Red-Sharkbite-PEX-Tubing-25-ft-Coil',
  },
  {
    id: 'elbows',
    group: 'plumbing',
    brand: 'SharkBite',
    name: '½″ brass PEX elbows',
    pack: 'UC248LFA elbow',
    quantity: 8,
    unitMinor: 298,
    photo: photo('pex-elbow'),
    retailer: 'Home Depot',
    source: 'https://www.homedepot.com/p/202270636',
  },
  {
    id: 'mortar',
    group: 'tile',
    brand: 'VersaBond',
    name: 'White thinset mortar',
    pack: '50 lb bag',
    quantity: 2,
    unitMinor: 1798,
    photo: photo('thinset'),
    retailer: 'Home Depot',
    source: 'https://www.homedepot.com/p/100091767',
  },
  {
    id: 'grout',
    group: 'tile',
    brand: 'Polyblend Plus',
    name: 'Charcoal unsanded grout',
    pack: '10 lb box · #60',
    quantity: 1,
    unitMinor: 2499,
    photo: photo('grout'),
    retailer: 'Stine',
    source:
      'https://www.stinehome.com/home-improvement/paint-supplies/grouts/custom-building-products-polyblend-plus-indoor-and-outdoor-charcoal-non-sanded-grout-10-lb./1003227.html',
  },
  {
    id: 'screws',
    group: 'fixings',
    brand: 'Backer-On',
    name: '1¼″ cement-board screws',
    pack: '185-count box',
    quantity: 1,
    unitMinor: 752,
    photo: photo('backer-screws'),
    retailer: 'Home Depot',
    source: 'https://www.homedepot.com/p/300657700',
  },
  {
    id: 'sealant',
    group: 'fixings',
    brand: 'GE Advanced Silicone 2',
    name: 'Clear kitchen & bath sealant',
    pack: '10.1 oz tube',
    quantity: 2,
    unitMinor: 1098,
    photo: photo('sealant'),
    retailer: 'Home Depot',
    source: 'https://www.homedepot.com/p/317742602',
  },
] as const;
export const costLabor = [
  {
    trade: 'Plumbing',
    task: 'Disconnect, reconnect and test the vanity supply.',
    hours: 6,
    rateMinor: 7500,
    photo: photo('pex-coil'),
  },
  {
    trade: 'Tile prep & installation',
    task: 'Prepare the surface, set tile and finish the grout.',
    hours: 24,
    rateMinor: 6000,
    photo: photo('thinset'),
  },
] as const;
export const materialTotalMinor = costMaterials.reduce(
  (sum, item) => sum + lineTotalMinor(item.quantity, item.unitMinor),
  0,
);
export const laborTotalMinor = costLabor.reduce(
  (sum, item) => sum + lineTotalMinor(item.hours, item.rateMinor),
  0,
);
export const costMoney = (minor: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: minor % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(minor / 100);
