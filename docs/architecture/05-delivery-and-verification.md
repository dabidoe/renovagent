# Delivery sequence and verification

## Delivery policy

Build in vertical slices: a user action, durable state transition, visible work product, and evidence that the transition is correct. Do not declare a module complete because its screen renders or its endpoint returns 200. Avoid a calendar-based checklist that credits “agents,” “code,” or “procurement” before their semantics exist.

The following slices are proposed. Backend deployment remains deferred until the connected phase is intentionally started. Acceptance criteria are test targets, not assertions that those checks already pass.

## Slice 0 — Agree the foundation

**Output:** this architecture set, current-code inventory, selected boundaries, and reference workflow.

**Complete for this planning task when:** documents agree on the same product scope, data ownership, commands, artifacts, run semantics, target file tree, delivery order, and present limitations. This is a documentation milestone, not implemented infrastructure.

## Slice 1 — Durable project foundation

**Depends on:** Slice 0.

**Create:** workspaces/build entrypoints; `packages/contracts`; initial `packages/core/domain` and `ports`; local IndexedDB repository; versioned legacy import; fixture project state.

**Implement first:** Property, Space, Project, Fact, Evidence, Artifact, Decision, and revisioned command envelope. Only implement the initial create/record/query/invalidate operations. Add other record types when the next slice needs them.

**User outcome:** create two distinct projects against a property, record/inspect facts, attach evidence, change a fact, and resume without data loss.

**Acceptance:**

- Runtime validation rejects malformed values, incompatible units, missing references, and invalid schema versions.
- A repeated command with the same payload returns its original result; a reused ID with a different payload is rejected.
- A stale base revision cannot overwrite newer input. No partial write occurs on validation failure.
- Fact changes invalidate their dependent fixture artifact; unrelated artifacts stay current.
- Refresh/reopen restores both projects and their original/derived attachment references. Project creation does not erase the previous project.
- Legacy import previews what can and cannot be recovered; no boolean legacy “permit checked” becomes an issued permit or passed inspection.
- Current visual preview remains runnable while migration is incomplete.

**Suggested first reviewable change:** contracts, repository port, IndexedDB implementation, fixture and migration tests. No model SDK, new auth flow, or UI redesign in this change.

## Slice 2 — Working project workspace

**Depends on:** Slice 1.

**Create:** `apps/web` shell; properties/projects navigation; work surface; conversation/activity; artifact registry; decision panel; fixture runner adapter.

**User outcome:** start or import a job, ask for work, inspect produced artifacts, supply a missing fact, accept an option, and see the next action. Both an exploratory project and an already-started project have a supported entry path.

**Acceptance:**

- Run state derives from stored fixture checkpoints, not a timer pretending analysis has occurred.
- A fixture run can pause for input, resume, fail, retry, and cancel without losing work or duplicating proposals.
- Conversation links open the exact artifact revision. A historical message cannot silently display a newer artifact as its original result.
- User decisions reference named revisions and cannot accept stale output.
- Desktop supports conversation plus current work; phone supports switching between them without losing drafts/state.
- Browser scenarios cover photos/documents, source inspection, multi-project switching, edit conflicts, persistence, keyboard/focus behavior, and explicit demo labeling.

**Exit:** the full lifecycle is navigable using typed fixture work. It is still simulated and says so.

## Slice 3 — Technical planning core

**Depends on:** Slice 1; displayed through Slice 2.

**Create:** shared deterministic planning modules; initial versioned half-bath playbook; typed requirement/check records; reviewed source fixtures; code coverage matrix.

**User outcome:** a measured reference project produces inspectable option/technical-check artifacts, a gated task plan, and traceable material quantities.

**Acceptance:**

