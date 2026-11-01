import type { PhotoReview, PropertyResearch, Workspace } from '@renovagent/contracts';
import type { WorkspaceController } from '../../app/workspace-controller.js';
import { propertyAddress } from '@renovagent/core';

export type HouseRegion = {
  id: string;
  photoId: string;
  label: string;
  category: string;
  polygon: { x: number; y: number }[];
  observation: string;
  unknowns: string[];
  nextAction: string;
  confidence: string;
};
export type HouseCorpus = {
  address: string;
  reviewedAt: string;
  manifestHash: string;
  batches: PhotoReview['batches'];
  originalGoal?: string;
  originalPlanning?: PhotoReview['planning'];
  photos: PhotoReview['photos'];
  inventory: {
    kind: string;
    method: string;
    verification: string;
    analyzedAt: string;
    runId: string;
    model: string;
    photos: { id: string; sha256: string; width: number; height: number }[];
    items: HouseRegion[];
  };
  sources: PropertyResearch['sources'];
  findings: PropertyResearch['findings'];
  suppliedListing: string;
  suppliedVideo: string;
  visualReceipts?: Record<string, unknown>;
};
export const HOUSE_PACKET_NAME = 'hutchinson-whole-house-plan.md';
export const HOUSE_CHOICES_NAME = 'hutchinson-concept-direction.json.txt';
export const HOUSE_GOAL =
  'Refresh the whole house and investigate adding a new half bath in the living room. Use listing photos and plans to develop the concept before a measured takeoff.';
