import { createHash, createHmac, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Collection, Db } from 'mongodb';

export const ACCOUNT_COOKIE = 'renovagent_account';
const SESSION_DAYS = 30;
const GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const META_GRAPH_VERSION = 'v21.0';
const META_DIALOG_URL = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;
const META_TOKEN_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`;
const META_ME_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}/me`;

export type OAuthProvider = 'google' | 'meta';

export type AccountUser = {
  _id: string;
  email: string;
  googleSub?: string;
  metaSub?: string;
  createdAt: string;
};

export type AccountSession = {
  _id: string;
  userId: string;
  expiresAt: Date;
};

export type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type MetaConfig = {
  appId: string;
  appSecret: string;
  redirectUri: string;
};

export type ProviderConfigs = { google?: GoogleConfig; meta?: MetaConfig };

export type OAuthIdentity = { sub: string; email: string };

// `publicRedirect` is the hosted callback; an explicit *_REDIRECT_URI still wins.
export function googleConfigFromEnv(publicRedirect?: string): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ||
      publicRedirect ||
      'http://127.0.0.1:8741/api/workspace/auth/google/callback',
  };
}

export function metaConfigFromEnv(publicRedirect?: string): MetaConfig | null {
  const appId = process.env.META_APP_ID || '';
  const appSecret = process.env.META_APP_SECRET || '';
  if (!appId || !appSecret) return null;
  return {
    appId,
    appSecret,
    redirectUri:
      process.env.META_REDIRECT_URI ||
      publicRedirect ||
      'http://127.0.0.1:8741/api/workspace/auth/meta/callback',
  };
}

async function defaultExchangeGoogleCode(
  config: GoogleConfig,
  code: string,
): Promise<{ idToken: string }> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!response.ok) throw new Error('Google code exchange failed');
  const data = (await response.json()) as { id_token?: string };
  if (!data.id_token) throw new Error('Google returned no identity token');
  return { idToken: data.id_token };
}

async function defaultVerifyGoogleIdToken(
  config: GoogleConfig,
  idToken: string,
): Promise<OAuthIdentity> {
  const { payload } = await jwtVerify(idToken, createRemoteJWKSet(new URL(GOOGLE_JWKS)), {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: config.clientId,
  });
  if (
    typeof payload.sub !== 'string' ||
    typeof payload.email !== 'string' ||
    !payload.email_verified
  )
    throw new Error('Google identity is missing a verified email');
  return { sub: payload.sub, email: payload.email.toLowerCase() };
}

async function defaultExchangeMetaCode(
  config: MetaConfig,
  code: string,
): Promise<{ accessToken: string }> {
  const url = new URL(META_TOKEN_URL);
  url.searchParams.set('client_id', config.appId);
  url.searchParams.set('client_secret', config.appSecret);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('code', code);
  const response = await fetch(url);
  if (!response.ok) throw new Error('Meta code exchange failed');
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('Meta returned no access token');
  return { accessToken: data.access_token };
}

async function defaultVerifyMetaToken(
  config: MetaConfig,
  accessToken: string,
): Promise<OAuthIdentity> {
  const proof = createHmac('sha256', config.appSecret).update(accessToken).digest('hex');
  const url = new URL(META_ME_URL);
  url.searchParams.set('fields', 'id,name,email');
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('appsecret_proof', proof);
  const response = await fetch(url);
  if (!response.ok) throw new Error('Meta identity lookup failed');
  const data = (await response.json()) as { id?: string; email?: string };
  if (typeof data.id !== 'string' || typeof data.email !== 'string' || !data.email)
    throw new Error('Meta identity is missing a confirmed email');
  return { sub: data.id, email: data.email.toLowerCase() };
}

export type AccountOverrides = {
  exchangeGoogleCode?: (config: GoogleConfig, code: string) => Promise<{ idToken: string }>;
  verifyGoogleIdToken?: (config: GoogleConfig, idToken: string) => Promise<OAuthIdentity>;
  exchangeMetaCode?: (config: MetaConfig, code: string) => Promise<{ accessToken: string }>;
  verifyMetaToken?: (config: MetaConfig, accessToken: string) => Promise<OAuthIdentity>;
};

export class AccountService {
  private pendingStates = new Map<string, { provider: OAuthProvider; expires: number }>();
  readonly users: Collection<AccountUser>;
  readonly sessions: Collection<AccountSession>;

