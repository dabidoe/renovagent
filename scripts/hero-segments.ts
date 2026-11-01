import { access, readFile, writeFile } from 'node:fs/promises';
import { imageMediaType, samSegmentText } from './muse-provider.js';
import { parseSegmentation, type PhotoSegmentation } from '../apps/api/src/segmentation.js';

// One-off: SAM 3.1 outlines the landing hero's four example objects. The
// result is committed so visitors never trigger a model call; rerun only when
// the hero photo changes. Usage: node --import tsx scripts/hero-segments.ts
// The raw SAM answer stays in .local; a delete there asks SAM again.
const photo = 'apps/web/src/assets/examples/bath.jpg';
const raw = '.local/hero-segments-raw.json';
const out = 'apps/web/src/features/landing/hero-segments.json';
const phrases = {
  vanity: 'wood vanity cabinet',
  mirror: 'wall mirror',
  shower: 'white subway tile shower wall',
  floor: 'dark hexagon floor tile',
};

type Seg = PhotoSegmentation['segments'][number];
type Result = PhotoSegmentation & { model: string; runId: string };
async function ask(): Promise<Record<string, Result>> {
  const bytes = new Uint8Array(await readFile(photo));
  const image = { bytes, mediaType: imageMediaType(bytes) };
  const results: Record<string, Result> = {};
  for (const [id, phrase] of Object.entries(phrases)) {
    const sam = await samSegmentText({ image, phrase });
    results[id] = {
      model: sam.model,
      runId: sam.runId,
      ...(await parseSegmentation(phrase, sam.text)),
    };
  }
  await writeFile(raw, JSON.stringify({ photo: 'bath.jpg', results }));
  return results;
}
const results: Record<string, Result> = await access(raw).then(
  async () => JSON.parse(await readFile(raw, 'utf8')).results,
  ask,
);

// Outlines are traced every half pixel; a one-pixel simplification keeps the
// shape and drops ~95% of the points.
function simplify(points: number[][], tolerance: number): number[][] {
  if (points.length < 3) return points;
  const [ax, ay] = points[0]!,
    [bx, by] = points.at(-1)!;
  const len = Math.hypot(bx - ax, by - ay) || 1;
  let worst = 0,
    at = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i]!;
    const d = Math.abs((by - ay) * px - (bx - ax) * py + bx * ay - by * ax) / len;
    if (d > worst) ((worst = d), (at = i));
  }
  if (worst <= tolerance) return [points[0]!, points.at(-1)!];
  return [
    ...simplify(points.slice(0, at + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(at), tolerance),
  ];
}
// The outer contour in image pixels (box offset and mask scale applied).
// Holes, such as a cabinet handle inside the vanity, read as noise here.
function outline(seg: Seg) {
  const contours = seg.path
    .split(/(?=M)/)
    .map((part) =>
      [...part.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)].map((m) => [
        seg.box.left + Number(m[1]) * seg.scaleX,
        seg.box.top + Number(m[2]) * seg.scaleY,
      ]),
    );
  const extent = (pts: number[][]) => {
    const xs = pts.map(([x]) => x!),
      ys = pts.map(([, y]) => y!);
    return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
  };
  const outer = contours.reduce((a, b) => (extent(b) > extent(a) ? b : a));
  const kept = simplify(outer, 1);
  return kept.length < 3
    ? ''
    : `M${kept.map(([x, y]) => `${Math.round(x)} ${Math.round(y)}`).join('L')}Z`;
}
const slim: Record<string, unknown> = {};
for (const [id, r] of Object.entries(results)) {
  // The shower's reflection in the mirror is not the shower.
  const segments = r.segments.filter((s) => (id === 'shower' ? s.box.left > 600 : true));
  slim[id] = {
    phrase: r.phrase,
    runId: r.runId,
    count: segments.length,
    box: {
      left: Math.min(...segments.map((s) => s.box.left)),
      top: Math.min(...segments.map((s) => s.box.top)),
      right: Math.max(...segments.map((s) => s.box.right)),
      bottom: Math.max(...segments.map((s) => s.box.bottom)),
    },
    path: segments.map(outline).join(''),
  };
  console.log(id, segments.length, 'segments');
}
const first = Object.values(results)[0]!;
await writeFile(
  out,
  JSON.stringify({
    photo: 'bath.jpg',
    model: first.model,
    width: first.width,
    height: first.height,
    objects: slim,
  }),
);
console.log('wrote', out);
