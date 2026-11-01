import type {
  DesignDirection,
  ScopeDraft,
  ScopeInputKey,
  ScopeRequirement,
} from '@renovagent/contracts';
import {
  count,
  floorArea,
  perimeter,
  req,
  round,
  wallArea,
  type RecipeValues,
} from './recipe-kit.js';

// Versioned living-room refresh recipe: wall paint, carpet removal and two
// floating-floor alternatives. Like the bathroom recipe it never supplies a
// physical default; product rates and gaps come from the selected product.
export const livingRoomRefreshRecipe = { id: 'living-room-refresh', version: 2 } as const;

export const livingRoomPackages = [
  {
    id: 'removal-protection',
    title: 'Protection and furniture',
    summary: 'Protect adjacent finishes and move furniture out of and back into the work area.',
  },
  {
    id: 'wall-paint',
    title: 'Wall paint',
    summary: 'Prepare and repaint the walls in the chosen color; the ceiling is unchanged.',
  },
  {
    id: 'carpet-removal',
    title: 'Carpet removal',
    summary: 'Remove the room carpet and pad and prepare the subfloor. The stair carpet stays.',
  },
  {
    id: 'hardwood-floor',
    title: 'Engineered hardwood floor',
    summary: 'Floating engineered hardwood with underlayment, trim and transitions.',
  },
  {
    id: 'lvp-floor',
    title: 'Wood-look vinyl plank floor',
    summary: 'Floating vinyl plank with trim and transitions.',
  },
] as const;

export const livingRoomSources: ScopeDraft['sources'] = [
  {
    id: 'recipe-living-room-refresh-1',
    title: 'Renovagent living-room-refresh recipe v2',
    publisher: 'Renovagent',
    retrieval: 'internal-recipe',
    supports:
      'Component relationships and quantity formulas in this draft. Unreviewed reference material; not manufacturer or code text.',
  },
  {
    id: 'toh-floating-engineered',
    title: 'How to install a floating engineered wood floor',
    publisher: 'This Old House',
    url: 'https://www.thisoldhouse.com/flooring/how-to-install-a-floating-engineered-wood-floor',
    retrieval: 'fetched',
    retrievedOn: '2026-10-29',
    supports:
      '“For carpet, cut it into manageable strips and roll them up for disposal”; “For wood subfloors, a basic foam or cork underlayment is usually sufficient”; concrete needs an underlayment “with a built-in vapor barrier”; trim the casing at doorways; “install transition strips where your new engineered wood floor meets another type of flooring”; fasten quarter-round “to the baseboard, not the flooring.”',
  },
  {
    id: 'xulon-lvp-install',
    title: 'Xulon luxury vinyl planks click installation guide',
    publisher: 'Expressive Flooring (Xulon)',
    url: 'https://cdn.shopify.com/s/files/1/0007/1578/4252/files/Xulon_Luxury_Vinyl_Planks_Click-Installation_Guide.pdf',
    retrieval: 'fetched',
    retrievedOn: '2026-10-29',
    supports:
      '“Never install this LVP over existing carpet”; “the removal of wall baseboards is optional since quarter round can be installed”; “undercut all doorjambs and never fasten wall moldings and/or transition strips to the plank”; an underlayment “is not necessary”, and if used “nothing thicker than 1.5mm”; “in doorways should use a t-molding.” Product-specific.',
  },
];

const RECIPE = ['recipe-living-room-refresh-1'];
const TOH = ['toh-floating-engineered', ...RECIPE];
const XULON = ['xulon-lvp-install', ...RECIPE];

// Two finish coats is this recipe's design selection, stated wherever it is used.
const COATS = 2;
// So is buying 10% more paint than the coats need: touch-ups, rolling loss
// and porous walls, so the job rounds up rather than running short.
const PAINT_EXTRA = 0.1;