  constructor(
    db: Db,
    readonly configs: ProviderConfigs,
    private overrides: AccountOverrides = {},
  ) {
    this.users = db.collection<AccountUser>('workspace_users');
    this.sessions = db.collection<AccountSession>('workspace_sessions');
  }

  providers(): OAuthProvider[] {
    return (['google', 'meta'] as const).filter((p) => this.configs[p]);
  }

  private issueState(provider: OAuthProvider): string {
    const state = randomBytes(24).toString('hex');
    this.pendingStates.set(state, { provider, expires: Date.now() + 10 * 60 * 1000 });
    return state;
  }

  googleAuthUrl(): { url: string; state: string } {
    const config = this.configs.google;
    if (!config) throw new Error('Google sign-in is not configured');
    const state = this.issueState('google');
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', config.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    return { url: url.toString(), state };
  }

  metaAuthUrl(): { url: string; state: string } {
    const config = this.configs.meta;
    if (!config) throw new Error('Meta sign-in is not configured');
    const state = this.issueState('meta');
    const url = new URL(META_DIALOG_URL);
    url.searchParams.set('client_id', config.appId);
    url.searchParams.set('redirect_uri', config.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'public_profile,email');
    url.searchParams.set('state', state);
    return { url: url.toString(), state };
  }

  consumeState(state: string, provider: OAuthProvider): boolean {
    const pending = this.pendingStates.get(state);
    this.pendingStates.delete(state);
    for (const [key, value] of this.pendingStates)
      if (value.expires < Date.now()) this.pendingStates.delete(key);
    return pending !== undefined && pending.provider === provider && pending.expires > Date.now();
  }

  async completeLogin(
    provider: OAuthProvider,
    code: string,
  ): Promise<{ token: string; user: AccountUser }> {
    let identity: OAuthIdentity;
    if (provider === 'google') {
      const config = this.configs.google;
      if (!config) throw new Error('Google sign-in is not configured');
      const exchange = this.overrides.exchangeGoogleCode ?? defaultExchangeGoogleCode;
      const verify = this.overrides.verifyGoogleIdToken ?? defaultVerifyGoogleIdToken;
      identity = await verify(config, (await exchange(config, code)).idToken);
    } else {
      const config = this.configs.meta;
      if (!config) throw new Error('Meta sign-in is not configured');
      const exchange = this.overrides.exchangeMetaCode ?? defaultExchangeMetaCode;
      const verify = this.overrides.verifyMetaToken ?? defaultVerifyMetaToken;
      identity = await verify(config, (await exchange(config, code)).accessToken);
    }
    // Provider-scoped identities only: a Meta login never merges into an
    // existing Google account by email. Explicit account linking is future work.
    const key = provider === 'google' ? 'googleSub' : 'metaSub';
    let user = await this.users.findOne({ [key]: identity.sub });
    if (!user) {
      user = {
        _id: `user:${randomBytes(16).toString('hex')}`,
        email: identity.email,
        [key]: identity.sub,
        createdAt: new Date().toISOString(),
      };
      await this.users.insertOne(user);
    }
    const token = randomBytes(32).toString('hex');
    await this.sessions.insertOne({
      _id: createHash('sha256').update(token).digest('hex'),
      userId: user._id,
      expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000),
    });
    return { token, user };
  }

  async getSession(token: string): Promise<AccountUser | null> {
    const session = await this.sessions.findOne({
      _id: createHash('sha256').update(token).digest('hex'),
    });
    if (!session || session.expiresAt.getTime() < Date.now()) return null;
    return this.users.findOne({ _id: session.userId });
  }

  async destroySession(token: string): Promise<void> {
    await this.sessions.deleteOne({ _id: createHash('sha256').update(token).digest('hex') });
  }
}

export function accountCookie(token: string, secure: boolean): string {
  return `${ACCOUNT_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/api/workspace${secure ? '; Secure' : ''}; Max-Age=${SESSION_DAYS * 24 * 3600}`;
}

export function clearAccountCookie(secure = false): string {
  return `${ACCOUNT_COOKIE}=; HttpOnly; SameSite=Lax; Path=/api/workspace${secure ? '; Secure' : ''}; Max-Age=0`;
}
