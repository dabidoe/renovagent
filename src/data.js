export const INV = [
  { k: 'wax', label: 'Wax ring (spare)', val: 9 },
  { k: 'valve', label: 'Angle stop valve', val: 14 },
  { k: 'ptrap', label: 'P-trap kit', val: 12 },
  { k: 'caulk', label: 'Silicone caulk tube', val: 8 },
];

export const TASKS = [
  { id: 't1', title: 'Measure & confirm stack, vent, shutoffs', trade: 'Archie / Pete', deps: [], hold: false },
  { id: 't2', title: 'Permit & inspection check (hold point)', trade: 'Dwang', deps: ['t1'], hold: true },
  { id: 't3', title: 'Demo & prep — protect floors, cap lines', trade: 'Dwang', deps: ['t1'], hold: false },
  { id: 't4', title: 'Rough plumbing — drain, vent, supply', trade: 'Pete', deps: ['t2', 't3'], hold: false },
  { id: 't5', title: 'Rough electrical — GFCI, fan, lighting', trade: 'Sparky', deps: ['t2', 't3'], hold: false },
  { id: 't6', title: 'Floor prep & finish', trade: 'Dwang', deps: ['t4', 't5'], hold: false },
  { id: 't7', title: 'Set toilet & sink, test for leaks', trade: 'Pete', deps: ['t6'], hold: false },
  { id: 't8', title: 'Finish, caulk, punch list & photos', trade: 'Dwang', deps: ['t7'], hold: false },
];

export const CODE_DB = [
  { fam: 'IPC', sec: 'IPC §405 / fixture clearances', topic: 'Water closet clearance', req: 'Min. 15 in from centreline to side wall/obstruction; 21 in clear in front of the bowl (typical model-code values). Our plan keeps the toilet out of corners that fail this.', key: 'clearance water closet toilet side front' },
  { fam: 'IPC', sec: 'IPC §802 / drainage slope', topic: 'Drain slope', req: 'Horizontal drain piping typically slopes 1/4 in per foot for smaller diameters. Pete checks stack distance against achievable fall before pipe is bought.', key: 'slope fall drain pitch stack' },
  { fam: 'IPC', sec: 'IPC Ch.9 / venting', topic: 'Vent required', req: 'Each fixture trap must be protected by a vent system. An unvented toilet can siphon other traps and fail inspection. Vent path is a hold point, never assumed from photos.', key: 'vent siphon trap toilet' },
  { fam: 'IPC', sec: 'IPC §405.3 / water closet', topic: 'Toilet supply & waste', req: 'Water closet needs a 3 in (typical) waste connection and a potable supply with shutoff. Existing stack material/condition must be verified in person.', key: 'toilet supply waste stack shutoff' },
  { fam: 'IPC', sec: 'IPC §607 / hot water', topic: 'Lavatory hot water', req: 'If hot water is extended, tempering/scald and pipe material rules apply. Confirm existing water heater capacity is not assumed.', key: 'hot water lavatory sink scald' },
  { fam: 'NEC', sec: 'NEC 210.8 / GFCI', topic: 'GFCI in bathrooms', req: 'Receptacles in bathrooms require GFCI protection. In the BOM — never substituted to save a few dollars.', key: 'gfci receptacle bathroom shock' },
  { fam: 'NEC', sec: 'NEC 210.11 / branch circuits', topic: 'Bathroom circuit', req: 'Bathroom receptacles are served by a dedicated 20A branch circuit under typical NEC rules. Panel capacity must be verified by a qualified person.', key: 'circuit 20a panel receptacle dedicated' },
  { fam: 'IBC', sec: 'IBC §1010 / egress & doors', topic: 'Door swing & access', req: 'Door must not reduce required clearances or trap a user against fixtures. Our layout check flags swing conflicts for small half baths.', key: 'door swing egress access clearance' },
  { fam: 'IRC', sec: 'IRC R303 / ventilation', topic: 'Exhaust ventilation', req: 'Bathrooms without an operable window need mechanical exhaust vented outdoors (typical model-code ~50 CFM intermittent). Fan in BOM, ducted outside — not into a joist bay.', key: 'fan exhaust ventilation window cfm mould' },
  { fam: 'IRC', sec: 'IRC P2708 etc / fixtures', topic: 'Fixture standards', req: 'Fixtures must be listed/approved types installed per manufacturer instructions. Keep cut sheets with the project record.', key: 'fixture listed approved manufacturer' },
  { fam: 'Philadelphia', sec: 'Philadelphia L&I / permits', topic: 'Who issues permits', req: 'Philadelphia plumbing and electrical work is permitted through L&I / eCLIPSE. Confirm current forms, fees, and licensed-contractor requirements at phila.gov before applying. Fees change — we do not hard-code a fee as fact.', key: 'philadelphia permit li eclipse license fee' },
  { fam: 'Philadelphia', sec: 'Philadelphia / inspections', topic: 'Rough-in before cover', req: 'Do not close walls/floors until required rough-in inspections are passed and recorded. This is a hard hold point in the task plan.', key: 'inspection rough close wall philadelphia hold' },
];
