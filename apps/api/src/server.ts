import { createServer, type IncomingMessage } from 'node:http';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { DomainError } from '@unpermitted/contracts';
import { MongoWorkspaceRepository } from './repository.js';
import { PhotoWorker, requestPhotoJob, publicJob, type StoredPhotoJob } from './photo-jobs.js';
import { configuredMuseKey } from '../../../scripts/muse-provider.js';
export async function createWorkspaceServer(
  repository: MongoWorkspaceRepository,
  token: string,
  providerConfigured: boolean,
) {
  const worker = new PhotoWorker(repository);
  await worker.recover();
  const origins = new Set(['http://127.0.0.1:8741', 'http://localhost:8741']);
  const blobSchema = z
    .object({
      id: z.string().min(1).max(160),
      mediaType: z.string().max(100),
      data: z
        .string()
        .max(12 * 1024 * 1024)
        .regex(/^[A-Za-z0-9+/]*={0,2}$/),
    })
    .strict();
  async function body(req: IncomingMessage) {
    if (!req.headers['content-type']?.startsWith('application/json'))
      throw new DomainError('VALIDATION', 'Expected JSON');
    let size = 0;
    const parts: Buffer[] = [];
    for await (const part of req) {
      size += part.length;
      if (size > 20 * 1024 * 1024) throw new DomainError('VALIDATION', 'Request exceeds 20 MB');
      parts.push(part);
    }
    const parsed: unknown = JSON.parse(Buffer.concat(parts).toString());
    const stack = [parsed];
    let nodes = 0;
    while (stack.length) {
      const value = stack.pop();
      if (++nodes > 150000)
        throw new DomainError('VALIDATION', 'Request structure exceeds validation budget');
      if (Array.isArray(value)) {
        if (value.length > 10000)
          throw new DomainError('VALIDATION', 'Collection exceeds validation budget');
        stack.push(...value);
      } else if (value && typeof value === 'object') {
        const entries = Object.values(value);
        if (entries.length > 10000)
          throw new DomainError('VALIDATION', 'Object exceeds validation budget');
        stack.push(...entries);
      }
    }
    return parsed;
  }
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const json = (status: number, value: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(value));
    };
    try {
      const host = req.headers.host || '';
      const bound = server.address();
      const port = bound && typeof bound !== 'string' ? bound.port : 4000;
      const allowedHost = new RegExp(`^(127\\.0\\.0\\.1|localhost):(${port}|8741)$`);
      if (
        !allowedHost.test(host) ||
        (req.headers.origin && !origins.has(req.headers.origin)) ||
        (req.headers['sec-fetch-site'] &&
          !['same-origin', 'none'].includes(String(req.headers['sec-fetch-site'])))
      )
        throw new DomainError('FORBIDDEN', 'Only the local workspace origin is allowed');
      const url = new URL(req.url || '/', 'http://127.0.0.1:4000');
      const path = url.pathname.replace(/^\/api\/workspace/, '');
      if (req.method === 'POST' && req.headers['x-unpermitted-client'] !== 'workspace')
        throw new DomainError('FORBIDDEN', 'Workspace request header required');
      if (path === '/session' && req.method === 'GET') {
        if (req.headers['x-unpermitted-client'] !== 'workspace')
          throw new DomainError('FORBIDDEN', 'Workspace request header required');
        res.setHeader(
          'Set-Cookie',
          `unpermitted_local=${token}; HttpOnly; SameSite=Strict; Path=/api/workspace`,
        );
        await repository.read();
        json(200, { mode: 'local-single-owner', mongo: true, muse: providerConfigured });
        return;
      }
      const candidate =
        req.headers.cookie
          ?.split(';')
          .map((v) => v.trim())
          .find((v) => v.startsWith('unpermitted_local='))
          ?.slice('unpermitted_local='.length) || '';
      if (
        candidate.length !== token.length ||
        !timingSafeEqual(Buffer.from(candidate), Buffer.from(token))
      )
        throw new DomainError('FORBIDDEN', 'Open the local workspace session first');
      if (path === '' && req.method === 'GET') {
        json(200, (await repository.read()).workspace);
        return;
      }
      if (path === '/commands' && req.method === 'POST') {
        const data = z
          .object({
            commands: z.array(z.unknown()).min(1).max(50),
            blobs: z.array(blobSchema).max(30).default([]),
          })
          .strict()
          .parse(await body(req));
        json(200, await repository.execute(data.commands, data.blobs));
        return;
      }
      if (path === '/import' && req.method === 'POST') {
        const data = z
          .object({ workspace: z.unknown(), blobs: z.array(blobSchema) })
          .strict()
          .parse(await body(req));
        json(200, await repository.importWorkspace(data.workspace, data.blobs));
        return;
      }
      if (path === '/backup' && req.method === 'GET') {
        const doc = await repository.read();
        json(200, { workspace: doc.workspace, blobs: doc.blobs });
        return;
      }
      const asset = path.match(/^\/photo-assets\/([a-f0-9]{64})$/);
      if (asset && req.method === 'GET') {
        const hash = asset[1],
          doc = await repository.read();
        const photo = Object.values(doc.workspace.artifacts)
          .flatMap((versions) =>
            versions.flatMap((a) =>
              a.payload.kind === 'property-research' ? a.payload.photoReview?.photos || [] : [],
            ),
          )
          .find((p) => p.sha256 === hash);
        if (!photo) throw new DomainError('NOT_FOUND', 'Photo hash is outside this workspace');
        for (const job of doc.jobs as StoredPhotoJob[]) {
          const index = job.photos.findIndex((p) => p.imageUrl === photo.imageUrl);
          if (index < 0) continue;
          try {
            const cached = JSON.parse(
              await readFile(`.local/photo-jobs/${job.id}/input-${index}.json`, 'utf8'),
            );
            const data = Buffer.from(cached.data, 'base64');
            if (createHash('sha256').update(data).digest('hex') !== hash) continue;
            res.writeHead(200, {
              'Content-Type':
                cached.extension === 'png'
                  ? 'image/png'
                  : cached.extension === 'webp'
                    ? 'image/webp'
                    : 'image/jpeg',
            });
            res.end(data);
            return;
          } catch {
            /* An earlier external review may have no private cached image. */
          }
        }
        res.writeHead(302, { Location: photo.imageUrl, 'Referrer-Policy': 'no-referrer' });
        res.end();
        return;
      }
      if (path.startsWith('/blobs/') && req.method === 'GET') {
        const id = decodeURIComponent(path.slice('/blobs/'.length)),
          doc = await repository.read();
        if (!Object.values(doc.workspace.evidence).some((e) => e.source.attachment?.blobId === id))
          throw new DomainError('NOT_FOUND', 'Attachment not found');
        const blob = doc.blobs.find((b) => b.id === id);
        if (!blob) throw new DomainError('NOT_FOUND', 'Attachment not found');
        res.writeHead(200, {
          'Content-Type': blob.mediaType,
          'Content-Security-Policy': "sandbox; default-src 'none'",
          'Content-Disposition': 'inline',
        });
        res.end(Buffer.from(blob.data, 'base64'));
        return;
      }
      if (path === '/photo-jobs' && req.method === 'GET') {
        const doc = await repository.read();
        json(
          200,
          doc.jobs.filter((j) => j.projectId === url.searchParams.get('projectId')).map(publicJob),
        );
        return;
      }
      if (path === '/photo-jobs' && req.method === 'POST') {
        if (!providerConfigured)
          throw new DomainError('VALIDATION', 'Configure MUSE_API_KEY on the server first');
        const job = await requestPhotoJob(repository, await body(req));
        json(202, publicJob(job));
        void worker.tick();
        return;
      }
      const cancel = path.match(/^\/photo-jobs\/([a-f0-9-]{36})\/cancel$/);
      if (cancel && req.method === 'POST') {
        await worker.cancel(cancel[1]);
        json(200, { cancelled: true });
        return;
      }
      json(404, { message: 'Unknown workspace endpoint' });
    } catch (error) {
      const code = error instanceof DomainError ? error.code : 'VALIDATION';
      const message =
        error instanceof DomainError
          ? error.message
          : error instanceof z.ZodError
            ? 'Request failed schema validation'
            : 'Request failed; saved state was preserved';
      json(
        code === 'FORBIDDEN'
          ? 403
          : code === 'CONFLICT' || code === 'STALE'
            ? 409
            : code === 'NOT_FOUND'
              ? 404
              : 400,
        { code, message },
      );
    }
  });
  const interval = setInterval(() => void worker.tick().catch(() => {}), 3000);
  server.on('close', () => clearInterval(interval));
  return { server, worker };
}
if (process.argv[1]?.endsWith('/apps/api/src/server.ts')) {
  await mkdir('.local', { recursive: true, mode: 0o700 });
  let token: string;
  try {
    token = (await readFile('.local/api-session', 'utf8')).trim();
  } catch {
    token = randomBytes(32).toString('hex');
    await writeFile('.local/api-session', token, { mode: 0o600, flag: 'wx' });
  }
  const { repository, client } = await MongoWorkspaceRepository.connect(
    process.env.WORKSPACE_MONGODB_URI || 'mongodb://127.0.0.1:27018/unpermitted_workspace',
  );
  const { server, worker } = await createWorkspaceServer(
    repository,
    token,
    Boolean(await configuredMuseKey()),
  );
  server.listen(4000, '127.0.0.1', () =>
    console.log(
      'Workspace API ready on 127.0.0.1:4000; Mongo persistence enabled; local single-owner mode',
    ),
  );
  const stop = () =>
    server.close(() => {
      void worker
        .shutdown()
        .then(() => client.close())
        .then(() => process.exit(0));
    });
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
