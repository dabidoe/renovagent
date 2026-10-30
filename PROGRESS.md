# Project status — Renovagent

Updated October 29, 2026. This tracker distinguishes prototypes from the reliable product workflow we are building.

**Landing V2:** compact header and first-screen prompt, uniform drafting background, a single bathroom example with before/after and material views, and responsive pricing/capability panels are implemented at `/`. Product specs/fit checks expand on demand; prototype selections survive demo view switches. Build and 1280px/390px/360px browser checks pass; visuals and allowances remain illustrative. See [evidence and limitations](docs/landing-v2-evidence.md).

**Resume work:** [current handoff](HANDOFF.md) records the Atlas/Muse verification, runtime and connection expiry, preserved data, uncommitted changes, next implementation sequence. Step 1 commerce findings are addressed (entry below).

## Direction

Renovagent carries a persistent property project through investigation, options, technical resolution, procurement, preparation, coordination, execution, and handover. Chat directs the work; versioned project artifacts hold the results. The half bath is the reference workflow, not the product boundary.

**Active next implementation plan:** [Muse-first hackathon workflow](docs/architecture/hackathon-implementation-plan.md), October 29. Targets a useful first draft from casual language/photos/inspiration, visual room alternatives with cost breakdowns, full project materials, contractor and inspection scope, shopping and receipt reconciliation in four–five working days. A living-room refresh/flooring example demonstrates visual option selection alongside the bathroom workflow. Standard consumer Muse integration is a required acceptance gate. This is planned work; implementation status below is unchanged.

**Canonical build plan:** [architecture index](docs/architecture/README.md). **Product direction:** [scope](docs/RENOVAGENT_PRODUCT_SCOPE.md) and [technical plan](docs/RENOVAGENT_TECHNICAL_ARCHITECTURE.md), mapped to slices in [reconciliation](docs/architecture/renovagent-reconciliation.md). **Implemented foundation:** [Slice 1 evidence and boundaries](docs/architecture/slice-1-foundation.md). **Workspace:** [Slice 2 implementation](docs/architecture/slice-2-workspace.md). **Technical core:** [Slice 3 implementation](docs/architecture/slice-3-technical-core.md), [local coverage and open review gate](docs/architecture/local-context-and-code-coverage.md).

## What currently exists

| Area | Current state | Important limit |
|---|---|---|
| Local frontend | Prompt-first React/Vite workspace on IndexedDB or connected Mongo: projects, conversation/work surfaces, artifacts/revisions, decisions, sources, drafts, activity | Labeled agent fixtures where noted; no reviewed compliance guidance. Original frontend retained at `/legacy.html` |
| Connected backend | Loopback API + selectable local/cluster Mongo: per-owner workspaces, real in-app Muse photo jobs, sessions, catalog, submissions; shared server-side database selection | Public HTTPS hosting and production hardening remain open |
| Accounts | Optional Google/Meta sign-in with per-owner workspaces, explicit local adoption, sign-in web surface | No passwords; live round-trips need the owner's OAuth clients |
| Commerce | Shared catalog with duplicate-proof imports, tiered purchase plans, contractor accept/decline, checkout reviews, price submissions with review quarantine | Seed prices are labeled demo examples; affiliate feeds need the owner's accounts; no live inventory, tax, or checkout |
| Agents | MCP adapter with 14 tools over stdio and authenticated Streamable HTTP: owner-scoped reads/proposals, project creation, recipe scope/materials drafts, same-room design options, file discovery, catalog recall and checkout assembly | Consumer Muse Mac discovered ten tools, read the migrated projects, created a separate authorized QA project and reread its brief over temporary HTTPS; stable hosting remains open |
| Technical references | Versioned adoption/scope/permit source register, applicability checks and visible coverage gaps | Exact 2018 clearances and residential exhaust criteria retrieved; local clearance mapping, complete electrical provisions, trade design and qualified review remain blocked |
| Planning math | Shared deterministic geometry, quantities, money/tier/checkout math; single command authority for all writes | Rectangular playbooks; no inferred routes, no reviewed compliance guidance |
| Verification | 181 pass (15 legacy + 166 TypeScript, 31 Mongo cases skip); explicit real-Mongo suite 34/34; strict types, boundaries, formatting, builds | Browser QA covers labeled projects; actual consumer-Muse reads and separate QA brief write/read verified; no claim of general model reliability, technical compliance, or full lifecycle coverage |

## Delivery tracking

