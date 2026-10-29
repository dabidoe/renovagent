# Renovagent handoff

October 29, 2026 · America/New_York · Repository: `/Users/deastridge/Documents/Meta hackathon`

**Resume here:** Atlas is now the shared database. Consumer Muse Mac has successfully discovered tools, read the migrated projects, created a separately authorized QA project, and reread its saved brief. The website displays the same revision. The next work is the useful product workflow: photo/inspiration → visual options with costs → complete material requirements → contractor/inspection handoff. A saved brief alone does not fulfill that goal.

## Product direction

The owner wants a polished, simple, agent-first home improvement product for a Meta hackathon, with roughly four–five working days originally allocated. Ordinary consumer Muse is a required client. Someone should be able to say “how much for this bathroom?” with a photo/Pinterest link, or “renovate my living room,” and receive useful work with few questions.

- Establish scope and needed materials before recommending products. A vanity shopping demo is insufficient: include supporting parts, connections, preparation, finishes and justified consumable allowances.
- Design should accept existing inspiration/shopping links and conversational changes such as “make it blue.” Show two or three same-room visual options with their corresponding scope and cost breakdowns. Preserve original photos.
- Check compatibility from supplied measurements and manufacturer specifications. Keep unmeasured routes, concealed conditions and unsupported feasibility unknown/conditional.
- Save useful Design, Materials, Contractors and Requirements files in the project. Avoid a long sequence of mandatory choices or approvals.
- Contractor handoff should specify work, exclusions, materials responsibilities, permit/inspection responsibilities and quote differences. Diagnostics, avoiding unnecessary spending, price alternatives, and receipt accounting are important use cases.
- Keep the property/project model general. The bathroom is the first reference case; living-room flooring/refresh proves broader visual exploration.

Before substantial work, read [AGENTS.md](AGENTS.md), [architecture index](docs/architecture/README.md), the relevant linked specifications, and [PROGRESS.md](PROGRESS.md). The [hackathon plan](docs/architecture/hackathon-implementation-plan.md) is the intended sequence, not a completion claim. Its opening inventory predates this connector/migration work: there are now ten MCP tools and a verified consumer Muse connection. Day 1's connection is proven; useful scope/cost generation remains open.

## What was completed

| Area | Verified result | Remaining boundary |
| --- | --- | --- |
| Database | API, stdio MCP, HTTP MCP, launcher, catalog seed and grant CLI share server-side database selection; configured `MONGODB_URI` selects Atlas | No automatic synchronization or fallback to another database |
| Migration | Seven original projects, 41 artifact identities with revision histories, three blobs, two completed photo jobs, and 17 products/offers/price observations each copied to Atlas | Original local copies remain; do not replay migration over the live workspace |
| Photos | 25 private job JSON files copied, including five cached image inputs and historical execution receipts; all five images served with original hashes | Future provider checkpoints/receipts still use local disk; distributed recovery is open |
| MCP | Ten tools over stdio and authenticated stateless Streamable HTTP; expiring/revocable owner-bound read/proposal grants | Temporary HTTPS test, not stable deployment; no MCP photo-upload/job tool yet |
| Consumer Muse | Native Mac app discovered schemas, listed seven originals, created QA project and reread brief revision 1 | Shipped client template stalled; working client in Muse uses individual stateless calls and a bounded 180-second timeout |
| Website | Reload displayed Muse's exact QA brief; corrected misleading “Simulated output” label to “Saved project intent · unreviewed” | Website general chat still saves notes; it does not run a general live assistant |

Agents propose through validated commands. They cannot accept decisions, record technical facts through the MCP allowlist, pass inspections or purchase anything. Technical-source coverage and qualified review gates remain open. Catalog prices remain visibly labeled demo observations.

## Canonical data and backup

The original project aggregate was in **`unpermitted_workspace` on local port 27018**, while the catalog was in local **`renovagent_workspace`**. The configured Atlas **`renovagent_workspace`** was empty apart from an initialized blank owner aggregate. Migration used validation, a private EJSON backup, a source recheck and one majority-write Atlas transaction.

