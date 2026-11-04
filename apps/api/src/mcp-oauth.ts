import { createHash, randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Collection } from 'mongodb';
import { z } from 'zod';
import { DomainError } from '@renovagent/contracts';
import { McpAccessStore } from './mcp-access.js';

const READ = 'renovagent:read';
const PROPOSE = 'renovagent:propose';
const SCOPES = [READ, PROPOSE];
const secret = () => randomBytes(32).toString('base64url');
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const challenge = (s: string) => createHash('sha256').update(s).digest('base64url');
const opaque = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const redirect = z
  .string()
  .max(2048)
  .url()
  .refine((s) => {
    const u = new URL(s);
    return (
      !u.username &&
      !u.password &&
      !u.hash &&
      (u.protocol === 'https:' ||
        (u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)))
    );
  });
const registration = z
  .object({
    client_name: z.string().trim().min(1).max(60).default('MCP agent'),
    redirect_uris: z.array(redirect).min(1).max(10),
    token_endpoint_auth_method: z.literal('none').default('none'),
    grant_types: z.array(z.literal('authorization_code')).length(1).default(['authorization_code']),
    response_types: z.array(z.literal('code')).length(1).default(['code']),
  })
  .strip();
type Client = z.infer<typeof registration> & { _id: string; expiresAt: Date };
type Request = {
  _id: string;
  clientId: string;
  name: string;
  redirectUri: string;
  resource: string;
  scope: string;
  state?: string;
  codeChallenge: string;
  expiresAt: Date;
};
type Code = Request & { ownerId: string };
class OAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
function invalid(message: string): never {
  throw new OAuthError('invalid_request', message);
}

