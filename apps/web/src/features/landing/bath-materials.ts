// The example bathroom's four finishes, shared by the hero and the product demo.
// Presentation-only allowances: never written into a user's project or offered for checkout.
export const materials = [
  {
    id: 'vanity',
    name: 'IKEA ÄNGSJÖN vanity',
    title: 'IKEA ÄNGSJÖN · 36″',
    finish: 'Oak effect',
    spec: '36 × 21 × 25⅛ in',
    quantity: '1 cabinet reference',
    check: 'Check wall support, plumbing position and compatible basin.',
    missing: 'Counter, basin, faucet, trap, supply lines and installation.',
    kind: 'Retail reference',
    price: 33900,
    x: 31,
    y: 54,
    basis: 'IKEA · ÄNGSJÖN · cabinet only',
    detail:
      '36-inch reference option. Sink, counter, faucet and installation are extra. Fit and stock have not been checked. The generated image does not depict this exact product.',
    href: 'https://www.ikea.com/us/en/p/aengsjoen-bathroom-vanity-with-drawers-oak-effect-20535355/',
  },
  {
    id: 'mirror',
    name: 'Black-framed mirror',
    title: 'Slim black-frame mirror',
    finish: 'Matte black concept',
    spec: '24 × 32 in concept option',
    quantity: '1 mirror allowance',
    check: 'Measure between the backsplash and light; verify mounting.',
    missing: 'Wall anchors, blocking and installation.',
    kind: 'Demo allowance',
    price: 8500,
    x: 30,
    y: 25,
    basis: 'Demo allowance · supplier TBD',
    detail:
      'An illustrative allowance, not a retrieved offer. Size, mounting and supplier still need selection.',
  },
  {
    id: 'shower',
    name: 'White subway wall tile',
    title: 'Classic subway · gloss white',
    finish: 'Gloss white concept',
    spec: '3 × 6 in concept tile',
    quantity: 'Area still to measure',
    check: 'Confirm coverage, substrate and a complete waterproofing system.',
    missing: 'Waterproofing, backer, mortar, grout, edge trim and labor.',
    kind: 'Demo allowance',
    price: 68000,
    x: 66,
    y: 38,
    basis: 'Demo allowance · supplier TBD',
    detail:
      'Illustrative wall-tile allowance, not a retailer quote or measured takeoff. Shower glass, fixtures and installation are not priced.',
  },
  {
    id: 'floor',
    name: 'Charcoal hex floor mosaic',
    title: '2″ charcoal porcelain hex',
    finish: 'Matte charcoal concept',
    spec: '2 in hex concept tile',
    quantity: 'Area still to measure',
    check: 'Confirm wet-area suitability, substrate and floor transitions.',
    missing: 'Underlayment, mortar, grout, waste and installation.',
    kind: 'Demo allowance',
    price: 24000,
    x: 65,
    y: 84,
    basis: 'Demo allowance · supplier TBD',
    detail:
      'Illustrative tile allowance, not an area-based estimate. Measurements, waste, underlayment, setting materials and installation remain unresolved.',
  },
];
export const money = (minor: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(minor / 100);