- Owner: `local-homeowner`.
- Atlas had **eight projects after QA**: seven originals plus the clearly labeled test below. Later user work may change that count.
- Backup folder: `.local/backups/atlas-migration-2026-10-29T22-08-34.859Z/`.
- `snapshot.ejson` contains source and pre-migration destination records; `verification.json` records successful comparisons. Both files are private, mode 0600, ignored by Git.
- Source snapshot SHA-256: `d153030a97ff58640d7f8f1580f92ee4f16ce94c6c415033a31ff9266a9c3462`.
- Originals remain in local Mongo, browser IndexedDB, and `.local/photo-jobs`. They are backups, not the connected workspace's write target.
- A later dry-run correctly refuses the changed destination: website navigation receipts and the QA project make it diverge from the frozen source. Do not reset Atlas to make the old snapshot match.

Configuration precedence is `RENOVAGENT_MONGO_URI`, `WORKSPACE_MONGODB_URI`, then `MONGODB_URI`. Process values override the corresponding file variables; root `.env` is read before `server/.env`. An omitted database path normalizes to `renovagent_workspace`. Explicit local mode is `RENOVAGENT_MONGO_TARGET=local`, selecting `MONGODB_URI_LOCAL`.

**Local configuration trap:** the existing `MONGODB_URI_LOCAL` value points to the older `27017/unpermitted` service, not the persistent project service on 27018. It was preserved. Use an explicit correct URI if investigating old local data. Never print connection strings, provider keys or bearer tokens. Private environment files, `.local/` and `atlas-credentials.env` must stay out of Git.

Details: [migration evidence](docs/architecture/atlas-migration.md), [database/connector setup](docs/architecture/remote-mcp-connector.md).

## Exact consumer Muse proof

Native app: **Muse**, tester name **renovagent tester**, custom provider **`custom.renovagent`**. The credential was entered only through Muse's secure Add custom connector field.

| Record | Value |
| --- | --- |
| Project name | QA · Muse living-room connector test |
| Request ID | `muse-mac-qa-20261029-living-room` |
| Project ID | `agent-project:e2fa554fb2e66006918a582f` |
| Separate home ID | `agent-home:e2fa554fb2e66006918a582f` |
| Artifact ID | `agent-project:e2fa554fb2e66006918a582f:agent-brief` |
| Revision/state | 1 · proposed/current · unaccepted |

Muse called `start_project`, `list_project_files` and `get_artifact`, then stopped. The brief compares hardwood with keeping the existing floor and explicitly leaves dimensions, budget, conditions and prices unknown. Independent Atlas comparison confirmed all original properties/projects/facts/evidence/artifacts/decisions/runs unchanged. No estimate, design, physical fact, approval or purchase was added.

Evidence preserved in the repository:

- [Website showing the saved brief](docs/previews/atlas-muse-brief.png).
- [Native Muse completion result](docs/previews/muse-mac-qa-result.png).

The website was left on the QA brief. To reopen: project selector → QA project → Tools → Saved work → Project brief, revision 1. Do not accept it just to improve the screenshot.

## Runtime and connection lifetime

At approximately **6:38 PM Eastern on October 29**, the frontend returned HTTP 200, the API's `/api/workspace/auth/me` returned HTTP 200 with `local-single-owner`, and MCP `/health` returned HTTP 200. Recheck ports before starting duplicates.

| Service | Address / resume command |
| --- | --- |
| Frontend | `http://127.0.0.1:8741/` · `npm run dev -- --strictPort` |
| Website API | `127.0.0.1:4000` · `npm run dev:api` |
| MCP HTTP | `127.0.0.1:4010/mcp` · `npm run serve:mcp:http` |
| Persistent local Mongo backup/test service | `127.0.0.1:27018` · `npm run dev:mongo` |
| Combined website startup | `npm run dev:connected` starts API/frontend and starts local Mongo only when local selection is active |

