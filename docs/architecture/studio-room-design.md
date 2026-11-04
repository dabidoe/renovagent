# Studio room design and saved revisions

Follow-up: [Editable furniture and photo ideas](studio-furniture-and-ideas.md) adds the 3D asset library and furnished render path.

## Public example templates — November 4, local

Public listing studios, Hutchinson, furnished directions and prepared samples now
open from their bundled template, with an isolated `example-copy-<uuid>` browser
namespace. They ignore legacy template-keyed edits, saved-project metadata and
pending save commands; those records are left intact. A first design edit uses the
existing validated studio save service to create a new owner-scoped project, with
a separate snapshot identity. Later saves update only that copy. Browsing and
switching views do not create a workspace project or run inference.

An edited history entry remembers its draft scope so refresh and a lost response
replay the exact persisted request through `StudioSync`, without duplicate copies.
Dimensions are edited on the copied project and recover with its draft snapshot.
Successful saves retain the existing private saved-design URL behavior. Opening
the public template again starts fresh; saved copies remain available in My
projects. The editor controls/layout and canonical command/revision protections
are unchanged. The read-only bedroom inspiration walkthrough has no editable
project state and continues to hand off to the owner's photo intake.

Verification: build/types/boundaries; regular tests (15 legacy and 336 TS passed,
59 skipped; the one sandbox-blocked localhost hosting test passed separately with
listener permission); two focused copy tests; 66 offline browser isolation/retry checks
for all three listings, a furnished direction and a prepared sample; and 26
desktop/phone furniture/rotation checks using private draft scopes. The browser
APIs are fixtures, not live account/database verification. Existing checks that
seed/read template-keyed browser state describe the superseded editing behavior.
No production writes, model calls or deployment.

## Canvas layout — November 3, local

**Top save/autosave follow-up:** Save look and live save status sit above the
canvas beside the estimate and comparison controls. Save look opens Compare and
focuses naming; choosing which variation to name remains explicit. Browser drafts
are acknowledged after a successful debounced local-storage write and show failure
instead of an unearned saved claim. Existing per-field browser recovery remains in
place. A first workspace save for an example is explicit; merely browsing an example
does not create an account project. Once linked, later edits autosave through the
existing serialized revision writer, just as own projects do. Pending requests,
revision conflicts and authorization failures retain existing protections. The top
row exposes retry and distinguishes workspace saves from browser-only copies.

Verification: build/type/boundary checks; four sync tests; 56 fixture browser
assertions at 1440/1024/390/320 px for placement above the image, direct naming,
browser reload, explicit initial workspace linking, automatic following revisions
and exact failed-request replay. Captures in `.local/studio-save-qa/` were visually
reviewed. These are local fixture checks, with no live model/account/database work
or deployment.

**Comparison and clarity follow-up:** Compare offers independent left/right
choices from the source photo, current finishes, generated photo history, current
3D render and named saved looks. Up to twelve looks per room can freeze a finish
pick or an existing image reference. Rename/delete operates on that working set;
comparison does not restore old room choices or mutate prior canonical revisions.
The optional `comparisonStyles` snapshot field is backward compatible. The save
boundary checks room IDs, unique look IDs and owner access for referenced images.
Original-vs-live retains the finish slider; other combinations use separate images
with source/preview/generated labels instead of implying pixel registration.

The per-room estimate now says **Room estimate**. Work-plan preparation is under
**Optional paint & floor work plan**, with an explicit explanation that it saves
the design and proposes tasks/checks rather than calculating the displayed room
cost. It retains the bounded scope and stale-download gates below. The empty room
list omits disabled allowance-fill controls and full pricing caveats until items
exist. Paint line assumptions are collapsed; the example material allowance level
is a secondary selector, not claimed ProMar/SuperPaint/Emerald retail pricing.

Focused verification: 76 browser assertions at 1440/1024/390/320 px for saved-look
naming/reload, independent comparison sides, no historical-choice application,
vanity rotation, scroll-through, pinch and button zoom, optional work-plan controls
and overflow. Both studio integration suites pass with local Mongo/fixture
providers, including exact look snapshots and rejection of foreign images/room
IDs. Regular tests pass 15 legacy + 330 TypeScript cases (52 skips); the existing
studio fixture flow passes 240 checks. Captures in `.local/studio-usability-qa/`
were reviewed; all 202 public UI guardrails pass. No production writes, live
generation or deployment were used.

