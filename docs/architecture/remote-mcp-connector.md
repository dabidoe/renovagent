# Remote MCP connector: first implementation

October 29, 2026. Implemented and tested over real HTTP/Mongo. A user-authorized temporary HTTPS test in the consumer Muse Mac app completed authenticated discovery of all ten tools and read all seven migrated projects. Muse also created one explicitly authorized QA project and reread its proposed brief; Atlas independently confirmed the exact IDs/revision and preservation of all original domain records. Stable hosting remains open.

## User outcome

A compatible remote MCP client can connect to one owner workspace, discover
saved projects/files, start a project from a casual request without an address,
and save proposals. Website and MCP use the same domain/repository and selected
database. This increment establishes the connection and durable intent; it does
not generate visual options, a materials plan or a price estimate.

The existing stdio adapter still runs. It now includes `start_project` and
`list_project_files` alongside the previous eight tools. Project context also
returns file IDs/revisions so an agent can find saved work without guessing IDs.

## Implementation and authority

- `apps/api/src/mcp-http.ts`: stateless Streamable HTTP on a separate loopback
  listener, default port 4010. Only `/mcp` exposes tools. `/` contains public
  connection documentation; `/health` reports liveness without project data.
- `apps/api/src/mcp-access.ts`: revocable, expiring owner-bound credentials,
  stored as SHA-256 hashes in `mcp_access_grants`. Authentication is checked on
  every request, including calls from already-connected clients. Lifetimes are
  1–168 hours, default 24; read-only or proposal access is selected at issue time.
- Read-only grants omit both mutation tools from discovery and cannot invoke
  them by name. Proposal grants retain the existing command allowlist and add
  bounded project creation. They cannot approve decisions, record technical
  facts, mark inspections passed or purchase anything.
- `apps/api/src/agent-projects.ts`: `start_project` atomically runs validated
  CreateProject/ProposeArtifact commands. A relayed brief is identified as an
  agent proposal. It creates no measured facts. An existing home can be reused.
  Identical retries return their original result; changed content with the same
  request ID fails without partial mutation. Request IDs are scoped by owner.
- Tool annotations distinguish reads from writes. Transport capabilities and
  granted access are returned in project context. Checkout preparation rejects
  stale/rejected plans instead of silently assembling actionable old output.
- Host/origin checks, bounded 1 MiB MCP request bodies, per-credential request
  windows and generic transport errors protect this narrow development listener.
  Browser cookies, photo bytes, catalog imports and the existing workspace HTTP
  API are not exposed through it. This is not production hosting hardening.

No long-lived MCP session holds project state. Each HTTP request constructs an
owner-scoped server; restarting/reconnecting reads durable Mongo records.
Existing provider jobs and simulated run contracts are unchanged.

## Database selection

`apps/api/src/database-config.ts` is used by the workspace API, both MCP
entrypoints, the connected launcher, catalog seed script and access CLI.

1. Process environment overrides the corresponding file variable. Files are
   read from root `.env`, then `server/.env` (the server file wins duplicates).
2. Normal selection checks `RENOVAGENT_MONGO_URI`, `WORKSPACE_MONGODB_URI`, then
   **`MONGODB_URI`**, the owner's configured cluster connection.
3. **`RENOVAGENT_MONGO_TARGET=local`** explicitly selects **`MONGODB_URI_LOCAL`**.
   Local mode rejects a non-loopback URI. Missing local configuration uses the
   project's established `127.0.0.1:27018/renovagent_workspace` default.
4. A URI without a database path selects `renovagent_workspace` rather than
   silently using Mongo's default `test`. An explicit database path is preserved.
5. A selected connection failure does not cause fallback to another database.
   Logs identify the target/variable name, never print the connection string.

The connected launcher starts local Mongo only for local selection. Database selection does not synchronize or merge records. The owner subsequently authorized the [Atlas migration](atlas-migration.md): all seven original projects were found in the pre-rename local database at port 27018, backed up, copied with history/attachments/catalog/private job files, and verified. Website/API and MCP now use that shared cluster. The older `MONGODB_URI_LOCAL` setting in `server/.env` still points to the earlier `27017/unpermitted` service and was preserved; use an explicit correct local URI when selecting that old local workspace. Browser IndexedDB originals remain separate.

## Run and issue access

From the repository root, with the existing server environment file:

```sh
npm run serve:mcp:http
```

The listener starts on `127.0.0.1:4010/mcp` and uses the selected cluster. It
does not open a tunnel or make the endpoint publicly reachable. To use local
configuration explicitly, prefix the command with `RENOVAGENT_MONGO_TARGET=local`.

Issue a connection only for the intended existing workspace owner:

```sh
npm run mcp:access -- --owner local-homeowner --name "Muse Mac test" --hours 1
npm run mcp:access -- --owner local-homeowner --name "Read only" --hours 1 --read-only
npm run mcp:access -- --owner local-homeowner --list
npm run mcp:access -- --revoke <grantId>
```