function paintCoverage(v: RecipeValues) {
  const walls = wallArea(v);
  return walls.quantity === null
    ? { ...walls, quantityBasis: 'Wall area × 2 coats; dimensions not yet provided.' }
    : {
        ...walls,
        quantity: round(walls.quantity * COATS * (1 + PAINT_EXTRA)),
        quantityBasis: `${walls.quantity} sq ft gross wall area × ${COATS} coats, plus ${PAINT_EXTRA * 100}% for touch-ups and loss (recipe selections); openings not deducted. Gallons follow the selected paint's stated coverage, rounded up.`,
      };
}

export function livingRoomRequirements(
  packageId: string,
  v: RecipeValues,
  direction?: DesignDirection,
): ScopeRequirement[] {
  const wallColor = direction?.wallColor ?? 'chosen color';
  const floorFinish = direction?.floorFinish ?? 'chosen finish';
  switch (packageId) {
    case 'removal-protection':
      return [
        req(
          packageId,
          'protect',
          {
            category: 'task',
            purpose: 'Protect the stairs, adjoining floors and furniture during the work.',
            specification: 'Covering and containment for the work area and access path.',
            kind: 'count',
            unit: 'lot',
            sourceIds: RECIPE,
          },
          count(1, 'One lot for the job.'),
        ),
        req(
          packageId,
          'furniture',
          {
            category: 'task',
            purpose: 'Move furniture out of the work area and back.',
            specification: 'Furniture moved and returned; contents and fragile items by the owner.',
            kind: 'count',
            unit: 'lot',
            sourceIds: RECIPE,
          },
          count(1, 'One lot for the job.'),
        ),
      ];
    case 'wall-paint':
      return [
        req(
          packageId,
          'walls',
          {
            category: 'task',
            purpose: 'Paintable wall area.',
            specification: `Walls prepared and painted ${wallColor}; ceiling unchanged.`,
            kind: 'measured',
            unit: 'sq ft',
            sourceIds: RECIPE,
          },
          wallArea(v),
        ),
        req(
          packageId,
          'paint',
          {
            category: 'material',
            purpose: 'Finish coats.',
            specification: `${wallColor} interior wall paint${direction?.paintSheen ? `, ${direction.paintSheen} finish` : ''}, ${COATS} finish coats (recipe selection; follow the product's directions).`,
            kind: 'measured',
            unit: 'sq ft',
            sourceIds: RECIPE,
            catalog: {
              category: 'interior-paint',
              constraints: direction?.paintSheen
                ? [{ attribute: 'sheen', operator: 'eq', value: direction.paintSheen }]
                : [],
            },
          },
          paintCoverage(v),
        ),
        req(
          packageId,
          'covering',
          {
            category: 'task',
            purpose: 'Deal with any existing wall covering before painting.',
            specification:
              'Remove or seal existing wallpaper or texture as the paint maker requires.',
            kind: 'conditional',
            unit: 'sq ft',
            condition:
              'Only if the walls turn out to be papered or coated in a way paint will not bond to.',
            sourceIds: RECIPE,
          },
          wallArea(v),
        ),
        req(
          packageId,
          'patch',
          {
            category: 'material',
            purpose: 'Repair holes and damage before painting.',
            specification: 'Patching compound as the surface condition requires.',
            kind: 'conditional',
            unit: 'lot',
            condition: 'Depends on the wall condition once furniture and fixtures are moved.',
            sourceIds: RECIPE,
          },
          { quantity: null, quantityBasis: 'Set after surface inspection.', blockedBy: [] },
        ),
        req(
          packageId,
          'primer',
          {
            category: 'material',
            purpose: 'Seal stains and patches or bridge a large color change.',
            specification: 'Primer compatible with the selected paint.',
            kind: 'conditional',
            unit: 'sq ft',
            condition: 'Only if stains, patches or the color change require it.',
            sourceIds: RECIPE,
          },
          wallArea(v),
        ),
      ];
    case 'carpet-removal':
      return [
        req(
          packageId,
          'carpet',
          {
            category: 'task',
            purpose: 'Remove the room carpet, pad and tack strip for disposal.',
            specification:
              'Room carpet only; the stair carpet stays unless added. Floating floors are not installed over carpet.',
            kind: 'measured',
            unit: 'sq ft',
            sourceIds: ['toh-floating-engineered', 'xulon-lvp-install'],
          },
          floorArea(v),
        ),
        req(
          packageId,
          'subfloor',
          {
            category: 'task',
            purpose: 'Bring the subfloor to the flatness the selected floor requires.',
            specification:
              "Repair and flatten per the selected flooring maker's subfloor requirements.",
            kind: 'conditional',
            unit: 'sq ft',
            condition:
              'Depends on the subfloor found under the carpet (type and flatness unknown).',
            sourceIds: XULON,
          },
          floorArea(v),
        ),
      ];
    case 'hardwood-floor':
      return [
        req(
          packageId,
          'planks',
          {
            category: 'material',
            purpose: 'Floor finish.',
            specification: `${floorFinish} engineered hardwood, floating installation; expansion gap per the product's instructions.`,
            kind: 'measured',
            unit: 'sq ft',
            sourceIds: TOH,
            catalog: { category: 'engineered-hardwood', constraints: [] },
          },
          floorArea(v),
        ),
        overage(packageId),
        req(
          packageId,
          'underlayment',
          {
            category: 'material',
            purpose: 'Cushion and level under the floating floor.',
            specification:
              'Foam or cork underlayment for a wood subfloor; a vapor-barrier type if the subfloor is concrete (not yet known).',
            kind: 'measured',
            unit: 'sq ft',
            sourceIds: TOH,
            catalog: { category: 'floor-underlayment', constraints: [] },
          },
          floorArea(v),
        ),
        trim(packageId, v, TOH),
        transition(packageId, TOH),
        undercut(packageId, TOH),
      ];
    case 'lvp-floor':
      return [
        req(
          packageId,
          'planks',
          {
            category: 'material',
            purpose: 'Floor finish.',
            specification: `${floorFinish} vinyl plank, floating click installation; expansion space per the product's instructions.`,
            kind: 'measured',
            unit: 'sq ft',
            sourceIds: XULON,
            catalog: { category: 'vinyl-plank', constraints: [] },
          },
          floorArea(v),
        ),
        overage(packageId),
        req(
          packageId,
          'underlayment',
          {
            category: 'material',
            purpose: 'Optional thin underlayment.',
            specification:
              'Only a type the selected plank maker allows (the referenced guide: none needed, max 1.5 mm).',
            kind: 'conditional',
            unit: 'sq ft',
            condition: 'Only if the selected plank has no attached pad and its maker permits one.',
            sourceIds: XULON,
          },
          floorArea(v),
        ),
        trim(packageId, v, XULON),
        transition(packageId, XULON),
        undercut(packageId, XULON),
      ];
    default:
      return [];
  }
}

