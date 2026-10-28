// Explicit semantic bindings for this versioned recipe. Arbitrary imported questions
// cannot acquire the meaning of these questions merely by sharing an array index.
export const scopeRecipeVersion = 'kitchen-powder-study/2';
export const scopeQuestionBindings = [
  'Which kitchen elements must stay, and which can change: cabinets, countertops, sink, range, microwave and dishwasher?',
  'Should the peninsula and its lattice front remain as the work and circulation divider?',
  "Is the existing bathroom's tub/shower, toilet and vanity arrangement acceptable, or is alteration expected?",
  'Is basement use acceptable for a powder room given the stair access, exposed ductwork and small high windows shown?',
  'Would use of an understair or closed-door ground-floor area be acceptable if measurements and services later proved suitable?',
  'Must the existing stair and hallway circulation widths and door positions remain fully unchanged?',
] as const;
export const scopeOptionDefinitions = [
  {
    id: 'kitchen-only',
    title: 'Kitchen refresh · defer the additional powder room',
    summary:
      'Develop the kitchen scope first, using the reported cabinet, countertop, appliance and peninsula direction. Defer the new powder room as a separate project phase.',
    questions: [0, 1, 2, 5],
    scope: [
      'Survey and develop the kitchen refresh, including the reported retain/change choices.',
      'Confirm whether any existing-bath work is a separate scope before pricing.',
    ],
    exclusions: [
      'New powder-room construction.',
      'Existing-bath refurbishment unless separately scoped and reviewed.',
    ],
    measurement:
      'Kitchen footprint, cabinet runs, countertop geometry, appliance specifications and service positions, peninsula/circulation clearances, windows and door swings.',
    feasibility:
      'Inspect retained cabinetry and countertop support, appliance/service compatibility, ventilation and any affected concealed systems. A reported intention to retain something does not establish its condition.',
  },
  {
    id: 'ground-floor-powder',
    title: 'Kitchen refresh + ground-floor powder-room study',
    summary:
      'Investigate an additional powder room in a measured ground-floor candidate area. An understair or closed-door area in the photos is a lead, not an established available room.',
    questions: [0, 1, 2, 4, 5],
    scope: [
      'Develop the kitchen refresh from the reported retain/change choices.',
      'Survey nominated ground-floor/understair areas and compare a powder-room layout only after access, services and geometry are established.',
    ],
    exclusions: [
      'Basement powder-room construction.',
      'Assumed removal of walls, relocation of doors or loss of required circulation.',
    ],
    measurement:
      'Kitchen survey plus nominated ground-floor enclosure footprint, sloping/finished headroom, door swings, stair/hall circulation, adjacent openings and observed service locations.',
    feasibility:
      'Qualified investigation of structure, stair enclosure and circulation constraints, water supply, waste/vent routing and drainage, ventilation/exhaust route and electrical scope. No service adjacency or code-compliant fit is established by photos.',
  },
  {
    id: 'basement-powder',
    title: 'Kitchen refresh + basement powder-room study',
    summary:
      'Investigate a basement powder-room location while developing the kitchen refresh. Keep the access and drainage risks explicit before committing to this location.',
    questions: [0, 1, 2, 3, 5],
    scope: [
      'Develop the kitchen refresh from the reported retain/change choices.',
      'Survey a nominated basement zone, stair approach, beams/ducts and floor levels before developing a powder-room layout.',
    ],
    exclusions: [
      'Ground-floor powder-room construction.',
      'Assumed below-slab drainage, gravity fall, pump suitability or compliant headroom.',
    ],
    measurement:
      'Kitchen survey plus basement candidate footprint, finished headroom under beams/ducts, stair access and landing geometry, floor/elevation survey, openings and observed service locations.',
    feasibility:
      'Qualified investigation of below-slab/other waste and vent routes, available drainage elevations, moisture and floor conditions, access/headroom, ventilation/exhaust and electrical scope. Gravity drainage or a pumping solution remains unsupported.',
  },
] as const;