The access CLI never prints the credential. It writes a new mode-0600 file in
ignored `.local/mcp/` and prints its path, permissions and expiry. The grant is
revoked if writing that private file fails. Enter credentials only through the
client's secure setup flow; keep them out of chats, URLs, issues and logs.

Before remote pairing, configure `RENOVAGENT_MCP_PUBLIC_URL` to the canonical
HTTPS URL ending in `/mcp`, then restart this listener. Forward only port 4010
through the selected HTTPS host/tunnel; keep the workspace API off that public
surface. The public host becomes an explicit accepted Host/Origin. Forwarded
headers cannot select an owner or change the trusted-host policy.

A temporary [Cloudflare Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
is a development test option. Its URL changes when restarted and it does not
support SSE; the connector deliberately enables direct JSON responses for this
initial request/response workflow. A tunnel does not constitute stable hosting.

## Consumer Muse Mac test

The actual Muse Mac app was paired on October 29 through its custom connector secure API-key dialog. Provider: `custom.renovagent`; one exact temporary Cloudflare host, with bearer placement in the `Authorization` header. The one-hour credential was entered only in the secure field, never in chat. The server checks expiry/revocation for every call. The tunnel process also has a one-hour automatic shutdown. Only port 4010 is forwarded; the website API and photo routes stay private.

Observed successful reads:

- The app created its MCP client/connector instructions in its own workspace and discovered all ten tools with their actual schemas.
- `list_projects` with `{}` returned the seven migrated project names, matching the website and Atlas snapshot.
- A second read check using the same connection returned those same seven projects. No account reconnection or key/host change was needed.
- The shipped client template timed out during initialize with its 45-second request limit; an interactive initialize probe returned HTTP 200 after 51.6 seconds with protocol `2025-11-25`. A notification probe also stalled in that client path. The app's working client uses bounded 180-second requests and one stateless JSON-RPC call per invocation. These are observed client-path limitations; direct SDK clients and local/public HTTP tests passed. The exact contribution of interactive network approvals versus transport behavior is not established.
- Requests were approved individually for the test. Automatic approval review rejected persistent “Always allow this site” access because it exceeded the one-hour authorization. No persistent host permission was granted.

Project names returned by consumer Muse: First-floor half bath · example; Flooring · workspace check; Property workflow · public record test; Residential listing · Bingham test; Muse answers · workflow QA only; Hutchinson · home inventory; Hutchinson · inventory QA only.

The owner separately authorized one project named **QA · Muse living-room connector test**, with a proposed brief comparing hardwood with retaining the existing floor and dimensions/budget/conditions/prices explicitly unknown. This test must leave all existing owner projects unchanged. Verified write/read result:

- Project: `agent-project:e2fa554fb2e66006918a582f`, separate generated home `agent-home:e2fa554fb2e66006918a582f`.
- Brief: `agent-project:e2fa554fb2e66006918a582f:agent-brief`, revision 1, proposed/current, no acceptance.
- Stable request ID: `muse-mac-qa-20261029-living-room`.
- Consumer Muse called `start_project`, `list_project_files` and `get_artifact`, then reported the same IDs/revision and exact supplied brief. Independent Atlas read confirmed eight projects (seven originals plus QA), exactly one new brief, and unchanged original properties/projects/facts/evidence/artifacts/decisions/runs. No physical facts, estimate, design, approvals, purchases or inspection outcomes were added.
- Native Muse proof was saved privately at `/tmp/renovagent-muse-qa-success.png`. The reloaded website displayed that same project and exact brief at revision 1; screenshot `/tmp/renovagent-atlas-muse-brief.png`. Website verification is also recorded alongside the Atlas migration evidence. The request had separate explicit user approval after automatic review rejected creating persistent QA records under the connection test alone.

OAuth account linking, reviewed directory distribution, stable HTTPS hosting, attachment transfer through MCP, model planning and visual options remain future increments. A one-hour development connection is not production hosting.

## Verification

- Six new real HTTP/Mongo scenarios: casual intake and retry/reconnect; owner
  isolation/read-only enforcement; expiry/revocation/malformed credentials;
  Host/Origin/method/body boundaries; rate limiting; existing-home reuse and
  rollback. Raw HTTP tests exercise Host independently of fetch normalization.
- Two non-Mongo configuration scenarios check cluster/local selection, file and
  environment precedence, omitted database paths and invalid local settings.
- Connected suites: **24/24 passed** on isolated temporary local databases.
- Regular tests: **148 passed** (15 legacy + 133 TypeScript), 23 Mongo scenarios
  skipped without the explicit test URI. Types, boundaries, builds and formatting
  passed. The existing frontend bundle-size advisory remains.
- Consumer Muse completed authenticated discovery and migrated-project reads through the temporary HTTPS connector. The separately authorized QA project write/read check also passed, with independent Atlas verification. Product-wide purchasing correctness is not established; other commerce defects from the earlier review remain open.
