// Download public-domain editions of the ICC model codes as published by
// Public.Resource.Org on archive.org (codes incorporated into law). Newer
// editions (2015+) are copyrighted and not downloaded; they are cited by link.
// Text lands in .local/codes, which is gitignored.
//
//   node scripts/fetch-model-codes.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const dest = '.local/codes';
const FILES = [
  ['irc.2012', 'icc.irc.2012_djvu.txt'],
  ['irc.2009', 'icc.irc.2009.html'],
  ['iebc.2012', 'icc.iebc.2012_djvu.txt'],
  ['ipc.2012', 'icc.ipc.2012_djvu.txt'],
  ['imc.2012', 'icc.imc.2012_djvu.txt'],
  ['iecc.2012', 'icc.iecc.2012_djvu.txt'],
];
mkdirSync(dest, { recursive: true });
let bytes = 0;
for (const [id, name] of FILES) {
  const url = `https://archive.org/download/gov.law.icc.${id}/${name}`;
  const res = await fetch(url);
  if (!res.ok) throw Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  bytes += buf.length;
  writeFileSync(`${dest}/${name}`, buf);
  console.log(name, `${(buf.length / 1e6).toFixed(1)} MB`);
}
console.log(`${FILES.length} files, ${(bytes / 1e6).toFixed(1)} MB in ${dest}`);
