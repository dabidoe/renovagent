// Keyword shortlist of model-code sections per Renovagent work package, the
// input a reviewer (person, subagent or Jev) narrows to what matters.
// Reads .local/codes/sections.json; writes .local/codes/shortlist.json.
import { readFileSync, writeFileSync } from 'node:fs';

const sections = JSON.parse(readFileSync('.local/codes/sections.json', 'utf8'));
const PACKAGES = {
  'permits-general': [
    'work exempt from permit',
    'permits required',
    'repairs',
    'finish work',
    'painting',
    'alteration',
    'level 1 alterations',
  ],
  'wall-paint': ['painting', 'interior finishes', 'wall finish', 'lead', 'paint'],
  'carpet-removal': ['floor covering', 'subfloor', 'underlayment', 'carpeting', 'floor finish'],
  'lvp-floor': ['floor covering', 'resilient', 'underlayment', 'floor finish', 'flooring'],
  'hardwood-floor': ['wood flooring', 'floor covering', 'underlayment', 'hardwood', 'flooring'],
  'floor-tile': ['tile', 'ceramic', 'floor finish', 'backer', 'underlayment', 'water-resistant'],
  vanity: [
    'lavatory',
    'lavatories',
    'fixture clearance',
    'fixture spacing',
    'trap',
    'faucet',
    'water closet, lavatory',
  ],
  toilet: [
    'water closet',
    'water closets',
    'fixture spacing',
    'flush',
    'closet flange',
    'clearance',
    'floor-outlet',
  ],
  'exhaust-fan': [
    'exhaust',
    'bathroom',
    'ventilation',
    'mechanical ventilation',
    'cfm',
    'duct',
    'terminat',
  ],
  paint: ['painting', 'interior finishes', 'paint'],
  'service-work': [
    'receptacle',
    'ground-fault',
    'gfci',
    'branch circuit',
    'bathroom',
    'vent',
    'drain',
    'water supply',
  ],
  'half-bath': [
    'bathroom',
    'water closet compartment',
    'ceiling height',
    'glazing',
    'mechanical ventilation',
    'fixture',
    'clear space',
    'toilet',
  ],
  'smoke-co': ['smoke alarm', 'carbon monoxide', 'alterations, repairs and additions'],
};
const score = (s, words) => {
  const t = `${s.title} ${s.title} ${s.text}`.toLowerCase();
  return words.reduce(
    (n, w) => n + (t.split(w).length - 1) * (s.title.toLowerCase().includes(w) ? 3 : 1),
    0,
  );
};
const out = {};
for (const [pkg, words] of Object.entries(PACKAGES))
  out[pkg] = sections
    .map((s) => ({ s, n: score(s, words) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 40)
    .map(({ s }) => ({ code: s.code, id: s.id, title: s.title, text: s.text.slice(0, 900) }));
writeFileSync('.local/codes/shortlist.json', JSON.stringify(out, null, 1));
console.log(
  Object.entries(out)
    .map(([k, v]) => `${k} ${v.length}`)
    .join(', '),
);
