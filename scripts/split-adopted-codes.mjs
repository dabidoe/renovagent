// Split adopted state/city code texts (fetch-adopted-codes.mjs, fetch-city-codes.mjs
// + pdf-to-text.swift) into sections tagged with market, jurisdiction, code and
// edition. One id pattern covers the numbering styles in these books: R105.2,
// 405.3.1, 210.8, 4.106.4 (CALGreen), 28-105.4.2 (NYC Title 28).
// Writes .local/codes/adopted-sections.json (gitignored).
//
//   node scripts/split-adopted-codes.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const ID = /^(?:§\s*)?((?:[A-Z]{1,2})?\d{1,4}(?:-\d{1,4})?(?:\.\d+)+)\s/;
const FURNITURE =
  /^(\d{1,4}|.*Copyright.*|.*Licensed to.*|.*Public\.Resource\.Org.*|[A-Z0-9 ,.&-]{0,60}CODE[A-Z ]*\d*|[A-Z ]+—?\s*\d*)$/;
const manifests = [
  ['.local/codes/adopted', 'manifest.json'],
  ['.local/codes/city', 'manifest.json'],
].filter(([dir, f]) => existsSync(`${dir}/${f}`));

const sections = [];
for (const [dir, file] of manifests)
  for (const src of JSON.parse(readFileSync(`${dir}/${file}`, 'utf8'))) {
    const path = `${dir}/${src.file}`;
    if (!existsSync(path)) continue;
    const lines = readFileSync(path, 'utf8').split('\n');
    let current = null;
    for (let n = 0; n < lines.length; n++) {
      const line = lines[n].replace(/\s+/g, ' ').trim();
      const m = line.match(ID);
      const heading = m && line.slice(m[0].length).match(/^([A-Z0-9][^.]{1,100}?)\.\s*(.*)$/);
      if (m && heading) {
        if (current) sections.push(current);
        current = {
          market: src.market,
          jurisdiction: src.jurisdiction,
          code: src.code,
          edition: src.edition,
          source: src.url ?? `https://archive.org/details/${src.archiveId}`,
          id: m[1],
          title: heading[1].trim(),
          text: heading[2],
        };
        continue;
      }
      if (!current || !line || FURNITURE.test(line) || /^SECTION [A-Z]?\d+/.test(line)) continue;
      if (/^(CHAPTER|ARTICLE) \d+/.test(line)) {
        sections.push(current);
        current = null;
        continue;
      }
      current.text = current.text.endsWith('-')
        ? current.text.slice(0, -1) + line
        : `${current.text} ${line}`;
    }
    if (current) sections.push(current);
  }
// The fullest occurrence of each id per book wins over contents and indexes.
const byKey = new Map();
for (const x of sections) {
  const key = `${x.jurisdiction}|${x.code}|${x.edition}|${x.id}`;
  if ((byKey.get(key)?.text.length ?? -1) < x.text.trim().length)
    byKey.set(key, { ...x, text: x.text.trim().slice(0, 4000) });
}
const out = [...byKey.values()].filter((x) => x.text.length > 20);
writeFileSync('.local/codes/adopted-sections.json', JSON.stringify(out));
const counts = Object.groupBy(out, (x) => `${x.jurisdiction} ${x.code} ${x.edition ?? ''}`);
for (const [k, v] of Object.entries(counts)) console.log(`${v.length}\t${k}`);
console.log(`= ${out.length} sections`);
