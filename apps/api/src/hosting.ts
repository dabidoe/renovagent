import { readFile, stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

// Where the API listens and which browser origin it trusts. With nothing set it
// stays the loopback development server. A public deployment names its one
// origin in RENOVAGENT_PUBLIC_URL; the site and API are then served from that
// origin, so the cookie and same-origin checks work without CORS.
export type HostingConfig = {
  listenHost: string;
  listenPort: number;
  publicUrl?: URL;
  staticDir?: string;
};

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);

export function hostingConfigFromEnv(env: NodeJS.ProcessEnv = process.env): HostingConfig {
  const listenHost = env.RENOVAGENT_HOST || '127.0.0.1';
  const listenPort = Number(env.PORT || env.RENOVAGENT_PORT || 4000);
  if (!Number.isInteger(listenPort) || listenPort < 1 || listenPort > 65535)
    throw new Error('Invalid API port');
  let publicUrl: URL | undefined;
  if (env.RENOVAGENT_PUBLIC_URL) {
    publicUrl = new URL(env.RENOVAGENT_PUBLIC_URL);
    if (publicUrl.pathname !== '/' || publicUrl.search || publicUrl.hash)
      throw new Error('RENOVAGENT_PUBLIC_URL must be an origin, like https://example.com');
    if (publicUrl.protocol !== 'https:' && !LOOPBACK.has(publicUrl.hostname))
      throw new Error('RENOVAGENT_PUBLIC_URL must use https');
  }
  if (!LOOPBACK.has(listenHost) && !publicUrl)
    throw new Error('Listening beyond loopback needs RENOVAGENT_PUBLIC_URL');
  const staticDir = env.RENOVAGENT_STATIC_DIR ? resolve(env.RENOVAGENT_STATIC_DIR) : undefined;
  return {
    listenHost,
    listenPort,
    ...(publicUrl ? { publicUrl } : {}),
    ...(staticDir ? { staticDir } : {}),
  };
}

export const localHosting: HostingConfig = { listenHost: '127.0.0.1', listenPort: 4000 };

export const isPublic = (h: HostingConfig) =>
  Boolean(h.publicUrl && !LOOPBACK.has(h.publicUrl.hostname));

// The loopback dev origins always work; the public origin is added when set.
export function trustedOrigins(h: HostingConfig, port: number) {
  const origins = new Set([
    'http://127.0.0.1:8741',
    'http://localhost:8741',
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
  ]);
  if (h.publicUrl) origins.add(h.publicUrl.origin);
  return origins;
}

export function trustedHost(h: HostingConfig, port: number, host: string) {
  if (new RegExp(`^(127\\.0\\.0\\.1|localhost):(${port}|8741)$`).test(host)) return true;
  return Boolean(h.publicUrl && host === h.publicUrl.host);
}

// Secure cookies whenever the public origin is https (TLS ends at the host's proxy).
export const secureCookies = (h: HostingConfig) => h.publicUrl?.protocol === 'https:';

export const oauthRedirect = (h: HostingConfig, provider: 'google' | 'meta') =>
  h.publicUrl ? `${h.publicUrl.origin}/api/workspace/auth/${provider}/callback` : undefined;

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

// Serves the built site (`npm run build` → dist/): the React app with the landing
// at /, as in development. Returns false
// for paths it does not own, so the API routes run as before. Hashed assets are
// cached for a year; pages are revalidated so a deploy shows up at once.
export async function serveStatic(dir: string, req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const pathname = decodeURIComponent(new URL(req.url || '/', 'http://x').pathname);
  if (pathname.startsWith('/api/') || pathname === '/mcp' || pathname.startsWith('/mcp/'))
    return false;
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = normalize(join(dir, relative));
  if (file !== dir && !file.startsWith(dir + sep)) return false;
  const type = TYPES[extname(file).toLowerCase()];
  const found = type && (await stat(file).catch(() => null))?.isFile();
  const target = found ? file : join(dir, '404.html');
  const body = await readFile(target).catch(() => null);
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  if (!found) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : (body ?? 'Not found'));
    return true;
  }
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': relative.startsWith('assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
  });
  res.end(req.method === 'HEAD' ? undefined : body);
  return true;
}
