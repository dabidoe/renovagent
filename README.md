# Unpermitted.ai

**Questionable name. Surprisingly sound advice.**

An AI construction crew that helps homeowners plan a renovation once — and stop losing money on extra store trips, overbuying, and rework.

**Live demo concept:** Convert a first-floor space in a Philadelphia rowhouse into a half bathroom.

## Build direction

The product is a home improvement agent spanning property investigation, options, technical resolution, job preparation, coordination, execution, and handover. Chat directs the work; persistent project artifacts and evidence hold the results.

Start with the **[canonical architecture and build plan](docs/architecture/README.md)**. It includes the target repository structure, domain/command contracts, agent execution and knowledge design, current-code audit, and implementation slices with acceptance criteria. [PROGRESS.md](PROGRESS.md) distinguishes implemented prototypes from planned capabilities.

The durable project foundation is now implemented beside the preview: shared runtime contracts, transactional IndexedDB, versioned facts/artifacts, idempotent commands, downstream invalidation, and explicit legacy import. See [Slice 1 verification and limits](docs/architecture/slice-1-foundation.md). The product UI now uses that repository. See [Slice 2 workspace evidence](docs/architecture/slice-2-workspace.md). The backend remains off. [Slice 3](docs/architecture/slice-3-technical-core.md) adds real shared calculations and source/applicability/gate records; [Local coverage](docs/architecture/local-context-and-code-coverage.md) now includes explicit adopted/retained bases, local provision checks and reported-locality evidence contracts; qualified technical review and complete code coverage remain open.

For real-browser checks, open `/foundation.html` on the dev server. `npm test` runs the existing and foundation suites; `npm run build` checks TypeScript/module boundaries and separately builds the product and diagnostic; `npm run format:check` checks the new sources.

## Current workspace preview

Run `npm run dev` and open http://127.0.0.1:8741/. Start a project or explicitly open a simulated example. Conversation sits beside the selected artifact; projects, sources, decisions, revision history, unsent drafts, and local fixture runs persist in IndexedDB. On phones, switch between work and conversation.

Agent work is clearly simulated and advances through saved checkpoints. The Technical work surface separately runs real deterministic calculations from explicit measured inputs; calculation, source access and qualified review are labeled independently. No backend, model, code research, file interpretation, purchasing, or professional approval is connected. The current workflow and verification are documented in [Slice 2](docs/architecture/slice-2-workspace.md).

The old intake frontend remains at `/legacy.html`. Import its localStorage project through the workspace's explicit preview/confirmation flow; the original source is preserved. `/foundation.html` runs a separate developer diagnostic database.

## Status and historical demo

Day-by-day status: [PROGRESS.md](PROGRESS.md) · Live demo: https://dabidoe.github.io/unpermitted-ai/

## Run locally

```bash
npm install
npm run dev
# open http://127.0.0.1:8741/
```

The current workspace needs no sign-in or server. State and original uploaded files are stored in this browser's IndexedDB. `npm test` runs legacy, contract, domain, and repository/workspace integration suites; `npm run build` checks TypeScript and module boundaries and builds the product, legacy preview, and foundation diagnostic.

The existing `server/` scaffold is disconnected from the workspace. Its MongoDB, authentication, and MCP setup belongs to a later connected-work slice.

## Project layout

- `index.html` and `apps/web/src/main.tsx` — React workspace entry; `apps/web/src/app/` — application/controller; `features/` — conversation, artifacts, sources, and activity
- `packages/contracts/` — runtime schemas and command contracts; `packages/core/` — pure domain and repository ports
- `apps/web/src/adapters/` — transactional IndexedDB and explicit legacy import
- `legacy.html` and `src/` — preserved earlier frontend and legacy demo calculations
- `server/` — disconnected Express/TypeScript/MongoDB scaffold and legacy MCP tools
- `tests/` — legacy JavaScript plus TypeScript contract, domain, and integration tests
- `docs/architecture/` — target architecture, delivery gates, and implemented-slice evidence
- `AGENTS.md` — implementation direction for future coding work

## Muse integration

The existing server exposes MCP tools (`list_projects`, `get_project_plan`, `run_crew`) at `/mcp`, using its session-token authentication. These tools expose legacy demo calculations and canned findings, not a durable agent workflow. Third-party OAuth integration has not been implemented. In the target architecture, MCP delegates to the same scoped application services as HTTP.

## Earlier prototype: intended savings mechanisms

- **Fewer trips:** materials are consolidated into phased purchasing groups instead of unplanned one-off runs.
- **Less overbuy:** every material shows need → waste allowance → package rounding → buy quantity. Existing garage inventory is subtracted.
- **Less rework:** tasks stay blocked until prerequisites and permit/inspection hold points are cleared. Specialist crew reviews flag missing vent paths, GFCI, and fan issues before work starts.
- **Budget control:** changing dimensions, layout, floor finish, or budget instantly recalculates cost, materials, trips, savings, contractor scope, and the revision log.

## Legacy demo features (not wired into the current opening)

- Intake for room dimensions, stack distance, layout, floor finish, and budget.
- Phased task plan with dependencies and hold points (Dwang, GC).
- Deterministic bill of materials with waste, package rounding, inventory, and source-task traceability.
- Grouped shopping trips and an exportable shopping list.
- Crew Meeting with structured findings from Dwang (GC), Pete (plumbing), and Sparky (electrical).
- Contractor scope-of-work generator and due-diligence checklist (unknown = unverified).

## Product and technical plan

See the [current build architecture](docs/architecture/README.md) for implementation direction and acceptance gates. The [original vision](docs/Unpermitted.ai.md) is retained as historical product context.

## Safety

Guidance only. This is not a substitute for licensed trade advice or city inspection. Plumbing and electrical work usually requires permits and inspections — the app flags those hold points; it does not help dodge them.

## Hackathon

Indie Developer track · October 2026 · Initial use case: first-floor half-bathroom renovation.
