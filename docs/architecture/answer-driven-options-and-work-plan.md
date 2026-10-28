# Saved direction → conditional options and sequenced work

Implemented locally October 27, 2026. Backend off. This is a bounded investigation-planning increment, not completed Slice 3 technical coverage or construction release.

## What now works

From the working brief or “The plan,” compile three conditional study options for the Bingham kitchen/additional-powder-room scenario:

- Kitchen refresh first, with the additional powder room deferred.
- Kitchen refresh plus investigation of a nominated ground-floor/understair candidate.
- Kitchen refresh plus investigation of a nominated basement candidate.

Each option shows proposed scope, exclusions, relevant literal answers and exact response revision links, source photo links, missing choices, candidate-specific survey requirements, qualified feasibility, local code applicability, permit/inspection requirements and unresolved resource/budget inputs. Unsupported drainage, headroom, structure, service routing and code coverage stay blocked. Photos are reference leads; they are not measurements or code evidence. Code/permit/resource gates have no photo citations purporting to establish those requirements.

“Sequence this option” chooses an investigation focus. It saves a ten-stage conditional sequence: reconcile scope; measured survey and qualified site/services investigation in parallel; design dependent on both; approvals/specifications/budget preparation; future protection/isolation/removal; approved rough work; an inspection/review hold before concealment; finishes/connections; actual testing, final authority outcomes and handover. Each stage records predecessors, evidence/hold requirements and `not-reported` completion. Preparation, physical work, inspection and handover remain blocked. There is no task-completion, purchase, inspection-pass or construction-release control.

## Meaning and coverage

`kitchen-powder-study/1` is an explicit versioned local scope recipe, separate from the technical half-bath playbook. It binds the six known Muse question texts by meaning through exact text matching, not array position, keyword guesses or a hidden model call. Unrecognized question sets are refused with an unsupported-recipe explanation. The general artifact/contracts model can carry other recipes; this increment does not fabricate coverage for other projects.

Responses are arbitrary free text. The compiler quotes them and preserves their `direction`, `unsure` or `deferred` meaning, but does not infer yes/no or claim that an alternative satisfies every clause. All option fit remains `needs-reconciliation`, including when all six responses are marked reported direction. In particular, a response declining a basement or understair location is retained visibly; the conditional candidate is not presented as compatible. Explicit scope reconciliation remains the first planning step. Existing-bath alterations require a separately resolved scope. Unknown room dimensions, condition, routes, prices, durations and contractor credentials are not invented.

Current technical example inputs or listing/assessor floor area cannot establish a measured layout for a new candidate location. The subsequent [candidate measurement increment](candidate-measurements.md) upgrades the recipe to version 2 and connects separate reported surveys and supported arithmetic. It adds no qualified review acceptance or measured fixture-layout path; unsupported feasibility gates remain unresolved.

## Durable contracts and dependencies

- `BuildProjectOptions` fences the exact current research ref, the complete current answer-ref set and expected target options revision. It saves `project-options`, a system conversation link and the selected work view atomically.
- `PlanProjectOption` fences a current exact options revision, a named option in that revision and the expected work-plan revision. It saves `project-work-plan`, a system link and work view atomically. Choosing an investigation focus is not design acceptance.
- Generic `ProposeArtifact` cannot create or replace either protected kind. Caller-supplied release/status fields are not accepted by these commands; the pure compiler owns their outputs.
- Options consume exact research, saved response and context refs. Plans consume the exact options revision and capture context membership. First answers, corrections, source imports, goal/address changes and recipe drift stale affected output. Unrelated physical calculations keep their existing physical-fact dependencies.
- Rebuilds preserve old versions, accepted history and exact historical conversation links. Stale selections and stale acceptance are rejected. Repeated identical command IDs are idempotent; conflicting payloads/target revisions fail without partial writes.
- Sequence validation rejects duplicate IDs, missing/forward/cyclic predecessors, completion claims, absent blockers and nonblocked physical/inspection/preparation/handover stages.

No root snapshot migration was required: these are additive discriminated artifact payloads and validated commands. The pure domain retains no UI/storage/provider dependencies. The preview and `/legacy.html` remain available.

## Verification evidence

Seven integration scenarios in `tests/integration/scope-planning.test.ts` use the actual Muse receipt with synthetic, explicitly labeled responses. Coverage includes distinct option survey/feasibility branches, literal conditional/negative preferences, source and response refs, persistent sequences for all three alternatives, survey/services joins, inspection holds, immutable physical-work blocks, sequence validation, accepted/historical versions, downstream versus unrelated invalidation, source/goal/address changes, target and answer conflicts, idempotency, rejected generic writes, foreign project selection, unsupported question bindings, reordered question identity and obsolete recipe revisions.

Browser verification in **Muse answers · workflow QA only**: built options from six saved test responses; inspected basement dependencies; saved a basement sequence; corrected a response; observed both artifacts become stale and all three sequence actions disabled; rebuilt current revisions; refreshed and confirmed the saved sequence and gates survived. Screenshots: `docs/previews/project-options.png` and `docs/previews/project-sequence.png`.

The original Bingham project has no actual owner responses. Its compiled options therefore show all six directions missing; no example preference is promoted into that project and no study location is silently selected. No Muse, provider, backend, procurement or external action was executed for this increment.

Verification passed: **120 tests** (15 legacy JavaScript + 105 TypeScript), strict type checking, dependency boundaries, formatting, frontend production build and foundation build. The existing main-bundle size advisory remains.
