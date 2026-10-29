# Build architecture — Renovagent

Status: Slices 1–2, local Slice 3 core, loopback Slice 4 (API/Mongo/jobs/accounts/MCP) and Slice 5 commerce planning implemented; technical review gate and hosting open · October 29, 2026

**Active hackathon implementation sequence:** [Muse-first project workflow](hackathon-implementation-plan.md). The four–five-day plan covers casual intake, room recognition, visual design alternatives with cost breakdowns, full material requirements, contractor/inspection scope, shopping and receipts. It records planned work and acceptance gates, not completed capabilities.

This is the canonical build plan. It supersedes the original ten-day feature checklist and the intake-only interpretation of the opening design. Most of these documents describe the target architecture. [Slice 1](slice-1-foundation.md) and [Slice 2](slice-2-workspace.md) evidence identify the foundation and local workspace now built. [Slice 3](slice-3-technical-core.md) records the deterministic technical core and its open review/coverage gates.

## Product we are building

A home improvement agent that carries a real property project from investigation through design, technical resolution, procurement, execution, and handover. Conversation directs the work; a persistent, versioned project record holds the results. A half bathroom is the first end-to-end reference case, not the product's data model or feature boundary.

The system must be able to explain **what it knows, how it knows it, what remains unresolved, what depends on that uncertainty, and what should happen next**.

## Read in this order

| Document | Purpose |
|---|---|
| [Product and workspace](01-product-and-workspace.md) | Full lifecycle, agent responsibilities, user surfaces, and scope boundaries |
| [System and repository](02-system-and-repository.md) | Runtime boundaries, target file tree, current-code audit, migration strategy |
| [Domain and contracts](03-domain-and-contracts.md) | Project record, provenance, artifacts, commands, revisions, invalidation |
| [Agent execution and knowledge](04-agents-and-knowledge.md) | Durable runs, tools, technical research, evaluation, recovery |
| [Delivery and verification](05-delivery-and-verification.md) | Ordered implementation slices with evidence required to call each complete |
| [Architecture decisions](decisions/0001-foundation.md) | Selected defaults, reasons, revisit triggers, open decisions |
| [Reference scenario](examples/half-bath-change.json) | Concrete dependency and stale-result example for implementation tests |

## Decisions to build against

1. One modular application and one canonical domain model; no independently deployed specialist microservices.
2. Vite + React + TypeScript for the target workspace; retain Node/Express and MongoDB for the future server. Migrate incrementally from the current Vite frontend.
3. Shared TypeScript runtime contracts and deterministic domain functions. Browser and server must not maintain separate planning formulas.
4. Local-first development through repository interfaces and IndexedDB. A fixture runner supports the UI without backend credentials. Actual model calls and private credentials belong on the server when that phase starts.
5. A workflow coordinator delegates bounded jobs to specialists. Every durable change goes through validated commands; an agent's prose never becomes authoritative state by itself.
6. Versioned artifacts with explicit inputs, evidence, and freshness. Changing a source fact invalidates affected results and downstream release decisions.
7. Model reasoning proposes and explains; deterministic code handles units, arithmetic, dependencies, budget totals, and release conditions.
8. Code applicability is a separate finding from code retrieval. An adoption page, a retrieved section, and a project-specific technical conclusion are different records.
9. Build one narrow workflow through completion before expanding coverage. Add a second project type to prove the architecture generalizes.

## Definition of a useful product increment

A user can give the agent work to do, watch its real progress, inspect a produced artifact, resolve a decision or missing fact, and continue from the same durable state after refresh or a failed run. The result includes a next action and a visible basis. A new tab, attractive mockup, canned specialist reply, or green build alone does not meet this bar.

## Implementation boundary

**Slices 1 and 2 are implemented and tested locally.** See the [foundation evidence](slice-1-foundation.md) and [workspace evidence](slice-2-workspace.md). The main frontend now uses durable commands/repositories, typed artifact viewers, decisions, and explicit simulated runs. The old frontend remains available at `/legacy.html`.

The [Slice 3 local core](slice-3-technical-core.md) now supplies deterministic calculations, source/applicability records and gated plans. Its [local coverage and authority follow-up](local-context-and-code-coverage.md) separates exact sources, filing basis, local methods and future commerce/contractor evidence. The [coverage matrix](technical-coverage.md) keeps exact-source and qualified-review gaps open. Slice 3 is not complete as reviewed technical guidance. Hosted deployment, production credentials, and external commitments remain outside the loopback-connected workflow.

