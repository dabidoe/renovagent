// Render a floor plan file in Blender from the same room model the web 3D view
// and plan drawing use.
//
//   npm run render:room -- <plan.json> <out-dir> [--wall "soft blue"] [--floor "light oak"] [--samples 128]
//
// Needs a local Blender (BLENDER env var, or /Applications/Blender.app on macOS).
// Writes room-model.json, perspective.png, plan-top.png and room.glb.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { floorFinishKind, floorOutline, roomModelFromPlan, wallSwatch } from '@renovagent/core';

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const [planPath, outDir] = args.filter(
  (a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'),
);
if (!planPath || !outDir) {
  console.error(
    'Usage: render-room <plan.json> <out-dir> [--wall name] [--floor name] [--samples n]',
  );
  process.exit(2);
}
const model = roomModelFromPlan(JSON.parse(readFileSync(planPath, 'utf8')));
const wall = flag('wall', 'white');
const floor = flag('floor', 'plain');
mkdirSync(outDir, { recursive: true });
const modelPath = resolve(outDir, 'room-model.json');
writeFileSync(
  modelPath,
  JSON.stringify(
    {
      ...model,
      floorOutline: floorOutline(model),
      look: {
        wallHex: wallSwatch(wall).hex,
        wallName: wall,
        floorKind: floorFinishKind(floor),
        floorName: floor,
      },
      samples: Number(flag('samples', '96')),
    },
    null,
    1,
  ),
);
const blender = process.env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender';
const script = fileURLToPath(new URL('./blender/room_to_blender.py', import.meta.url));
const run = spawnSync(
  blender,
  ['--background', '--factory-startup', '--python', script, '--', modelPath, resolve(outDir)],
  { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' },
);
const done = run.stdout?.split('\n').find((l) => l.startsWith('RENOVAGENT'));
if (run.status !== 0 || !done) {
  console.error(run.error?.message ?? 'Blender did not finish');
  process.exit(1);
}
console.log(done);
