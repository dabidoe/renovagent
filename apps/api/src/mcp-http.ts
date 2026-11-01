import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { MongoWorkspaceRepository } from './repository.js';
import { CatalogStore } from './catalog.js';
import { McpAccessStore } from './mcp-access.js';
import { createWorkspaceMcpServer } from './mcp.js';
import { DesignImageStore } from './design-images.js';
import { workspaceMongoConfig } from './database-config.js';

export type McpHttpOptions = {
  publicUrl?: string;
  requestsPerMinute?: number;
  images?: DesignImageStore;
};

export function mcpPublicUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/mcp'
  )
    throw new Error('RENOVAGENT_MCP_PUBLIC_URL must be an HTTPS URL ending in /mcp');
  return url;
}

// A separate, narrow listener keeps the existing loopback API, browser session
// endpoints and photo assets out of a remote connector's exposed surface.
export function createMcpHttpServer(
  repository: MongoWorkspaceRepository,
  access: McpAccessStore,
  catalog?: CatalogStore,
  options: McpHttpOptions = {},
) {
  const publicUrl = options.publicUrl ? mcpPublicUrl(options.publicUrl) : undefined;
  const endpoint = mcpEndpoint(repository, access, catalog, options);
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const fail = (status: number, message: string) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    };
    try {
      const bound = server.address();
      const port = bound && typeof bound !== 'string' ? bound.port : 4010;
      const hosts = new Set([
        `127.0.0.1:${port}`,
        `localhost:${port}`,
        ...(publicUrl ? [publicUrl.host] : []),
      ]);
      // Validate Host/Origin before auth. Forwarded headers never choose scope,
      // auth policy, redirects or trusted origins.
      if (
        !req.headers.host ||
        !hosts.has(req.headers.host) ||
        !allowedOrigin(req, publicUrl, port)
      ) {
        fail(403, 'Origin or host is not allowed');
        return;
      }
      if (req.url === '/health' && req.method === 'GET') {
        fail(200, 'Renovagent MCP is running');
        return;
      }
      if (req.url === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(
          [
            'Renovagent — private project connector (development preview)',
            '',
            `MCP endpoint: ${publicUrl?.href ?? 'Configure a public HTTPS /mcp URL before connecting a remote agent.'}`,
            'Transport: stateless Streamable HTTP; JSON responses. POST /mcp.',
            'Authentication: API key sent as Authorization: Bearer <credential>.',
            'Enter the key only in the client secure credential setup. Never send it in a chat or URL.',
            'The credential selects one workspace. It expires and can be revoked. Each request rechecks access.',
            '',
            'Read tools: list_homes, list_projects, get_project_context, list_project_files, get_artifact, search_catalog, get_offer_history, build_checkout_review, list_floor_styles, find_paint_color, plan_paint_and_floor.',
            'Proposal tools (only when granted): start_project, propose_project_change.',
            'List the actual tools and read their schemas before invoking them. Read-only credentials do not expose proposal tools.',
            'Project creation saves intent and a proposed brief only; it does not generate a design or estimate.',
            'Proposals cannot accept decisions, verify facts, pass inspections or purchase anything.',
            'There is no public workspace API, browser login, attachment access or catalog-import endpoint on this listener.',
            '',
            'Start with list_projects to verify the intended workspace. Use a stable requestId when starting a project.',
          ].join('\n'),
        );
        return;
      }
      if (req.url !== '/mcp') {
        fail(404, 'Not found');
        return;
      }
      await endpoint.handle(req, res);
    } catch {
      // Request bodies, authorization headers and provider errors never enter
      // logs or unauthenticated responses.
      if (!res.headersSent) fail(500, 'Connector request failed');
      else res.end();
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.maxHeadersCount = 40;
  server.on('close', () => endpoint.close());
  return server;
}