| Slice | Status |
|---|---|
| 0 — Architecture baseline | Documented; implementation choices and open integration questions recorded |
| 1 — Durable project foundation | Implemented and tested alongside current preview; see linked acceptance evidence |
| 2 — Working project workspace | Implemented with durable local fixtures and desktop/phone browser checks; see linked evidence |
| 3 — Technical planning core | Local deterministic core implemented; exact-source/trade coverage and qualified technical review gate remain open |
| 4 — Connected durable agent workflow | Partial: loopback API/Mongo, photo jobs, accounts, local MCP done; hosted transport and general agent workflow open |
| 5 — Job preparation and coordination | Partial: catalog, tiered plans, checkout reviews done; scheduling, contractor accounts, tax, live retail open |
| 6 — Execution, change control, handover | Not implemented; receipt accounting and contractor accountability specified only |
| 7 — Second project playbook | Not implemented |

Use each slice's acceptance criteria before changing its status. A mock screen, canned reply, or HTTP 200 does not establish workflow completion.

### Hosted deployment scaffolding — October 30, 2026

- One container serves the landing (`/`), workspace (`/workspace.html`) and API from one origin. `RENOVAGENT_PUBLIC_URL`/`RENOVAGENT_HOST`/`PORT`/`RENOVAGENT_STATIC_DIR` drive trusted origin and host, `Secure` cookies, hosted OAuth callbacks and static serving; defaults keep the loopback dev server. A public origin without Google/Meta sign-in refuses to start. Added `/healthz`, `Dockerfile`, `railway.json`, `.env.example` (names only), and CI (build, tests, Docker build; no deploy).
- Nothing deployed. Owner steps (Railway, production Atlas, provider callbacks, domain/Bunny) and public-launch blockers (16 MB per-owner blob document, no account deletion or privacy policy, `muse` CLI absent from the image, MCP HTTP not containerised) are in [hosted deployment](docs/architecture/hosted-deployment.md).
- Verified: `npm test` 15 legacy + 200 TypeScript, `npm run test:connected` 36/36 (new public-mode scenario), build/types/boundaries; manual run serving `pages-dist`. Docker build not run locally (no Docker); Railway, Bunny and hosted sign-in not exercised.

### Room studio: 3D room, plan drawing, renders — October 30, 2026

- One `RoomModel` parser (RoomPlan, OpenPlan3D export and project files) feeds the floor-plan summary, a dimensioned SVG plan drawing in named layers (empty electrical layer: nothing records wiring), surface-to-scope links, a clickable three.js room (Existing/Proposed look, GLB export with per-surface data) and Blender Cycles renders (`npm run render:room`). Unknown thickness/height is styled, never dimensioned; quantities come only from the scope draft.
- Details and limits: [room studio](docs/architecture/room-studio.md). Verified with domain/integration tests and a headless-Chrome end-to-end run; not on our own iPhone scan or by a person in a desktop browser; connected-mode plan blob read checked by inspection.

### Room measurement capture — October 29, 2026

- "Measure this room" card (options and plan stages) saves floor length, width and ceiling height as project facts with a user observation and optional photo as evidence. The method (tape, phone AR app, LiDAR scan) is recorded; nothing is marked verified. Unchanged values are skipped on re-save.
- Scope drafts carry a `factContext` over their measurement fact keys, so a first-time dimension stales an existing draft and, through it, the BOM and purchase plans. MCP `draft_scope` includes the measurement signature in its idempotency key, so a retry after measuring re-drafts. No MCP fact-writing tool: agents still relay values as unverified `reported` inputs.
- Research and plan (RoomPlan import as step 2, gated on a real export file): [room measurement](docs/architecture/room-measurement.md).
- Verified after merging with design options: `npm test` 15 legacy + 173 TypeScript passed, `npm run test:connected` 35/35, build/types/boundaries. Not verified in a live browser. Scope drafts saved before this change lack `factContext`; re-draft them once.

### Same-room design options with costs and previews — October 29, 2026

- One room photo plus a vague request becomes three living-room options (fresh walls keeping the carpet; light-oak hardwood + walls; wood-look vinyl plank + walls), each with its own recipe scope, a builder-to-high materials range priced at view time, coverage ("priced N of M"), its biggest unknown, and a labeled generated concept preview. Validated commands only: `BuildDesignOptions`, `ReviseDesignOptions` ("make it blue", preference, retry) and server-only `RecordDesignPreview`.
- Previews: Muse `image_generation` edits the owner's photo in an isolated workspace (contributor mode off); a durable pending state is picked up by the API worker; stale results are discarded; provenance records source hash, prompt, provider, reported model and run. Images live in an owner-scoped checksum-verified collection, not the workspace document. The shipped Muse provider, run from the repository root on the owner's living-room photo, changed only floor and walls and kept camera, stairs and furniture (29 s); paid calls are bounded and commit failures never loop. Muse still reports a `-contributor` model with `--contributor-mode off`.
- Selecting an option drafts its full scope with its colors and proposes its BOM and tier plans in the same update; it is a proposal, not a decision. New measurements rebuild costs while keeping previews and the preference. MCP: `build_design_options`, `revise_design_option`, `get_design_options` (14 tools). Website viewer shows the original photo, each preview and costs, with "I like this one" and a wall-color box.
- New `living-room-refresh` v1 recipe with fetched This Old House and Xulon installation sources; overage unset; two coats stated as a recipe selection. Demo living-room catalog (15 fictional records); `seed:catalog` now imports both fixtures but has not been run against Atlas. Details: [design options](docs/architecture/design-options.md).
- Verified: `npm test` 15 legacy + 166 TypeScript passed (31 Mongo cases skipped), `npm run test:connected` 34/34, build/types/boundaries, formatting. Limits: no website upload button (demo script uploads), loopback-only image paths, previews only while the API runs with a Muse key, macOS image conversion.

