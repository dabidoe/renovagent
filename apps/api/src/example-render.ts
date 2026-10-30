import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DomainError } from '@renovagent/contracts';
import { normalizeImage, type DesignImageStore } from './design-images.js';
import type { PreviewProvider } from './design-previews.js';

const WALL: Record<string, string> = {
  'warm-white': 'warm white',
  sage: 'sage green',
  'soft-blue': 'soft blue',
};
const FLOOR: Record<string, string> = {
  carpet: 'the existing beige carpet',
  lvp: 'the warm oak-look vinyl plank floor',
  hardwood: 'the dark-stained hardwood plank floor',
};

// The example room's 3D renders ship with the web build (public/example-room).
async function readRender(variant: string) {
  const dirs = [
    process.env.RENOVAGENT_STATIC_DIR,
    fileURLToPath(new URL('../../../public', import.meta.url)),
  ].filter((d): d is string => !!d);
  for (const dir of dirs) {
    try {
      return new Uint8Array(await readFile(join(resolve(dir), 'example-room', `${variant}.jpg`)));
    } catch {
      continue;
    }
  }
  throw new DomainError('NOT_FOUND', 'Example render not found');
}

// Same-room edit: the render fixes the camera, layout and chosen finishes; Muse
// is asked only to make it look photographed. The result is a generated
// concept of the labelled example, never a photo of a real room.
export function examplePrompt(variant: string) {
  const [, wall, floor] = variant.match(/^done-(.+)-(carpet|lvp|hardwood)$/)!;
  return `Make this 3D render of a living room look like a real interior photograph. Keep the camera position, framing, room shape, windows, trim, every piece of furniture and its placement exactly as they are. Keep the walls ${WALL[wall!]} and keep ${FLOOR[floor!]}. Improve only realism: natural daylight through the windows, soft shadows, true-to-life textures. Do not add, remove or move any objects, and add no text.`;
}

export async function renderExample(
  images: DesignImageStore,
  provider: PreviewProvider,
  ownerId: string,
  variant: string,
) {
  const prompt = examplePrompt(variant);
  const result = await provider.generate({ image: await readRender(variant), prompt });
  const stored = await images.put(ownerId, await normalizeImage(result.bytes));
  return {
    variant,
    image: stored,
    prompt,
    provider: result.provider,
    model: result.model,
    ...(result.runId ? { runId: result.runId } : {}),
    generatedAt: new Date().toISOString(),
  };
}
