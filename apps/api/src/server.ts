import { createServer, type IncomingMessage } from 'node:http';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { DomainError, moneySchema } from '@renovagent/contracts';
import { MongoWorkspaceRepository } from './repository.js';
import { PhotoWorker, requestPhotoJob, publicJob, type StoredPhotoJob } from './photo-jobs.js';
import {
  AccountService,
  ACCOUNT_COOKIE,
  accountCookie,
  clearAccountCookie,
  googleConfigFromEnv,
  metaConfigFromEnv,
  type OAuthProvider,
} from './accounts.js';
import { configuredMuseKey } from '../../../scripts/muse-provider.js';
import { CatalogStore } from './catalog.js';
import { workspaceMongoConfig } from './database-config.js';
import { PhotoJobFiles } from './photo-job-files.js';
export async function createWorkspaceServer(
  repository: MongoWorkspaceRepository,
  token: string,
  providerConfigured: boolean,
  accounts?: AccountService,
  catalog?: CatalogStore,
  photoFiles?: PhotoJobFiles,
) {
  const accountMode = Boolean(accounts);
  const workers = new Map<string, PhotoWorker>();
  async function workerFor(repo: MongoWorkspaceRepository) {
    let worker = workers.get(repo.ownerId);
    if (!worker) {
      worker = new PhotoWorker(repo, photoFiles);
      workers.set(repo.ownerId, worker);
      await worker.recover();
    }
    return worker;
  }
  if (!accountMode) await workerFor(repository);
  else {
    for (const id of await repository.collection.distinct('_id'))
      await workerFor(repository.forUser(id));
  }
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
      if (req.method === 'POST' && req.headers['x-renovagent-client'] !== 'workspace')
        throw new DomainError('FORBIDDEN', 'Workspace request header required');
      const cookies = Object.fromEntries(
        (req.headers.cookie || '')
          .split(';')
          .map((v) => v.trim().split('='))
          .filter((p): p is [string, string] => p.length === 2),
      );
      const oauthStart = path.match(/^\/auth\/(google|meta)$/);
      if (oauthStart && req.method === 'GET') {
        const provider = oauthStart[1] as OAuthProvider;
        if (!accounts || !accounts.providers().includes(provider))
          throw new DomainError(
            'VALIDATION',
            `Sign-in with ${provider} is not configured on this server`,
          );
        const started = provider === 'google' ? accounts.googleAuthUrl() : accounts.metaAuthUrl();
        res.writeHead(302, { Location: started.url });
        res.end();
        return;
      }
      const oauthCallback = path.match(/^\/auth\/(google|meta)\/callback$/);
      if (oauthCallback && req.method === 'GET') {
        const provider = oauthCallback[1] as OAuthProvider;
        if (!accounts || !accounts.providers().includes(provider))
          throw new DomainError(
            'VALIDATION',
            `Sign-in with ${provider} is not configured on this server`,
          );
        const state = url.searchParams.get('state') || '',
          code = url.searchParams.get('code') || '';
        if (!code || !accounts.consumeState(state, provider)) {
          res.writeHead(302, { Location: '/?auth=error' });
          res.end();
          return;
        }
        try {
          const login = await accounts.completeLogin(provider, code);
          await repository.forUser(login.user._id).ensure();
          res.writeHead(302, { Location: '/', 'Set-Cookie': accountCookie(login.token, false) });
        } catch {
          res.writeHead(302, { Location: '/?auth=error' });
        }
        res.end();
        return;
      }
      if (path === '/auth/me' && req.method === 'GET') {
        if (!accounts) {
          json(200, { mode: 'local-single-owner', signedIn: false });
          return;
        }
        const user = await accounts.getSession(cookies[ACCOUNT_COOKIE] || '');
        json(
          200,
          user
            ? {
                mode: 'account',
                signedIn: true,
                user: { email: user.email },
                providers: accounts.providers(),
              }
            : { mode: 'account', signedIn: false, providers: accounts.providers() },
        );
        return;
      }
      if (path === '/auth/logout' && req.method === 'POST') {
        if (accounts) await accounts.destroySession(cookies[ACCOUNT_COOKIE] || '');
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': clearAccountCookie(),
        });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      if (path === '/session' && req.method === 'GET') {
        if (req.headers['x-renovagent-client'] !== 'workspace')
          throw new DomainError('FORBIDDEN', 'Workspace request header required');
        if (accountMode) {
          const user = await accounts!.getSession(cookies[ACCOUNT_COOKIE] || '');
          json(
            200,
            user
              ? {
                  mode: 'account',
                  signedIn: true,
                  user: { email: user.email },
                  providers: accounts!.providers(),
                  mongo: true,
                  muse: providerConfigured,
                }
              : {
                  mode: 'account',
                  signedIn: false,
                  providers: accounts!.providers(),
                  mongo: true,
                  muse: providerConfigured,
                },
          );
          return;
        }
        res.setHeader(
          'Set-Cookie',
          `renovagent_local=${token}; HttpOnly; SameSite=Strict; Path=/api/workspace`,
        );
        await repository.read();
        json(200, { mode: 'local-single-owner', mongo: true, muse: providerConfigured });
        return;
      }
      let activeRepo = repository;
      if (accountMode) {
        const user = await accounts!.getSession(cookies[ACCOUNT_COOKIE] || '');
        if (!user) throw new DomainError('FORBIDDEN', 'Sign in to use the shared workspace');
        activeRepo = repository.forUser(user._id);
      } else {
        const candidate = cookies['renovagent_local'] || '';
        if (
          candidate.length !== token.length ||
          !timingSafeEqual(Buffer.from(candidate), Buffer.from(token))
        )
          throw new DomainError('FORBIDDEN', 'Open the local workspace session first');
      }
      const activeWorker = await workerFor(activeRepo);
      const requireOperator = () => {
        if (!accountMode) return;
        const expected = process.env.RENOVAGENT_CATALOG_OPERATOR || '';
        if (!expected || req.headers['x-renovagent-operator'] !== expected)
          throw new DomainError('FORBIDDEN', 'Catalog curation needs the operator token');
      };
      if (path === '/catalog/offers' && req.method === 'GET') {
        if (!catalog) throw new DomainError('VALIDATION', 'Catalog is unavailable');
        const productIds = (url.searchParams.get('productIds') || '')
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
          .slice(0, 200);
        json(
          200,
          await catalog.offersFor(productIds, {
            region: url.searchParams.get('region') || undefined,
            sku: url.searchParams.get('sku') || undefined,
            retailer: url.searchParams.get('retailer') || undefined,
          }),
        );
        return;
      }
      if (path === '/catalog/search' && req.method === 'GET') {
        if (!catalog) throw new DomainError('VALIDATION', 'Catalog is unavailable');
        json(
          200,
          await catalog.search(
            url.searchParams.get('q') || '',
            url.searchParams.get('category') || undefined,
          ),
        );
        return;
      }
      const history = path.match(/^\/catalog\/offers\/([^/]+)\/history$/);
      if (history && req.method === 'GET') {
        if (!catalog) throw new DomainError('VALIDATION', 'Catalog is unavailable');
        const limit = Number(url.searchParams.get('limit') || 50);
        json(
          200,
          await catalog.history(
            decodeURIComponent(history[1]),
            Number.isFinite(limit) ? limit : 50,
          ),
        );
        return;
      }
      if (path === '/catalog/import' && req.method === 'POST') {
        if (!catalog) throw new DomainError('VALIDATION', 'Catalog is unavailable');
        requireOperator();
        json(200, await catalog.importBatch(await body(req)));
        return;
      }
      if (path === '/catalog/submissions' && req.method === 'POST') {
        if (!catalog) throw new DomainError('VALIDATION', 'Catalog is unavailable');
        const data = z
          .object({
            offerId: z.string().min(1).max(160),
            observedAt: z.string().max(40).optional(),
            unitPrice: moneySchema,
            stock: z.enum(['in_stock', 'limited', 'out_of_stock', 'unknown']),
            shippingEstimate: moneySchema.optional(),
            note: z.string().max(500).optional(),
          })
          .strict()
          .parse(await body(req));
        json(
          201,
          await catalog.submitObservation(activeRepo.ownerId, data, {
            autoApprove: !accountMode,
          }),
        );
        return;
      }
      const review = path.match(/^\/catalog\/submissions\/([^/]+)\/review$/);
      if (review && req.method === 'POST') {
        if (!catalog) throw new DomainError('VALIDATION', 'Catalog is unavailable');
        requireOperator();
        const data = z
          .object({ approve: z.boolean(), reason: z.string().max(500).optional() })
          .strict()
          .parse(await body(req));
        json(
          200,
          await catalog.reviewSubmission(decodeURIComponent(review[1]), data.approve, data.reason),
        );
        return;
      }
      if (path === '' && req.method === 'GET') {
        json(200, (await activeRepo.read()).workspace);
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
        json(200, await activeRepo.execute(data.commands, data.blobs));
        return;
      }
      if (path === '/import' && req.method === 'POST') {
        const data = z
          .object({ workspace: z.unknown(), blobs: z.array(blobSchema) })
          .strict()
          .parse(await body(req));
        let workspace = data.workspace;
        if (accountMode && workspace && typeof workspace === 'object') {
          // Explicit local-to-account transfer: the incoming workspace is adopted
          // by the signed-in owner. Local mode keeps strict owner matching.
          const adopted = workspace as Record<string, unknown>;
          const properties = adopted.properties as
            | Record<string, Record<string, unknown>>
            | undefined;
          if (properties)
            for (const key of Object.keys(properties))
              properties[key] = { ...properties[key], ownerId: activeRepo.ownerId };
          workspace = { ...adopted, ownerId: activeRepo.ownerId };
        }
        json(200, await activeRepo.importWorkspace(workspace, data.blobs));
        return;
      }
      if (path === '/backup' && req.method === 'GET') {
        const doc = await activeRepo.read();
        json(200, { workspace: doc.workspace, blobs: doc.blobs });
        return;
      }
      const asset = path.match(/^\/photo-assets\/([a-f0-9]{64})$/);
      if (asset && req.method === 'GET') {
        const hash = asset[1],
          doc = await activeRepo.read();
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
              (await photoFiles?.get(activeRepo.ownerId, job.id, `input-${index}.json`)) ??
                (await readFile(`.local/photo-jobs/${job.id}/input-${index}.json`, 'utf8')),
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
          doc = await activeRepo.read();
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
        const doc = await activeRepo.read();
        json(
          200,
          doc.jobs.filter((j) => j.projectId === url.searchParams.get('projectId')).map(publicJob),
        );
        return;
      }
      if (path === '/photo-jobs' && req.method === 'POST') {
        if (!providerConfigured)
          throw new DomainError('VALIDATION', 'Configure MUSE_API_KEY on the server first');
        const job = await requestPhotoJob(activeRepo, await body(req));
        json(202, publicJob(job));
        void activeWorker.tick();
        return;
      }
      const cancel = path.match(/^\/photo-jobs\/([a-f0-9-]{36})\/cancel$/);
      if (cancel && req.method === 'POST') {
        await activeWorker.cancel(cancel[1]);
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
  const interval = setInterval(() => {
    for (const worker of workers.values()) void worker.tick().catch(() => {});
  }, 3000);
  server.on('close', () => clearInterval(interval));
  return { server, workers };
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
  const database = await workspaceMongoConfig();
  const { repository, client } = await MongoWorkspaceRepository.connect(database.uri);
  const google = googleConfigFromEnv();
  const meta = metaConfigFromEnv();
  const accounts =
    google || meta
      ? new AccountService(client.db(), {
          ...(google ? { google } : {}),
          ...(meta ? { meta } : {}),
        })
      : undefined;
  const catalog = new CatalogStore(client.db());
  await catalog.ensureIndexes();
  const { server, workers } = await createWorkspaceServer(
    repository,
    token,
    Boolean(await configuredMuseKey()),
    accounts,
    catalog,
    new PhotoJobFiles(client.db()),
  );
  server.listen(4000, '127.0.0.1', () =>
    console.log(
      `Workspace API ready on 127.0.0.1:4000; Mongo ${database.target} selected (${database.source}); ${accounts ? `account mode (${accounts.providers().join(' + ')} sign-in)` : 'local single-owner mode'}`,
    ),
  );
  const stop = () =>
    server.close(() => {
      void Promise.all([...workers.values()].map((worker) => worker.shutdown()))
        .then(() => client.close())
        .then(() => process.exit(0));
    });
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
