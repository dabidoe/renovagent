// Download building codes adopted into law for Renovagent's markets, as
// published by Public.Resource.Org on archive.org (OCR text). These are the
// enacted state/city codes (California Title 24, New York State Uniform Code,
// Texas, Pennsylvania, San Francisco, New York City), not the ICC model books.
// Text lands in .local/codes/adopted (gitignored); the manifest is committed
// in .local too so the splitter knows each file's market and code family.
//
//   node scripts/fetch-adopted-codes.mjs
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const dest = '.local/codes/adopted';
// [market, jurisdiction, code, edition (null = read from the text), archive id, file]
const MANIFEST = [
  [
    'bay-area',
    'California',
    'CRC',
    '2025',
    'gov.ca.bsc.residential.2025',
    'gov.ca.bsc.residential.2025_djvu.txt',
  ],
  [
    'bay-area',
    'California',
    'CPC',
    '2025',
    'gov.ca.bsc.plumbing.2025',
    'gov.ca.bsc.plumbing.2025_djvu.txt',
  ],
  [
    'bay-area',
    'California',
    'CEC',
    '2025',
    'gov.ca.bsc.electrical.2025',
    'gov.ca.bsc.electrical.2025_djvu.txt',
  ],
  [
    'bay-area',
    'California',
    'CMC',
    '2025',
    'gov.ca.bsc.mechanical.2025',
    'gov.ca.bsc.mechanical.2025_djvu.txt',
  ],
  [
    'bay-area',
    'California',
    'CEBC',
    '2025',
    'gov.ca.bsc.existing.2025',
    'gov.ca.bsc.existing.2025_djvu.txt',
  ],
  [
    'bay-area',
    'California',
    'Energy',
    '2025',
    'gov.ca.bsc.energy.2025',
    'gov.ca.bsc.energy.2025_djvu.txt',
  ],
  [
    'bay-area',
    'California',
    'CALGreen',
    '2025',
    'gov.ca.bsc.green.2025',
    'gov.ca.bsc.green.2025_djvu.txt',
  ],
  [
    'bay-area',
    'California',
    'CRC',
    '2016',
    'gov.ca.bsc.title24.2016.02.5',
    'gov.ca.bsc.2016.02.5_djvu.txt',
  ],
  [
    'bay-area',
    'San Francisco',
    'SF Building',
    null,
    'gov.ca.sf.building',
    'ca_sf_building_djvu.txt',
  ],
  ['bay-area', 'San Francisco', 'SF Housing', null, 'gov.ca.sf.housing', 'ca_sf_housing_djvu.txt'],
  [
    'nyc',
    'New York State',
    'RCNYS',
    '2025',
    'gov.ny.residential.2025',
    'gov.ny.residential.2025_djvu.txt',
  ],
  [
    'nyc',
    'New York State',
    'EBCNYS',
    '2025',
    'gov.ny.existing.2025',
    'gov.ny.existing.2025_djvu.txt',
  ],
  [
    'nyc',
    'New York State',
    'PCNYS',
    '2025',
    'gov.ny.plumbing.2025',
    'gov.ny.plumbing.2025_djvu.txt',
  ],
  [
    'nyc',
    'New York State',
    'MCNYS',
    '2025',
    'gov.ny.mechanical.2025',
    'gov.ny.mechanical.2025_djvu.txt',
  ],
  ['nyc', 'New York State', 'ECCCNYS', '2025', 'gov.ny.energy.2025', 'gov.ny.energy.2025_djvu.txt'],
  [
    'nyc',
    'New York City',
    'NYC Building',
    '2008',
    'gov.law.nyc.building.2008',
    'nyc.building.2008_djvu.txt',
  ],
  [
    'nyc',
    'New York City',
    'NYC Plumbing',
    '2008',
    'gov.law.nyc.plumbing.2008',
    'nyc.plumbing.2008_djvu.txt',
  ],
  [
    'nyc',
    'New York City',
    'NYC Mechanical',
    '2008',
    'gov.law.nyc.mechanical.2008',
    'nyc.mechanical.2008_djvu.txt',
  ],
  [
    'nyc',
    'New York City',
    'NYC Electrical',
    '2011',
    'gov.law.nyc.electrical.2011',
    'nyc.electrical.2011_djvu.txt',
  ],
  ['austin', 'Texas', 'TX Residential', null, 'gov.tx.residential', 'tx_residential_djvu.txt'],
  ['austin', 'Texas', 'TX Plumbing', null, 'gov.tx.plumbing', 'tx_plumbing_djvu.txt'],
  ['austin', 'Texas', 'TX Mechanical', null, 'gov.tx.mechanical', 'tx_mechanical_djvu.txt'],
  [
    'philadelphia',
    'Pennsylvania',
    'PA Existing',
    null,
    'gov.pa.existingbuilding',
    'pa_existingbuilding_djvu.txt',
  ],
  ['philadelphia', 'Pennsylvania', 'PA Plumbing', null, 'gov.pa.plumbing', 'pa_plumbing_djvu.txt'],
];
mkdirSync(dest, { recursive: true });
let bytes = 0;
const out = [];
for (const [market, jurisdiction, code, edition, id, file] of MANIFEST) {
  const path = `${dest}/${file}`;
  if (!existsSync(path)) {
    const url = `https://archive.org/download/${id}/${encodeURIComponent(file)}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`skip ${id}: ${res.status}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    bytes += buf.length;
    writeFileSync(path, buf);
  }
  out.push({ market, jurisdiction, code, edition, archiveId: id, file });
}
writeFileSync(`${dest}/manifest.json`, JSON.stringify(out, null, 1));
console.log(`${out.length} codes, ${(bytes / 1e6).toFixed(1)} MB new, in ${dest}`);
