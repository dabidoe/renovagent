// Download current city code text published by the cities themselves:
// New York City's 2022 Construction Codes (NYC Department of Buildings
// chapter PDFs) and Austin's local amendments to the 2024 I-codes / UPC / UMC
// (City of Austin EDIMS). Government publications; PDFs land in
// .local/codes/city (gitignored). Convert with scripts/pdf-to-text.swift.
//
//   node scripts/fetch-city-codes.mjs
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const dest = '.local/codes/city';
const NYC = 'https://www.nyc.gov/assets/buildings/codes-pdf/cons_codes_2022/';
// [market, jurisdiction, code, edition, url, file]
const DOCS = [
  ...[
    ['NYC Admin (Title 28)', '2022GAP_Chapter1_AdministrationWBwm.pdf'],
    ['NYC Plumbing', '2022PC_Chapter3_GenRegsWBwm.pdf'],
    ['NYC Plumbing', '2022PC_Chapter4_FixturesWBwm.pdf'],
    ['NYC Plumbing', '2022PC_Chapter6_WaterSupplyWBwm.pdf'],
    ['NYC Plumbing', '2022PC_Chapter7_SanitaryDrainageWBwm.pdf'],
    ['NYC Plumbing', '2022PC_Chapter9_VentsWBwm.pdf'],
    ['NYC Plumbing', '2022PC_Chapter10_TrapsWBwm.pdf'],
    ['NYC Mechanical', '2022MC_Chapter4_VentilationWB.pdf'],
    ['NYC Mechanical', '2022MC_Chapter5_ExhaustWB.pdf'],
    ['NYC Building', '2022BC_Chapter08_InteriorFinishesWBwm.pdf'],
    ['NYC Building', '2022BC_Chapter12_InteriorEnvironmentWBwm.pdf'],
    ['NYC Building', '2022BC_Chapter24_GlassGlazingWBwm.pdf'],
    ['NYC Building', '2022BC_AppendixM_One-TwoWBwm.pdf'],
  ].map(([code, file]) => ['nyc', 'New York City', code, '2022', NYC + file, file]),
  ...[
    ['Austin IRC amendments', '2024', 450486],
    ['Austin UPC amendments', '2024', 453142],
    ['Austin UMC amendments', '2024', 450546],
    ['Austin IBC/IEBC amendments', '2024', 453143],
    ['Austin IECC amendments', '2024', 452785],
  ].map(([code, edition, id]) => [
    'austin',
    'Austin',
    code,
    edition,
    `https://services.austintexas.gov/edims/document.cfm?id=${id}`,
    `austin-edims-${id}.pdf`,
  ]),
];
mkdirSync(dest, { recursive: true });
let bytes = 0;
const manifest = [];
for (const [market, jurisdiction, code, edition, url, file] of DOCS) {
  const path = `${dest}/${file}`;
  if (!existsSync(path)) {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 Renovagent research' } });
    if (!res.ok) {
      console.log(`skip ${file}: ${res.status}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    bytes += buf.length;
    writeFileSync(path, buf);
  }
  manifest.push({ market, jurisdiction, code, edition, url, file: file.replace(/\.pdf$/, '.txt') });
}
writeFileSync(`${dest}/manifest.json`, JSON.stringify(manifest, null, 1));
console.log(`${manifest.length} documents, ${(bytes / 1e6).toFixed(1)} MB new, in ${dest}`);
