// Order of operations, DIY difficulty, the kit, and a template price for each
// work package. Template prices are typical US big-box retail figures (USD,
// October 2026) for planning only: they are not quotes, not live prices and not
// a product selection. Material allowances scale with the package's own
// measured quantity from the scope draft; without it, only the kit is priced.

export type DiyLevel = 'Easy' | 'Medium' | 'Hard' | 'Pro';
export type WorkPhase = 'Prep' | 'Demo' | 'Rough-in' | 'Paint' | 'Flooring' | 'Fixtures';
export const PHASES: WorkPhase[] = ['Prep', 'Demo', 'Rough-in', 'Paint', 'Flooring', 'Fixtures'];

export type KitItem = { name: string; priceMinor: number };
export type WorkGuide = {
  phase: WorkPhase;
  diy: DiyLevel;
  diyNote: string;
  // Tools a contractor would bring; a DIYer buys them on top of materials.
  kit: KitItem[];
  // A how-to search, not a specific video: it always resolves and stays current.
  videoSearch: string;
  // Template material allowance: per measured sq ft (with waste), or a flat amount.
  materialPerSqFtMinor?: number;
  materialFlatMinor?: number;
  materialNote?: string;
};

const k = (name: string, dollars: number): KitItem => ({
  name,
  priceMinor: Math.round(dollars * 100),
});

const GUIDES: Record<string, WorkGuide> = {
  'removal-protection': {
    phase: 'Prep',
    diy: 'Easy',
    diyNote: 'Protect what stays, then clear out what is being replaced.',
    videoSearch: 'how to protect floors and furniture before renovation',
    kit: [
      k('Plastic sheeting, 10 × 25 ft', 15),
      k("Painter's tape", 8),
      k('Floor protection paper', 20),
    ],
  },
  'carpet-removal': {
    phase: 'Demo',
    diy: 'Easy',
    diyNote: 'Cut into strips, roll, bag; pull tack strip and staples.',
    videoSearch: 'how to remove carpet and tack strip diy',
    kit: [
      k('Utility knife', 10),
      k('Carpet blades, 10-pack', 8),
      k('Contractor bags, 20 ct', 24),
      k('Flat pry bar', 12),
      k('Work gloves', 10),
    ],
  },
  'exhaust-fan': {
    phase: 'Rough-in',
    diy: 'Hard',
    diyNote: 'Electrical and venting; same-location swaps only. Permits may apply.',
    videoSearch: 'how to replace a bathroom exhaust fan',
    kit: [k('Voltage tester', 20), k('Wire connectors', 6), k('Foil duct tape', 10)],
    materialFlatMinor: 12000,
    materialNote: 'Fan allowance',
  },
  'service-work': {
    phase: 'Rough-in',
    diy: 'Pro',
    diyNote: 'Supply, drain or electrical changes: licensed trades and permits.',
    videoSearch: 'what a plumber and electrician do in a bathroom remodel',
    kit: [],
  },
  paint: {
    phase: 'Paint',
    diy: 'Easy',
    diyNote: 'Patch, cut in, two coats. Before new flooring goes down.',
    videoSearch: 'how to paint a room diy',
    kit: [
      k('Roller frame and covers', 18),
      k('Paint tray', 6),
      k('Angled brush', 12),
      k("Painter's tape", 8),
      k('Drop cloth', 15),
      k('Patching compound', 8),
    ],
    materialPerSqFtMinor: 20,
    materialNote: 'Paint, two coats (≈ $40/gal, 400 sq ft per coat)',
  },
  'floor-tile': {
    phase: 'Flooring',
    diy: 'Hard',
    diyNote: 'Flat substrate, layout and cutting matter; slow to fix if wrong.',
    videoSearch: 'how to tile a bathroom floor diy',
    kit: [
      k('Notched trowel', 12),
      k('Tile spacers', 6),
      k('Grout float', 12),
      k('Sponge and bucket', 15),
      k('Manual tile cutter', 45),
    ],
    materialPerSqFtMinor: 420,
    materialNote: 'Tile + thinset and grout, 10% waste (≈ $3/sq ft tile)',
  },
  'hardwood-floor': {
    phase: 'Flooring',
    diy: 'Hard',
    diyNote: 'Acclimate, nail or glue; a flooring nailer is usually rented.',
    videoSearch: 'how to install engineered hardwood flooring',
    kit: [k('Flooring install kit', 25), k('Flooring nailer rental, 1 day', 60), k('Spacers', 6)],
    materialPerSqFtMinor: 660,
    materialNote: 'Engineered hardwood, 10% waste (≈ $6/sq ft)',
  },
  'lvp-floor': {
    phase: 'Flooring',
    diy: 'Medium',
    diyNote: 'Click-lock planks float; the work is in prep, layout and cuts.',
    videoSearch: 'how to install vinyl plank flooring',
    kit: [
      k('Flooring install kit (tapping block, pull bar, spacers)', 25),
      k('Rubber mallet', 12),
      k('Utility knife', 10),
      k('Speed square', 10),
    ],
    materialPerSqFtMinor: 330,
    materialNote: 'Vinyl plank, 10% waste (≈ $3/sq ft)',
  },
  vanity: {
    phase: 'Fixtures',
    diy: 'Medium',
    diyNote: 'Set, level and connect existing supply and drain.',
    videoSearch: 'how to install a bathroom vanity',
    kit: [
      k('Basin wrench', 20),
      k('Supply lines', 20),
      k('Plumber’s putty and tape', 8),
      k('Level', 15),
    ],
    materialFlatMinor: 45000,
    materialNote: 'Vanity, top and faucet allowance',
  },
  toilet: {
    phase: 'Fixtures',
    diy: 'Medium',
    diyNote: 'Heavy but simple: new wax ring, bolts and supply line.',
    videoSearch: 'how to replace a toilet',
    kit: [k('Wax ring and closet bolts', 12), k('Supply line', 10), k('Shims', 8)],
    materialFlatMinor: 25000,
    materialNote: 'Toilet allowance',
  },
};
GUIDES['wall-paint'] = GUIDES.paint!;

export function workGuide(packageId: string): WorkGuide | null {
  return Object.hasOwn(GUIDES, packageId) ? GUIDES[packageId]! : null;
}

export type TemplateEstimate = {
  totalMinor: number;
  kitMinor: number;
  materialMinor: number;
  areaSqFt: number | null;
  needsArea: boolean;
};

// The package's measured area: the smallest positive sq ft quantity among its
// requirements (the base area; coats and waste lines are multiples of it).
export function templateEstimate(
  guide: WorkGuide,
  lines: { quantity: number | null; unit: string }[],
): TemplateEstimate {
  const areas = lines.filter((l) => l.unit === 'sq ft' && l.quantity).map((l) => l.quantity!);
  const areaSqFt = areas.length ? Math.min(...areas) : null;
  const kitMinor = guide.kit.reduce((n, i) => n + i.priceMinor, 0);
  const perSqFt = guide.materialPerSqFtMinor;
  const materialMinor =
    (guide.materialFlatMinor ?? 0) +
    (perSqFt !== undefined && areaSqFt !== null ? Math.round(perSqFt * areaSqFt) : 0);
  return {
    totalMinor: kitMinor + materialMinor,
    kitMinor,
    materialMinor,
    areaSqFt,
    needsArea: perSqFt !== undefined && areaSqFt === null,
  };
}