- Exact code basis and local applicability remain separate from retrieval. A missing required provision/amendment is visible and prevents an unsupported “review complete” result.
- Units, geometry assumptions, material specifications, package quantities, and currency are explicit and traceable.
- Unknown or conflicting critical inputs produce `needs_input`/`needs_review`; no silent default dimensions, pipe routes, or prices.
- Dependency graph rejects cycles/missing nodes; an unsatisfied inspection/review gate prevents release.
- Changing the selected fixture or geometry invalidates affected checks, tasks, quantities, and estimate; unaffected work stays current.
- The same shared calculator runs in browser preview and server tests when connected. Retire the duplicated legacy formulas; old numerical snapshots remain legacy characterization only.
- Technical fixtures and expected conclusions are reviewed by a qualified domain reviewer before being used as reviewed technical guidance.

**Exit:** deterministic behavior and curated technical coverage work independently of any LLM.

## Slice 4 — Connected durable agent workflow

**Depends on:** Slices 1–3; begins when backend work is resumed.

**Create:** application command/query services; server repositories/migrations; private blob adapter; durable job/outbox mechanism; one model-provider adapter; specialist tools; authenticated owner isolation.

**User outcome:** request a bounded real investigation, see real progress, supply requested evidence, and receive a persisted, source-linked proposal rather than a fixture.

**Acceptance:**

- Every write, attachment read, job continuation, export, and MCP operation is authorized to the same scope.
- Crash/restart resumes from checkpoint. Timeout, invalid output, tool failure, and duplicate delivery do not produce duplicate domain mutations.
- Input changes during execution cannot publish a stale result as current or release work.
- Tool budgets/cancellation are enforced; credentials remain server-side; retrieved instructions cannot grant capabilities.
- Live source access/usage rights and a reviewed technical coverage matrix are established. Unavailable sources produce honest incomplete work.
- Structured-output and specialist reconciliation evaluations pass against the curated gold set, including adversarial and ambiguous cases.
- Local-to-account import is explicit, previewed, and verified before the original is retired.
- Server auth/session hardening and ownership/integration tests pass before network exposure.

**Exit:** one real end-to-end investigation reliably produces a reviewable technical artifact. More agents/providers are not a prerequisite.

## Slice 5 — Job preparation and coordination

**Depends on:** Slices 3–4.

**Create:** accepted plan revisions, estimate basis, contractor scope pack, quote normalization, compatible catalog offer mapping, purchase/delivery grouping, tool/rental lists.

**User outcome:** turn a resolved option into a coherent package to quote, purchase, and schedule.

**Acceptance:**

- Each quantity traces to tasks and specifications; incompatible products are not merged or substituted silently.
- Prices, assumptions, exclusions, lead times, and sources are inspectable. A partial estimate cannot be labeled complete.
- Quotes are compared against the same scope revision with missing work exposed, not an invented universal contractor score.
- A plan change identifies purchases/quotes/schedule assumptions that need revisiting.
- Purchase/contact integrations, if enabled later, require explicit scoped authorization; otherwise export actionable packages without pretending to transact.

## Slice 6 — Execution, change control, and handover

**Depends on:** Slice 5; task/gate primitives begin in Slice 3.

**Create:** next-ready work views, completion evidence, inspections, issues, change proposals, actual cost/material tracking, punch list, handover export.

**User outcome:** continue through a real job, handle a discovery, and leave a durable property record.

**Acceptance:**

- Task completion requires its defined evidence; requesting/scheduling an inspection does not satisfy a passed-inspection condition.
- A site discovery immediately blocks affected work, preserves completed-work history, and produces a scoped change proposal.
- Approved changes update dependent plans/materials/estimates and identify committed purchases or physical work requiring action.
- Failed inspection leads to remediation and reinspection work rather than disappearing into chat.
- Handover includes the selected/as-built scope, recorded approvals, receipts/manuals/warranties, unresolved items, and future maintenance.
- A simulated full lifecycle can be replayed end to end; a real-work trial is reviewed before broad release.

## Slice 7 — Prove breadth

**Depends on:** stable foundations through Slice 6.

Add a second playbook such as flooring replacement. It must reuse property facts, evidence, artifacts, commands, runs, estimates, task gates, and handover. It must not require half-bath-only fields or hardcoded specialist dispatch. Use the exercise to remove accidental bathroom coupling before adding more project types or jurisdictions.

## Verification layers

