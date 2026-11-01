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
import {
  configuredMuseKey,
  imageMediaType,
  museEditImage,
  samSegmentText,
} from '../../../scripts/muse-provider.js';
import { parseSegmentation, type PhotoSegmentation } from './segmentation.js';
import {
  blenderPayload,
  renderInput,
  renderServiceFromEnv,
  type RenderService,
} from './hq-render.js';
import { CatalogStore } from './catalog.js';
import { workspaceMongoConfig } from './database-config.js';
import { PhotoJobFiles } from './photo-job-files.js';
import { DesignImageStore } from './design-images.js';
import {
  hostingConfigFromEnv,
  isPublic,
  localHosting,
  oauthRedirect,
  secureCookies,
  serveStatic,
  trustedHost,
  trustedOrigins,
  type HostingConfig,
} from './hosting.js';
import {
  DesignPreviewWorker,
  MusePreviewProvider,
  type PreviewProvider,
} from './design-previews.js';
import {
  buildDesignOptions,
  reviseDesignOption,
  summarizeDesignOptions,
  uploadDesignPhoto,
} from './design-service.js';
import { renderExample } from './example-render.js';
import { studioProviders, studioRoutes, type StudioProviders } from './studio.js';
import { StudioPlanStore } from './studio-plans.js';
import { studioProject } from './mcp-studio.js';
import { McpAccessStore } from './mcp-access.js';
import { mcpEndpoint } from './mcp-http.js';
import { configuredJevKey, judgeProducts, rankReviewFindings, readRoomPhoto } from './jev.js';
import {
  bestValue,
  FAR_MATCH_DE,
  nearestPaints,
  paintFamilies,
  priceLook,
  scopeDraftId,
  valueCandidates,
  type PaintFamily,
} from '@renovagent/core';
import { curatedLooks, lookRoomFor, lookView } from './looks.js';
import type { BomPayload, PurchasePlanPayload, ScopeDraft } from '@renovagent/contracts';
import { imageSize } from 'image-size';

// Paid model calls per owner per window, so a session cannot drain the key.
const RANK_LIMIT = { calls: 20, windowMs: 10 * 60 * 1000 };
// SAM 3.1 outlines per owner per window; repeats of the same photo and phrase are cached.
const SEGMENT_LIMIT = { calls: 60, windowMs: 10 * 60 * 1000 };
const SEGMENT_CACHE_SIZE = 200;
// Muse Image repaint previews ($0.01 each) per owner per window.
const REPAINT_LIMIT = { calls: 12, windowMs: 10 * 60 * 1000 };
// Blender GPU renders per owner per window.
const HQ_LIMIT = { calls: 6, windowMs: 10 * 60 * 1000 };
// Muse Spark reads of an owner's room photos and floor plans.
const READ_LIMIT = { calls: 10, windowMs: 10 * 60 * 1000 };
const rankInput = z
  .object({
    work: z
      .object({
        request: z.string().max(2000),
        packages: z.array(z.string().max(160)).max(20),
        facts: z.array(z.string().max(200)).max(10),
      })
      .strict(),
    findings: z
      .array(
        z
          .object({
            id: z.string().min(1).max(40),
            citations: z
              .array(
                z
                  .object({
                    kind: z.string().max(40),
                    title: z.string().max(300),
                    locator: z.string().max(120).nullable(),
                    excerpt: z.string().max(600),
                  })
                  .strip(),
              )
              .max(12),
          })
          .strip(),
      )
      .max(80),
  })
  .strict();