function overage(packageId: string) {
  return req(
    packageId,
    'overage',
    {
      category: 'material',
      purpose: 'Extra flooring for cuts and future repairs.',
      specification:
        'Set from the selected product, layout and installer; kept separate from measured area.',
      kind: 'allowance',
      unit: 'sq ft',
      sourceIds: RECIPE,
    },
    {
      quantity: null,
      quantityBasis: 'No sourced percentage; depends on the product and layout.',
      blockedBy: [],
    },
    'needs-source',
  );
}

function trim(packageId: string, v: RecipeValues, sourceIds: string[]) {
  return req(
    packageId,
    'quarter-round',
    {
      category: 'material',
      purpose: 'Cover the expansion gap at the walls.',
      specification:
        'Quarter-round fastened to the baseboard, not the floor; existing baseboards stay.',
      kind: 'measured',
      unit: 'lin ft',
      sourceIds,
      catalog: { category: 'quarter-round', constraints: [] },
    },
    perimeter(v),
  );
}

function transition(packageId: string, sourceIds: string[]) {
  return req(
    packageId,
    'transition',
    {
      category: 'material',
      purpose: 'Finish the edge where the new floor meets another floor.',
      specification: 'Transition or T-molding fastened to the subfloor, not the new floor.',
      kind: 'conditional',
      unit: 'ea',
      condition:
        'One per opening where the new floor meets a different floor (kitchen, entry, stair).',
      sourceIds,
    },
    { quantity: null, quantityBasis: 'Count the openings on site.', blockedBy: [] },
  );
}

