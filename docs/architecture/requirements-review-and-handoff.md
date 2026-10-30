# "Does this work?", approval before change, contractor handoff

Status: implemented (local and connected), October 30, 2026. First increment of
the owner's `docs/MODEL_INTEGRATION.md` proposal (kept in the main checkout),
covering its "Now — hackathon" items 3–5 for scope drafts.

## What shipped

| Proposal item                                      | Shipped as                                                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| §5 "Does this work?" with three categories         | `reviewScope` (`packages/core/src/scope/scope-review.ts`), "Does this work?" card in the room studio                 |
| §4 finding statuses                                | The seven proposal statuses plus `needs_product_selection` (a product choice is not a measurement or a source)       |
| §4 source discipline (edition, section, URL, date) | Citations carry title, URL, edition, locator, retrieval date and a `reviewed` flag, copied from stored sources only  |
| §11.4 "Use this option" proposes, user approves    | "Use this design" opens a change table (walls, floor, steps added/removed, DIY and pro totals); "Approve and save"   |
| §6 contractor handoff                              | `contractorHandoff` / `projectHandoff`: Markdown with work in order, provenance, register, verify list, reply fields |
| §8 tool operations                                 | MCP `review_scope(projectId)` and `export_contractor_handoff(projectId)`, read-only, alongside `get_project_context` |

### How the review decides

Deterministic only; the card and the MCP result say "No model interpretation".

1. **Rules from fetched sources, checked against the plan.** A new floor over
   existing carpet is a `potential_conflict` quoted from the maker's guide
   (Xulon LVP: never over carpet) or This Old House (carpet comes up first for
   floating engineered wood); with carpet removal planned it passes.
2. **Measured quantities** that follow recorded measurements pass, listing the
   measurements as evidence (agent-relayed values are flagged unverified).
3. **Draft statuses become explicit unknowns**: needs-input → measure;
   needs-product-spec → choose a product; conditional → contractor confirms on
   site (with the condition); needs-source → find a primary source.
4. **Code and permits.** Requirement `codeTopics` resolve to the retrieved
   Philadelphia provisions in `planning/sources.ts` only when the project's
   jurisdiction resolves to Philadelphia (`resolveLocalContext`); then they are
   cited with edition and section and still marked "applicability not
   reviewed". Otherwise the finding asks for the jurisdiction. Work with no code
   topic gets one open "permit not researched" finding. Nothing is ever called
   compliant or approved.

### Approval

Picking finishes previews in memory. "Use this design" shows what changes and
only "Approve and save" records it (`DraftScope`, a new proposed revision with
the design direction and a request derived from the pick). Review and handoff
always read the saved draft; while a pick is unsaved the review says so.

## Not shipped (from the proposal)

- **Jev / any model in the review.** No inexpensive model is selected or
  validated; the proposal itself says to validate capabilities and cost first.
  The review's structure (findings with source IDs) is what a model would
  extend, under the same rule: model output is labelled interpretation, never
  a source.
- **Requirements for living-room work.** No code or permit source was
  retrieved for paint and floating floors, so the review says "not researched"
  rather than guessing. Jurisdiction-aware registry and freshness checks are
  "Later" items.
- PAUGO metering, `/connect` page, hosted MCP, Bunny storage, contractor
  comments on the handoff.

## Verified

- `tests/domain/scope-review.test.ts`: LVP over carpet is a cited conflict and
  removal passes; missing inputs and permits stay unknown; Philadelphia
  provisions are cited only with a Philadelphia jurisdiction, with edition,
  locator, URL and date, and never as compliance.
- `tests/integration/contractor-handoff.test.ts`: the example project's
  handoff (order, quantities, provenance, source links, permit question,
  reply fields; prep is a note, not a step).
- Headless Chrome on the example: pick sage + hardwood → change table
  (DIY $825.60 → $1,414, pro $1,876.64 → $3,263.60) → approve → scope revision
  2 → review (0 conflicts, 7 to confirm, 2 pass) → handoff. Not checked by a
  person; the MCP tools are typechecked, and their connected tests need Mongo.
