import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { imageSize } from 'image-size';
import { Binary, type Collection, type Db } from 'mongodb';
import { DomainError, id, type DesignImage } from '@renovagent/contracts';

const run = promisify(execFile);
const MAX_INPUT = 25 * 1024 * 1024;

type StoredDesignImage = {
  _id: string;
  ownerId: string;
  sha256: string;
  mediaType: DesignImage['mediaType'];
  width: number;
  height: number;
  data: Binary;
  createdAt: string;
  // Present for uploaded source photos; previews carry provenance in artifacts.
  source?: { label: string; originalName: string; originalSha256: string; permission: string };
};

export const sha256Of = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

// Normalize any supported photo (AVIF, HEIC, PNG, JPEG…) to a bounded JPEG for
// display and as the model input. The original file's hash is kept separately
// by the caller; this derivative is what previews are generated from.
export const normalizeImage = (bytes: Uint8Array, maxEdge = 1600) => toJpeg(bytes, { maxEdge });

// A generated image resized to exactly its source photo's frame, so masks
// and the before/after comparison line up pixel for pixel.
export const fitImage = (bytes: Uint8Array, width: number, height: number) =>
  toJpeg(bytes, { width, height });

async function toJpeg(
  bytes: Uint8Array,
  target: { maxEdge: number } | { width: number; height: number },
) {
  if (bytes.byteLength > MAX_INPUT) throw new DomainError('VALIDATION', 'Image exceeds 25 MB');
  const dir = await mkdtemp(join(tmpdir(), 'renovagent-image-'));
  try {
    await writeFile(join(dir, 'in'), bytes);
    // macOS sips locally; libvips (the container's libvips-tools) elsewhere.
    // A bound shrinks to fit and never enlarges; an exact frame resamples.
    const input = join(dir, 'in'),
      output = join(dir, 'out.jpg');
    const [w, h] =
      'maxEdge' in target
        ? [String(target.maxEdge), String(target.maxEdge)]
        : [String(target.width), String(target.height)];
    const [tool, args] =
      process.platform === 'darwin'
        ? [
            'sips',
            [
              '-s',
              'format',
              'jpeg',
              '-s',
              'formatOptions',
              '85',
              ...('maxEdge' in target ? ['-Z', w] : ['-z', h, w]),
              input,
              '--out',
              output,
            ],
          ]
        : [
            'vips',
            [
              'thumbnail',
              input,
              `${output}[Q=85,strip]`,
              w,
              '--height',
              h,
              '--size',
              'maxEdge' in target ? 'down' : 'force',
            ],
          ];
    await run(tool, args, { timeout: 60000 });
    const out = new Uint8Array(await readFile(output));
    const size = imageSize(out);
    if (!size.width || !size.height) throw new DomainError('VALIDATION', 'Unreadable image');
    return { bytes: out, width: size.width, height: size.height, mediaType: 'image/jpeg' as const };
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError('VALIDATION', 'The image could not be read or converted');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Owner-scoped, immutable, checksum-verified image bytes kept outside the
// bounded workspace aggregate. Artifacts reference images by hash only.
export class DesignImageStore {
  readonly collection: Collection<StoredDesignImage>;
  constructor(db: Db) {
    this.collection = db.collection<StoredDesignImage>('design_images');
  }

  async put(
    ownerId: string,
    image: {
      bytes: Uint8Array;
      width: number;
      height: number;
      mediaType: DesignImage['mediaType'];
    },
    source?: StoredDesignImage['source'],
  ): Promise<DesignImage> {
    id.parse(ownerId);
    const sha256 = sha256Of(image.bytes);
    await this.collection.updateOne(
      { _id: `${ownerId}:${sha256}` },
      {
        $setOnInsert: {
          _id: `${ownerId}:${sha256}`,
          ownerId,
          sha256,
          mediaType: image.mediaType,
          width: image.width,
          height: image.height,
          data: new Binary(Buffer.from(image.bytes)),
          createdAt: new Date().toISOString(),
          ...(source ? { source } : {}),
        },
      },
      { upsert: true },
    );
    return {
      sha256,
      mediaType: image.mediaType,
      width: image.width,
      height: image.height,
      bytes: image.bytes.byteLength,
    };
  }

  async get(ownerId: string, sha256: string) {
    const record = await this.collection.findOne({ _id: `${ownerId}:${sha256}`, ownerId });
    if (!record) return null;
    const bytes = new Uint8Array(record.data.buffer);
    if (sha256Of(bytes) !== sha256)
      throw new DomainError('STORAGE', 'Design image checksum mismatch');
    return { bytes, mediaType: record.mediaType, record };
  }
}