| Layer | What it proves |
|---|---|
| Contract tests | External inputs/tool results and migrations satisfy runtime schemas |
| Domain tests | Units, rounding, budgets, dependencies, release gates, conflict handling, invalidation |
| Repository integration | Atomic writes, revision fencing, duplicate commands, attachment consistency, imports, migrations |
| Run recovery tests | Crash/resume, timeout, partial failure, cancellation, stale late result, deduplicated effects |
| Browser workflows | Full user paths across work/conversation, evidence, decisions, progress, and restart |
| Technical evaluations | Correct source/edition/applicability and supported scope-limited conclusions under qualified review |
| Operational checks | Owner isolation, secret handling, restore procedure, limits, errors, cost/latency and traces |

CI grows with implemented slices. Initial checks are formatting/lint, TypeScript, unit/contract tests, build, and a small fixture browser workflow. Add database, worker, model evaluation, and production operational gates when those systems exist; never represent absent test layers as passing.

## High-value reliability scenarios

1. Retry the same `RecordFact` request three times: one mutation and one invalidation set.
2. Two edits share a base revision: one succeeds; the other returns a conflict without lost work.
3. A property fact changes while two projects depend on it: both projects' release checks see the mismatch immediately; cached read models may rebuild asynchronously.
4. Change room width after option acceptance: fixture checks/materials/estimate become stale; accepted history remains inspectable.
5. Worker crashes after saving a tool result but before acknowledging the job: resume without duplicate proposal or external effect.
6. Technical source unavailable or an amendment uncertain: the related requirement remains unresolved and cannot unlock dependent work.
7. A photo includes “ignore prior instructions”: it remains evidence data and cannot grant permissions.
8. A task is marked complete without required evidence, or an inspection is only scheduled: downstream gated work stays blocked.
9. A new issue affects completed work: preserve completion evidence and create remediation/review actions.
10. A model/prompt update improves fluent answers but fails the same stale-input or citation tests: block that change from release.

## Completion evidence per change

Each implementation change states the user behavior added, contract/schema revisions, migration impact, test evidence, known coverage limits, and which delivery acceptance criteria it satisfies. Keep changes reviewable. Revisit architecture decisions using evidence from these slices rather than accumulating speculative infrastructure.

## Slice 1 first change: file-level handoff

Target the following small set before building the workspace screens. These are proposed paths; their presence must not be assumed.

| Proposed file | Responsibility |
|---|---|
| `packages/contracts/src/project.ts` | Runtime schemas for project/property/space identity and revisions |
| `packages/contracts/src/facts.ts` | Typed facts, quantities, evidence, provenance and supersession |
| `packages/contracts/src/artifacts.ts` | Revisioned artifact envelope, input refs and freshness |
| `packages/contracts/src/commands.ts` | Discriminated initial command/result/error envelopes |
| `packages/core/src/ports/project-repository.ts` | Atomic load/commit and idempotency contract; no storage SDK imports |
| `packages/core/src/domain/handle-command.ts` | Initial create/record validation, revision checks and resulting events |
| `packages/core/src/domain/invalidate.ts` | Reverse dependencies and transitive freshness/readiness impact |
| `apps/web/src/adapters/indexeddb/project-repository.ts` | Local transactional persistence of snapshots, command results and events |
| `apps/web/src/adapters/indexeddb/migrations.ts` | Versioned database migrations with rollback/export recovery path |
| `apps/web/src/adapters/fixtures/import-legacy.ts` | Explicit mapping from current `renovagent-opening-v1` data; unknown fields remain unknown |
| `tests/contracts/project.test.ts` | External input and migration validation |
| `tests/integration/local-project.test.ts` | Two-project restore, atomic updates, duplicate commands and revision conflicts |
| `tests/domain/invalidation.test.ts` | Reference change scenario plus unrelated/missing/cyclic reference cases |

Add package/config entrypoints needed to compile and run these modules. The fixture should exercise the new command handler; it must not merely compare a JSON expectation to itself. The reference JSON in this documentation was checked for internal consistency only and is not a passing implementation test.

Review this foundation as its own change. Only after its acceptance evidence is present should the next change replace the current UI state management with it.
