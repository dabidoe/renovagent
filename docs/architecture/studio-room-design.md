# Studio room design and saved revisions

Follow-up: [Editable furniture and photo ideas](studio-furniture-and-ideas.md) adds the 3D asset library and furnished render path.

November 2, 2026. Implemented locally; not deployed. This closes part of the
inspiration-to-project gap found in the owner's consumer Muse pressure test.
It does not complete the living-room design, procurement and contractor workflow.

## User flow

- **Design**, **Finishes**, and **Plan & budget** separate the main studio tasks.
  New design drafts default to Furnish the room; the API retains its backward-compatible
  Refresh finishes default. Refresh preserves furniture. Furnish allows furniture,
  lighting and decor additions/replacements from a text brief, an optional inspiration
  photo, or both, with owner-entered items to keep. The intake brief carries into Design.
- Both model stages receive the mode and keep instructions. The website uses the
  current floor preview as the base image, asks to preserve that floor, and sends
  the currently selected paint. Rugs remain available as inspiration items;
  flooring stays under its own controls. These are model instructions, not a
  guarantee that generated pixels obey them.
- Inspiration selections, the brief, keep instructions and returned proposed changes
  stay with the room. Up to 12 generated versions retain their original image and
  finish/request signatures. Revisiting an older image does not overwrite current
  finish choices; mismatches remain visible.
- Generated furniture/decor proposals accumulate in a structured per-room list.
  Owners can add/edit/remove items, choose Add/Replace/Keep, record quantities,
  enter unit allowances and attach a product URL. Unknown quantities/prices remain
  unknown; retained items are excluded from buying totals. Shared pure domain
  arithmetic computes allowances in integer cents. The header, room list, shopping
  sheet and copied list agree; owner allowances stay separate from demo finish prices.
  No store URL is fetched or treated as an offer.
- A render records its finish/request signatures. Changing choices exposes a
  previous-design warning. It does not silently regenerate or claim the old image
  depicts the new choices. Existing legacy renders without signatures are treated
  as previous designs.
- Price tier is persisted. Edit measurements remains available after a correction;
  entering a size replaces the estimate note without creating a verified site fact.

## Saved project boundary

**Save project** sends a validated `studio-design` proposal to the owner-scoped
workspace. A first save uses the existing project-intent service and then
`ProposeArtifact`; subsequent saves require the expected artifact revision.
Identical retries are idempotent. Conflicting writes are rejected. Historical
snapshots remain fixed. No save approves construction, accepts an artifact or
records photo estimates as measured facts.

The snapshot contract is in `packages/contracts/src/studio-design.ts`: room
images/masks, dimensions and their estimate notes, picks, tier, inspiration drafts,
render history/references/signatures and structured room items with owner allowances. It identifies listing examples
separately from owner projects. It stores choices, not fabricated furniture prices;
paint/floor allowances are recomputed by the existing shared demo engine.

Signed-out photo intake keeps selected File objects in memory while the owner
continues as a guest; it resumes the account repository and upload without a page
reload or implicit import of unrelated local records.

API: POST `/api/workspace/studio-designs`; GET
`/api/workspace/studio-designs/<projectId>/<revision>` (latest when revision omitted).
Every server-image reference must exist for the same owner. Browser reopening uses
`/#design/<encodedProjectId>/<revision>` and loads that exact snapshot ahead of any
browser-local edits. A later save advances the URL. Private links require the
same owner session; they do not publish images or confer access.

Muse sees saved projects through `list_projects`, finds their `studio-design`
artifact through `list_project_files`, and reads exact revisions with `get_artifact`.
Unsaved work remains browser-local. The older MCP `save_plan` collection is still
separate. MCP `draft_scope` now exposes the existing `living-room-refresh` recipe
(wall-paint, carpet-removal, floating hardwood/LVP, removal/protection). Its optional
`sourceDesignRef` must identify the current studio-design in the same project.
The resulting draft references that exact revision; a subsequent design save
marks the scope and its dependent artifacts stale. Existing `review_scope` and
`export_contractor_handoff` work on this bounded finish scope. No photo estimate
is automatically turned into a reported measurement. Canonical fact/scope changes
are not yet reconciled back into studio controls; this is not a general
bidirectional planning command interface.

Website **Save & prepare work plan** calls POST
`/api/workspace/studio-designs/prepare-scope` for the current saved room/revision.
It uses the same bounded living-room recipe and provenance rules, returning checks,
coverage and downloadable proposed handoff Markdown. Photo estimates remain unknown
for formal scope quantities. Owner-entered dimensions are relayed as unverified
reported inputs. A separate furnishing appendix preserves item actions, unknowns,
allowances and owner product links, without claiming furnishing installation scope.
The download is disabled after local edits until the work plan is updated.
Multi-room projects with ambiguous canonical dimension facts require review first.

## Verification and remaining gaps

Tests use fixture providers and isolated local Mongo databases: backward-compatible
refresh defaults, direct design without a reference, furnishing and protected objects
reaching both model stages, floor preservation, invalid requests failing before
provider calls, exact snapshot reads (including item allowances and design history),
retry idempotency, stale-write rejection, image ownership, real MCP client discovery,
work-plan output and no promotion of photo estimates to measured facts.

Browser QA on a disposable account-mode local database covered photo intake → guest
continuation without losing the file/brief, direct design, three image versions,
older-image warnings, owner allowance math (2 × $125.50 = $251), Keep exclusions,
shopping sheet consistency, save/reload and a real Markdown download inspected as
text. Layout had no horizontal overflow at 320/390/1280 px. Earlier checks also
covered inspiration upload, corrected measurements and room isolation.

A separate bounded real-provider evaluation used the bundled public Oakland source
photo, no inspiration reference, one Muse Spark read and one Muse Image edit (zero
segmentation calls), and a disposable local database. The output visibly added a
cream sofa, walnut table, striped rug, tan chair and floor lamp while retaining the
recognisable windows, door, ceiling fixture and camera. This is one evaluated case,
not a general fit/preservation guarantee. UI QA replayed that image through fixture
providers; it did not perform additional live generation. No Atlas writes, deployment
or fresh consumer Muse round-trip occurred.

Verification: production build, types, boundaries and changed-file formatting pass;
15 legacy + 284 TypeScript tests pass (52 regular-suite skips), and all 59 connected
tests pass.

Still open: measured furniture placement and exact product geometry; exact furniture products and
live prices; a complete furnishing recipe with supporting materials and labour;
furniture fit/electrical/clearance review; a contractor-ready full-room scope;
direct MCP photo upload/generation/image return; broad real-model evaluations and
a fresh consumer Muse round-trip. A saved image and a green build do not establish
those capabilities.