**Toolbar/Furnishings follow-up:** supersedes the initial catch-all Paint, floor &
style entry described below. One toolbar beneath the preview exposes Paint, Floor,
Furnishings and secondary Room settings. Paint opens the existing full catalog
picker directly (brand/family/search/custom color); Floor exposes the existing
floor options. Each panel expands below the toolbar and can be closed or dismissed
with Escape. Switching task closes the other editor. Paint/floor choices stay in
the live finish comparison, even if a generated image exists; that generated still
does not pretend to update with a color click. A separate comparison selector can
show the generated photo against its source. Existing paint masks, floor previews,
availability warnings and calculated material totals remain in use.

The main 3D mode and toolbar entry are now called **Furnishings**. Both open the
3D scene and placement library directly, with the existing Render with Muse action.
Photo ideas/restyling is an explicitly secondary editing tab. No new model,
placement inference or rendering behavior was added. The offline toolbar check
(`scripts/studio-finish-toolbar-check.mjs`) passes 88 checks at four widths; the
updated 232-check studio flow passes too. Desktop and phone captures in
`.local/finish-toolbar-qa/` were visually reviewed. Catalog fixtures verify picker
interaction rather than live catalog completeness; no provider spend or production
mutation was performed.

This supersedes the upper summary sidebar and always-expanded editing workspace
described below. The room canvas fills the available width. Design / Compare / 3D
sit between room identity and the project estimate on desktop, wrapping below them
on phones. Project metadata, source credits, revision links and reset/history
controls remain accessible through the Project disclosure; Save project and any
save error or sign-in continuation stay outside that disclosure.

**Paint, floor & style** opens the existing controls in a collapsible full-width
section below the image. This implements the below-image variant of the mockup,
rather than reintroducing a narrow editor drawer. Close and Escape return focus
to the trigger. Closing preserves mounted drafts; completed renders close the
controls and return to the room. Measurement editing and the 3D furniture shortcut
open the relevant controls. Provider requests, persistence and authorization remain
unchanged.

Design displays a whole generated image or an explicitly labeled finishes preview.
Compare shows the source and selected generated design side by side (stacked on
phones), without implying pixel alignment or reconstructed geometry. 3D-generated
stills also appear in Design and update the room thumbnail. When both photo and
model outputs exist, source buttons let the owner choose; the display preference
is browser-local. Both original outputs and saved revisions remain intact. Existing
signature checks flag changed finishes/layouts rather than silently updating pixels.

The room list uses compact cards with illustrative library-model thumbnails and
one expanded item editor at a time. Unsupported names get a neutral placeholder.
These are generic library illustrations, not exact retail product photos. Unknown
quantities and prices stay unknown; existing allowance calculations, Keep exclusions,
undo/redo/reset and the saved work-plan flow are unchanged.

Verification: build/types/boundaries and changed-file formatting pass; 15 legacy
and 327 TypeScript tests pass (52 connected cases skipped). The updated offline
studio check passes 232 assertions at 1440/1024/390/320 px, including collapsed
defaults, draft retention, view placement, photo/model thumbnail updates, separate
comparison images, furnished captures, signature invalidation and room isolation.
The furniture budget/undo fixture check passes at 1440/390/320 px; all 202 public
UI checks pass, including source-credit access through the new disclosure.
Desktop and phone captures in `.local/room-design-qa/` were visually reviewed.
Fixture images establish layout/interaction behavior, not fresh model quality.
No live account/database/model calls, production writes or deployment were used.

## Reversible edits and furniture demo budgets — November 3, local

The studio has session-only Undo/Redo (50 checkpoints, with rapid typing/dragging grouped)
and a confirmed Reset room design. Reset restores the selected room's starting
finishes, room list and model placements; it creates a separate undo checkpoint.
A saved design resets to its opening saved snapshot; prepared examples reset to
their starter concept. Photos, dimensions, generated-image history and historical
saved revisions are outside edit history. Restored working choices use the same
existing persistence/autosave path; undo does not delete canonical revisions.

