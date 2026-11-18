import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { parseSegmentation } from '../apps/api/src/segmentation.js';
import { samSegmentText } from './muse-provider.js';

const maxBytes = 1_500_000;

export function drainTraceHandler(token: string, segment = samSegmentText) {
  let remaining = 20;
  let working = false;
  return async (req: IncomingMessage, res: ServerResponse) => {
    const reply = (status: number, data: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    if (req.method !== 'POST' || req.url !== '/trace') {
      reply(404, { error: 'Unknown endpoint.' });
      return;
    }
    if (req.headers.authorization !== `Bearer ${token}`) {
      reply(401, { error: 'Check the bridge token.' });
      return;
    }
    if (working || remaining === 0) {
      reply(429, { error: working ? 'A trace is running.' : 'Prototype trace budget exhausted.' });
      return;
    }
    const size = Number(req.headers['content-length']);
    if (
      req.headers['content-type'] !== 'image/jpeg' ||
      !Number.isInteger(size) ||
      size < 4 ||
      size > maxBytes
    ) {
      reply(400, { error: 'Expected a bounded JPEG frame.' });
      return;
    }
    working = true;
    try {
      const chunks: Buffer[] = [];
      let received = 0;
      for await (const chunk of req) {
        received += chunk.length;
        if (received > size) throw Error('Invalid image length');
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks);
      if (received !== size || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
        reply(400, { error: 'Invalid JPEG.' });
        return;
      }
      remaining--;
      const phrase = 'exposed drain pipe';
      const model = await segment({ image: { bytes, mediaType: 'image/jpeg' }, phrase });
      const masks: number[][][] = [];
      const result = await parseSegmentation(
        phrase,
        model.text,
        (segment, raster, width, height) => {
          if (masks.length >= 20) return;
          const { box, scaleX, scaleY } = segment;
          const step = Math.max(1, Math.ceil(Math.max(width, height) / 90));
          const points: number[][] = [];
          for (let y = 0; y < height; y++) {
            // Stagger columns per row to retain sparse mask pixels without shipping the raster.
            for (let x = y % step; x < width; x += step) {
              if (raster[y * width + x]) {
                points.push([box.left + (x + 0.5) * scaleX, box.top + (y + 0.5) * scaleY]);
              }
            }
          }
          const stride = Math.max(1, Math.ceil(points.length / 1200));
          masks.push(points.filter((_, i) => i % stride === 0));
        },
      );
      reply(200, { width: result.width, height: result.height, masks, runId: model.runId });
    } catch {
      reply(502, {
        error: 'SAM trace unavailable. Check the Mac bridge and provider configuration.',
      });
    } finally {
      working = false;
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const token = randomBytes(24).toString('hex');
  const host = process.env.RENOVAGENT_IOS_HOST ?? '127.0.0.1';
  const server = createServer(drainTraceHandler(token));
  server.requestTimeout = 15_000;
  server.listen(8765, host, () => {
    process.stdout.write(`Drain bridge listening on ${host}:8765\nPrototype token: ${token}\n`);
  });
}