// The authenticated /mcp endpoint, shared by this listener and the hosted
// workspace server. The caller checks Host and Origin first. Only a
// connector credential (Bearer) is accepted, never a browser session; each
// request gets a server scoped to the credential's owner.
export function mcpEndpoint(
  repository: MongoWorkspaceRepository,
  access: McpAccessStore,
  catalog?: CatalogStore,
  options: { requestsPerMinute?: number; images?: DesignImageStore } = {},
) {
  const windows = new Map<string, { start: number; count: number }>();
  const active = new Set<ReturnType<typeof createWorkspaceMcpServer>>();
  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const fail = (status: number, message: string) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    };
    res.setHeader('Cache-Control', 'no-store');
    try {
      const match = req.headers.authorization?.match(/^Bearer (reno_[A-Za-z0-9_-]{43})$/);
      const grant = match ? await access.authenticate(match[1]) : null;
      if (!grant) {
        res.setHeader('WWW-Authenticate', 'Bearer realm="renovagent", error="invalid_token"');
        fail(401, 'An active Renovagent connector credential is required');
        return;
      }
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        fail(405, 'This stateless MCP endpoint accepts POST requests');
        return;
      }
      const now = Date.now();
      for (const [key, value] of windows) if (now - value.start >= 60_000) windows.delete(key);
      const window = windows.get(grant._id) ?? { start: now, count: 0 };
      window.count++;
      windows.set(grant._id, window);
      if (window.count > (options.requestsPerMinute ?? 120)) {
        res.setHeader(
          'Retry-After',
          String(Math.max(1, Math.ceil((window.start + 60_000 - now) / 1000))),
        );
        fail(429, 'Connector request limit reached; retry shortly');
        return;
      }
      const ownerRepository = repository.forUser(grant.ownerId);
      // Revoked/deleted workspaces never get recreated by a remote request.
      await ownerRepository.read();
      const mcp = createWorkspaceMcpServer(ownerRepository, catalog, {
        access: grant.access,
        transport: 'streamable-http',
        ...(options.images ? { images: options.images } : {}),
      });
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
        maxRequestBodySize: 1024 * 1024,
      });
      active.add(mcp);
      res.on('close', () => {
        active.delete(mcp);
        void mcp.close().catch(() => {});
      });
      await mcp.connect(transport);
      await transport.handleRequest(req, res);
    } catch {
      // Request bodies, authorization headers and provider errors never enter
      // logs or unauthenticated responses.
      if (!res.headersSent) fail(500, 'Connector request failed');
      else res.end();
    }
  };
  const close = () => {
    windows.clear();
    for (const mcp of active) void mcp.close().catch(() => {});
    active.clear();
  };
  return { handle, close };
}

function allowedOrigin(req: IncomingMessage, publicUrl: URL | undefined, port: number) {
  const origin = req.headers.origin;
  if (origin === undefined) return true; // Server-to-server MCP clients.
  return new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`, publicUrl?.origin]).has(
    origin,
  );
}

async function main() {
  const database = await workspaceMongoConfig();
  const port = Number(process.env.RENOVAGENT_MCP_PORT ?? 4010);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid MCP port');
  const { repository, client } = await MongoWorkspaceRepository.connect(database.uri);
  try {
    const catalog = new CatalogStore(client.db());
    const access = new McpAccessStore(client.db());
    await access.ensureIndexes();
    await catalog.ensureIndexes();
    const server = createMcpHttpServer(repository, access, catalog, {
      publicUrl: process.env.RENOVAGENT_MCP_PUBLIC_URL,
      images: new DesignImageStore(client.db()),
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
    console.log(
      `Renovagent MCP ready on 127.0.0.1:${port}/mcp; Mongo ${database.target} selected (${database.source}); authentication required`,
    );
    const stop = () => server.close(() => void client.close());
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  } catch (error) {
    await client.close();
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error('MCP startup failed; check Mongo, port and public URL configuration.');
    process.exitCode = 1;
  });
}