### Scope and materials draft from casual intent — October 29, 2026

- New validated `DraftScope` command and versioned `bathroom-refresh` v1 recipe compile a `scope-draft` artifact: seven work packages, 31 requirements when all are included (purpose, specification, quantity basis, status, blocking inputs, sources), conditional site-dependent items, and a clearly unset tile overage allowance. Nothing measured still yields the full list; only dependent quantities wait.
- Inputs: recorded facts take precedence and stale the draft when corrected; relayed values stay unverified inside the artifact; "I don't know" is retained and not re-asked. At most two questions, ranked by what they unblock.
- MCP `draft_scope` (11 tools now) runs the command, proposes a BOM for catalog-priceable items and builds tier plans server-side, all referencing their exact inputs (draft → BOM → plan → checkout staleness). Muse gets demo-labeled materials subtotals for the priced items plus a coverage line; labor, permits, tax, delivery and disposal are stated as not priced. Agents cannot propose a `scope-draft` directly, a BOM citing a draft must match its requirements, and MCP BOM candidates must belong to the item's category. Website viewer added; Materials no longer offers the fixed vanity template when a draft exists.
- Sources: Kohler service-kit instructions and Broan fan instructions fetched and quoted; tile overage left unset because published guidance (search summary only) varies about 5–35%. No allowance is quantified. Details: [scope draft](docs/architecture/scope-draft.md).
- Verified: `npm test` 15 legacy + 159 TypeScript passed (28 Mongo cases skipped), `npm run test:connected` 31/31, build/types/boundaries, formatting. Limits: one recipe; demo catalog prices only the vanity package; the website views drafts but cannot create them; the running API/MCP processes need a restart to serve this.

### Commerce integrity and saved-file viewers — October 29, 2026

- Saved BOM, purchase-plan, checkout-review and conversation-plan files now render in the project viewer (previously blank). `ArtifactView` has an exhaustive kind check, so a new artifact kind without a renderer fails the typecheck. Materials and the viewer share one read-only plan renderer.
- Offer selection: every offer for a product competes (the $1 vs $999 result no longer depends on array order). Ranking uses delivered cost, so shipping is included. A shipping-only offer without an estimate ranks behind offers with a known delivered cost and is noted, never treated as $0. Out-of-stock offers are rejected; unknown/limited stock is kept and noted. A pack unit must match the BOM unit through an explicit alias table. The curated seed totals are unchanged ($307 / $771 / $1,912).
- `ProposeArtifact` now recomputes purchase-plan and checkout-review payloads against the exact BOM/plan revision they reference: line identity, candidates, quantities, pack rounding, line and plan totals, currency, code topics, derived basis, retailer grouping and cart-link hosts. Checkout needs a current, undeclined plan.
- MCP `propose_project_change` rebuilds agent commerce proposals from the catalog and compares the whole payload except build time, so mismatches are rejected. That covers invented "live" prices, arithmetically consistent swaps to incompatible candidates, and injected notes or checklist text. Tiered artifact IDs must hold their own tier. Plan notes are aggregated per kind and rejections are capped, so a 60-item BOM still produces a schema-valid plan.
- Catalog: `offersFor([])` returns nothing; `undefined` means no product filter. `importBatch` checks all collections before writing. If a later insert fails, it removes only the records it inserted, using the driver-reported inserted IDs.
- Verified: `npm test` 15 legacy + 149 TypeScript passed (27 Mongo cases skipped), `npm run test:connected` 30/30, build/types/boundaries, formatting. Each new regression was confirmed failing against the earlier code. Limits: new price observations do not stale saved plans because the catalog is outside the workspace dependency graph, so a stale catalog shows up only as an MCP proposal mismatch or a manual rebuild. Local standalone Mongo has no transactions; import rollback is compensating, not isolated.

### Remote connector foundation — October 29, 2026