export const houseAreas = [
  {
    id: 'living',
    title: 'Living & dining',
    level: 'Ground floor',
    icon: 'home',
    photoIds: ['photo-04', 'photo-03'],
    planId: 'photo-20',
    approach: 'Refresh',
    headline: 'A fresh start, with room for an extra bath.',
    work: [
      'Compare replacing the room carpet while keeping stair access.',
      'Plan wall preparation, repairs and repainting.',
      'Investigate a new half-bath zone, circulation and waste / vent routing.',
    ],
    materials: [
      'Floor finish, product-specific underlayment, trim and transitions',
      'Patching, primer where needed, paint and protection',
      'For the bath study: fixtures, supply / waste / vent assemblies and ventilation once the layout is resolved',
    ],
    question: 'Which zone would you consider for the new half bath?',
  },
  {
    id: 'kitchen',
    title: 'Kitchen',
    level: 'Ground floor',
    icon: 'materials',
    photoIds: ['photo-05', 'photo-06', 'photo-07'],
    planId: 'photo-20',
    approach: 'Keep & refine',
    headline: 'Start with what is already here.',
    work: [
      'Review cabinets, counters and appliances for retention.',
      'Compare a targeted refresh before a full replacement.',
      'Coordinate any work with access to the rear door and retained services.',
    ],
    materials: [
      'Hardware, finishing products and localized repairs if selected',
      'Lighting and connection parts after fixture selection',
      'Floor edges and transitions wherever finishes meet',
    ],
    question: 'Keep the cabinet layout as the starting option?',
  },
  {
    id: 'bedrooms',
    title: 'Upstairs rooms',
    level: 'Upper floor',
    icon: 'paint',
    photoIds: ['photo-11', 'photo-12', 'photo-13'],
    planId: 'photo-21',
    approach: 'Refresh',
    headline: 'One coordinated finish plan upstairs.',
    work: [
      'Inspect wall coverings and ceilings before choosing preparation.',
      'Compare floor and paint choices across the upstairs rooms.',
      'Retain access to closets, radiators and windows.',
    ],
    materials: [
      'Surface preparation, patches, primer and finish coats',
      'Selected flooring, trim and doorway transitions',
      'Protection and disposal requirements after the scope is chosen',
    ],
    question: 'Keep the same palette and flooring throughout upstairs?',
  },
  {
    id: 'bathroom',
    title: 'Full bathroom',
    level: 'Upper floor',
    icon: 'pipe',
    photoIds: ['photo-09'],
    planId: 'photo-21',
    approach: 'Review & refresh',
    headline: 'Decide what stays before anything comes out.',
    work: [
      'Review the existing fixtures, tile and wet-area finishes.',
      'Separate cosmetic updates from plumbing or waterproofing work.',
      'Develop replacement assemblies only for the selected changes.',
    ],
    materials: [
      'Selected fixtures and compatible connection parts',
      'Product-specific waterproofing and tile assemblies if disturbed',
      'Sealants, fixings, protection and disposal',
    ],
    question: 'A cosmetic refresh, or replacement of specific fixtures?',
  },
  {
    id: 'basement',
    title: 'Basement & laundry',
    level: 'Basement',
    icon: 'layers',
    photoIds: ['photo-14', 'photo-16', 'photo-17', 'photo-15'],
    planId: 'photo-19',
    approach: 'Investigate first',
    headline: 'Understand the services before adding finishes.',
    work: [
      'Survey condition and moisture before choosing finishes.',
      'Keep laundry, meter and existing half-bath access in the plan.',
      'Review possible service routes for the proposed upstairs work.',
    ],
    materials: [
      'Finish and repair requirements after the condition survey',
      'Service work only after routing and connection review',
      'Protection and access provisions during the refresh',
    ],
    question: 'Which basement finishes should be retained?',
  },
  {
    id: 'exterior',
    title: 'Exterior & roof',
    level: 'House envelope',
    icon: 'home',
    photoIds: ['photo-01', 'photo-02', 'photo-18'],
    planId: 'photo-22',
    approach: 'Survey first',
    headline: 'Put weather-tightness ahead of cosmetic work.',
    work: [
      'Review roof, facade, openings and drainage with current evidence.',
      'Separate maintenance from repairs supported by the survey.',
      'Coordinate access and protection with the interior sequence.',
    ],
    materials: [
      'Repair assemblies follow the condition and product findings',
      'Access, protection and disposal depend on the chosen work',
    ],
    question: 'Any current roof, leak or exterior repair reports to add?',
  },
] as const;
export type AreaId = (typeof houseAreas)[number]['id'];
export type HouseChoices = { excluded: AreaId[]; halfBath: boolean };
export function scopeForArea(area: (typeof houseAreas)[number], choices: HouseChoices) {
  return {
    work: area.work.filter((work) => choices.halfBath || !work.includes('a new half-bath')),
    materials: area.materials.filter(
      (material) => choices.halfBath || !material.startsWith('For the bath study:'),
    ),
    question:
      area.id === 'living' && !choices.halfBath
        ? 'Which floors and wall finishes should the refresh use?'
        : area.question,
  };
}
export function parseHouseChoices(raw: unknown): HouseChoices {
  const value = raw as Partial<HouseChoices> | null;
  if (
    !value ||
    typeof value.halfBath !== 'boolean' ||
    !Array.isArray(value.excluded) ||
    value.excluded.some((id) => !houseAreas.some((area) => area.id === id))
  )
    throw Error('Invalid concept direction');
  return { halfBath: value.halfBath, excluded: [...new Set(value.excluded)] };
}
export const housePhases = [
  {
    title: 'Understand the house',
    detail:
      'Organize the photos, listing plans and current owner information. Choose what to keep and where the new half bath could go.',
    rooms: 'All areas',
  },
  {
    title: 'Resolve the consequential work',
    detail:
      'Investigate the bath layout and services, inspect existing conditions and turn the chosen direction into a measured scope.',
    rooms: 'Bath study · services · envelope',
  },
  {
    title: 'Prepare, then improve',
    detail:
      'Sequence protection and removals before approved service work, inspections where required, and surface preparation.',
    rooms: 'Selected work areas',
  },
  {
    title: 'Finish and hand over',
    detail:
      'Coordinate floors, paint, fixtures and trim; then record testing, corrections and the final handoff.',
    rooms: 'Whole-house coordination',
  },
];

