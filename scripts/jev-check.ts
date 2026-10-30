// Live check of the Jev integration: rank the model-code digest against the
// example living room, then run photo checks on one of its renders. Two
// requests. Needs TYPESAFE_API_KEY (environment or the repository's .env).
//
//   node --import tsx scripts/jev-check.ts
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { modelCodeDigest } from '@renovagent/core';
import { photoChecks, rankSections } from '../apps/api/src/jev.js';

// One candidate per distinct provision (the digest repeats one per package).
const candidates = [
  ...new Map(modelCodeDigest.map((e) => [`${e.code}:${e.id}:${e.excerpt}`, e])).values(),
].map((e, i) => ({ key: String(i), code: e.code, id: e.id, title: e.title, excerpt: e.excerpt }));
const ranked = await rankSections(
  {
    request: 'Repaint the living room walls and replace the carpet with floating vinyl plank',
    packages: ['wall-paint', 'carpet-removal', 'lvp-floor'],
    facts: ['14 × 12 ft living room, 8 ft ceiling', 'one- or two-family rowhouse'],
  },
  candidates,
);
console.log(`rank: ${ranked.model}, ${ranked.inputTokens} input tokens`);
const show = (r: (typeof ranked.ranked)[number]) =>
  console.log(`  ${r.probability.toFixed(2)}  ${r.code} ${r.id} ${r.title}`);
console.log(`${candidates.length} provisions; top 12:`);
ranked.ranked.slice(0, 12).forEach(show);
console.log('bottom 6:');
ranked.ranked.slice(-6).forEach(show);

// Jev takes 280–1568 px per side; the renders are 1600 wide (macOS sips).
const small = join(tmpdir(), 'jev-before.jpg');
execFileSync(
  'sips',
  [
    '-Z',
    '1500',
    fileURLToPath(new URL('../public/example-room/before.jpg', import.meta.url)),
    '--out',
    small,
  ],
  {
    stdio: 'ignore',
  },
);
const photo = await photoChecks({ format: 'jpg', bytes: new Uint8Array(await readFile(small)) }, [
  { key: 'carpet', present: 'Is the floor covered with wall-to-wall carpet?' },
  { key: 'window', present: 'Is there a window?', locate: 'The window on the back wall' },
  { key: 'sofa', present: 'Is there a sofa?', locate: 'The sofa' },
]);
console.log(`photo: ${photo.model}, ${photo.inputTokens} input tokens`);
for (const i of photo.items)
  console.log(`  ${i.key}: ${i.probability.toFixed(2)} ${JSON.stringify(i.box)}`);