- Added authenticated Streamable HTTP beside the existing stdio adapter, owner-scoped expiring/revocable read/proposal grants, casual project creation and saved-file discovery. Ten tools now share repository/domain rules; project intake records a proposed brief without inventing physical facts or an estimate.
- Unified API/MCP/catalog/launcher database selection around the configured `MONGODB_URI` cluster and explicit `MONGODB_URI_LOCAL` mode. Database selection itself does not merge or synchronize records. The owner subsequently authorized migration: seven original projects were located in the pre-rename local database and copied to Atlas with history, attachments, catalog and private job inputs; see the migration evidence below.
- Verified 148 regular tests (23 Mongo scenarios skipped without the explicit URI), 24/24 real HTTP/Mongo integration cases, strict types, boundaries, formatting and production builds. The owner-authorized temporary HTTPS/Muse Mac test subsequently completed authenticated discovery of ten tools and reads of all seven migrated projects; the separately authorized QA project/brief write/read check also passed with independent Atlas verification; stable hosting remains open. See [implementation and connection steps](docs/architecture/remote-mcp-connector.md).

### Atlas migration — October 29, 2026

- Moved all seven existing projects, 41 artifact identities with revisions, three attachments, two completed photo jobs, 17 products/offers/price observations each and 25 private job files to the configured Atlas cluster in a single transaction. Private source/destination EJSON backup and post-copy hash verification retained; local originals unchanged.
- Consumer Muse Mac discovered ten tools, read the seven original projects, then created and reread one separately authorized QA living-room brief at revision 1. Atlas independently confirmed its IDs/content and unchanged original domain records. There are now eight projects including the labeled QA project.
- API/MCP share the cluster. Private photo inputs now live in owner-scoped Mongo storage and new jobs persist their input bytes there; the live website served all five cached inputs with matching hashes. App processes and future provider checkpoint execution remain local. This is storage migration, not hosted deployment.
- Added conflict/active-job/orphan-catalog/checksum/owner guards and a cloud-only image HTTP scenario. Connected tests 28/28; regular tests 150 passed with 25 Mongo scenarios skipped; types, boundaries, formatting and builds passed. See [migration mechanism, backup and limits](docs/architecture/atlas-migration.md).

## Historical material

The [earlier tracker](docs/history/muse-progress-2026-10-26.md) and [original vision](docs/Unpermitted.ai.md) are preserved. The old ten-day checklist mixed demo implementations with production capabilities; it is no longer the delivery authority. The public Pages demo may differ from this local working tree and has not been redeployed by this planning task.

### Slice 3 clearance and systems follow-up — October 27

See [implementation and remaining blockers](docs/architecture/slice-3-clearances-and-systems.md). Added exact publisher clearance/exception criteria, local residential mechanical routing, city electrical research locators and structured unverified system observations. Unsupported compliance checks stay blocked; no construction release, real agent or backend execution added. Verified 84 tests, production builds, boundaries and formatting, plus browser save/reload.

### Slice 3 local mapping and electrical follow-up — October 27

[Current implementation and open gates](docs/architecture/slice-3-local-mapping-and-electrical.md): candidate general 2021 clearance mapping separated from retained accessibility; exact selected IRC bathroom electrical clauses and certified local/state amendment comparison; explicit service/design/measurement scope; limited basin-distance comparison. Complete NEC alternative remains unavailable behind official reader login. No reviewed-compliance or construction-release claim. 91 tests, builds and formatting pass; synthetic boundary/shortfall and reload verified in the working preview; backend off.

### Address-first intake and Muse handoff — October 27

Implemented the property opening, explicit Philadelphia public-record lookup, permission-gated image references, local uploads, a working plan compiled from saved inputs, sourced Markdown export and revision-bound Muse job export/import. Backend remains off. See [implementation and verification](docs/architecture/property-intake-and-muse.md). No live Muse research or automatic Google/listing image collection has been verified.

### Real Muse property handoff — October 27

Ran live City Hall research through the installed CLI, imported raw results and a source-audited proposal, and verified refresh/export. Current result: 22 findings, 10 sources, two source-page image leads, zero permitted previews. Two permit claims lacked support in the cited query and remain blocked from the plan. Fixed HTTPS generation, rejected-output retention, sourced context export, source links, caveat retention and exact repeated-claim block protection. Backend stays off. [Evidence and limits](docs/evidence/muse-city-hall/README.md). 100 tests, builds and formatting pass.

### Real residential listing handoff — October 27

Tested 7149 Bingham Street with its public 35-photo listing and primary OPA context. Live Muse returned 16 findings / five sources / eight references without visually identifying rooms. A separately labeled browser source audit produced 17 findings / six sources / four identified kitchen, bathroom, basement and exterior references that now feed the saved plan. Area/floor-count conflicts stay explicit; violations remain blocked; no permitted previews or current-condition verification. Fixed street-suffix matching, strict nullable provider output schema and photo-to-plan historical references. [Evidence and limits](docs/evidence/muse-bingham-home/README.md). 103 tests, builds and formatting pass; backend off.

### Muse attached-image review — October 27

