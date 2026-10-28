# Slice 3 — Local deterministic technical core

Initial core implemented October 27, 2026. **Follow-up:** [local provision coverage, applicability and locality](local-context-and-code-coverage.md) supersedes the initial source/coverage details below. The preview remains at `/`; `/legacy.html` and `/foundation.html` remain available. No server, credentials, model execution or deployment was enabled.

**Delivery status: deterministic local core implemented; qualified technical review gate open.** This is not completion of the reviewed-guidance acceptance criterion. Exact clearance provisions, local/PA amendment reconciliation, accessibility applicability and several trade topics are deliberately unavailable or unresolved. A green software test suite cannot close those gaps.

## Working user path

Open a project → Technical work → enter measured inputs (or explicitly load synthetic examples) → Save inputs & calculate. The command batch saves source observations, versioned input records and deterministic results atomically. Inspect geometry, applicability, quantities, partial cost, gated work and source register using the artifact navigation. Change inputs to produce replacements; old conversation links keep the original revisions.

The half-bath playbook is selected explicitly by entering this work surface; no project-name classifier dispatches technical rules. Other projects can keep using the general workspace. This first playbook covers one rectangular layout, not arbitrary rooms or all renovation types.

## What actually calculates

| Method | Inputs and behavior |
|---|---|
| Unit conversion | Shared dimensional conversion with the foundation fact normalizer; planning length resolution is 0.000001 mm, with a 10 km supported-length ceiling. Unknown is null, distinct from zero |
| Geometry | Finished width × length, perimeter, named fixture footprints, wall/footprint conflicts, toilet centerline and front distances within the declared orientation, supplied manufacturer constraints |
| Route observation | Supplied available fall / horizontal run × 100. No slope requirement, pipe sizing, fittings or vent route is inferred |
| Floor takeoff | Explicit specification, area, allowance in integer basis points with rationale, compatible usable inventory and product package coverage |
| Packages | `ceil(max(0, area × (1 + allowance) − inventory) / package coverage)`; only purchase packages are rounded up. A floating-point boundary tolerance removes binary arithmetic noise, not material quantities |
| Partial cost | Integer package count × sourced package price in minor units, safe-integer checked. USD/CAD/EUR/GBP currently supported (two minor-unit digits). Unknown prices stay unknown |
| Task readiness | Validated dependency DAG and distinct review, permit, rough-inspection and final-inspection gates. Scheduled inspection or evidence-free pass cannot satisfy an inspection gate |

Geometry supports a toilet facing the room length from the back wall and a basin against the opposite wall. Door clearance is a **reported survey status**, not a swept-door computation. No wall composition, concealed route, fixture model, product allowance, inventory or price is defaulted. The drawing uses exact consumed dimensions/footprints; it is not a construction drawing.

Floor quantities exclude unmeasured deductions and all unselected plumbing/electrical/finish products. The cost is a partial floor-material subtotal, excluding labor, other products, tax, delivery, permits, disposal and contingency. An arithmetic result does not establish a procurement-ready or technically approved scope.

## Code basis, applicability and evidence

Source package `philadelphia-half-bath-2026-10-27.2` records authority/publisher URLs, exact locators, edition, retrieval date, access status, unreviewed status, and SHA-256 of each **curated paraphrase**. These are not hashes of full remote code snapshots. No copyrighted full-code collection was ingested.