The current MCP process was started with a temporary diagnostic wrapper, `/tmp/renovagent-mcp-observed.ts`, using the same maintained `createMcpHttpServer`. It records only timestamp, method, route class and status in `.local/mcp/test-http-status.log`. Replace it with the maintained CLI on restart; do not assume `/tmp` files will survive.

The authorized test endpoint was `https://switches-impressive-vids-duplicate.trycloudflare.com/mcp`. The tunnel forwards **only 4010** and was configured to terminate after one hour, approximately **7:09 PM Eastern**. The grant expires approximately **7:11 PM Eastern**, October 29. A stale URL/key is expected to fail after that window; neither is a permanent integration endpoint.

The owner authorized that one-hour exposure/pairing, then separately authorized the QA project write. Persistent “Always allow this site” permission was rejected by automatic approval review and was not granted. Requests were approved individually. Do not treat the old test as permanent authorization to reopen public access or grant broader permissions.

For a newly authorized connection: establish the HTTPS hostname, set `RENOVAGENT_MCP_PUBLIC_URL` to its exact `/mcp` URL, restart the HTTP listener, and issue an owner-bound expiring grant with `npm run mcp:access`. The CLI writes the key to a private ignored file without printing it. Enter it only through the client's secure credential flow. Changing a Quick Tunnel hostname also changes Muse's registered allowed host; reuse is not automatic.

The shipped Muse template timed out with a 45-second request budget. One interactive initialize returned HTTP 200 after 51.6 seconds; an initialized-notification probe also stalled. The working Muse client uses one stateless JSON-RPC call per invocation with 180-second timeout. The precise contribution of network approvals versus transport behavior remains unresolved. Do not claim the server's protocol support is universally broken or that the developer stdio test alone proves consumer integration.

## Code map for this increment

| Files | Responsibility |
| --- | --- |
| `apps/api/src/database-config.ts` | Shared cluster/local selection without secret logging |
| `apps/api/src/mcp-access.ts`, `scripts/mcp-access.ts` | Hashed owner/access/expiry grants and private credential issuance/revocation |
| `apps/api/src/mcp-http.ts` | Separate authenticated stateless HTTP listener, Host/Origin checks, request/rate limits |
| `apps/api/src/agent-projects.ts` | Atomic, retry-safe project creation plus proposed intent brief |
| `apps/api/src/mcp.ts` | Ten tools, grant-based discovery, saved files, proposal allowlist; stale/rejected checkout-plan check |
| `apps/api/src/cluster-migration.ts`, `scripts/migrate-to-cluster.ts` | Preflight, private backup, transactional copy and hash verification |
| `apps/api/src/photo-job-files.ts` | Owner/job/name-scoped immutable private files with checksum checks |
| `apps/api/src/photo-jobs.ts`, `apps/api/src/server.ts` | Persist/reuse cloud image inputs; authorized hash-matched image serving |
| `apps/web/src/features/work/artifact-panel.tsx`, `artifact-view.tsx` | Correct label/title for saved agent intent; other commerce viewers still need work |
| `scripts/dev-connected.ts`, `scripts/seed-catalog.ts`, `package.json` | Shared selection and operational commands |
| `tests/integration/mcp-http.test.ts`, `database-config.test.ts`, `cluster-migration.test.ts`, `connected-workspace.test.ts` | Connection, access, migration and cloud-only photo rendering checks |

## Next implementation sequence

1. **Make the existing commerce artifacts inspectable and trustworthy.** Add BOM, purchase-plan and checkout-review renderers. Reproduce and fix the review findings below before using price comparisons in a demo.
2. **Done October 29 — see [scope draft](docs/architecture/scope-draft.md).** Produce a useful scope and full materials draft from casual intent. Reuse the existing command/revision model. Add a bounded versioned reference recipe covering the declared bathroom work packages, supporting parts and justified allowances. Missing facts should block affected decisions, not every draft. Ask few questions and retain “I don't know.” A big dataset acquisition is not a prerequisite; use attributable installation documents/specifications first.
3. **Deliver the visible wow moment.** A real room photo plus a vague request produces two or three same-room alternatives with cost breakdowns tied to their own scope/quantities/rate basis. Selection or “make it blue/cheaper” updates saved design, materials and stale dependencies together. Distinguish image search/reference retrieval from generated previews, and label generated images.
4. **Turn the selected scope into a contractor/inspection package.** Work packages, exclusions, materials owner/contractor responsibilities, quote comparison and unresolved local requirements. Preserve actual inspection evidence; scheduled never means passed. Named outreach and purchases require their own authorization.
5. **Finish the demo journey and polish.** Durable project files, clear unknowns and price coverage, reconnect/retry, phone usability, receipt reconciliation if time permits. Reduce breadth before dropping the complete journey. Stable hosting is still a separate implementation task.