Muse inspected all 35 Bingham listing images in five accepted attachment batches using neutral IDs and no prior human labels/visual notes. A separate model-only synthesis produced six questions/eight next steps; 12 selected photo references feed the saved plan. All raw classifications, confidence, uncertainties and attachment hashes are retained. Contradictory/missing-photo outputs were rejected and rerun; source-byte-matched resume, strict per-batch identity, visual-result provenance, goal dependencies and a repeatable external photo job were added. [Evidence and limits](docs/evidence/muse-photo-vision/README.md). 109 tests, builds and formatting pass; backend off, conditions/rights/qualified review remain unverified.

### Muse questions → saved conversation direction (October 27, 2026)

- Wired the six source-backed Muse questions into the composer, with exact photo links, confidence and uncertainty, reported-direction / unsure / defer meaning, saved question drafts and correction support. Backend remains off; no model interpretation of responses.
- Added validated atomic `AnswerPhotoQuestion` commands and typed revisioned response artifacts. Messages pin the exact response version. The working plan compiles literal answers and updates its clarification queue; measurements, feasibility and qualified review remain open. Latest plan views advance after an answer; historical views stay pinned.
- Current-review responses join workflow dependencies. First answers/corrections stale prior proposals and dependent plans, reject late simulated output and stale acceptance, while retaining accepted history and unrelated physical calculations. New research/goal/address context requires reconfirmation; stale direction is excluded from current plan context.
- Verified all six paths and a correction in a separate labeled browser QA project. Refreshed question draft destination/text persisted. Returned preview to the original Bingham project, with all six actual preferences unanswered. Evidence: `docs/previews/muse-question-answers.png` and the latest section of `docs/architecture/property-intake-and-muse.md`.
- Verification: **113 tests passed** (15 legacy JavaScript + 98 TypeScript), including four new durable-response integration scenarios; strict TypeScript, import boundaries, formatting and frontend/foundation production builds passed. Existing bundle-size advisory remains. Preview and legacy entry preserved; no backend/deployment/credential work.

### Saved answers → conditional options and sequenced work (October 27, 2026)

- Added a pure versioned kitchen/powder-room study recipe, typed `project-options` / `project-work-plan` artifacts and validated revision-fenced build/sequence commands. Three alternatives distinguish kitchen-only phasing, ground-floor location investigation and basement location investigation. Literal answers, exact response/source revisions, exclusions and option-specific survey/feasibility dependencies remain inspectable; free text is not silently classified as yes/no or an approved layout.
- Added a ten-stage sequence with survey/services investigation in parallel, design waiting for both, and explicit preparation, rough-inspection/concealment, finishing and final-outcome holds. Missing geometry, unsupported feasibility/local applicability, approvals, resources and all physical-work release remain blocked. Unknown dimensions, routes, prices, credentials and dates are not fabricated.
- First answers/corrections, source/goal/address changes and recipe drift invalidate dependent options/sequences while retaining accepted/history records. Unsupported question bindings, stale/foreign selections, conflicting revisions and generic artifact forgery are rejected. No backend, model execution, deployment or purchasing added.
- Browser QA verified source/answer dependencies, sequencing, answer correction → stale artifacts/disabled actions, rebuild and refresh persistence in the labeled test project. Original Bingham directions remain unanswered; conditional options can be inspected without inventing owner preferences or selecting a construction location. See [implementation and limits](docs/architecture/answer-driven-options-and-work-plan.md), `docs/previews/project-options.png`, and `docs/previews/project-sequence.png`.

- Verification: **120 tests passed** (15 legacy JavaScript + 105 TypeScript), including seven new option/sequence integration scenarios; strict TypeScript, import boundaries, formatting and both production builds passed. Existing main-bundle size advisory remains. Preview is running at `http://127.0.0.1:8741/`; backend remains off.

### Candidate measurements → options, checks and work revisions (October 27, 2026)

- Added separate named kitchen, ground-floor and basement survey editors with original units, unknown blanks, rough/finished/conflicting basis, method/date/notes, door observations, example labeling and supporting file refs. Replacement candidates get new physical IDs with cleared inputs and preserved history; one active candidate per recipe role is supported.
- Added protected, versioned `candidate-measurements` and `candidate-checks` records plus `SaveCandidateMeasurements`. Shared geometry supplies area/perimeter/observed gradient and normalized headroom/access lengths. Irregular areas, fixture fit, drainage/structure/service feasibility, local applicability, permits and release stay blocked. No other room’s technical inputs or property facts are overwritten.
- Saves fence source address, survey, options and sequence revisions. Current options/selected work update atomically; old checks and downstream revisions become stale, accepted history remains, other candidate checks stay current, and stale work is not silently revived. Historical views remain pinned. Exact survey-set guards protect queued option builds.
- Browser QA saved three explicit examples, verified mixed-unit/date refresh persistence and a 4 ft → 5 ft correction (2.4384 → 3.048 m²), latest versus historical checks, and work revision advancement. Date capture and accessible labels were fixed. Actual property measurements remain empty. [Implementation and limits](docs/architecture/candidate-measurements.md); screenshots in `docs/previews/candidate-measurement-*.png`.
- Verification: **128 tests passed** (15 legacy JavaScript + 113 TypeScript), including eight new integration scenarios; type checking, dependency boundaries, formatting and both production builds passed. Existing main-bundle advisory remains. Preview preserved, backend off; no model, deployment or credential work.