- [Philadelphia L&I applicable codes](https://www.phila.gov/departments/department-of-licenses-and-inspections/resources/applicable-codes/) supplies adoption metadata and the separate accessibility basis.
- [Enacted Bill 250645](https://phila.legistar.com/LegislationDetail.aspx?FullText=1&GUID=349F6C13-53C4-4B7C-9E9F-FD51948829F0&ID=7436521), Subcode P, **P-101.2 / P-103.2**, supplies plumbing scope and permit-rule candidates. Building-code and plumbing-code paths are not collapsed into a blanket IRC-versus-IBC switch.
- [2021 IPC Chapter 4](https://codes.iccsafe.org/content/IPC2021P1/chapter-4-fixtures-faucets-and-fixture-fittings), candidate **405.3.1**, could not be retrieved (HTTP 403). No remembered numerical code minimum is applied. Manufacturer thresholds entered by the user are a separate constraint class.

The rule-based candidate path requires Philadelphia, the covered building description, new half-bath scope, available sources, and an application date from July 1, 2026 through the source capture date (October 27, 2026). Later dates require a refreshed adoption basis; earlier transition dates, other jurisdictions/building types, replacements and other scopes are outside this source package. Missing inputs remain `needs_input`; classification, applicability, amendments, exceptions and trade coverage remain `needs_review`. The package cannot emit `reviewComplete: true` or a supported code-compliance result.

The [technical coverage matrix](technical-coverage.md) records the missing reviewer and provisions. Runtime retrieval, professional review and authority integrations are not connected.

## Durable commands and dependencies

New validated commands:

- `SavePlanningInputs`: source evidence plus explicit expected revisions for site/layout/finish/context. A stale editor conflicts; a failed calculation or reference validation rolls the entire browser batch back.
- `CalculatePlanning`: reads canonical input revisions, executes the shared functions, validates the task graph, and stores typed outputs. Identical current results are not duplicated. Changed inputs produce proposed replacements.

Typed artifacts: `planning-inputs`, `planning-sources`, `measured-layout`, `code-assessment`, `quantity-takeoff`, `cost-plan`, `gated-plan`. Direct `ProposeArtifact` calls cannot forge these outputs or overwrite reserved planning artifact IDs. Input records are user-reported or explicitly example-based, never professionally verified. Supporting observations/files can be selected as evidence; attaching a file does not analyze it.

Dependencies are deliberately narrow:

```text
site + layout + applicable room facts → geometry
site + finish + applicable room facts → floor quantities → partial cost
context → source basis → code applicability
geometry + code applicability + quantities → gated task plan
```

Exact `finishedWidth` / `finishedLength` facts in the project's subject scope are compared against the planning inputs. A conflicting, unknown or assumed observation requires review rather than silently replacing a dimension. A membership signature detects new relevant facts as well as revisions of already consumed facts. Other free-text fact keys are not parsed into physical quantities.

Changing geometry invalidates quantities/cost/tasks, preserving independent code basis and unrelated work. Changing fixture selection invalidates geometry/tasks while retaining unaffected floor quantities. Source access, context or package-version changes invalidate code and dependent work. Readiness and acceptance fence transitive references, including source-package drift before refresh. Accepted history remains intact.

Workspace snapshot schema stays **2**: new command/payload variants and optional scoped fact-context metadata are additive. Existing schema-1 migration and schema-2 data remain readable. Older application binaries do not understand the new payload variants and must not be used to edit this database.

## Release boundary

Only evidence collection is initially ready. All construction tasks remain gated. User acceptance of an artifact cannot establish technical review, issue a permit, mark a predecessor physically complete or pass an inspection.

The pure gate evaluator can test supplied completion/gate evidence; the canonical workspace currently has no command that grants those outcomes. Its read model supplies no fabricated completions or gate evidence. Evidence-backed completion/inspection commands and role authorization remain later delivery work. The evaluator itself is not an authority-record validation API.

## Files

- `packages/contracts/src/planning.ts`: explicit inputs, sources/checks, task and output schemas.
- `packages/core/src/domain/quantities.ts`: shared foundation unit normalization.
- `packages/core/src/planning/`: deterministic calculators, source metadata, half-bath applicability/playbook, narrow physical-fact context and command publication.
- `apps/web/src/features/technical/`: input editor, calculation/source/coverage/gate viewers and proportional sketch.
- `fixtures/projects/technical-reference.ts`: explicitly synthetic numerical reference.
- `tests/domain/planning.test.ts`, `tests/integration/planning.test.ts`: numerical, gate, persistence, conflict and invalidation checks.
- `server/src/engine.ts`: disconnected legacy compatibility wrapper importing the preserved `src/engine.js`; the duplicated server math was removed. Legacy numerical tests remain characterization tests only.

## Verification

66 tests pass: 15 legacy JavaScript tests and 51 TypeScript contract/domain/repository/workspace/planning tests. New tests cover conversions and mixed-unit boundaries; missing/rough/conflicting inputs; collisions and door conflicts; decimal allowance, inventory, package rounding and price completeness; candidate/out-of-coverage applicability; DAG errors; scheduled/unsupported inspection evidence; restore; idempotency; editor conflicts; selective and transitive invalidation; source-version drift; newly conflicting physical facts; stale acceptance; preserved accepted history; and forged technical output rejection.

Strict frontend TypeScript, dependency boundaries, product/legacy/diagnostic builds, formatting and disconnected server `tsc --noEmit` are checked. Browser verification covers calculating an explicit example, source links/coverage, accepted revision history after changing width, refreshed quantities, blocked tasks and reopen. These are software checks, not qualified technical validation.

Do not move to connected agent work or represent reviewed technical guidance until permitted exact sources, amendment/exception coverage and a qualified domain review are supplied and recorded.