### Commerce review findings — addressed October 29 (step 1)

All seven findings below have failing-first regressions and fixes; see the PROGRESS.md entry “Commerce integrity and saved-file viewers” and `docs/architecture/commerce-catalog.md` § Integrity rules. Remaining limits: catalog observations do not stale saved plans, and local import rollback is compensating rather than transactional. Next is step 2. Original findings:

- `artifact-view.tsx` declares commerce titles but lacks rendering cases for `bom`, `purchase-plan` and `checkout-review`; opening these artifacts can show no useful content.
- Proposal-grade commerce payloads need authoritative semantic validation of totals, line/source identity and dependencies. A schema-valid agent proposal must not become trusted purchasing math by assertion.
- `packages/core/src/commerce/plans.ts` maps product ID to a single priced offer; multiple offers for the same product are overwritten. Earlier order reversal selected a $1 versus $999 offer depending on array order.
- Offer selection needs pack-unit compatibility, stock handling and delivered-cost ranking. Current ranking uses merchandise line totals before shipping; shipping is added afterward.
- BOM → purchase-plan → checkout dependencies and downstream invalidation need complete source/revision coverage.
- `CatalogStore.importBatch` can write collections independently before a later conflict; make an operator import atomic. The migration tool's transaction does not repair the regular importer.
- Recheck empty candidate lookup semantics: `offersFor([])` currently removes the product filter and can return the catalog. `CatalogStore.search` already rejects blank queries; do not conflate those paths.

Keep changes in reviewable slices. Preserve the preview and the original projects. Avoid expanding the scope into unrelated infrastructure or rewriting the domain.

## Verification and Git state

Last completed verification for this implementation:

- `npm test`: **150 passed** (15 legacy JavaScript + 135 TypeScript), **25 Mongo scenarios skipped** without the explicit test URI.
- `npm run test:connected`: **28/28 passed**, against isolated temporary databases on the real local Mongo service. These overlap regular-suite scenarios; do not add the counts as unique tests.
- `npm run build`: strict types, dependency boundaries, frontend and foundation builds passed. Existing frontend bundle-size advisory remains.
- `npm run format:check` and `git diff --check`: passed.
- Real Atlas copy/hash/source-preservation checks, five authorized photo hashes, public unauthenticated 401, consumer Muse read/write/read, and website reload were verified separately.

Logs: `/tmp/renovagent-cluster-unit.log`, `/tmp/renovagent-cluster-connected.log`, `/tmp/renovagent-cluster-build.log`, `/tmp/renovagent-cluster-format.log`. Temporary files may disappear; the maintained tests and linked evidence are the durable record. Handoff creation itself does not rerun those suites.

The checkout was on **`main`**, latest commit **`de30aab`** (`feat: enhance MCP tools and catalog integration`), preceded by `45e88d3`. All connector/migration/UI-label/documentation changes from this session were **uncommitted** at handoff. Inspect `git status`/diff before continuing; do not discard this work. `.DS_Store` and `docs/.DS_Store` were already modified and should not be staged or reverted casually. No PR, remote push or application deployment was performed.

Start the next session by reading this document and the current Git diff, confirming the selected Atlas workspace and preserving the verified connection/data baseline, then implement the first useful scope/materials/visual-options slice. Do not spend the next session repeating the migration or proving the same seven-project read again.
