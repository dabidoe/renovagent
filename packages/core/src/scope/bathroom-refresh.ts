import type { ScopeDraft, ScopeInputKey, ScopeRequirement } from '@renovagent/contracts';
import {
  count,
  floorArea,
  missing,
  perimeter,
  req,
  wallArea,
  type RecipeValues,
} from './recipe-kit.js';

export type { RecipeValues } from './recipe-kit.js';

// Versioned reference recipe for a bathroom refresh. It lists the work
// packages, the easily forgotten supporting parts and the quantity basis of
// each requirement. It never supplies physical defaults: an unknown dimension
// leaves the dependent quantity null, and product-specific rates (coverage,
// airflow) wait for a selected product's published data.
export const bathroomRefreshRecipe = { id: 'bathroom-refresh', version: 1 } as const;

export const bathroomPackages = [
  {
    id: 'removal-protection',
    title: 'Removal and protection',
    summary: 'Protect adjacent finishes, remove and dispose of what the included packages replace.',
  },
  {
    id: 'vanity',
    title: 'Vanity, top and faucet',
    summary: 'Replace the vanity cabinet, top, faucet, drain assembly and supply connections.',
  },
  {
    id: 'toilet',
    title: 'Toilet',
    summary: 'Replace the toilet with a new seal, bolts and supply connection.',
  },
  {
    id: 'floor-tile',
    title: 'Floor tile',
    summary: 'New floor tile with setting materials, grout, trim and conditional underlayment.',
  },
  {
    id: 'paint',
    title: 'Wall paint',
    summary: 'Prepare and repaint the walls.',
  },
  {
    id: 'exhaust-fan',
    title: 'Exhaust fan',
    summary: 'Replace the exhaust fan, vented outdoors.',
  },
  {
    id: 'service-work',
    title: 'Concealed service work (conditional)',
    summary:
      'Supply, drain/vent or electrical changes. Only if the survey shows they are needed; licensed trades and the local permit path apply.',
  },
] as const;

export const bathroomSources: ScopeDraft['sources'] = [
  {
    id: 'recipe-bathroom-refresh-1',
    title: 'Renovagent bathroom-refresh recipe v1',
    publisher: 'Renovagent',
    retrieval: 'internal-recipe',
    supports:
      'Component relationships and quantity formulas in this draft. Unreviewed reference material; not manufacturer or code text.',
  },
  {
    id: 'demo-vanity-template-1',
    title: 'Demo vanity-replacement template v1',
    publisher: 'Renovagent demo catalog',
    retrieval: 'internal-recipe',
    supports:
      'Demo design selections for the vanity package (freestanding cabinet, max 22 in deep, single-hole faucet, connection sizes) used to match the demo catalog. Selections, not site findings.',
  },
  {
    id: 'kohler-toilet-install',
    title: 'Kohler service kit instructions 1365041-9 (T-bolts and wax ring)',
    publisher: 'Kohler Co.',
    url: 'https://techcomm.kohler.com/techcomm/pdf/1365041-9.pdf',
    retrieval: 'fetched',
    retrievedOn: '2026-10-29',
    supports:
      '“Replace the T-Bolts and Wax Ring. Install the new T-bolts and wax ring”; “Install the washers and nuts”; “Connect the new water supply hose”; “Inspect and repair the water supply stops, as needed.” Kohler service sheet; the selected toilet’s own guide governs.',
  },
  {
    id: 'broan-fan-install',
    title: 'Broan S50U installation instructions, “Install the Fan”',
    publisher: 'Broan (hosted by ManualsLib)',
    url: 'https://www.manualslib.com/manual/457322/Broan-S50u.html?page=2',
    retrieval: 'fetched',
    retrievedOn: '2026-10-29',
    supports:
      '“Install 4\" round duct and extend duct to outside through a roof or wall cap”; “Check damper to make sure that it opens freely”; “Tape all duct connections to make them secure and air tight.” Model-specific.',
  },
  {
    id: 'retail-tile-overage-guidance',
    title: 'Published tile overage guidance (web search summary)',
    publisher: 'Retailer and flooring-advice pages located by search',
    retrieval: 'search-excerpt',
    retrievedOn: '2026-10-29',
    supports:
      'A search for overage guidance returned figures from about 5% to 35% depending on layout, tile size and shape; no manufacturer document was found and no page was opened. Used only to show that no single value is supportable without the selected tile and layout.',
  },
];