### Home-centered planning rebuild — October 28, 2026

- Replaced the supported property's document-first overview with home imagery, a working kitchen / bathroom investigation proposal, sourced house context, and a focused next action. Project notes, preferences, full measurements, source handoff and archive are available on demand. No live assistant is implied.
- Focused direction and footprint editors use the existing validated durable commands. Study selection now atomically compiles options, selects the investigation and retains the overview. Stale records cannot masquerade as the current study; examples and irregular/rough surveys do not advance as a finished site footprint. Shared arithmetic feeds the area and proportional rectangle drawing; fit and construction remain blocked.
- Original listing images require an explicit viewer action and retain visible unknown-rights labeling. No permission record is promoted, imagery exported, or source asset stored. Actual Bingham owner preferences/measurements remain empty. Browser QA used the separate labeled example project.
- Added four meaningful integration scenarios, including semantic question reordering, atomic rollback/view persistence, next-action progression and downstream invalidation. See [implementation, evidence and remaining product gaps](docs/architecture/home-centered-planning.md). Backend remains off.
- Final verification: **132 tests passed** (15 legacy JavaScript + 117 TypeScript); strict types, dependency boundaries, formatting and both builds passed. Existing bundle-size advisory remains. Browser verification confirmed the original kitchen photo, QA persistence/recalculation, atomic focus selection, optional notes, and stale historical calculations. Phone usability remains unvalidated. Preview evidence: `docs/previews/home-centered-planning.png` and `docs/previews/home-plan-qa.png`.

### Hutchinson home inventory and living-room half-bath scope — October 28, 2026

- Added 2440 S Hutchinson St as a separate real reference home. Audited Compass/Homes.com source claims, inspected all 22 native listing photos through real Muse attachment runs, and generated 27 approximate visual regions across four model-selected room views. Configured Muse keys are used only in Node, passed through stdin and redacted from output; no key is bundled into the UI.
- Added selectable SVG photo regions and an element inspector for recognition, label correction and keep/replace/investigate/reject direction. Listing claims, visual proposals and reported preferences remain separate. Saved choices update the working brief and scoped evidence request through validated commands; model observations are preserved.
- Added protected inventory/direction artifacts, exact inspected-image hash checks, polygon/identity guards, revision fences, goal-mismatch protection, membership-based invalidation and historical preservation. New source context requires fresh inventory binding and does not inherit prior confirmations.
- Recorded the user's additional living-room half-bath goal and reported semi-finished basement with an existing half bath. Re-ran the bounded Muse planning synthesis for that scope, verified the old inventory became blocked, and explicitly reused unchanged image regions against the current research. No location geometry, dimensions, service connection or feasibility was invented.
- Backend/in-app model execution remain off. Mongo provisioning and stable private asset storage remain next steps. See [implementation and limits](docs/architecture/photo-inventory.md) and [source/run evidence](docs/evidence/muse-hutchinson/README.md).
- Final verification: **138 tests passed** (15 legacy JavaScript + 123 TypeScript); strict types, dependency boundaries, formatting and both production builds passed. Browser QA covered isolated saved-direction persistence and goal/source invalidation. Reopening the actual project retained its living-room goal and reported basement context; the 1494×1000 source photo loaded and keyboard region selection updated the inspector. Original owner element preferences remain unanswered. Evidence: `docs/previews/hutchinson-inventory.png` and `docs/previews/hutchinson-project-goal.png`. Existing bundle-size advisory remains; phone usability is unvalidated.

### Connected Muse photo jobs and Mongo persistence — October 28, 2026

- Connected the preview to a new loopback API and persistent local MongoDB 8.0.16. Explicit transfer preserved all seven projects, revisions, accepted history, receipts/events and attachment bytes; IndexedDB remains intact. Atomic aggregate CAS and shared domain commands own all connected writes. Connected mode never silently falls back to local edits during an outage.
- Added real in-app Muse jobs for selected saved source photos and current uploads, persisted progress, cancellation, renewable leases, bounded checkpoints/recovery and revision-fenced atomic publication. Credentials remain server-only. Cached hash-matched image bytes feed region detection and the private viewer. Historical source photos remain selectable after bounded refreshes, labeled as earlier reviews.
- The real four-photo Hutchinson job produced 32 observations, automatically advancing research/inventory r2 → r3. No manual exports/imports. Existing owner context stayed intact. A Mongo/API restart preserved the exact workspace hash and reload restored connected mode. No owner element preferences or measurements were invented.
- Verification: **144 tests passed** (15 legacy + 129 TypeScript), including real Mongo isolation/concurrency/rollback/invalidation/late-result/attachment tests and provider cancellation/budget checks. Types, boundaries, formatting and builds pass. Local single-owner access and the 14 MB aggregate are explicit limits; the general agent workflow remains simulated and technical review remains open. See [implementation, operating commands and limits](docs/architecture/connected-muse-and-mongo.md).