export function houseBrief(corpus: HouseCorpus, choices: HouseChoices) {
  const areas = houseAreas.filter((area) => !choices.excluded.includes(area.id));
  return [
    '# Hutchinson — whole-house concept plan',
    '',
    corpus.address,
    '',
    `Direction: whole-house refresh${choices.halfBath ? ' + investigate a new living-room half bath' : ''}.`,
    'Status: proposed concept scope. Listing evidence and saved model observations are reference inputs, not current measurements or a construction release.',
    '',
    '## Source pack',
    `- Owner-supplied listing: ${corpus.suppliedListing}`,
    `- Source video tour: ${corpus.suppliedVideo}`,
    `- ${corpus.photos.length} reviewed source files, including four listing-plan images.`,
    `- Saved Muse review: ${corpus.reviewedAt}; manifest SHA-256 ${corpus.manifestHash}.`,
    `- ${corpus.inventory.items.length} historical per-photo region proposals; not a count of distinct physical assets.`,
    '',
    ...areas.flatMap((area) => [
      `## ${area.title}`,
      `Approach: ${area.approach}. Source views: ${area.photoIds.join(', ')}. Listing plan: ${area.planId}.`,
      ...scopeForArea(area, choices).work.map((work) => `- ${work}`),
      '',
      'Supporting materials to develop:',
      ...scopeForArea(area, choices).materials.map((material) => `- ${material}`),
      '',
      `Next decision: ${scopeForArea(area, choices).question}`,
      '',
    ]),
    ...(choices.halfBath
      ? [
          '## New half-bath investigation',
          '- Explore a living-room zone without assuming an enclosure size or feasible service connection.',
          '- Preserve circulation; investigate waste, vent, supply, ventilation and access with the listing plan as a reference.',
          '- This study remains separate from any deferred cosmetic work in the living room.',
          '',
        ]
      : []),
    '## Work sequence',
    ...housePhases.map((phase, i) => `${i + 1}. ${phase.title}: ${phase.detail}`),
    '',
    '## Quantities and budget',
    'Concept planning does not require room dimensions. Listing plans and public records can supply reference information; dimensions need a stated basis before a takeoff. No room areas, labour hours or house budget have been invented here. Resolve the selected work into quantities, supporting materials, labour, tax/delivery and unpriced work before a cost commitment.',
    '',
    '## Visual pipeline',
    '- Source photos: original listing evidence.',
    '- SAM: precise image outlines when a saved segmentation receipt is available. Historical Muse regions remain separately identified.',
    '- Blender: a concept reference tied to its source plan, with any display-only geometry identified.',
    '- Muse Image: a generated look tied to its input reference and prompt, not a measured model.',
    '',
    '## Source observations',
    ...corpus.photos.flatMap((photo) => [
      `### ${photo.id} · ${photo.roomType}`,
      photo.imageUrl,
      ...photo.observations.map((observation) => `- ${observation}`),
      ...photo.uncertainties.map((uncertainty) => `- Unresolved: ${uncertainty}`),
      '',
    ]),
  ].join('\n');
}

export function isHouseCase(state: Workspace, projectId: string) {
  return Object.values(state.evidence).some(
    (e) => e.projectId === projectId && e.source.attachment?.name === HOUSE_PACKET_NAME,
  );
}

// Preserve the historical review as a source attachment. It is not rebound to
// this new goal as if Muse had produced a fresh whole-house planning result.
export async function saveHouseCase(
  controller: WorkspaceController,
  corpus: HouseCorpus,
  choices: HouseChoices,
  projectId?: string,
) {
  choices = parseHouseChoices(choices);
  const current = controller.getSnapshot().workspace;
  const existingProperty = Object.values(current.projects).find((p) => {
    const address = propertyAddress(current, p.id);
    return (
      address?.value.kind === 'text' &&
      address.value.text.trim().toLowerCase() === corpus.address.trim().toLowerCase()
    );
  })?.propertyId;
  const id =
    projectId ??
    (await controller.createProject({
      name: 'Hutchinson · whole-house refresh',
      goal: HOUSE_GOAL,
      propertyName: corpus.address,
      propertyId: existingProperty,
      address: existingProperty ? undefined : corpus.address,
      room: 'Whole home',
      underway: false,
    }));
  const packet = new File([houseBrief(corpus, choices)], HOUSE_PACKET_NAME, { type: 'text/plain' });
  const packetId = await controller.attachFile(id, packet);
  await controller.attachFile(
    id,
    new File([JSON.stringify(parseHouseChoices(choices))], HOUSE_CHOICES_NAME, {
      type: 'text/plain',
    }),
  );
  if (!projectId)
    await controller.attachFile(
      id,
      new File([JSON.stringify(corpus, null, 2)], 'hutchinson-source-receipts.json.txt', {
        type: 'text/plain',
      }),
    );
  await controller.sendMessage(
    id,
    `Saved the proposed whole-house concept scope and its listing/Muse source records. ${choices.halfBath ? 'The living-room half bath remains an investigation.' : 'The new living-room half-bath study is deferred.'} Do not treat the source plan as a measured construction survey.`,
    [packetId],
  );
  return id;
}
