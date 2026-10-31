// Curated looks: sets of real catalog products (retail reference and inspo
// fixtures) that go together, for people browsing ideas. A look is priced for a
// project by the server with the plan's own quantities and hard rules, so a
// product that doesn't fit the plan shows why instead of disappearing.
//
// Tips are Renovagent's general advice, not product claims or code guidance.
// Badges are "best of" picks from articles that were fetched and name the
// product or its line; nothing is badged without a source.

export type LookRoom = 'bathroom' | 'living-room';
export type CuratedLook = {
  id: string;
  room: LookRoom;
  name: string;
  blurb: string;
  style: string[];
  tips: string[];
  productIds: string[];
};
export type LookBadge = {
  productId: string;
  publisher: string;
  title: string;
  date: string;
  url: string;
  label: string;
};

export const curatedLooks: CuratedLook[] = [
  {
    id: 'bath-clean-simple',
    room: 'bathroom',
    name: 'Clean & simple',
    blurb: 'White, chrome and nothing fussy: the most bathroom for the least money.',
    style: ['minimal', 'budget'],
    tips: [
      'Spend on the faucet before the cabinet: it is the part you touch every day.',
      'Bring the vanity box home and check the cabinet for shipping damage before the old one comes out.',
    ],
    productIds: [
      'rr-van-glacier-bay-kinghurst-30',
      'rr-top-design-house-cm-31',
      'rr-fau-pfister-pfirst-modern',
      'ri-drain-pf-waterworks-decodrain',
      'rr-sup-plumbshop-stainless-20',
    ],
  },
  {
    id: 'bath-ikea-scandi',
    room: 'bathroom',
    name: 'IKEA Scandi',
    blurb: 'Oak effect, soft white and slim chrome, built from IKEA pieces.',
    style: ['scandinavian', 'japandi'],
    tips: [
      'IKEA vanities are designed around IKEA sinks and countertops; check the pairing before mixing brands.',
      'A wall-hung vanity needs solid backing in the wall. Ask your installer before the wall is closed.',
      'IKEA faucets ship with their own hoses; confirm they reach your shut-off valves.',
    ],
    productIds: [
      'ri-van-ikea-angsjon-30',
      'ri-van-ikea-hemnes-30',
      'ri-fau-ikea-brogrund',
      'ri-fau-ikea-hamnskar',
      'rr-top-design-house-cm-31',
      'ri-drain-pf-waterworks-decodrain',
    ],
  },
  {
    id: 'bath-spa-modern',
    room: 'bathroom',
    name: 'Spa modern',
    blurb: 'Walnut tones, matte black and a sculpted single-hole faucet.',
    style: ['modern', 'warm'],
    tips: [
      'A vanity sold with its top saves a separate top, but check the sink drilling matches your faucet.',
      'Wood-tone vanities look best with one other warm material in the room, like a bath mat or towel bar.',
    ],
    productIds: [
      'ri-van-mercury-row-binford-30',
      'ri-fau-hansgrohe-talis-e-110',
      'ri-drain-pf-waterworks-decodrain',
      'rr-sup-plumbshop-stainless-20',
    ],
  },
  {
    id: 'bath-coastal-classic',
    room: 'bathroom',
    name: 'Coastal classic',
    blurb: 'Pottery Barn legs, a marble-look top and Moen Genta faucets in chrome or matte black.',
    style: ['coastal', 'traditional'],
    tips: [
      'Widespread faucets need a three-hole top; a single-hole plan would need a different faucet or top.',
      'Furniture-style vanities on legs make a small bathroom feel bigger: you see more floor.',
    ],
    productIds: [
      'ri-van-pottery-barn-belleair-30',
      'ri-fau-moen-genta-widespread-black',
      'rr-fau-moen-genta',
      'rr-drain-delta-push-pop-up',
      'rr-sup-plumbshop-stainless-20',
    ],
  },
  {
    id: 'bath-gold-splurge',
    room: 'bathroom',
    name: 'Gold splurge',
    blurb: 'Solid wood, white quartz and a Brizo faucet in Luxe Gold.',
    style: ['glam', 'luxury'],
    tips: [
      'Order the faucet and drain in the same finish from the same maker; gold tones vary between brands.',
      'Quartz tops are heavy; have two people set it, and check the cabinet is level first.',
    ],
    productIds: [
      'rr-van-fd-kent-30',
      'rr-top-transolid-quartz-31',
      'ri-fau-brizo-litze-luxe-gold',
      'ri-drain-brizo-push-pop-up-luxe-gold',
      'rr-sup-noels-stainless-20',
    ],
  },
  {
    id: 'living-bright-budget',
    room: 'living-room',
    name: 'Bright on a budget',
    blurb: 'Clean white walls and light oak-look plank for the lowest real price.',
    style: ['minimal', 'budget'],
    tips: [
      'Flat paint hides wall flaws best; it is harder to scrub, so keep it out of high-traffic hallways.',
      'Buy all your flooring cartons at once so they come from the same production run.',
    ],
    productIds: [
      'rr-paint-glidden-premium-flat',
      'rr-lvp-fd-windy-gap-oak',
      'rr-ul-roberts-unison',
      'rr-qr-woodgrain-pine',
    ],
  },
  {
    id: 'living-designer-matte',
    room: 'living-room',
    name: 'Designer matte',
    blurb: 'Chalky Farrow & Ball walls over warm oak, with cork underfoot.',
    style: ['traditional', 'moody'],
    tips: [
      'Very matte paints look soft but mark more easily; they suit rooms adults use more than kids do.',
      'Paint two big sample swatches on different walls and look at them in morning and evening light.',
    ],
    productIds: [
      'ri-paint-farrow-ball-estate-emulsion',
      'ri-lvp-coretec-plus-premium-ezra-oak',
      'ri-hw-kahrs-smaland-more-oak',
      'ri-ul-qep-natural-cork-6mm',
      'ri-qr-fd-solid-oak-wm106',
    ],
  },
  {
    id: 'living-scandi-oak',
    room: 'living-room',
    name: 'Scandi white oak',
    blurb: 'Soft designer white, pale wide oak and felt underlayment for a quiet floor.',
    style: ['scandinavian', 'minimal'],
    tips: [
      'Let wood and plank flooring sit in the room before installing, as long as the maker says.',
      'Quarter round stained to match the floor disappears; painted like the baseboard, it reads as trim.',
    ],
    productIds: [
      'ri-paint-clare-wall-eggshell',
      'ri-hw-hurst-lighthouse-white-oak',
      'ri-lvp-pergo-extreme-ecru',
      'ri-ul-roberts-super-felt',
      'rr-qr-woodgrain-oak',
    ],
  },
  {
    id: 'living-family-proof',
    room: 'living-room',
    name: 'Family-proof',
    blurb: 'Scrubbable paint and a waterproof plank that shrugs off spills.',
    style: ['practical', 'modern'],
    tips: [
      'Washable matte paints are the middle ground: low shine, but they take a scrub.',
      'Keep a spare carton of flooring for future repairs; colours get discontinued.',
    ],
    productIds: [
      'ri-paint-sw-emerald-matte',
      'ri-paint-bm-aura-matte',
      'ri-lvp-shaw-floorte-pro-paragon',
      'ri-ul-roberts-super-felt',
      'ri-qr-alexandria-primed-poplar',
    ],
  },
  {
    id: 'living-warm-traditional',
    room: 'living-room',
    name: 'Warm traditional',
    blurb: 'Knotty pine-look plank and click-lock white oak with classic oak trim.',
    style: ['traditional', 'warm'],
    tips: [
      'Warm floors pair best with whites that have a little yellow or red in them; test against the plank.',
      'Run planks along the longest wall or toward the main window for the calmest look.',
    ],
    productIds: [
      'rr-paint-behr-ultra-flat',
      'ri-lvp-lifeproof-heirloom-pine',
      'ri-hw-bruce-hydropel-white-oak',
      'rr-ul-fd-ez-foam',
      'rr-qr-woodgrain-oak',
    ],
  },
];

const COMPOSITE = {
  publisher: 'Composite Paint',
  title: 'Best Wall Paint for Interior Walls in 2026',
  date: '2026-05-31',
  url: 'https://compositepaint.com/best/wall-paint/',
};

export const lookBadges: LookBadge[] = [
  { productId: 'ri-paint-clare-wall-eggshell', ...COMPOSITE, label: 'Best designer-direct pick' },
  { productId: 'ri-paint-bm-aura-matte', ...COMPOSITE, label: 'Top pick for interior walls' },
  { productId: 'ri-paint-sw-emerald-matte', ...COMPOSITE, label: 'Best washable wall paint' },
  {
    // The article names the Genta one-handle faucet line, not a model number.
    productId: 'rr-fau-moen-genta',
    publisher: 'Bob Vila',
    title: 'The Best Bathroom Faucets',
    date: '2024-12-23',
    url: 'https://www.bobvila.com/articles/best-bathroom-faucet/',
    label: 'Best Modern (Genta line)',
  },
];