const RECIPE = ['recipe-bathroom-refresh-1'];

export function bathroomRequirements(packageId: string, v: RecipeValues): ScopeRequirement[] {
  switch (packageId) {
    case 'removal-protection':
      return [
        req(
          packageId,
          'protect',
          {
            category: 'task',
            purpose: 'Protect adjacent floors, doors and finishes and contain dust during removal.',
            specification: 'Covering and containment for the work area and access path.',
            kind: 'count',
            unit: 'lot',
            sourceIds: RECIPE,
          },
          count(1, 'One lot for the job.'),
        ),
        req(
          packageId,
          'remove',
          {
            category: 'task',
            purpose: 'Remove and dispose of the items the included packages replace.',
            specification:
              'Removal limited to included packages; concealed conditions found during removal are reported, not assumed.',
            kind: 'count',
            unit: 'lot',
            sourceIds: RECIPE,
          },
          count(1, 'One lot for the job.'),
        ),
      ];
    case 'vanity': {
      const width = v.vanityWidthIn;
      const template = ['demo-vanity-template-1', ...RECIPE];
      return [
        req(
          packageId,
          'cabinet',
          {
            category: 'material',
            purpose: 'Vanity cabinet.',
            specification:
              width === undefined
                ? 'Freestanding vanity cabinet, max 22 in deep (demo selection); width not yet chosen.'
                : `${width} in freestanding vanity cabinet, max 22 in deep (demo selection; confirm clearances on site).`,
            kind: 'count',
            unit: 'ea',
            sourceIds: template,
            codeTopics: ['phila-permits', 'phila-plumbing-scope'],
            ...(width === undefined
              ? {}
              : {
                  catalog: {
                    category: 'vanity-cabinet',
                    constraints: [
                      { attribute: 'width_in', operator: 'eq' as const, value: width },
                      { attribute: 'depth_in', operator: 'lte' as const, value: 22 },
                      { attribute: 'mount', operator: 'eq' as const, value: 'freestanding' },
                    ],
                  },
                }),
          },
          { ...count(1, 'One cabinet.'), blockedBy: width === undefined ? ['vanityWidthIn'] : [] },
          width === undefined ? 'needs-input' : 'quantified',
        ),
        req(
          packageId,
          'top',
          {
            category: 'material',
            purpose: 'Vanity top with sink, matched to the cabinet.',
            specification:
              width === 30
                ? '31 in top with single-hole sink cutout; the demo catalog pairs this size with a 30 in cabinet. Confirm against the selected cabinet.'
                : 'Top sized to the selected cabinet per its manufacturer; single-hole cutout (demo selection).',
            kind: 'count',
            unit: 'ea',
            sourceIds: template,
            codeTopics: ['phila-plumbing-scope'],
            ...(width === 30
              ? {
                  catalog: {
                    category: 'vanity-top',
                    constraints: [
                      { attribute: 'width_in', operator: 'eq' as const, value: 31 },
                      { attribute: 'holes', operator: 'eq' as const, value: 1 },
                      {
                        attribute: 'material',
                        operator: 'oneOf' as const,
                        value: ['cultured-marble', 'quartz', 'granite'],
                      },
                    ],
                  },
                }
              : {}),
          },
          {
            ...count(1, 'One top.'),
            blockedBy: width === undefined ? ['vanityWidthIn'] : [],
          },
          width === undefined ? 'needs-input' : width === 30 ? 'quantified' : 'needs-product-spec',
        ),
        req(
          packageId,
          'faucet',
          {
            category: 'material',
            purpose: 'Lavatory faucet.',
            specification:
              'Single-hole faucet, 1/2 in FIP connections, max 1.5 gpm (demo selections).',
            kind: 'count',
            unit: 'ea',
            sourceIds: template,
            codeTopics: ['phila-plumbing-scope'],
            catalog: {
              category: 'faucet',
              constraints: [
                { attribute: 'holes', operator: 'eq', value: 1 },
                { attribute: 'connection', operator: 'eq', value: '1/2-fip' },
                { attribute: 'flow_gpm', operator: 'lte', value: 1.5 },
              ],
            },
          },
          count(1, 'One faucet.'),
        ),
        req(
          packageId,
          'drain',
          {
            category: 'material',
            purpose: 'Sink drain and trap connecting the new top to the existing waste.',
            specification:
              'P-trap and drain assembly, 1-1/4 in connection (demo selection); alignment with the existing waste arm unverified.',
            kind: 'count',
            unit: 'ea',
            sourceIds: template,
            codeTopics: ['phila-plumbing-scope', 'phila-single-stack'],
            catalog: {
              category: 'drain',
              constraints: [{ attribute: 'connection_in', operator: 'eq', value: 1.25 }],
            },
          },
          count(1, 'One drain assembly.'),
        ),
        req(
          packageId,
          'supply',
          {
            category: 'material',
            purpose: 'Hot and cold supply connections from the stop valves to the faucet.',
            specification: 'Supply lines, 3/8 in compression × 1/2 in FIP (demo selection).',
            kind: 'count',
            unit: 'ea',
            condition: 'Assumes existing 3/8 in compression stop valves; confirm on site.',
            sourceIds: template,
            codeTopics: ['phila-plumbing-scope'],
            catalog: {
              category: 'supply-line',
              constraints: [
                { attribute: 'connection', operator: 'eq', value: '3/8-comp-x-1/2-fip' },
              ],
            },
          },
          count(2, 'One hot and one cold line.'),
        ),
        req(
          packageId,
          'stops',
          {
            category: 'material',
            purpose: 'Replacement stop valves.',
            specification: 'Stop valves matched to the existing supply pipe type and size.',
            kind: 'conditional',
            unit: 'ea',
            condition: 'Only if the existing stops are missing, seized or leaking.',
            sourceIds: RECIPE,
            codeTopics: ['phila-plumbing-scope'],
          },
          { quantity: null, quantityBasis: 'Depends on the existing valves.', blockedBy: [] },
        ),
      ];
    }
    case 'toilet': {
      const roughIn = v.toiletRoughInIn;
      const kohler = ['kohler-toilet-install', ...RECIPE];
      return [
        req(
          packageId,
          'toilet',
          {
            category: 'material',
            purpose: 'Replacement toilet.',
            specification:
              roughIn === undefined
                ? 'Toilet matched to the existing rough-in distance (not yet measured).'
                : `Toilet for a ${roughIn} in rough-in (relayed measurement; confirm before ordering).`,
            kind: 'count',
            unit: 'ea',
            sourceIds: RECIPE,
            codeTopics: ['phila-plumbing-scope'],
          },
          {
            ...count(1, 'One toilet.'),
            blockedBy: roughIn === undefined ? ['toiletRoughInIn'] : [],
          },
          roughIn === undefined ? 'needs-input' : 'quantified',
        ),
        req(
          packageId,
          'seal',
          {
            category: 'material',
            purpose: 'Seal between the toilet outlet and the floor flange.',
            specification: 'New wax ring (or the seal the selected toilet specifies).',
            kind: 'count',
            unit: 'ea',
            sourceIds: kohler,
          },
          count(1, 'One per toilet; never reused.'),
        ),
        req(
          packageId,
          'bolts',
          {
            category: 'material',
            purpose: 'Anchor the toilet to the flange.',
            specification:
              'New T-bolts (closet bolts) with washers, nuts and caps, length per the toilet guide.',
            kind: 'count',
            unit: 'set',
            sourceIds: kohler,
          },
          count(1, 'One set per toilet.'),
        ),
        req(
          packageId,
          'supply',
          {
            category: 'material',
            purpose: 'Water supply from the stop valve to the tank.',
            specification: 'New toilet supply hose sized to the stop valve and tank fitting.',
            kind: 'count',
            unit: 'ea',
            sourceIds: kohler,
          },
          count(1, 'One per toilet.'),
        ),
        req(
          packageId,
          'flange-repair',
          {
            category: 'material',
            purpose: 'Restore a sound, correctly set flange.',
            specification: 'Flange repair ring or spacer as the condition requires.',
            kind: 'conditional',
            unit: 'ea',
            condition:
              'Only if the existing flange is damaged, loose, or sits too low after the new floor.',
            sourceIds: RECIPE,
            codeTopics: ['phila-plumbing-scope'],
          },
          {
            quantity: null,
            quantityBasis: 'Depends on the flange found at removal.',
            blockedBy: [],
          },
        ),
      ];
    }
    case 'floor-tile': {
      const area = floorArea(v);
      return [
        req(
          packageId,
          'tile',
          {
            category: 'material',
            purpose: 'Field floor tile.',
            specification: 'Floor tile; product, size and layout not yet selected.',
            kind: 'measured',
            unit: 'sq ft',
            sourceIds: RECIPE,
          },
          area,
        ),
        req(
          packageId,
          'overage',
          {
            category: 'material',
            purpose: 'Extra tile for cuts, breakage and future repairs.',
            specification:
              'Overage set from the selected tile, layout and installer; kept separate from measured area.',
            kind: 'allowance',
            unit: 'sq ft',
            sourceIds: ['retail-tile-overage-guidance'],
          },
          {
            quantity: null,
            quantityBasis:
              'No single supportable percentage: published guidance varies with layout and tile.',
            blockedBy: [],
          },
          'needs-source',
        ),
        req(
          packageId,
          'mortar',
          {
            category: 'material',
            purpose: 'Bond the tile to the substrate.',
            specification: 'Tile mortar compatible with the selected tile and substrate.',
            kind: 'spec-dependent',
            unit: 'bag',
            sourceIds: RECIPE,
          },
          {
            quantity: null,
            quantityBasis: "Tile area ÷ the selected mortar's published coverage per bag.",
            blockedBy: area.blockedBy,
          },
        ),
        req(
          packageId,
          'grout',
          {
            category: 'material',
            purpose: 'Fill tile joints.',
            specification: 'Grout matched to the tile and joint width.',
            kind: 'spec-dependent',
            unit: 'bag',
            sourceIds: RECIPE,
          },
          {
            quantity: null,
            quantityBasis:
              "Tile area with the selected tile size and joint width, per the grout's published coverage.",
            blockedBy: area.blockedBy,
          },
        ),
        req(
          packageId,
          'underlayment',
          {
            category: 'material',
            purpose: 'Make the subfloor suitable for tile.',
            specification:
              'Backer board or membrane as the selected tile/underlayment manufacturer requires, with its fasteners and seam treatment.',
            kind: 'conditional',
            unit: 'sq ft',
            condition:
              'Only if the existing subfloor is not suitable for tile; unknown until the old floor is removed.',
            sourceIds: RECIPE,
          },
          area,
        ),
        req(
          packageId,
          'transition',
          {
            category: 'material',
            purpose: 'Finish the floor edge at the doorway.',
            specification: 'Transition or threshold matched to the adjoining floor height.',
            kind: 'conditional',
            unit: 'ea',
            condition: 'Only if the new floor height differs from the adjoining floor.',
            sourceIds: RECIPE,
          },
          { quantity: null, quantityBasis: 'One per affected doorway.', blockedBy: [] },
        ),
        req(
          packageId,
          'base-trim',
          {
            category: 'material',
            purpose: 'Base trim or tile base along the walls.',
            specification: 'Base trim or cove tile matching the new floor.',
            kind: 'measured',
            unit: 'lin ft',
            sourceIds: RECIPE,
          },
          perimeter(v),
        ),
      ];
    }
    case 'paint': {
      const walls = wallArea(v);
      return [
        req(
          packageId,
          'walls',
          {
            category: 'task',
            purpose: 'Paintable wall area.',
            specification: 'Walls prepared and painted; ceiling excluded unless added.',
            kind: 'measured',
            unit: 'sq ft',
            sourceIds: RECIPE,
          },
          walls,
        ),
        req(
          packageId,
          'paint',
          {
            category: 'material',
            purpose: 'Finish coats.',
            specification: 'Paint suited to bathroom humidity; product and sheen not yet selected.',
            kind: 'spec-dependent',
            unit: 'gal',
            sourceIds: RECIPE,
          },
          {
            quantity: null,
            quantityBasis:
              "Wall area × number of coats ÷ the selected paint's published coverage per gallon.",
            blockedBy: walls.blockedBy,
          },
        ),
        req(
          packageId,
          'primer',
          {
            category: 'material',
            purpose: 'Seal patches and stains or bridge a large color change.',
            specification: 'Primer compatible with the selected paint.',
            kind: 'conditional',
            unit: 'gal',
            condition: 'Only if patching, stains or a large color change require it.',
            sourceIds: RECIPE,
          },
          {
            quantity: null,
            quantityBasis: "Area to prime ÷ the primer's published coverage.",
            blockedBy: walls.blockedBy,
          },
        ),
        req(
          packageId,
          'patch',
          {
            category: 'material',
            purpose: 'Repair wall damage before painting.',
            specification: 'Patching compound and tape as the surface condition requires.',
            kind: 'conditional',
            unit: 'lot',
            condition: 'Depends on the wall condition after removal.',
            sourceIds: RECIPE,
          },
          { quantity: null, quantityBasis: 'Set after surface inspection.', blockedBy: [] },
        ),
      ];
    }
    case 'exhaust-fan': {
      const broan = ['broan-fan-install', ...RECIPE];
      const dims = missing(v, ['floorLengthFt', 'floorWidthFt']);
      return [
        req(
          packageId,
          'fan',
          {
            category: 'material',
            purpose: 'Replacement exhaust fan.',
            specification:
              'Exhaust fan rated for the room; airflow rating chosen from room size and the duct run with qualified review.',
            kind: 'spec-dependent',
            unit: 'ea',
            sourceIds: broan,
            codeTopics: ['phila-permits'],
          },
          { ...count(1, 'One fan.'), blockedBy: dims },
        ),
        req(
          packageId,
          'duct',
          {
            category: 'material',
            purpose: 'Carry exhaust air outdoors.',
            specification:
              'Duct of the size the selected fan specifies (4 in round on the referenced models), run outdoors with joints sealed with tape.',
            kind: 'conditional',
            unit: 'lin ft',
            condition: 'Only if the existing duct is missing, undersized or not run outdoors.',
            sourceIds: broan,
          },
          {
            quantity: null,
            quantityBasis: 'Length of the actual route to the exterior.',
            blockedBy: [],
          },
        ),
        req(
          packageId,
          'cap',
          {
            category: 'material',
            purpose: 'Terminate the duct outdoors.',
            specification: 'Wall or roof cap with damper, matched to the duct size.',
            kind: 'conditional',
            unit: 'ea',
            condition: 'Only if the existing termination is replaced or missing.',
            sourceIds: broan,
          },
          { quantity: null, quantityBasis: 'One per duct termination.', blockedBy: [] },
        ),
        req(
          packageId,
          'electrical',
          {
            category: 'task',
            purpose: 'Connect the fan to power.',
            specification:
              'Reconnect to the existing fan circuit by a qualified electrician; any new circuit or switching is service work.',
            kind: 'count',
            unit: 'lot',
            sourceIds: RECIPE,
            codeTopics: ['phila-permits'],
          },
          count(1, 'One connection.'),
        ),
      ];
    }
    case 'service-work':
      return [
        [
          'supply',
          'Move or extend water supply piping.',
          'Only if a fixture moves or the existing supply is unsuitable.',
        ],
        [
          'drain-vent',
          'Change drain or vent piping.',
          'Only if a fixture moves or the existing drain/vent is unsuitable.',
        ],
        [
          'electrical',
          'Add or change circuits, receptacles or switching.',
          'Only if the survey or chosen fixtures require it.',
        ],
      ].map(([id, purpose, condition]) =>
        req(
          packageId,
          id,
          {
            category: 'task',
            purpose,
            specification: 'Licensed trade work under the local permit and inspection path.',
            kind: 'conditional',
            unit: 'lot',
            condition,
            sourceIds: RECIPE,
            codeTopics: ['phila-permits', 'phila-plumbing-scope'],
          },
          { quantity: null, quantityBasis: 'Defined only after the survey.', blockedBy: [] },
        ),
      );
    default:
      return [];
  }
}

export const bathroomQuestions: { inputKeys: ScopeInputKey[]; question: string }[] = [
  {
    inputKeys: ['floorLengthFt', 'floorWidthFt'],
    question:
      'About how long and wide is the bathroom floor? A rough tape measurement is fine, and "I don\'t know" is OK.',
  },
  {
    inputKeys: ['ceilingHeightFt'],
    question: 'Roughly how high is the ceiling?',
  },
  {
    inputKeys: ['vanityWidthIn'],
    question: 'How wide should the vanity be (or how wide is the current one)?',
  },
  {
    inputKeys: ['toiletRoughInIn'],
    question:
      'Behind the toilet, how far is it from the wall to the center of the floor bolts (the rough-in)?',
  },
];

export const bathroomNotPriced = [
  'Labor and installation',
  'Permits and inspection fees',
  'Sales tax',
  'Delivery',
  'Debris disposal fees',
];