- Upload browser QA also completed: one private QA attachment → real Muse classification/planning/regions → seven saved observations and authorized cached-image rendering. Previous QA inventory direction became stale; actual owner preferences remain empty.

### Prompt-first UI — October 29, 2026

- Replaced the permanent dashboard/sidebar with a centered prompt, compact house/project context and on-demand dialogs for house tools, saved plans, history, sources and activity. Kept revision-specific outputs, saved drafts, photo question responses and existing controller/repository commands.
- Materials and contractors have explicit empty states; general messages remain saved notes. Muse photo analysis remains connected locally. Standard Muse-agent access through current-workspace MCP is a recorded requirement, not an enabled integration. See [implementation, verification and Muse client boundary](docs/architecture/prompt-first-workspace.md).
- Verification: regular tests passed (139 passed, five Mongo cases skipped); the explicit real-Mongo suite passed all six cases, covering the skipped cases. Builds, types, boundaries and changed-file formatting passed. Browser checks covered desktop and 390/360-pixel phone layouts, house/plan dialogs, project switching, Escape, and QA draft persistence through refresh. Actual owner facts/preferences were not changed; the original QA draft was restored.

### Agent procurement and checkout handoff — October 29, 2026

- Added MCP catalog tools (`search_catalog`, `get_offer_history`, computation-only `build_checkout_review`) so agents search the verified corpus first; verified-corpus-plus-agent-live-check is the recorded pattern. Materials plans gained one-click checkout-review preparation.
- `checkout-review` artifacts group plans by retailer with product URLs, Amazon add-to-cart links for ASIN offers, an explicit customer double-check list, and authorization recorded via decision. Agent assembles, human checks out — never the reverse.
- Researched the corpus: Amazon Associates links-first (API gated on sales), Wayfair via CJ, UPC lookup APIs for identity, manufacturer curation for spec attributes. Multi-retailer affiliate rows tested.
- Specified (not built): receipt OCR → project accounting and contractor accountability (hours, claim-vs-evidence checks, timelines, templated contracts). See [agent procurement and checkout](docs/architecture/agent-procurement-checkout.md).
- Verification: checkout/cart-URL scenarios, MCP catalog tools over a seeded store, stdio probe re-run (8 tools); `npm test` (15 + 131, 17 skip), `test:connected` (18), builds, types, boundaries, formatting pass.

### Real retail pricing access — October 29, 2026

- Decided the lawful path after research: no public HD/Lowe's API exists and scraping violates terms, so pricing comes from authorized affiliate feeds (Impact for Home Depot, CJ for Lowe's) plus verified manual observations; scraper APIs rejected for now. Owner must apply for affiliate accounts.
- Built the plumbing: deterministic affiliate-row normalization, product text search, SKU/retailer lookup, per-offer price history, store fields, and user price submissions quarantined until operator review (local mode records immediately). File-based operator imports via `seed-catalog --file`.
- Verification: affiliate normalization plus quarantine-lifecycle scenarios; `npm test` (15 + 130, 15 skip) and `npm run test:connected` (16) pass with builds, types, boundaries, formatting. See [retail pricing access](docs/architecture/retail-pricing-access.md).

### Commerce catalog and tiered purchase plans — October 29, 2026

- Built the first shopping slice: shared catalog collections with duplicate-proof imports, deterministic compatibility matching and delivered-cost math, three tier plans (Builder grade / Mid-tier / High-end) for a Philadelphia vanity replacement, and contractor accept/decline on versioned purchase plans. Every plan line carries code topics for verification; rejections persist with reasons.
- All seed prices are explicitly labeled demo examples (fictional retailers, historical observations); nothing is purchasable and fixture plans carry a persistent warning. No live retail, tax, checkout, or per-line approvals.
- Verification: 5 domain scenarios with exact tier totals ($307 / $771 / $1,912) plus 2 integration scenarios (idempotent import, conflicts, session/operator gates); `npm test` (15 + 129, 13 skip) and `npm run test:connected` (14) pass with builds, types, boundaries, and formatting. Live double-seed confirmed no dupes. See [commerce catalog](docs/architecture/commerce-catalog.md).

### Rename to Renovagent and scope reconciliation — October 29, 2026