The [clearance and systems follow-up](slice-3-clearances-and-systems.md) records the latest exact-source recovery, electrical/exhaust observations and blocked review checks.

The [local clearance mapping and selected electrical increment](slice-3-local-mapping-and-electrical.md) is the latest Slice 3 evidence. It separates candidate general geometry from retained accessibility and records the still-blocked NEC alternative.

The [address-first intake and Muse handoff](property-intake-and-muse.md) records the local research export/import path. This is not connected Slice 4 agent execution.

The [candidate measurement increment](candidate-measurements.md) connects separate saved location surveys to supported geometry, option dependencies and sequenced work. Unsupported feasibility and construction release remain blocked.

The [answer-driven options increment](answer-driven-options-and-work-plan.md) compiles literal answers into conditional project options and a ten-stage sequenced work plan with dependency-tracked invalidation.

The [home-centered planning rebuild](home-centered-planning.md) replaces the supported listing project's document-first overview with property evidence, a working study proposal and a focused durable next action. It preserves the foundation and keeps generated layout design, qualified review and backend execution explicitly outside the implemented increment.

The [Hutchinson photo inventory](photo-inventory.md) adds real Muse region proposals, selectable photo elements and separate durable user direction. It records the living-room half-bath goal and reported existing basement bath. Model execution remains an external Node handoff; Mongo and in-app execution are not connected.

The [connected Muse and Mongo increment](connected-muse-and-mongo.md) adds a loopback-only single-owner API, persistent Mongo workspace, explicit local transfer and real in-app photo jobs. It preserves the same command/revision/invalidation authority. General agent conversation remains simulated; full hosted Slice 4 and technical review are not complete.

The [prompt-first workspace](prompt-first-workspace.md) replaces the dashboard opening with a centered prompt and on-demand project tools. It records the requirement for standard Muse clients to share the current application services through a future MCP adapter; that adapter is not connected by the UI change.

The [local MCP adapter](mcp-workspace-adapter.md) implements that requirement for local stdio: workspace reads plus proposal-grade commands over the shared repository, verified with a live headless client. Hosted transport, job tools, and purchasing remain future work.

The [Atlas migration](atlas-migration.md) preserves the seven original projects, history, attachments, completed jobs, catalog and private photo inputs in the configured cluster. Application processes remain local.

The [remote MCP connector](remote-mcp-connector.md) adds an authenticated Streamable-HTTP listener, owner-scoped expiring grants, casual project creation and saved-file discovery. Cluster/local database selection is shared with the web API. Real HTTP/Mongo checks pass; the consumer Muse Mac app discovered ten tools and read all seven migrated projects through a one-hour HTTPS test. It also created a separately authorized QA project and reread its brief, independently verified in Atlas. Stable hosting remains open.

[Accounts and Google login](accounts-and-google-login.md) adds optional account mode to the API: Google and Meta sign-in, per-owner workspaces, sessions, and a sign-in web surface. Password login, hosted deployment, and agent pairing remain future work.

The earlier [Muse app integration assessment](muse-app-integration.md) records the original hosted-MCP/OAuth proposal. The later [remote connector evidence](remote-mcp-connector.md) supersedes its unverified connection assumption: consumer Muse API-key pairing, reads and a separate QA brief write/read now work through temporary HTTPS.

The [scope draft](scope-draft.md) turns casual intent into versioned-recipe work packages and a complete requirement list feeding the BOM. The [commerce catalog](commerce-catalog.md) adds shared products/offers/pricing with duplicate-proof imports, deterministic tiered purchase plans, and contractor accept/decline. Seed prices are labeled demo examples; live retail integration is future work.

[Real retail pricing](retail-pricing-access.md) decides the lawful access path (affiliate feeds plus verified manual observations, no scraping) and implements recall, user submissions with review quarantine, and feed normalization.

[Agent procurement and checkout](agent-procurement-checkout.md) adds MCP catalog search, multi-retailer affiliate mapping, the customer checkout handoff, the corpus strategy, and the specified accounting and contractor slices.

The [Renovagent reconciliation](renovagent-reconciliation.md) maps the product scope and technical plan onto implemented slices, records the rename, and adapts the catalog/backlog plan.
