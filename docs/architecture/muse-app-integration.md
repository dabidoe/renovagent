# Muse app integration assessment

October 29, 2026. Research verdict on connecting Renovagent to Meta Muse
(the consumer personal agent at muse.ai and on iOS/Android), not Muse Code
(the developer CLI this session runs in, which already works with our local
stdio MCP server).

## Verdict: feasible, but it requires the hosted backend

Muse runs in Meta's cloud on a per-user Secure VM. It can build its own
integration to any service with a public API or MCP server, but it cannot
reach `127.0.0.1` on our laptop. There is no path from the Muse app to this
repository's loopback servers. "Seamless" is achievable, but only after a
hosted HTTPS endpoint exists — that is precisely the backend work currently
deferred. Meta Login does not itself connect Muse; it only aligns identity so
the eventual connection has less account friction.

## How Muse connects to third-party services

Three paths, confirmed by Meta docs and independent tests:

1. **Built-in connectors** (Meta-built, reviewed): Gmail, Calendar, Spotify,
   Plaid, etc. Added only through partnership with Meta. Not our near-term path.
2. **Custom connectors** (user-built, unreviewed): the user asks Muse in chat
   to connect to a service. Muse writes its own client on its VM from the
   service's API docs or MCP URL, stores credentials in its Secure Credentials
   Store, and saves the integration as a reusable skill. One independent test
   connected a hosted MCP server with a single message in under a minute.
   Transport for MCP is **Streamable HTTP**, remote only.
3. **Browser fallback**: Muse drives Chromium for sites with no API. Works,
   fragile, expensive. Not a strategy.

Sources: [custom integrations guide](https://parallel.ai/articles/meta-muse-custom-integrations),
[MCP support analysis](https://www.aiagentslibrary.com/blog/meta-muse-mcp/),
[connector submission notes](https://shipwithmuse.live/blog/muse-connectors-guide),
[example MCP integration](https://github.com/helium10/helium10-mcp).
A reviewed third-party directory is reported (apply at muse.ai/platform with a
hosted HTTPS MCP endpoint plus docs and auth), but reporting conflicts on
whether submissions are open; verify before relying on it.

## What we must build, in order

1. **Meta login** — done. Same-identity sign-in reduces friction later.
2. **Streamable-HTTP MCP transport** with token auth on our current tools
   (reads + proposals). Small slice: same repository and validation, new
   transport. Immediately testable through a temporary tunnel; internet-facing
   even temporarily, so the token is mandatory, not optional.
3. **Hosted HTTPS endpoint + OAuth** as our own authorization server. Then the
   user flow is one message: "connect to my Renovagent workspace at
   https://…" plus a browser OAuth approval. Muse saves it as a skill and the
   connection persists.
4. **Reviewed directory listing** (if/when submissions are open): listing
   details, endpoint, docs, auth method, Meta functional/security/legal review.

## What this means for the deferred backend

Step 2 is buildable without production hosting (tunnel demo), but anything a
real user would call "integrated with my Muse" needs step 3: a stable host,
TLS, our OAuth server, per-user token scoping, and abuse/rate controls. That
is the deferred backend. Until then, the honest statement is: Muse Code works
today over local stdio; the Muse app path is designed and blocked on hosting.

## Open questions for the hosting slice

- OAuth scopes: read-only vs proposal-capable connectors as separate grants.
- Per-user MCP tokens vs one OAuth client: hedging toward per-user tokens
  minted at pairing time (fits the recorded magic-link pairing design).
- Rate/abuse limits on agent-driven reads and proposals.
- Whether to seek directory listing or stay with user-built custom connectors.
