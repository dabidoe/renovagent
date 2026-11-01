# Current-workspace MCP adapter (local stdio)

October 29, 2026. Implemented locally: a standard MCP server over the real
workspace repository, verified with integration tests, a raw-protocol probe,
and a live headless Muse client run.

## What was built

`apps/api/src/mcp.ts` exposes the connected workspace through eight MCP tools,
served over stdio for a local agent client:

| Tool                                                              | Result and authority                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_homes` / `list_projects`                                    | Local properties and projects; no cross-owner discovery                                                                                                                                                                                                                                                                                                                                                                                                           |
| `get_project_context`                                             | Goal, current facts, uncertainties, evidence metadata (no bytes), input revisions, capabilities                                                                                                                                                                                                                                                                                                                                                                   |
| `get_artifact`                                                    | One artifact revision with freshness and limitations; historical views stay pinned                                                                                                                                                                                                                                                                                                                                                                                |
| `propose_project_change`                                          | Allowlisted commands (`ProposeArtifact`, `SaveDraft`, `AppendMessage`) through shared validation and atomic CAS; anything else returns an explicit capability limit                                                                                                                                                                                                                                                                                               |
| `search_catalog` / `get_offer_history`                            | Shared products with offers, latest dated prices, and price history                                                                                                                                                                                                                                                                                                                                                                                               |
| `build_checkout_review`                                           | Computation-only checkout assembly from a stored plan; stores nothing                                                                                                                                                                                                                                                                                                                                                                                             |
| `list_floor_styles` / `find_paint_color` / `plan_paint_and_floor` | The paint-and-floor studio for agents: floor styles (looks, not products), a paint name or hex resolved to a loaded brand colour, and rooms priced with the studio's quantities and labelled demo prices plus a shopping list; computation only, stores nothing                                                                                                                                                                                                   |
| `save_plan`                                                       | Hosted endpoint, propose credentials only: saves the agent's paint-and-floor choices (not prices) to the credential owner's `studio_plans`, idempotent by `requestId`, at most 50 per owner, and returns `<public origin>/#plan/<id>`. The page recomputes quantities and demo prices, shows photo-less rooms in 3D, and opens only for the signed-in owner (others get 404, signed-out 403); sign-in returns to the link. Edits on the page stay in that browser |
| `save_inspiration`, `list_inspiration`                            | Hosted endpoint, propose credentials only: add a link and/or a photo the agent already holds (base64, under about 600 KB) to the owner's studio inspiration board (`inspiration_finds`), idempotent by `requestId`, 100 per owner, http/https links never fetched, no prices; list the board. The owner sees finds as "Found by <agent> · not checked"                                                                                                            |

Reads and proposals share the web app's repository (`MongoWorkspaceRepository`),
revision checks, idempotency records, and receipts. Calculations stay in core;
no formulas are duplicated in tool prompts. A stored proposal is not approval:
customer approval and qualified review remain distinct.

The legacy `server/src/mcp.ts` is untouched and still must not be presented as
workspace integration; it uses the old flat project model.

## Run it

The adapter needs the local Mongo workspace only (not the HTTP API):

```bash
npm run dev:mongo   # one terminal: persistent local MongoDB on 127.0.0.1:27018
RENOVAGENT_MONGO_URI=mongodb://127.0.0.1:27018/renovagent_workspace npm run serve:mcp
```

For an isolated database (tests, demos), point `RENOVAGENT_MONGO_URI` at a
fresh database name instead; the server upserts an empty owner workspace.

## Connect a Muse client

Add a stdio entry under `mcpServers` (launch the client from the repo root so
`tsx` resolves, or substitute an absolute import path):

```json
{
  "mcpServers": {
    "renovagent": {
      "command": "node",
      "args": ["--import", "tsx", "<repo-root>/apps/api/src/mcp.ts"],
      "env": { "RENOVAGENT_MONGO_URI": "mongodb://127.0.0.1:27018/renovagent_workspace" }
    }
  }
}
```

Keep the URI in the environment, never in source. The CLI accepts the same
entry per-run via `-c 'mcpServers.renovagent={...}'` with the URI passed as a
whole-value `${VAR}`.

## Verification

- `tests/integration/mcp-workspace.test.ts`: three integration scenarios over a
  real MCP client against isolated temp databases — reads match the stored
  workspace, a proposal persists and replays without duplicating, and
  non-proposal commands (a schema-valid `RecordFact`), stale revisions, and
  unknown IDs are rejected. Covered by `npm run test:connected` (9 passed).
- Raw JSON-RPC stdio probe (`/tmp/mcp-stdio-probe.mjs`): initialize, tool
  discovery, empty-workspace reads, unknown-project and capability-limit
  errors — all passed against a temp database, then dropped.
- Live headless client: `muse exec` with the adapter attached per-run (no
  settings files modified) listed one seeded home and summarized the project
  goal correctly; the database afterwards showed zero writes (4 commands /
  4 events, unchanged). Temp database dropped.
- Full gates: `npm test` (15 legacy + 124 passed, 8 Mongo cases skip without
  the test URI), `npm run test:connected` (9 passed), production and
  foundation builds, strict TypeScript, import boundaries, formatting.

## Limits

- Local single-owner stdio only. Hosted Streamable HTTP needs account
  authentication and scope isolation first.
- Reads plus proposals. Photo-job request/status/cancel, purchasing, and
  contractor tools are not exposed over MCP.
- The adapter reads Mongo, not browser IndexedDB: the client sees whatever
  workspace was transferred to the targeted database.
- No in-app model execution was added; the agent client supplies the model.
