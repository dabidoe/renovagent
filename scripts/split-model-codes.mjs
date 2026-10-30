// Split the public-domain model-code texts (scripts/fetch-model-codes.mjs) into
// sections: { code, edition, id, title, text }. OCR text from scanned books, so
// hyphenation and page furniture are cleaned up; wording is otherwise kept as
// published. Writes .local/codes/sections.json (gitignored).
//
//   node scripts/split-model-codes.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const dir = '.local/codes';
const SOURCES = [
  {
    code: 'IRC',
    edition: '2012',
    file: 'icc.irc.2012_djvu.txt',
    id: /^((?:R|N|M|G|P|E|AF?|AG?)\d{3,4}(?:\.\d+)+)\s/,
  },
  { code: 'IEBC', edition: '2012', file: 'icc.iebc.2012_djvu.txt', id: /^(\d{3,4}(?:\.\d+)+)\s/ },
  { code: 'IPC', edition: '2012', file: 'icc.ipc.2012_djvu.txt', id: /^(\d{3,4}(?:\.\d+)+)\s/ },
  { code: 'IMC', edition: '2012', file: 'icc.imc.2012_djvu.txt', id: /^(\d{3,4}(?:\.\d+)+)\s/ },
  {
    code: 'IECC',
    edition: '2012',
    file: 'icc.iecc.2012_djvu.txt',
    id: /^((?:C|R)?\d{3,4}(?:\.\d+)+)\s/,
  },
];
// Running headers, footers and page numbers in the scans.
const FURNITURE =
  /^(\d{1,4}|20\d\d INTERNATIONAL [A-Z ]+CODE®?|.*Copyright.*|.*ICC.*license.*|.*Licensed to.*|[A-Z ]+—?\s*\d*)$/;

const sections = [];
for (const s of SOURCES) {
  const lines = readFileSync(`${dir}/${s.file}`, 'utf8').split('\n');
  let current = null;
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n].replace(/\s+/g, ' ').trim();
    const m = line.match(s.id);
    // A heading is "<id> <Title>. <text>"; titles start with a capital or digit.
    const heading = m && line.slice(m[0].length).match(/^([A-Z0-9][^.]{1,90}?)\.\s*(.*)$/);
    if (m && heading) {
      if (current) sections.push(current);
      current = {
        code: s.code,
        edition: s.edition,
        id: m[1],
        title: heading[1].trim(),
        line: n + 1,
        text: heading[2],
      };
      continue;
    }
    if (!current || !line || FURNITURE.test(line) || /^SECTION [A-Z]?\d+$/.test(line)) continue;
    if (/^CHAPTER \d+/.test(line)) {
      sections.push(current);
      current = null;
      continue;
    }
    // Join hyphenated line breaks; otherwise a space.
    current.text = current.text.endsWith('-')
      ? current.text.slice(0, -1) + line
      : `${current.text} ${line}`;
  }
  if (current) sections.push(current);
}
// Keep the fullest occurrence of each id per code (the body, not the contents
// or cross-reference tables), and cap text so one runaway section cannot
// swallow the rest.
const byKey = new Map();
for (const x of sections) {
  const key = `${x.code}:${x.id}`;
  if ((byKey.get(key)?.text.length ?? -1) < x.text.trim().length)
    byKey.set(key, { ...x, text: x.text.trim().slice(0, 4000) });
}
const out = [...byKey.values()].filter((x) => x.text.length > 20);
writeFileSync(`${dir}/sections.json`, JSON.stringify(out));
const counts = Object.groupBy(out, (x) => x.code);
console.log(
  Object.entries(counts)
    .map(([k, v]) => `${k} ${v.length}`)
    .join(', '),
  `= ${out.length} sections`,
);
