# Project implementation direction

Unpermitted.ai is a full home improvement workflow product. The half bath is the first reference scenario, not a hardcoded domain boundary. A conversational brief is the first artifact, not the destination.

Before architecture or substantial feature work, read `docs/architecture/README.md` and the relevant linked specifications. Current implementation status is in `PROGRESS.md`; earlier vision/checklists are historical. Architecture files describe the target and must not be treated as already implemented.

## Build principles

- Preserve the working local preview while migrating in reviewable slices. Delivery slices and acceptance gates are specified in `docs/architecture/05-delivery-and-verification.md`.
- Domain state changes go through validated commands. Shared contracts/domain code owns units, calculations, dependencies, revision conflicts, invalidation, and release rules.
- Agent output proposes artifacts/changes. It does not bypass authorization, overwrite source facts, approve itself, mark inspections passed, or directly patch canonical state.
- Keep reported observations, assumptions, retrieved sources, applicability findings, and verified evidence distinguishable.
- No invented physical defaults, code citations, live prices, verified contractor credentials, or savings claims. Demo fixtures must stay visibly identified as such.
- Keep the property/project model general. Specialize technical scope through versioned playbooks.
- Centralize planning formulas rather than maintaining browser/server copies. Existing duplicated engines and CODE_DB are legacy demos pending validation/replacement.
- Keep provider/database/UI dependencies out of the pure domain. Credentials and real model/tool execution belong behind the server boundary when connected work is authorized.
- Updating a fact must expose downstream stale results and block releases that depend on them. Preserve accepted revisions and actual physical-work history.
- Use the implemented slice's acceptance criteria and meaningful tests. Record what actually passed and what remains simulated or unverified; do not equate a green build with product completeness.

## Current commands

- `npm run dev` — local Vite frontend, normally at http://127.0.0.1:8741/.
- `npm test` — legacy JavaScript tests plus contract, domain, and integration TypeScript suites.
- `npm run build` — frontend production build.

Slice 1 now exists in `packages/contracts`, `packages/core`, and `apps/web/src/adapters`. Read `docs/architecture/slice-1-foundation.md` for implemented APIs and limits; the main product now uses the repository through the Slice 2 React workspace. Read `docs/architecture/slice-2-workspace.md` for its contracts, fixture workflow, migration, and limits. The earlier preview remains at `/legacy.html`. The local Slice 3 technical core is implemented in `packages/core/src/planning` and `apps/web/src/features/technical`; read `docs/architecture/slice-3-technical-core.md` and `docs/architecture/technical-coverage.md`. Read `docs/architecture/local-context-and-code-coverage.md` for local sources, applicability branches, source-quality guards, locality contracts and additive migration. Exact-source coverage and qualified review gates remain open; do not claim reviewed technical guidance or release construction. Other target subsystems are not implemented. Do not silently start server/deployment/credential work merely because it appears in the target architecture; follow the user's active task scope.
