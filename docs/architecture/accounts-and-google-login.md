# Accounts: Google and Meta login (current stack)

October 29, 2026. Implemented locally: Google and Meta (Facebook Login)
sign-in, server sessions, and per-owner workspaces on `apps/api`. Password
login was explicitly deferred; no passwords are stored anywhere.

## Behavior

- Default is unchanged: without provider credentials the API runs in local
  single-owner mode with the existing local token cookie.
- With either provider configured, the API runs in account mode. Each login
  identity gets its own user record, session, and workspace aggregate; users
  cannot read or write each other's data.
- Identities are provider-scoped: a Meta login never merges into an existing
  Google account by email, even when the addresses match. Explicit account
  linking is future work.
- Login is a server-side authorization-code flow per provider. Google verifies
  the ID token (issuer, audience, verified email); Meta exchanges the code and
  verifies identity through the Graph API with `appsecret_proof` and a
  confirmed email. Either path creates a 30-day httpOnly session cookie and
  redirects home; failures redirect to `/?auth=error` with no session.
- First connect explicitly adopts the local workspace into the signed-in
  account (owner remap at import). The local original stays intact.
- The web app shows one sign-in button per configured provider, falls back
  to local records instead of a dead-end error page, and shows the signed-in
  email with sign-out in the header. Session state is readable at
  `GET /auth/me`; `POST /auth/logout` destroys the session and clears the cookie.
- Photo jobs keep working per owner: each account aggregate gets its own
  worker, pre-warmed at boot.

## Setup (owner action, cannot be done in code)

Google:

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select
   a project and configure the OAuth consent screen (External): app name,
   support email, and the `openid`, `email`, `profile` scopes. While the app
   is in testing, add each Google account under test users.
2. Under Credentials, create an OAuth client ID (Web application) with this
   exact authorized redirect URI:
   `http://127.0.0.1:8741/api/workspace/auth/google/callback`
3. Export the credentials server-side only (never in source or client bundles):
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Optional override:
   `GOOGLE_REDIRECT_URI` (for a second loopback address or a future host).

Meta:

1. In [Meta for Developers](https://developers.facebook.com/), create an app,
   add the Facebook Login product, and set the valid OAuth redirect URI to
   `http://127.0.0.1:8741/api/workspace/auth/meta/callback`
2. Request the `email` permission. Test users (Roles) can sign in immediately;
   public users need App Review for `email` before it works for them.
3. Export server-side only: `META_APP_ID`, `META_APP_SECRET`. Optional
   override: `META_REDIRECT_URI`.

Then restart the connected stack (`npm run dev:connected`). The workspace shows
sign-in; after login, Connect transfers local work into the account.

## Verification

- `tests/integration/accounts.test.ts` (in `npm run test:connected`): stubbed
  Google and Meta login over real HTTP on ephemeral ports — redirect shapes,
  callback session cookies, `/auth/me`, local-to-account adoption with owner
  remap, two-owner isolation, bad-state rejection, logout, unchanged local
  mode, and same-email Meta/Google logins staying separate.
- Boot-path probe: env parsing, default redirect URI, auth-URL shape, and
  single-use state with replay rejection — verified; temp databases dropped.
- Full gates: `npm test` (15 legacy + 124 passed, 11 Mongo cases skip without
  the test URI), `npm run test:connected` (12 passed), production and
  foundation builds, strict TypeScript, import boundaries, formatting.
- Not verifiable here: the live provider round-trips need the owner's OAuth
  clients and browser. Interactive banner/redirect QA is pending that setup.

## Limits and next steps

- Google and Meta OAuth only. Email/password is not implemented; the legacy
  demo server's bcrypt/Firebase stubs remain untouched on the old model.
- No cross-provider account linking yet.
- OAuth state lives in server memory: fine for one local process, a shared
  store is required before any multi-process hosting.
- Sessions are 30-day opaque tokens (sha256 hashes in Mongo). No refresh
  rotation or device list yet.
- The stdio MCP adapter stays local single-owner; remote agent access needs
  token auth on a future hosted transport. See the
  [Muse app integration assessment](muse-app-integration.md).
- Recorded next step: magic-link pairing so a personal agent can join an
  account workspace with explicit consent. Shopping and contractor agents do
  not exist yet; there is nothing to plug pairing into on that side.