The examples gallery leads with the three prepared furnished Muse concepts. Their
furniture allowances are deliberately chosen USD demo amounts, not market data or
retailer prices: lounge $1,115; office $520; dining $865 (furniture only). The shared
`DEMO_FURNITURE_ALLOWANCES` table also supplies amounts for newly added library
pieces. Each seeded item carries optional `allowanceSource: 'demo'`; editing its
amount marks it as owner-entered. Older saved items remain compatible. Room-list,
shopping/copy output and proposed handoff distinguish demo from owner allowances.
Existing totals still use `studioItemBudget`; no parallel pricing arithmetic was added.

Fill missing demo allowances only fills recognized unpriced items after an explicit
click. It preserves known owner values, Keep items and unknown quantities. It does
not fetch store prices or price unsupported names. Prior browser edits are not
silently overwritten by new example defaults. Furniture fit, exact products,
tax, delivery, labor and installation remain unresolved.

Verification: build/types/boundaries; 15 legacy + 327 TypeScript tests pass, with
52 connected cases skipped; all 202 public UI guardrails pass. `scripts/furniture-budget-undo-check.mjs` intercepts
all API calls and checks labeled budgets, editable inputs, Undo/Redo, reversible
reset, removal/restoration, browser reload, library allowances and overflow at
1440/390/320 px. Gallery and phone studio screenshots were visually reviewed in
`.local/furniture-budget-undo/`. No fresh generated images, live prices, production
writes or deployment were used.

November 2, 2026. Implemented locally; not deployed. This closes part of the
inspiration-to-project gap found in the owner's consumer Muse pressure test.
It does not complete the living-room design, procurement and contractor workflow.

## Full-width plan follow-up — November 3

The room plan is now a single persistent section below both editor columns on all
screen sizes, rather than half the photo column on desktop or a hidden inspector
tab on phones. Budget and work-plan preparation share an overview row on wide
screens; the room list fills the width below in responsive item cards. Tools remain
in the inspector, which has bounded scrolling on desktop. The header's **Plan &
budget** shortcut moves focus and scrolls to the section, respecting reduced motion;
the shopping sheet's work-plan link goes to the same section.

This uses the existing selected-room items, finish totals and validated prepare/save
flow. Photo-generated proposals appear automatically in the bottom room list.
Changing rooms updates that list, and resizing keeps the same mounted plan and
unsent add-item draft. Prices remain unknown until entered; preparation remains an
explicit owner action. No new provider or server behavior was added.

`node scripts/studio-design-check.mjs` now covers this layout and the preceding
photo-to-3D flow with 144 offline fixture checks at 1440/1024/390/320 px. It checks
one plan outside both narrow columns, full workspace width, live generated item
population, responsive item rows, focus navigation, allowance updates, resize draft
retention, reload and room isolation. Screenshots in `.local/room-design-qa/` were
visually reviewed. This is local UI evidence, not real-provider or deployment QA.
Build/types/boundaries and formatting pass, with 15 legacy + 325 TypeScript tests
(52 connected cases skipped) and 193/193 public UI guardrails passing.

## User flow

### Wide editing workspace — November 3

The full-width **Room editing workspace** now sits below the photo/3D preview and
above the persistent plan. This supersedes the earlier sidebar editor and its
bounded desktop scrolling. The upper side card shows the selected paint, floor and
room-list count with a shortcut; tool tabs live in the lower workspace.

Restyle lays out three suggestion cards across on desktop/tablet. The editable
brief, optional inspiration/photo board, and rendering/history controls have their
own responsive sections (three across on wide screens, stacked as needed on phones).
Furniture gets a wider library plus selection/editing columns, and paint/floor
controls use responsive groups. These panels use normal page scrolling rather than
a tall narrow internal scroller. Switching tools preserves the mounted Restyle
draft; existing provider calls remain explicit and unchanged.

Shortcuts and measurement editing focus the workspace. **View room**, a completed
photo render, and **Try in 3D** return to the preview/scene, with scrolling honoring
reduced motion. The offline fixture regression check now passes 187 assertions at
1440/1024/390/320 px, including populated style-card alignment, full width, absence
of nested vertical scrolling, idea-to-brief selection, draft retention, render
completion focus and the preceding plan/3D checks. Screenshots in
`.local/room-design-qa/styles-*.png` were visually reviewed; these are fixture layout
examples, not new real-model quality evidence.
Build/types/boundaries and formatting pass, with 15 legacy + 325 TypeScript tests
(52 connected cases skipped) and 193/193 public UI guardrails passing.

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