// Public OAuth requests never choose a workspace. Only the existing authenticated,
// same-origin owner API can approve a request. Codes are hashed, short-lived,
// client/redirect/resource/PKCE-bound and atomically consumed across instances.
export class McpOAuth {
  readonly clients: Collection<Client>;
  readonly requests: Collection<Request>;
  readonly codes: Collection<Code>;
  private windows = new Map<string, { start: number; count: number }>();
  constructor(readonly access: McpAccessStore) {
    this.clients = access.db.collection<Client>('mcp_oauth_clients');
    this.requests = access.db.collection<Request>('mcp_oauth_requests');
    this.codes = access.db.collection<Code>('mcp_oauth_codes');
  }
  async ensure() {
    await Promise.all(
      [this.clients, this.requests, this.codes].map((c) =>
        c.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      ),
    );
  }
  private async pending(id: string) {
    if (!opaque.safeParse(id).success)
      throw new DomainError(
        'NOT_FOUND',
        'Pairing request is invalid or expired. Start connecting again in your agent.',
      );
    const request = await this.requests.findOne({ _id: id, expiresAt: { $gt: new Date() } });
    if (!request)
      throw new DomainError(
        'NOT_FOUND',
        'Pairing request is invalid or expired. Start connecting again in your agent.',
      );
    return request;
  }
  async describe(id: string) {
    const r = await this.pending(id);
    return {
      name: r.name,
      callback: r.redirectUri,
      access: r.scope.split(' ').includes(PROPOSE) ? 'propose' : 'read',
      expiresAt: r.expiresAt,
    };
  }
  async decide(id: string, ownerId: string, approve: boolean) {
    const r = await this.pending(id);
    if (approve && (await this.access.active(ownerId)).length >= 5)
      throw new DomainError(
        'VALIDATION',
        'Up to five connections at a time; remove one on the connection page first.',
      );
    const taken = await this.requests.findOneAndDelete({ _id: id, expiresAt: { $gt: new Date() } });
    if (!taken)
      throw new DomainError(
        'CONFLICT',
        'This pairing request has already been answered. Start connecting again in your agent.',
      );
    const to = new URL(r.redirectUri);
    if (r.state !== undefined) to.searchParams.set('state', r.state);
    if (!approve) to.searchParams.set('error', 'access_denied');
    else {
      const code = secret();
      await this.codes.insertOne({
        ...r,
        _id: hash(code),
        ownerId,
        expiresAt: new Date(Date.now() + 60_000),
      });
      to.searchParams.set('code', code);
    }
    return { redirect: to.href };
  }
  async handle(
    req: IncomingMessage,
    res: ServerResponse,
    origin: string,
    approvalOrigin = origin,
  ): Promise<boolean> {
    const url = new URL(req.url || '/', origin);
    const path = url.pathname;
    if (
      !path.startsWith('/oauth/') &&
      ![
        '/.well-known/oauth-authorization-server',
        '/.well-known/oauth-protected-resource',
        '/.well-known/oauth-protected-resource/mcp',
      ].includes(path)
    )
      return false;
    const json = (status: number, value: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(value));
    };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return true;
    }
    const resource = `${origin}/mcp`;
    try {
      if (path.startsWith('/.well-known/') && req.method === 'GET') {
        json(
          200,
          path.includes('oauth-protected-resource')
            ? {
                resource,
                authorization_servers: [origin],
                scopes_supported: SCOPES,
                bearer_methods_supported: ['header'],
                resource_name: 'Renovagent workspace',
              }
            : {
                issuer: origin,
                authorization_endpoint: `${origin}/oauth/authorize`,
                token_endpoint: `${origin}/oauth/token`,
                registration_endpoint: `${origin}/oauth/register`,
                revocation_endpoint: `${origin}/oauth/revoke`,
                response_types_supported: ['code'],
                grant_types_supported: ['authorization_code'],
                token_endpoint_auth_methods_supported: ['none'],
                code_challenge_methods_supported: ['S256'],
                scopes_supported: SCOPES,
              },
        );
        return true;
      }
      // Bounded per-process abuse guard; durable codes and grants live in Mongo.
      const now = Date.now();
      for (const [k, v] of this.windows) if (now - v.start >= 60_000) this.windows.delete(k);
      const key = req.socket.remoteAddress ?? 'unknown';
      const window = this.windows.get(key) ?? { start: now, count: 0 };
      this.windows.set(key, window);
      if (++window.count > 120) {
        res.setHeader('Retry-After', '60');
        json(429, { error: 'temporarily_unavailable' });
        return true;
      }
      if (path === '/oauth/authorize' && req.method === 'GET') {
        for (const key of new Set(url.searchParams.keys()))
          if (url.searchParams.getAll(key).length !== 1)
            invalid('Duplicate authorization parameter');
        const p = Object.fromEntries(url.searchParams);
        if (
          p.response_type !== 'code' ||
          p.code_challenge_method !== 'S256' ||
          !opaque.safeParse(p.code_challenge).success
        )
          invalid('Authorization code with S256 PKCE is required');
        const client = await this.clients.findOne({
          _id: p.client_id,
          expiresAt: { $gt: new Date() },
        });
        if (!client || !client.redirect_uris.includes(p.redirect_uri))
          invalid('Register a client and use its exact redirect URI');
        if (p.resource !== resource) invalid('The resource must be this site’s /mcp URL');
        const scopes = [...new Set((p.scope || READ).split(' '))];
        if (scopes.some((s) => !SCOPES.includes(s)))
          throw new OAuthError('invalid_scope', 'Unsupported scope');
        if (p.state && p.state.length > 2048) invalid('State is too long');
        const id = secret();
        await this.requests.insertOne({
          _id: id,
          clientId: client._id,
          name: client.client_name,
          redirectUri: p.redirect_uri,
          resource,
          scope: scopes.join(' '),
          ...(p.state !== undefined ? { state: p.state } : {}),
          codeChallenge: p.code_challenge,
          expiresAt: new Date(Date.now() + 10 * 60_000),
        });
        res.writeHead(302, { Location: `${approvalOrigin}/#connect/approve/${id}` });
        res.end();
        return true;
      }
      if (
        req.method !== 'POST' ||
        !['/oauth/register', '/oauth/token', '/oauth/revoke'].includes(path)
      ) {
        json(404, { error: 'invalid_request' });
        return true;
      }
      let size = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        const b = Buffer.from(chunk);
        size += b.length;
        if (size > 16384) invalid('Request too large');
        chunks.push(b);
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      if (path === '/oauth/register') {
        if (!req.headers['content-type']?.startsWith('application/json'))
          invalid('Registration requires JSON');
        const input = registration.parse(JSON.parse(raw));
        const client: Client = {
          ...input,
          _id: secret(),
          expiresAt: new Date(Date.now() + 30 * 86400_000),
        };
        await this.clients.insertOne(client);
        json(201, {
          ...input,
          client_id: client._id,
          client_id_issued_at: Math.floor(Date.now() / 1000),
        });
        return true;
      }
      if (!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded'))
        invalid('Token requests require form encoding');
      const params = new URLSearchParams(raw);
      for (const key of new Set(params.keys()))
        if (params.getAll(key).length !== 1) invalid('Duplicate token parameter');
      const p = Object.fromEntries(params);
      if (path === '/oauth/revoke') {
        const grant = await this.access.authenticate(p.token || '');
        if (grant?.clientId && grant.clientId === p.client_id) await this.access.revoke(grant._id);
        json(200, {});
        return true;
      }
      if (p.grant_type !== 'authorization_code')
        throw new OAuthError('unsupported_grant_type', 'Reconnect to renew access');
      if (!/^[A-Za-z0-9._~-]{43,128}$/.test(p.code_verifier || ''))
        invalid('A PKCE verifier is required');
      if (p.resource !== resource) invalid('The resource must be this site’s /mcp URL');
      const code = await this.codes.findOneAndDelete({
        _id: hash(p.code || ''),
        clientId: p.client_id,
        redirectUri: p.redirect_uri,
        resource,
        codeChallenge: challenge(p.code_verifier),
        expiresAt: { $gt: new Date() },
      });
      if (!code)
        throw new OAuthError(
          'invalid_grant',
          'Authorization code is invalid, expired or already used',
        );
      if ((await this.access.active(code.ownerId)).length >= 5)
        throw new OAuthError('access_denied', 'Remove an existing connection and reconnect');
      const { token } = await this.access.issue({
        ownerId: code.ownerId,
        name: code.name,
        access: code.scope.split(' ').includes(PROPOSE) ? 'propose' : 'read',
        hours: 168,
        clientId: code.clientId,
        resource,
      });
      json(200, {
        access_token: token,
        token_type: 'Bearer',
        expires_in: 7 * 86400,
        scope: code.scope,
      });
    } catch (e) {
      json(
        e instanceof OAuthError
          ? 400
          : e instanceof z.ZodError || e instanceof SyntaxError
            ? 400
            : 500,
        {
          error:
            e instanceof OAuthError
              ? e.code
              : e instanceof z.ZodError || e instanceof SyntaxError
                ? 'invalid_request'
                : 'server_error',
          error_description:
            e instanceof OAuthError ? e.message : 'The connection request could not be completed',
        },
      );
    }
    return true;
  }
}
