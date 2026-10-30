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
   topic gets one open permit finding, citing the 2012 model code's permit
   rules where the digest has them (see below). Nothing is ever called
   compliant or approved.

### Approval

Picking finishes previews in memory. "Use this design" shows what changes and
only "Approve and save" records it (`DraftScope`, a new proposed revision with
the design direction and a request derived from the pick). Review and handoff
always read the saved draft; while a pick is unsaved the review says so.

## Model codes and Jev (October 30, 2026, later)

**Which code text we hold, and why only 2012.** The ICC model codes (IRC, IBC,
IEBC, IPC, IMC, IECC) are copyrighted. Editions 2015–2024 can be read free on
ICC's site but not downloaded or scraped; full-text access for software is the
licensed ICC Code Connect API. The newest editions in the public domain are
the 2012 (and earlier) copies Public.Resource.Org posted as law incorporated
by reference. Homes fall under the IRC (one- and two-family dwellings) and the
IEBC for existing buildings, not the IBC.

Pipeline (all scripts, data in gitignored `.local/codes`):

1. `scripts/fetch-model-codes.mjs`: 2012 IRC, IEBC, IPC, IMC, IECC (OCR text)
   and the 2009 IRC HTML from archive.org (`gov.law.icc.*`), 11 MB.
2. `scripts/split-model-codes.mjs`: 4,523 sections `{code, edition, id, title,
text}` (IRC 2,297, IPC 819, IMC 792, IECC 335, IEBC 280); the fullest
   occurrence of each id wins over contents and cross-reference tables.
3. `scripts/shortlist-model-codes.mjs`: keyword shortlist per work package.
4. A reviewing subagent picked what matters per package (74 provisions across
   13 packages: permits, finishes, toilet/vanity clearances, exhaust rates,
   GFCI, smoke/CO on alterations, half-bath) with verbatim excerpts, a one-line
   "why" (its interpretation) and numeric checks only where the text states
   the number.
5. `scripts/build-code-digest.mjs` re-verifies every excerpt as an exact
   substring of the section text (74/74), drops converted numbers (two), and
   writes `packages/core/src/planning/model-code-digest.ts` (committed;
   public-domain text).

The review now adds these provisions for the planned packages: permits cite
R105.1/R105.2 (including "Painting, papering, tiling, carpeting ... and similar
finish work" as exempt) but stay `authority_confirmation_required`; numeric
rules become "Contractor confirms X ≥ value (IRC 2012 …)". Every citation says
"model code, not an adopted edition", links the archive.org copy and tells the
reader to check the edition their jurisdiction adopted at codes.iccsafe.org.
No per-edition deep links are generated: ICC's viewer could not be checked
from a script (403), so none are guessed.

**Jev (TypeSafe).** `apps/api/src/jev.ts`, server-side only:

- `rankSections(work, candidates)`: one Noul (yes-probability) per candidate
  section in one request; code supplies the candidates (digest/shortlist), Jev
  only orders them.
- `photoChecks(image, items)`: Noul "is it visible" plus Box "where" per item,
  for observations and pins on an owner's own photo (images need 280–1568 px
  per side and the `TypeSafe-Danger-Zone-Images` header; Box needs Jev 1.14;
  the API marks images as not production-ready).
- `scripts/jev-check.ts` runs both live against the example.

Status: tested with a fake that mirrors the documented API
(`tests/integration/jev.test.ts`). Live calls returned **401** with the key in
the main `.env` on both `/v1/models` and `/v1/systemone`, using the SDK's
defaults (base URL `https://api.typesafe.ai`, Bearer auth); the key has no
stray characters. Not yet wired into the review UI.

## Not shipped (from the proposal)

- **Jev in the review.** The client exists (above) but is not in the review
  until a live call succeeds and its rankings are checked on real projects.
  Model output stays labelled interpretation, never a source.
- **Adopted editions.** Living-room and bathroom work now cite the 2012 model
  code; which edition and amendments a jurisdiction adopted is still an open
  question per project (Philadelphia provisions remain the only adopted text). Jurisdiction-aware registry and freshness checks are
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