export async function createWorkspaceServer(
  repository: MongoWorkspaceRepository,
  token: string,
  providerConfigured: boolean,
  accounts?: AccountService,
  catalog?: CatalogStore,
  photoFiles?: PhotoJobFiles,
  design?: { images: DesignImageStore; provider?: PreviewProvider },
  hosting: HostingConfig = localHosting,
  // Jev judgments (review ranking, room photo reading); injectable for tests.
  jev: {
    configured: () => Promise<boolean>;
    rank: typeof rankReviewFindings;
    readPhoto: typeof readRoomPhoto;
    judgeProducts: typeof judgeProducts;
  } = {
    configured: async () => Boolean(await configuredJevKey()),
    rank: rankReviewFindings,
    readPhoto: readRoomPhoto,
    judgeProducts,
  },
  // SAM 3.1 concept segmentation; injectable for tests.
  segment: typeof samSegmentText = samSegmentText,
  // Muse Image edits for repaint previews; injectable for tests.
  repaint: typeof museEditImage = museEditImage,
  // Blender on Modal for high-quality renders; absent when not configured.
  render: RenderService | undefined = renderServiceFromEnv(),
  // The paint-and-floor studio's providers (SAM, Muse Image, Muse Spark); injectable for tests.
  studio: StudioProviders = studioProviders,
  // Remote agents (Muse and other MCP clients) at /mcp, with keys owners
  // create in the website; absent, both stay off.
  mcpAccess?: McpAccessStore,
  // Paint-and-floor plans owners' agents save, opened at /#plan/<id>.
  plans?: StudioPlanStore,
) {
  const accountMode = Boolean(accounts);
  // One-click guests (account mode only); RENOVAGENT_GUESTS=off turns them off.
  const guestsAllowed = process.env.RENOVAGENT_GUESTS !== 'off';
  // An Amazon Associates tag for shopping searches, only when one is set.
  const amazonTag = process.env.RENOVAGENT_AMAZON_TAG?.trim();
  const shopping = amazonTag && /^[A-Za-z0-9-]{1,40}$/.test(amazonTag) ? { amazonTag } : {};
  const GUESTS_PER_HOUR = 20;
  const guestStarts = new Map<string, { start: number; count: number }>();
  // A public origin with the shared local token would give every visitor one workspace.
  if (isPublic(hosting) && !accountMode)
    throw new Error('A public deployment needs Google or Meta sign-in configured');
  const secure = secureCookies(hosting);
  const designWorkers = new Map<string, DesignPreviewWorker>();
  const designWorkerFor = (repo: MongoWorkspaceRepository) => {
    if (!design?.provider) return undefined;
    let worker = designWorkers.get(repo.ownerId);
    if (!worker) {
      worker = new DesignPreviewWorker(repo, design.images, design.provider);
      designWorkers.set(repo.ownerId, worker);
    }
    return worker;
  };
  if (!accountMode) designWorkerFor(repository);
  const exampleRenders = new Map<string, ReturnType<typeof renderExample>>();
  // Paid Jev calls per owner per window (review ranking and photo reading).
  const jevCalls = new Map<string, number[]>();
  const spendJevCall = (ownerId: string) => {
    const now = Date.now();
    const recent = (jevCalls.get(ownerId) ?? []).filter((t) => now - t < RANK_LIMIT.windowMs);
    if (recent.length >= RANK_LIMIT.calls)
      throw new DomainError('VALIDATION', 'Jev limit reached; try again in a few minutes');
    jevCalls.set(ownerId, [...recent, now]);
  };
  const segmentCalls = new Map<string, number[]>();
  const repaintCalls = new Map<string, number[]>();
  const hqCalls = new Map<string, number[]>();
  // Render job → owner, so one owner cannot read another's render.
  const hqJobs = new Map<string, string>();
  const segmentCache = new Map<string, PhotoSegmentation & { model: string; runId: string }>();
  const spendSegmentCall = (ownerId: string) => {
    const now = Date.now();
    const recent = (segmentCalls.get(ownerId) ?? []).filter(
      (t) => now - t < SEGMENT_LIMIT.windowMs,
    );
    if (recent.length >= SEGMENT_LIMIT.calls)
      throw new DomainError('VALIDATION', 'Outline limit reached; try again in a few minutes');
    segmentCalls.set(ownerId, [...recent, now]);
  };
  const spendRepaintCall = (ownerId: string) => {
    const now = Date.now();
    const recent = (repaintCalls.get(ownerId) ?? []).filter(
      (t) => now - t < REPAINT_LIMIT.windowMs,
    );
    if (recent.length >= REPAINT_LIMIT.calls)
      throw new DomainError('VALIDATION', 'Preview limit reached; try again in a few minutes');
    repaintCalls.set(ownerId, [...recent, now]);
  };
  // Recovered workers only: ticks and shutdown see a worker once its jobs are reloaded.
  const readCalls = new Map<string, number[]>();
  const spendReadCall = (ownerId: string) => {
    const now = Date.now();
    const recent = (readCalls.get(ownerId) ?? []).filter((t) => now - t < READ_LIMIT.windowMs);
    if (recent.length >= READ_LIMIT.calls)
      throw new DomainError(
        'VALIDATION',
        'Photo reading limit reached; try again in a few minutes',
      );
    readCalls.set(ownerId, [...recent, now]);
  };
  const studioRoute = design
    ? studioRoutes({
        images: design.images,
        providers: studio,
        ...(catalog ? { paint: () => catalog.allPaint() } : {}),
        spend: (ownerId, kind) =>
          kind === 'segment'
            ? spendSegmentCall(ownerId)
            : kind === 'repaint'
              ? spendRepaintCall(ownerId)
              : spendReadCall(ownerId),
      })
    : undefined;
  const workers = new Map<string, PhotoWorker>();
  const starting = new Map<string, Promise<PhotoWorker>>();
  function workerFor(repo: MongoWorkspaceRepository) {
    let started = starting.get(repo.ownerId);
    if (!started) {
      const worker = new PhotoWorker(repo, photoFiles);
      started = worker.recover().then(
        () => (workers.set(repo.ownerId, worker), worker),
        (error) => {
          starting.delete(repo.ownerId);
          throw error;
        },
      );
      starting.set(repo.ownerId, started);
    }
    return started;
  }
  // Reloading every owner's photo jobs runs in the background, so a cold start
  // listens within the host's health-check timeout. A request for an owner
  // waits on that owner's recovery through workerFor.
  const recovery = (async () => {
    if (!accountMode) {
      await workerFor(repository);
      return;
    }
    for (const id of await repository.collection.distinct('_id')) {
      // Moves any attachments still embedded in the owner's document.
      await repository.forUser(id).moveEmbeddedBlobs();
      await workerFor(repository.forUser(id));
    }
  })().catch((error) =>
    console.error('Photo job recovery failed:', error instanceof Error ? error.message : error),
  );
  // Staged uploads match the intake's per-file allowance (20 MiB originals).
  const STAGED_MAX = 20 * 1024 * 1024;
  const STAGED_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/gif',
    'application/pdf',
  ]);
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
  // Links the site gives out: the public address, or this listener's.
  const siteOrigin = () => {
    const bound = server.address();
    return (
      hosting.publicUrl?.origin ??
      `http://127.0.0.1:${bound && typeof bound !== 'string' ? bound.port : hosting.listenPort}`
    );
  };
  const mcp = mcpAccess
    ? mcpEndpoint(repository, mcpAccess, catalog, {
        ...(design ? { images: design.images } : {}),
        ...(plans ? { plans: { store: plans, origin: siteOrigin } } : {}),
      })
    : undefined;
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Slow requests are logged by method, path (no query), status and time only.
    const started = performance.now();
    res.on('finish', () => {
      const ms = Math.round(performance.now() - started);
      if (ms >= 1000)
        console.warn(
          `[slow] ${req.method} ${(req.url || '').split('?')[0]} ${res.statusCode} ${ms}ms`,
        );
    });
    const json = (status: number, value: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(value));
    };
    try {
      // Liveness for the host's health check; reveals nothing about any workspace.
      if (req.url === '/healthz' && req.method === 'GET') {
        json(200, { ok: true });
        return;
      }
      // Readiness: the workspace database answers a version lookup in time.
      // Liveness alone can't show that useful workspace access works.
      if (req.url === '/readyz' && req.method === 'GET') {
        const t = performance.now();
        const ready = await Promise.race([
          repository.version().then(
            () => true,
            () => false,
          ),
          new Promise<boolean>((r) => setTimeout(() => r(false), 2000)),
        ]);
        json(ready ? 200 : 503, { ok: ready, ms: Math.round(performance.now() - t) });
        return;
      }
      const host = req.headers.host || '';
      const bound = server.address();
      const port = bound && typeof bound !== 'string' ? bound.port : 4000;
      if (!trustedHost(hosting, port, host))
        throw new DomainError('FORBIDDEN', 'Only the workspace origin is allowed');
      const pathname = (req.url || '/').split('?')[0];
      // Agents connect here with a key, never a browser session. Server-to-server
      // clients send no Origin; a browser one must be this site's.
      if (pathname === '/mcp') {
        if (!mcp) throw new DomainError('NOT_FOUND', 'Agent connections are not enabled here');
        if (req.headers.origin && !trustedOrigins(hosting, port).has(req.headers.origin))
          throw new DomainError('FORBIDDEN', 'Origin is not allowed');
        await mcp.handle(req, res);
        return;
      }
      // No OAuth discovery yet: clients that look after a 401 get JSON, not a page.
      if (pathname.startsWith('/.well-known/')) {
        json(404, { error: 'Not found' });
        return;
      }
      // Pages are public and linked from anywhere; the API checks below stay strict.
      if (hosting.staticDir && (await serveStatic(hosting.staticDir, req, res))) return;
      const url = new URL(req.url || '/', 'http://127.0.0.1:4000');
      const path = url.pathname.replace(/^\/api\/workspace/, '');
      // The provider's redirect back is a cross-site navigation; its one-time
      // state is the CSRF guard there. Every other request must be same-origin.
      const providerReturn = req.method === 'GET' && /^\/auth\/(google|meta)\/callback$/.test(path);
      if (
        (req.headers.origin && !trustedOrigins(hosting, port).has(req.headers.origin)) ||
        (!providerReturn &&
          req.headers['sec-fetch-site'] &&
          !['same-origin', 'none'].includes(String(req.headers['sec-fetch-site'])))
      )
        throw new DomainError('FORBIDDEN', 'Only the local workspace origin is allowed');
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
          // A guest who signs in keeps their work. An identity that already has
          // an account signs into it instead; the guest's work stays behind.
          const token = cookies[ACCOUNT_COOKIE] || '';
          const current = token ? await accounts.getSession(token) : null;
          const login = await accounts.completeLogin(
            provider,
            code,
            current?.guest ? current._id : undefined,
          );
          if (current) await accounts.destroySession(token);
          await repository.forUser(login.user._id).ensure();
          res.writeHead(302, {
            Location: '/',
            'Set-Cookie': accountCookie(login.token, secure),
          });
        } catch {
          res.writeHead(302, { Location: '/?auth=error' });
        }
        res.end();
        return;
      }
      // Judges and visitors try it in one click: a guest account with its own
      // private workspace. Limited per address so a script cannot mint many.
      if (path === '/auth/guest' && req.method === 'POST') {
        if (!accounts || !guestsAllowed)
          throw new DomainError('NOT_FOUND', 'Guest access is not enabled here');
        const from =
          String(req.headers['x-forwarded-for'] ?? '')
            .split(',')[0]
            ?.trim() ||
          req.socket.remoteAddress ||
          'unknown';
        const now = Date.now();
        for (const [k, v] of guestStarts) if (now - v.start >= 3600_000) guestStarts.delete(k);
        const seen = guestStarts.get(from) ?? { start: now, count: 0 };
        if (++seen.count > GUESTS_PER_HOUR)
          throw new DomainError('VALIDATION', 'Too many guest sign-ins from here; try again later');
        guestStarts.set(from, seen);
        const login = await accounts.guestLogin();
        await repository.forUser(login.user._id).ensure();
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': accountCookie(login.token, secure),
        });
        res.end(JSON.stringify({ ok: true }));
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
          'Set-Cookie': clearAccountCookie(secure),
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
                  user: { email: user.email, guest: Boolean(user.guest) },
                  providers: accounts!.providers(),
                  guests: guestsAllowed,
                  mongo: true,
                  muse: providerConfigured,
                  render: Boolean(render),
                  jev: await jev.configured(),
                  ...shopping,
                }
              : {
                  mode: 'account',
                  signedIn: false,
                  providers: accounts!.providers(),
                  guests: guestsAllowed,
                  mongo: true,
                  muse: providerConfigured,
                  render: Boolean(render),
                  jev: await jev.configured(),
                  ...shopping,
                },
          );
          return;
        }
        res.setHeader(
          'Set-Cookie',
          `renovagent_local=${token}; HttpOnly; SameSite=Strict; Path=/api/workspace`,
        );
        await repository.read();
        json(200, {
          mode: 'local-single-owner',
          mongo: true,
          muse: providerConfigured,
          render: Boolean(render),
          jev: await jev.configured(),
          ...shopping,
        });
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
      // Keys for the owner's own agents (Muse, Claude, any MCP client). A key is
      // shown once, at creation; only its hash is kept. Seven days, five at most.
      if (path.startsWith('/agent-keys')) {
        if (!mcpAccess)
          throw new DomainError('NOT_FOUND', 'Agent connections are not enabled here');
        const endpoint = `${hosting.publicUrl?.origin ?? `http://127.0.0.1:${port}`}/mcp`;
        const shown = (g: Awaited<ReturnType<McpAccessStore['active']>>[number]) => ({
          id: g._id,
          name: g.name,
          access: g.access,
          createdAt: g.createdAt,
          expiresAt: g.expiresAt,
        });
        if (path === '/agent-keys' && req.method === 'GET') {
          json(200, { endpoint, keys: (await mcpAccess.active(activeRepo.ownerId)).map(shown) });
          return;
        }
        if (path === '/agent-keys' && req.method === 'POST') {
          const input = z
            .object({
              name: z.string().trim().min(1).max(60),
              access: z.enum(['read', 'propose']),
            })
            .strict()
            .parse(await body(req));
          if ((await mcpAccess.active(activeRepo.ownerId)).length >= 5)
            throw new DomainError('VALIDATION', 'Up to five keys at a time; revoke one first');
          const { token: key, grant } = await mcpAccess.issue({
            ownerId: activeRepo.ownerId,
            ...input,
            hours: 168,
          });
          json(200, { endpoint, key, grant: shown(grant) });
          return;
        }
        if (path === '/agent-keys/revoke' && req.method === 'POST') {
          const { id: grantId } = z
            .object({ id: z.string().regex(/^[a-f0-9]{64}$/) })
            .strict()
            .parse(await body(req));
          const result = await mcpAccess.revoke(grantId, activeRepo.ownerId);
          if (!result.matchedCount) throw new DomainError('NOT_FOUND', 'No such key');
          json(200, { revoked: grantId });
          return;
        }
        throw new DomainError('NOT_FOUND', 'Unknown agent key request');
      }
      // A plan an owner's agent saved; only that owner can open it.
      const savedPlan = path.match(/^\/studio-plans\/([^/]+)$/);
      if (savedPlan && req.method === 'GET') {
        const plan = plans ? await plans.get(activeRepo.ownerId, savedPlan[1]!) : null;
        if (!plan) throw new DomainError('NOT_FOUND', 'No such plan in this account');
        json(200, {
          id: plan._id,
          title: plan.title,
          agent: plan.agent,
          createdAt: plan.createdAt,
          project: studioProject(
            `plan-${plan._id}`,
            plan.title,
            plan.ceilingFt,
            plan.tier,
            plan.rooms,
          ),
        });
        return;
      }
      const requireOperator = () => {
        if (!accountMode) return;
        const expected = process.env.RENOVAGENT_CATALOG_OPERATOR || '';
        if (!expected || req.headers['x-renovagent-operator'] !== expected)
          throw new DomainError('FORBIDDEN', 'Catalog curation needs the operator token');
      };
      const designImage = path.match(/^\/design-images\/([a-f0-9]{64})$/);
      if (designImage && req.method === 'GET') {
        // Owner-scoped store: only this owner's uploads and previews resolve.
        const found = await design?.images.get(activeRepo.ownerId, designImage[1]);
        if (!found) throw new DomainError('NOT_FOUND', 'Image is outside this workspace');
        res.writeHead(200, { 'Content-Type': found.mediaType });
        res.end(Buffer.from(found.bytes));
        return;
      }
      if (path === '/review/rank' && req.method === 'POST') {
        // Scores only: the browser holds the review; Jev judges how likely each
        // cited provision applies to the described work. Interpretation, not a source.
        if (!(await jev.configured()))
          throw new DomainError('VALIDATION', 'Jev is not configured on this server');
        // Validate first: only requests that reach the model count toward the limit.
        const input = rankInput.parse(await body(req));
        spendJevCall(activeRepo.ownerId);
        const ranked = await jev.rank(input.findings, input.work);
        json(200, {
          model: ranked.model,
          relevance: Object.fromEntries(ranked.findings.map((f) => [f.id, f.relevance])),
          note: 'Probability that a provision applies to this work, judged by the Jev model; an interpretation, not a code source or determination.',
        });
        return;
      }
      if (path === '/paint/colors' && req.method === 'GET') {
        // Brand paint colours loaded with seed:paint, for choosing and previewing.
        if (!catalog) throw new DomainError('VALIDATION', 'Catalog is unavailable');
        const query = z
          .object({
            q: z.string().trim().max(60).optional(),
            brand: z.string().trim().max(60).optional(),
            family: z.enum(paintFamilies as [PaintFamily, ...PaintFamily[]]).optional(),
            offset: z.coerce.number().int().min(0).max(10000).optional(),
          })
          .parse(Object.fromEntries(url.searchParams));
        json(200, await catalog.searchPaint(query));
        return;
      }
      if (path === '/paint/nearest' && req.method === 'GET') {
        // The loaded colours closest to one read from a photo: a match to how
        // it looks there, not a claim about the paint on that wall.
        if (!catalog) throw new DomainError('VALIDATION', 'Catalog is unavailable');
        const { hex } = z
          .object({ hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) })
          .parse(Object.fromEntries(url.searchParams));
        const matches = nearestPaints(hex, await catalog.allPaint(), 3);
        json(200, {
          hex: hex.toLowerCase(),
          close: (matches[0]?.deltaE ?? Infinity) <= FAR_MATCH_DE,
          matches: matches.map(({ color, deltaE }) => ({
            name: color.name,
            code: color.code ?? '',
            hex: color.hex.toLowerCase(),
            brand: color.brand,
            deltaE: Math.round(deltaE * 10) / 10,
          })),
        });
        return;
      }
      if (path === '/looks/price' && req.method === 'POST') {
        // Curated looks priced for the project's current materials list, with
        // the same hard rules as tier plans. No model call.
        if (!catalog) throw new DomainError('VALIDATION', 'Catalog is unavailable');
        const { projectId } = z
          .object({ projectId: z.string().min(1).max(160) })
          .strict()
          .parse(await body(req));
        const { workspace } = await activeRepo.read();
        if (!workspace.projects[projectId]) throw new DomainError('NOT_FOUND', 'Unknown project');
        const bom = workspace.artifacts[`${projectId}:bom`]?.at(-1)?.payload;
        if (bom?.kind !== 'bom')
          throw new DomainError(
            'VALIDATION',
            'Price the plan first: there is no materials list yet',
          );
        const draft = workspace.artifacts[scopeDraftId(projectId)]?.at(-1)?.payload as
          | ScopeDraft
          | undefined;
        const room = lookRoomFor(draft?.recipe.id);
        const looks = curatedLooks.filter((l) => l.room === room);
        const priced = await catalog.pricedOffers([...new Set(looks.flatMap((l) => l.productIds))]);
        json(200, {
          room,
          looks: looks.map((look) =>
            lookView(look, priceLook(bom as BomPayload, priced, look.productIds), priced),
          ),
          note: 'Real products at the shelf prices checked on the date shown; not live quotes. Tips are Renovagent’s general advice.',
        });
        return;
      }
      if (path === '/products/best' && req.method === 'POST') {
        // Best value across tiers for the project's current BOM: hard rules
        // filter, Jev judges fit and quality, code picks the cheapest fit.
        if (!catalog) throw new DomainError('VALIDATION', 'Catalog is unavailable');
        if (!(await jev.configured()))
          throw new DomainError('VALIDATION', 'Jev is not configured on this server');
        const { projectId } = z
          .object({ projectId: z.string().min(1).max(160) })
          .strict()
          .parse(await body(req));
        const { workspace } = await activeRepo.read();
        if (!workspace.projects[projectId]) throw new DomainError('NOT_FOUND', 'Unknown project');
        const latestOf = (id: string) => workspace.artifacts[id]?.at(-1);
        const bomArtifact = latestOf(`${projectId}:bom`);
        if (bomArtifact?.payload.kind !== 'bom')
          throw new DomainError(
            'VALIDATION',
            'Price the plan first: there is no materials list yet',
          );
        const bom = bomArtifact.payload as BomPayload;
        const draft = latestOf(scopeDraftId(projectId))?.payload as ScopeDraft | undefined;
        const priced = await catalog.pricedOffers([
          ...new Set(bom.items.flatMap((i) => i.candidateProductIds)),
        ]);
        const candidates = valueCandidates(bom, priced);
        spendJevCall(activeRepo.ownerId);
        const { model, judged } = await jev.judgeProducts(
          {
            request: (draft?.request ?? '').replace(/^\[Example fixture\]\s*/, ''),
            design: draft?.direction
              ? `walls ${draft.direction.wallColor}; floor ${draft.direction.floorFinish}`
              : null,
          },
          candidates.map((c) => ({
            key: c.key,
            requirement: bom.items.find((i) => i.id === c.itemId)!.description,
            product: {
              name: c.priced.product.name,
              manufacturer: c.priced.product.manufacturer,
              category: c.priced.product.category,
              specs: c.priced.product.specs,
              certifications: c.priced.product.certifications,
            },
          })),
        );
        const lines = bestValue(bom, candidates, judged);
        const mid = latestOf(`${projectId}:purchase-plan:mid`)?.payload as
          | PurchasePlanPayload
          | undefined;
        const view = (c: (typeof lines)[number]['pick']) =>
          c && {
            productName: c.priced.product.name,
            manufacturer: c.priced.product.manufacturer,
            retailer: c.priced.offer.retailer,
            sku: c.priced.offer.sku,
            tier: c.priced.offer.tier,
            units: c.units,
            packQuantity: c.priced.offer.packQuantity,
            packUnit: c.priced.offer.packUnit,
            unitPriceMinor: c.priced.observation.unitPrice.amountMinor,
            totalMinor: c.totalMinor,
            shippingMinor: c.shippingMinor,
            observedAt: c.priced.observation.observedAt,
            freshness: c.priced.observation.freshness,
            source: c.priced.observation.source,
            fit: c.fit,
            quality: c.quality,
          };
        const picked = lines.filter((l) => l.pick);
        json(200, {
          model,
          lines: lines.map((l) => ({ ...l, pick: view(l.pick), upgrade: view(l.upgrade) })),
          totals: {
            bestValueMinor: picked.reduce(
              (n, l) => n + l.pick!.totalMinor + (l.pick!.shippingMinor ?? 0),
              0,
            ),
            midMinor: mid
              ? mid.lines
                  .filter((pl) => picked.some((l) => l.itemId === pl.bomItemId))
                  .reduce((n, pl) => n + pl.lineTotalMinor, 0)
              : null,
          },
          note: 'Fit and quality are the Jev model’s judgments from product specs; prices are the catalog’s dated observations, not live quotes.',
        });
        return;
      }
      if (path === '/photo/read' && req.method === 'POST') {
        // The browser sends one already-resized photo; Jev reports what it sees
        // and where. Observations only: code decides pins and suggestions.
        if (!(await jev.configured()))
          throw new DomainError('VALIDATION', 'Jev is not configured on this server');
        const input = z
          .object({
            format: z.enum(['jpg', 'png']),
            data: z
              .string()
              .max(6 * 1024 * 1024)
              .regex(/^[A-Za-z0-9+/]*={0,2}$/),
          })
          .strict()
          .parse(await body(req));
        const bytes = new Uint8Array(Buffer.from(input.data, 'base64'));
        let size: { width?: number; height?: number; type?: string };
        try {
          size = imageSize(bytes);
        } catch {
          throw new DomainError('VALIDATION', 'The photo could not be read');
        }
        const fits = (n?: number) => !!n && n >= 280 && n <= 1568;
        if (!fits(size.width) || !fits(size.height) || !['jpg', 'png'].includes(size.type ?? ''))
          throw new DomainError('VALIDATION', 'Send a JPEG or PNG 280–1568 px on each side');
        spendJevCall(activeRepo.ownerId);
        json(200, await jev.readPhoto({ format: input.format, bytes }));
        return;
      }
      if (path.startsWith('/design/')) {
        if (!design) throw new DomainError('VALIDATION', 'Design options are unavailable');
        if (path === '/design/photo' && req.method === 'POST') {
          const input = z
            .object({
              name: z.string().trim().min(1).max(200),
              label: z.string().trim().min(1).max(200),
              permission: z.string().trim().min(1).max(300),
              data: z
                .string()
                .max(20 * 1024 * 1024)
                .regex(/^[A-Za-z0-9+/]*={0,2}$/),
            })
            .strict()
            .parse(await body(req));
          json(
            200,
            await uploadDesignPhoto(design.images, activeRepo.ownerId, {
              bytes: new Uint8Array(Buffer.from(input.data, 'base64')),
              originalName: input.name,
              label: input.label,
              permission: input.permission,
            }),
          );
          return;
        }
        if (path === '/design/example-render' && req.method === 'POST') {
          // The example room's chosen finishes, rendered in 3D, made photoreal by
          // Muse. Only the named render variants are accepted; one paid call per
          // owner and variant, then the stored result is reused.
          if (!design.provider)
            throw new DomainError('VALIDATION', 'Muse is not configured on this server');
          const { variant } = z
            .object({
              variant: z.string().regex(/^done-(warm-white|sage|soft-blue)-(carpet|lvp|hardwood)$/),
            })
            .strict()
            .parse(await body(req));
          const key = `${activeRepo.ownerId}:${variant}`;
          let done = exampleRenders.get(key);
          if (!done) {
            done = renderExample(design.images, design.provider, activeRepo.ownerId, variant);
            exampleRenders.set(key, done);
            done.catch(() => exampleRenders.delete(key));
          }
          json(200, await done);
          return;
        }
        if (path === '/design/options' && req.method === 'POST') {
          const input = z
            .object({
              requestId: z.string().min(1).max(160),
              projectId: z.string().min(1).max(160),
              request: z.string().trim().min(1).max(2000),
              sourcePhotoSha256: z.string().regex(/^[a-f0-9]{64}$/),
              reported: z
                .array(
                  z
                    .object({
                      key: z.enum(['floorLengthFt', 'floorWidthFt', 'ceilingHeightFt']),
                      amount: z.number().positive().max(10000).nullable(),
                      unit: z.enum(['ft', 'in', 'm', 'cm']),
                    })
                    .strict(),
                )
                .max(5)
                .default([]),
            })
            .strict()
            .parse(await body(req));
          const result = await buildDesignOptions(activeRepo, design.images, catalog, input);
          void designWorkerFor(activeRepo)
            ?.tick()
            .catch(() => {});
          json(200, result);
          return;
        }
        if (path === '/design/revise' && req.method === 'POST') {
          const input = z
            .object({
              requestId: z.string().min(1).max(160),
              projectId: z.string().min(1).max(160),
              optionId: z.string().min(1).max(160),
              direction: z
                .object({
                  wallColor: z.string().trim().min(1).max(80).optional(),
                  floorFinish: z.string().trim().min(1).max(80).optional(),
                })
                .strict()
                .optional(),
              select: z.boolean().optional(),
              retryPreview: z.boolean().optional(),
            })
            .strict()
            .parse(await body(req));
          const result = await reviseDesignOption(activeRepo, catalog, input);
          void designWorkerFor(activeRepo)
            ?.tick()
            .catch(() => {});
          json(200, result);
          return;
        }
        if (path === '/design/summary' && req.method === 'GET') {
          json(
            200,
            await summarizeDesignOptions(
              (await activeRepo.read()).workspace,
              url.searchParams.get('projectId') || '',
              catalog,
            ),
          );
          return;
        }
      }
      if (path === '/catalog/offers' && req.method === 'GET') {
        if (!catalog) throw new DomainError('VALIDATION', 'Catalog is unavailable');
        // An absent parameter means no product filter; a present one is an exact list.
        const productIds = url.searchParams.has('productIds')
          ? (url.searchParams.get('productIds') || '')
              .split(',')
              .map((id) => id.trim())
              .filter(Boolean)
              .slice(0, 200)
          : undefined;
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
        json(200, { workspace: doc.workspace, blobs: await activeRepo.listBlobs() });
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
      if (path.startsWith('/blobs/') && req.method === 'POST') {
        // Staged upload: the raw bytes of one attachment, before the command
        // that references it. Same origin, client header and owner as commands.
        const id = decodeURIComponent(path.slice('/blobs/'.length));
        if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/.test(id))
          throw new DomainError('VALIDATION', 'Invalid attachment id');
        const mediaType = String(req.headers['content-type'] || '')
          .split(';')[0]!
          .trim();
        if (!STAGED_TYPES.has(mediaType))
          throw new DomainError('VALIDATION', 'Unsupported attachment type');
        let size = 0;
        const parts: Buffer[] = [];
        for await (const part of req) {
          size += part.length;
          if (size > STAGED_MAX) throw new DomainError('VALIDATION', 'Attachment exceeds 20 MB');
          parts.push(part);
        }
        if (!size) throw new DomainError('VALIDATION', 'Empty attachment');
        await activeRepo.stageBlob(id, mediaType, Buffer.concat(parts));
        json(200, { ok: true, id, size });
        return;
      }
      if (path.startsWith('/blobs/') && req.method === 'GET') {
        const id = decodeURIComponent(path.slice('/blobs/'.length)),
          doc = await activeRepo.read();
        if (!Object.values(doc.workspace.evidence).some((e) => e.source.attachment?.blobId === id))
          throw new DomainError('NOT_FOUND', 'Attachment not found');
        const blob = await activeRepo.readBlob(id);
        if (!blob) throw new DomainError('NOT_FOUND', 'Attachment not found');
        res.writeHead(200, {
          'Content-Type': blob.mediaType,
          'Content-Security-Policy': "sandbox; default-src 'none'",
          'Content-Disposition': 'inline',
        });
        res.end(blob.bytes);
        return;
      }
      if (path.startsWith('/studio/') && req.method === 'POST') {
        if (!studioRoute) throw new DomainError('VALIDATION', 'Image storage is unavailable');
        if (!providerConfigured)
          throw new DomainError('VALIDATION', 'Configure MUSE_API_KEY on the server first');
        const result = await studioRoute(path, activeRepo.ownerId, await body(req));
        if (result === undefined) throw new DomainError('NOT_FOUND', 'Unknown studio request');
        json(200, result);
        return;
      }
      if (path === '/photos/segment' && req.method === 'POST') {
        // SAM 3.1 outlines for one attached photo and a short phrase ("floor",
        // "vanity"). A visual aid for the viewer; nothing is saved to the project.
        if (!providerConfigured)
          throw new DomainError('VALIDATION', 'Configure MUSE_API_KEY on the server first');
        const { blobId, phrase } = z
          .object({
            blobId: z.string().min(1).max(200),
            phrase: z.string().trim().min(1).max(60),
          })
          .strict()
          .parse(await body(req));
        const doc = await activeRepo.read();
        if (
          !Object.values(doc.workspace.evidence).some((e) => e.source.attachment?.blobId === blobId)
        )
          throw new DomainError('NOT_FOUND', 'Attachment not found');
        const key = `${activeRepo.ownerId}\n${blobId}\n${phrase.toLowerCase()}`;
        let result = segmentCache.get(key);
        if (!result) {
          const blob = await activeRepo.readBlob(blobId);
          if (!blob) throw new DomainError('NOT_FOUND', 'Attachment not found');
          let mediaType: string;
          try {
            mediaType = imageMediaType(blob.bytes);
          } catch {
            throw new DomainError('VALIDATION', 'Outlines work on JPEG, PNG or WebP photos');
          }
          spendSegmentCall(activeRepo.ownerId);
          const raw = await segment({ image: { bytes: blob.bytes, mediaType }, phrase });
          result = {
            ...(await parseSegmentation(phrase, raw.text)),
            model: raw.model,
            runId: raw.runId,
          };
          segmentCache.set(key, result);
          if (segmentCache.size > SEGMENT_CACHE_SIZE)
            segmentCache.delete(segmentCache.keys().next().value!);
        }
        json(200, result);
        return;
      }
      if (path === '/model/hq-render' && req.method === 'POST') {
        if (!render)
          throw new DomainError(
            'VALIDATION',
            'High-quality renders need the Blender service (RENOVAGENT_RENDER_URL and RENOVAGENT_RENDER_TOKEN)',
          );
        const input = renderInput.parse(await body(req));
        if (JSON.stringify(input.model).length > 500_000)
          throw new DomainError('VALIDATION', 'Room model is too large to render');
        const now = Date.now();
        const recent = (hqCalls.get(activeRepo.ownerId) ?? []).filter(
          (t) => now - t < HQ_LIMIT.windowMs,
        );
        if (recent.length >= HQ_LIMIT.calls)
          throw new DomainError('VALIDATION', 'Render limit reached; try again in a few minutes');
        hqCalls.set(activeRepo.ownerId, [...recent, now]);
        const { id } = await render.submit(blenderPayload(input));
        hqJobs.set(id, activeRepo.ownerId);
        json(202, { id });
        return;
      }
      if (path.startsWith('/model/hq-render/') && req.method === 'GET') {
        const id = decodeURIComponent(path.slice('/model/hq-render/'.length));
        if (!render || hqJobs.get(id) !== activeRepo.ownerId)
          throw new DomainError('NOT_FOUND', 'Unknown render');
        const result = await render.result(id);
        if (result.status !== 'done') {
          json(200, result);
          return;
        }
        const file = (name: string) => {
          const value = result.files[name];
          if (typeof value !== 'string')
            throw new DomainError('VALIDATION', `Render is missing ${name}`);
          return value;
        };
        json(200, {
          status: 'done',
          device: result.device,
          blender: result.blender,
          interior: file('interior.png'),
          perspective: file('perspective.png'),
          plan: file('plan-top.png'),
          glb: file('room.glb'),
        });
        return;
      }
      if (path === '/model/photoreal' && req.method === 'POST') {
        // Muse Image renders an eye-level still of the measured 3D model as a
        // photo of the same room in the chosen finishes. Returned only.
        if (!providerConfigured)
          throw new DomainError('VALIDATION', 'Configure MUSE_API_KEY on the server first');
        const words = /^[\p{L}\p{N} #'(),./&-]+$/u;
        const input = z
          .object({
            image: z.string().min(1).max(8_000_000),
            wall: z.string().trim().min(1).max(80).regex(words),
            floor: z.string().trim().min(1).max(80).regex(words),
          })
          .strict()
          .parse(await body(req));
        const bytes = new Uint8Array(Buffer.from(input.image, 'base64'));
        let mediaType: string;
        try {
          mediaType = imageMediaType(bytes);
        } catch {
          throw new DomainError('VALIDATION', 'The 3D still must be JPEG, PNG or WebP');
        }
        spendRepaintCall(activeRepo.ownerId);
        const result = await repaint({
          image: { bytes, mediaType },
          prompt: `Turn this plain 3D model view into a photorealistic interior photograph of the same empty room. Keep exactly the same camera position, room shape, wall positions, proportions, ceiling height and any window or door openings. Walls painted ${input.wall}, white baseboards and ceiling, floor: ${input.floor}. Soft natural daylight. Do not add, move or remove windows, doors, furniture or fixtures.`,
        });
        json(200, {
          model: result.model,
          mediaType: imageMediaType(result.bytes),
          image: Buffer.from(result.bytes).toString('base64'),
          note: 'A generated preview, not a photo of the room; not saved to the project.',
        });
        return;
      }
      if (path === '/photos/repaint' && req.method === 'POST') {
        // A Muse Image preview of one attached photo with one outlined part
        // refinished. Returned to the viewer only; nothing is saved.
        if (!providerConfigured)
          throw new DomainError('VALIDATION', 'Configure MUSE_API_KEY on the server first');
        const { blobId, phrase, finish } = z
          .object({
            blobId: z.string().min(1).max(200),
            phrase: z
              .string()
              .trim()
              .min(1)
              .max(60)
              .regex(/^[\p{L}\p{N} '-]+$/u),
            finish: z
              .string()
              .trim()
              .min(1)
              .max(120)
              .regex(/^[\p{L}\p{N} #'(),.-]+$/u),
          })
          .strict()
          .parse(await body(req));
        const doc = await activeRepo.read();
        if (
          !Object.values(doc.workspace.evidence).some((e) => e.source.attachment?.blobId === blobId)
        )
          throw new DomainError('NOT_FOUND', 'Attachment not found');
        const blob = await activeRepo.readBlob(blobId);
        if (!blob) throw new DomainError('NOT_FOUND', 'Attachment not found');
        let mediaType: string;
        try {
          mediaType = imageMediaType(blob.bytes);
        } catch {
          throw new DomainError('VALIDATION', 'Previews work on JPEG, PNG or WebP photos');
        }
        spendRepaintCall(activeRepo.ownerId);
        const result = await repaint({
          image: { bytes: blob.bytes, mediaType },
          prompt: `Change only the ${phrase} to ${finish}. Keep everything else in the photo exactly the same: layout, furniture, fixtures, lighting, shadows and camera angle. Photorealistic.`,
        });
        json(200, {
          model: result.model,
          mediaType: imageMediaType(result.bytes),
          image: Buffer.from(result.bytes).toString('base64'),
          note: 'Generated preview; not a photo of finished work and not saved to the project.',
        });
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
    for (const worker of designWorkers.values()) void worker.tick().catch(() => {});
  }, 3000);
  server.on('close', () => {
    clearInterval(interval);
    mcp?.close();
  });
  return { server, workers, recovery };
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
  const hosting = hostingConfigFromEnv();
  const google = googleConfigFromEnv(oauthRedirect(hosting, 'google'));
  const meta = metaConfigFromEnv(oauthRedirect(hosting, 'meta'));
  const accounts =
    google || meta
      ? new AccountService(client.db(), {
          ...(google ? { google } : {}),
          ...(meta ? { meta } : {}),
        })
      : undefined;
  const catalog = new CatalogStore(client.db());
  await catalog.ensureIndexes();
  const mcpAccess = new McpAccessStore(client.db());
  await mcpAccess.ensureIndexes();
  const plans = new StudioPlanStore(client.db());
  await plans.ensureIndexes();
  const { server, workers } = await createWorkspaceServer(
    repository,
    token,
    Boolean(await configuredMuseKey()),
    accounts,
    catalog,
    new PhotoJobFiles(client.db()),
    {
      images: new DesignImageStore(client.db()),
      ...((await configuredMuseKey()) ? { provider: new MusePreviewProvider() } : {}),
    },
    hosting,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    mcpAccess,
    plans,
  );
  server.listen(hosting.listenPort, hosting.listenHost, () =>
    console.log(
      `Workspace API ready on ${hosting.listenHost}:${hosting.listenPort}${hosting.publicUrl ? ` for ${hosting.publicUrl.origin}` : ''}${hosting.staticDir ? `, serving ${hosting.staticDir}` : ''}; Mongo ${database.target} selected (${database.source}); ${accounts ? `account mode (${accounts.providers().join(' + ')} sign-in)` : 'local single-owner mode'}`,
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
