// Legacy demo compatibility only. The live workspace uses @unpermitted/core planning.
// One preserved characterization calculator; no duplicate server formula or compliance authority.
import { calcProject as legacyCalculate, type ProjectInputs } from '../../src/engine.js';
export type { ProjectInputs } from '../../src/engine.js';
export function calcProject(v: ProjectInputs, owned: Record<string, boolean> = {}) {
  const { v: inputs, m: materials, ...calculated } = legacyCalculate(v, owned);
  return { inputs, materials, ...calculated };
}

export const TASKS = [
  { id: 't1', title: 'Measure & confirm stack, vent, shutoffs', trade: 'Archie / Pete', deps: [] as string[], hold: false },
  { id: 't2', title: 'Permit & inspection check (hold point)', trade: 'Dwang', deps: ['t1'], hold: true },
  { id: 't3', title: 'Demo & prep — protect floors, cap lines', trade: 'Dwang', deps: ['t1'], hold: false },
  { id: 't4', title: 'Rough plumbing — drain, vent, supply', trade: 'Pete', deps: ['t2', 't3'], hold: false },
  { id: 't5', title: 'Rough electrical — GFCI, fan, lighting', trade: 'Sparky', deps: ['t2', 't3'], hold: false },
  { id: 't6', title: 'Floor prep & finish', trade: 'Dwang', deps: ['t4', 't5'], hold: false },
  { id: 't7', title: 'Set toilet & sink, test for leaks', trade: 'Pete', deps: ['t6'], hold: false },
  { id: 't8', title: 'Finish, caulk, punch list & photos', trade: 'Dwang', deps: ['t7'], hold: false },
];

export function crewFindings(v: ProjectInputs, cost: number) {
  return {
    dwang: [
      { severity: cost > v.budget ? 'high' : 'low', text: cost > v.budget ? `You are $${cost - v.budget} over budget. Swap comfort vanity or LVP floor before cutting waterproofing.` : 'Sequence is sound. Next action: complete the hold point, not the demo.' },
      { severity: 'med', text: 'Do not mark rough-in done until inspection is booked. Blocked tasks are protecting your money.' },
    ],
    pete: [
      { severity: v.vent ? 'low' : 'high', text: v.vent ? 'Vent path confirmed — rough-in can proceed.' : 'No vent path confirmed. A toilet without venting will siphon traps and fail inspection. Verify before buying pipe.' },
      { severity: v.basement ? 'low' : 'med', text: v.basement ? 'Basement access keeps labour down. Photograph the stack before you cut.' : `No basement access: confirm fall (1/4" per ft) is achievable over ${v.stack} ft.` },
    ],
    sparky: [
      { severity: 'high', text: 'GFCI protection is non-negotiable in a bath. Do not substitute a standard receptacle.' },
      { severity: 'med', text: 'Exhaust fan vents outside, not into a joist bay.' },
    ],
  };
}