function undercut(packageId: string, sourceIds: string[]) {
  return req(
    packageId,
    'undercut',
    {
      category: 'task',
      purpose: 'Let the floor slide under door casings.',
      specification: 'Undercut door jambs and casings to the new floor height.',
      kind: 'count',
      unit: 'lot',
      sourceIds,
    },
    count(1, 'One lot for all doorways.'),
  );
}

export const livingRoomQuestions: { inputKeys: ScopeInputKey[]; question: string }[] = [
  {
    inputKeys: ['floorLengthFt', 'floorWidthFt'],
    question:
      'About how long and wide is the room? A floor plan or rough tape measurement is fine, and "I don\'t know" is OK.',
  },
  { inputKeys: ['ceilingHeightFt'], question: 'Roughly how high is the ceiling?' },
];

export const livingRoomNotPriced = [
  'Labor and installation',
  'Carpet disposal fees',
  'Sales tax',
  'Delivery',
];

export const livingRoomOptions: {
  id: string;
  title: string;
  summary: string;
  retained: string[];
  packageIds: string[];
  direction: DesignDirection;
}[] = [
  {
    id: 'paint-refresh',
    title: 'Fresh walls, keep the carpet',
    summary: 'Repaint the walls and keep the existing carpet. The lightest scope.',
    retained: ['Room and stair carpet', 'Ceiling, lighting and furniture'],
    packageIds: ['removal-protection', 'wall-paint'],
    direction: { wallColor: 'warm white', floorFinish: 'existing carpet' },
  },
  {
    id: 'hardwood',
    title: 'Light-oak hardwood + fresh walls',
    summary: 'Replace the room carpet with floating engineered hardwood and repaint the walls.',
    retained: ['Stair carpet', 'Ceiling, lighting and furniture'],
    packageIds: ['removal-protection', 'carpet-removal', 'hardwood-floor', 'wall-paint'],
    direction: { wallColor: 'warm white', floorFinish: 'natural light oak' },
  },
  {
    id: 'vinyl-plank',
    title: 'Wood-look vinyl plank + fresh walls',
    summary: 'Replace the room carpet with floating wood-look vinyl plank and repaint the walls.',
    retained: ['Stair carpet', 'Ceiling, lighting and furniture'],
    packageIds: ['removal-protection', 'carpet-removal', 'lvp-floor', 'wall-paint'],
    direction: { wallColor: 'warm white', floorFinish: 'warm mid-tone oak look' },
  },
];

// Deterministic edit instruction for a same-room concept preview. Everything
// not named as a change is asked to stay exactly as photographed.
export function livingRoomPreviewPrompt(packageIds: string[], direction: DesignDirection): string {
  const changes = [
    `repaint the walls ${direction.wallColor} (matte finish)`,
    ...(packageIds.includes('hardwood-floor')
      ? [
          `replace the carpet on the room floor (not the stairs) with ${direction.floorFinish} engineered hardwood planks`,
        ]
      : packageIds.includes('lvp-floor')
        ? [
            `replace the carpet on the room floor (not the stairs) with ${direction.floorFinish} vinyl plank flooring`,
          ]
        : ['keep the existing carpet exactly as it is']),
  ];
  return `Edit this exact photo. Keep the camera position, framing, room geometry, staircase and its carpet, railing, furniture, mirror, lamp, windows, doors, ceiling and lighting exactly as they are. Change only the following: ${changes.join('; ')}. Photorealistic, natural daylight, no added objects or text.`;
}
