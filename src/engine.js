// LEGACY DEMO ONLY: fixed assumptions, prices and savings are characterization fixtures.
// The current workspace uses packages/core/src/planning, never this calculator.
export function calcProject(v, owned = {}) {
  const area = v.L * v.W;
  const perim = 2 * (v.L + v.W);
  const waste = (q, p) => Math.ceil(q * (1 + p));
  const m = [];
  const add = (name, need, unit, w, pack, price, src, group, invKey) => {
    const withW = waste(need, w);
    const isOwned = invKey && owned[invKey] ? 1 : 0;
    const buy = Math.max(0, Math.ceil((withW - isOwned) / pack) * pack);
    m.push({ name, need: +need.toFixed(1), unit, withW, pack, price, buy, src, group, cost: (buy / pack) * price, owned: isOwned });
  };
  if (v.floor > 0) {
    add('Floor tile', area, 'sq ft', 0.10, v.floor === 6 ? 5 : 12, v.floor === 6 ? 42 : 36, 'Lay floor', 'Phase 3 · Flooring');
    add('Thinset mortar 50lb', Math.ceil(area / 40), 'bag', 0, 1, 18, 'Lay floor', 'Phase 3 · Flooring');
    add('Grout 10lb', Math.ceil(area / 25), 'bag', 0, 1, 16, 'Lay floor', 'Phase 3 · Flooring');
  } else {
    add('LVP flooring', area, 'sq ft', 0.07, 20, 52, 'Lay floor', 'Phase 3 · Flooring');
  }
  add('Cement backer board', area, 'sq ft', 0.05, 15, 14, 'Prep / demo', 'Phase 1 · Rough');
  add('3" PVC drain pipe', v.stack + 4, 'ft', 0.08, 10, 22, 'Rough plumbing', 'Phase 1 · Rough');
  add('1/2" PEX pipe', v.stack * 2 + 10, 'ft', 0.08, 25, 18, 'Rough plumbing', 'Phase 1 · Rough');
  add('Wax ring', 1, 'ea', 0, 1, 9, 'Set toilet', 'Phase 4 · Fixtures', 'wax');
  add('Angle stop valve', 2, 'ea', 0, 1, 14, 'Set fixtures', 'Phase 4 · Fixtures', 'valve');
  add('P-trap kit', 1, 'ea', 0, 1, 12, 'Set sink', 'Phase 4 · Fixtures', 'ptrap');
  add('Silicone caulk', 1, 'tube', 0, 1, 8, 'Finish', 'Phase 4 · Fixtures', 'caulk');
  add('Toilet (' + v.layout + ')', 1, 'ea', 0, 1, v.layout === 'compact' ? 420 : v.layout === 'comfort' ? 310 : 240, 'Set toilet', 'Phase 4 · Fixtures');
  add(v.layout === 'comfort' ? 'Vanity + sink' : 'Pedestal / corner sink', 1, 'ea', 0, 1, v.layout === 'comfort' ? 380 : 190, 'Set sink', 'Phase 4 · Fixtures');
  add('GFCI receptacle 20A', 1, 'ea', 0, 1, 24, 'Rough electrical', 'Phase 1 · Rough');
  add('Exhaust fan + duct', 1, 'ea', 0, 1, v.basement ? 135 : 185, 'Rough electrical', 'Phase 1 · Rough');
  add('Paint (walls, gal)', Math.ceil((perim * 8) / 350), 'gal', 0.05, 1, 38, 'Paint', 'Phase 3 · Flooring');
  const cost = m.reduce((s, x) => s + x.cost, 0);
  const groups = {};
  m.forEach((x) => { if (x.buy > 0) (groups[x.group] = groups[x.group] || []).push(x); });
  const tripsSaved = Math.max(0, 7 - Object.keys(groups).length);
  const wasteSaved = Math.round(m.reduce((s, x) => s + ((x.withW - x.need) / Math.max(1, x.pack)) * x.price * 0.4, 0))
    + (owned.wax ? 9 : 0) + (owned.valve ? 28 : 0) + (owned.ptrap ? 12 : 0) + (owned.caulk ? 8 : 0);
  const rework = (!v.vent ? 180 : 0) + (!v.permit ? 220 : 0) + (!v.basement ? 90 : 0);
  const totalSave = tripsSaved * 38 + wasteSaved + rework;
  return { v, m, cost, groups, tripsSaved, wasteSaved, rework, totalSave, area };
}
