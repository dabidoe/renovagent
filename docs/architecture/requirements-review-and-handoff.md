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

- `rankReviewFindings(findings, work)`: scores each cited provision of a
  review (up to six per finding) and orders findings by their most relevant
  one; findings are annotated, never added, removed or re-worded. MCP
  `review_scope` exposes it as `rank: true` (labelled interpretation).
- 429/529 are retried with exponential backoff (bounded).

Status: live with the replacement key (jev-1.14.0). Example living room:
2012 model digest, 45 provisions, ~6k input tokens: R105.2 permit exemption
0.94 and IEBC Level 1 alteration 0.91 on top, toilet/GFCI/bath provisions
0.02. Photo check on the "before" render: window box at 47–60% × 27–54% and
sofa at 53–84% × 52–86%, both where they are; carpet 0.51–0.54 (uncertain).
The first key returned 401 and was replaced.

## Adopted code text for our markets (October 30, 2026, later)

The owner asked for broad coverage of the Bay Area, Austin and New York City.
Copyrighted ICC books are still not scraped (their viewer blocks automated
access); the codes as enacted are, from public sources:

| Market        | Text held (newest first)                                                                                                                                                                     | Source                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Bay Area      | California 2025 Title 24: Residential, Plumbing, Electrical, Mechanical, Existing Building, Energy, CALGreen; 2016 Residential; 2007 San Francisco Building/Housing                          | Public.Resource.Org on archive.org (`gov.ca.bsc.*`, `gov.ca.sf.*`) |
| New York City | NYC 2022 Construction Codes: Title 28 administration, Plumbing ch. 3/4/6/7/9/10, Mechanical ch. 4/5, Building ch. 8/12/24 + App. M; NYC 2008 codes; NY State 2025 Uniform Code (outside NYC) | NYC Department of Buildings PDFs; Public.Resource.Org              |
| Austin        | City of Austin amendments to the 2024 IRC, UPC, UMC, IBC/IEBC, IECC (effective July 10, 2025)                                                                                                | City of Austin EDIMS                                               |
| (all)         | 2012 IRC/IEBC/IPC/IMC/IECC model text                                                                                                                                                        | Public.Resource.Org                                                |

Scripts: `fetch-adopted-codes.mjs`, `fetch-city-codes.mjs`,
`pdf-to-text.swift` (macOS PDFKit), `split-adopted-codes.mjs` (33,213
sections), `build-adopted-digest.mjs`. A second reviewing agent picked 167
provisions per market and package; every excerpt is re-verified verbatim
(section text, or whitespace-collapsed raw text where a heading did not
parse) into `packages/core/src/planning/adopted-code-digest.ts`.

`codePlace(locality)` (`planning/code-markets.ts`) maps a reported location:
California → Title 24 statewide (+ San Francisco), New York City → NYC codes,
elsewhere in New York → NY State code, Austin → Austin amendments. The review
cites adopted text for packages it covers and falls back to the 2012 model
code per package; `codeBasis` says which. The room studio's review card has a
**Location** picker (as recorded / Bay Area / NYC / Austin / Philadelphia,
"assumed"), and the handoff states the code text and whether the location
was assumed. MCP `review_scope` and `export_contractor_handoff` take
`location`.

Notable local differences the digest carries: California 1.28 gpf toilets,
1.2 gpm lavatory faucets, 24 in front clearance, Civil Code 1101.1 fixture
replacement at permit final, Class A GFCI within 6 ft of sinks, CO alarms in
existing dwellings, R105 exemptions only where a city adopted Division II;
NYC permits by "minor alterations and ordinary repairs" (§28-105.4.2),
limited plumbing work by licensed plumbers without a permit (§28-105.4.4),
1.28 gpf / 1.5 gpm; Austin's own R105.2 exemptions, UPC fixture replacement
without permit (not showers/tubs), 65 psi regulator threshold, visitability.

Gaps: NYC 2022 is partial chapters (no 2022 ch. 9 alarms or NYC electrical);
Austin's base 2024 codes are not held (only amendments); no Oakland/San José
local amendments; adopted provisions are unreviewed and a reported location is
not a verified boundary.

## Not shipped (from the proposal)

- **Jev in the review UI.** Ranking runs through MCP (`rank: true`) and the
  API module; the web card does not call it yet (the example runs in local
  mode without the server).
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