- Renamed the product to Renovagent (per the preferred spelling in the new scope doc): `@renovagent/*` packages, UI brand, titles, wire header/cookies, MCP name, env vars, and current docs. Legacy demo, historical evidence, and the original vision file keep the old name as record.
- Preserved persisted data across the rename: localStorage key with old-key fallback, one-time Mongo copy from `unpermitted_workspace` to `renovagent_workspace` on first boot (probe-verified: 7 projects, 3 blobs, 2 jobs, then cleaned up), and dual-host upload-URL routing so pre-rename photo records keep working. IndexedDB name stays frozen (no safe copy path); GitHub remote rename is an owner action.
- Reconciled the new product/technical docs with implemented slices: most MVP intake/planning/code items exist; catalog/pricing/purchase-plans are the first unbuilt block. Recorded the split model — shared reference collections plus per-owner workspace aggregates — adapted backlog, and open-decision recommendations in [renovagent-reconciliation](docs/architecture/renovagent-reconciliation.md).
- Verification: `npm test` (15 legacy + 124, 11 skip), `npm run test:connected` (12), builds, strict types, boundaries, and full formatting (including 6 pre-existing failures) pass.

### Meta login and Muse app assessment — October 29, 2026

- Added Meta (Facebook Login) sign-in alongside Google: provider-scoped identities with no email-based auto-merge, `appsecret_proof`-verified Graph identity, per-provider sign-in buttons, and stubbed Meta coverage in the account suite. Setup needs the owner's Meta app with the loopback redirect URI; public `email` use needs App Review.
- Researched the consumer Muse integration surface: custom connectors via hosted Streamable-HTTP MCP are the feasible path, but Muse's cloud cannot reach loopback, so real integration needs the hosted backend (endpoint, TLS, our OAuth server). Verdict, sources, and sequencing are in [the assessment](docs/architecture/muse-app-integration.md).
- Verification: `npm test` passes (15 legacy + 124, 11 Mongo cases skip); `npm run test:connected` passes (12); builds, strict types, boundaries, and formatting pass. Live provider round-trips still need the owner's OAuth clients.

### Accounts and Google login — October 29, 2026

- Added optional account mode to the current API: Google authorization-code login with ID-token verification, 30-day server sessions, per-owner workspace aggregates with cross-owner isolation, explicit local-to-account adoption on first connect, and per-owner photo workers. Default local single-owner behavior is unchanged when Google credentials are absent.
- Web app falls back to local records with a sign-in banner instead of a dead-end error, and shows the signed-in email with sign-out in the header. No passwords are stored; Meta login and the legacy demo's bcrypt/Firebase stubs are untouched.
- Verification: two new HTTP-level integration scenarios with stubbed Google (redirect, callback, adoption, isolation, bad-state rejection, logout, unchanged local mode) in `npm run test:connected` (11 passed); `npm test` passes (15 legacy + 124, 10 Mongo cases skip); builds, strict types, boundaries, and formatting pass. The live Google round-trip needs the owner's OAuth client; setup steps and limits are in [accounts and Google login](docs/architecture/accounts-and-google-login.md). Magic-link agent pairing is the recorded next step; shopping/contractor agents do not exist yet.

### Current-workspace MCP adapter — October 29, 2026

- Implemented the recorded standard-agent requirement as a local stdio MCP server (`apps/api/src/mcp.ts`, `npm run serve:mcp`) over the shared Mongo repository. Five tools: `list_homes`, `list_projects`, `get_project_context`, `get_artifact`, and `propose_project_change` (allowlisted to `ProposeArtifact`, `SaveDraft`, `AppendMessage`; fact recording, decision acceptance, and work release return an explicit capability limit).
- Verified three ways: three maintained integration scenarios over a real MCP client on isolated temp databases; a raw JSON-RPC stdio probe (discovery, empty reads, unknown-project and capability-limit errors); and a live headless `muse exec` run that listed the seeded home and summarized the goal with zero database writes. See [implementation, connection config, and limits](docs/architecture/mcp-workspace-adapter.md).
- Verification: `npm test` passes (15 legacy + 124 TypeScript, 8 Mongo cases skip without the test URI); `npm run test:connected` now covers both suites (9 passed); builds, strict types, boundaries, and formatting pass. Local single-owner stdio only; hosted transport, MCP job tools, and purchasing remain future work.

### Minimal opening and GitHub presentation — October 29, 2026

- Reduced the opening to the home selector, prompt, attachments and Tools. Photo questions, history and work surfaces remain available on demand. Added an agent-first product proposal centered on usable scopes, traceable quantities, comparable offers and revision-aware changes.
- Built a responsive public landing page at `/landing.html`, rewrote the README, and added `npm run build:pages`. The generated package puts the landing at its root and preserves the prototype at `workspace.html`; local preview routing remains intact. No remote publication has been performed.
- Final Pages build passed strict types, boundaries and both production builds; generated entry-point links/assets resolve. Desktop and phone browser checks covered the landing, packaged prototype navigation and on-demand photo questions. Existing test results are recorded in the prompt-first workspace note. Standard-agent MCP, hosted accounts, live offers and contractor verification remain planned.
