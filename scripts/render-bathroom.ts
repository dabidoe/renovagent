// A deliberately hypothetical 4 x 3 m room, not an owner/site measurement.
// Local Blender only. No provider calls or database access.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  boxRoomModel,
  floorOutline,
  studioPresetStarts,
  studioPlacementWarnings,
} from '@renovagent/core';
import { studioPlacementSchema } from '@renovagent/contracts';
const out = resolve(process.argv[2] ?? '.local/bathroom-concept');
mkdirSync(out, { recursive: true });
const room = boxRoomModel({ lengthM: 4, widthM: 3, heightM: 2.5 });
const placements = studioPresetStarts('bathroom', room).map((p, i) =>
  studioPlacementSchema.parse({ ...p, id: `demo-${i}`, itemId: `demo-item-${i}` }),
);
if (studioPlacementWarnings(room, placements).length)
  throw new Error('Demo fixtures extend outside room');
writeFileSync(
  `${out}/room-model.json`,
  JSON.stringify(
    {
      ...room,
      fixtures: [],
      placements,
      floorOutline: floorOutline(room),
      conceptCutaway: true,
      resolutionScale: 0.5,
      samples: 12,
      look: {
        wallHex: '#e9e3d8',
        wallName: 'Concept warm white',
        floorKind: 'tile',
        floorName: 'Concept tile',
      },
      notes: [
        'Hypothetical bathroom mockup. Source mesh sizes, not measured products; no clearance approval.',
      ],
    },
    null,
    2,
  ),
);
const run = spawnSync(
  process.env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender',
  [
    '--background',
    '--factory-startup',
    '--python',
    'scripts/blender/room_to_blender.py',
    '--',
    `${out}/room-model.json`,
    out,
  ],
  { encoding: 'utf8', maxBuffer: 20_000_000 },
);
writeFileSync(`${out}/blender.log`, (run.stdout ?? '') + (run.stderr ?? ''));
if (run.status !== 0 || !run.stdout?.includes('RENOVAGENT rendered'))
  throw new Error(`Blender failed; see ${out}/blender.log`);
console.log(`Bathroom concept rendered: ${out}/perspective.png and ${out}/interior.png`);
