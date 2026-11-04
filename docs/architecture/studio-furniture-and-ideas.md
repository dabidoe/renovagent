# Editable studio furniture and photo-led ideas

November 2, 2026. Implemented locally; not deployed. Extends
[the saved photo studio](studio-room-design.md). This is a concept-layout workflow,
not a furniture measurement, exact-product or installation approval system.

## Hutchinson photo furniture and contextual rotation — November 4, local

`hutchinson-project.ts` now exports a validated starter design alongside the root
project. The living/dining room includes nine editable models: sofa, loveseat,
dining table, four inward-facing chairs, a bookcase standing in for the china
cabinet, and a floor lamp. Placement follows the listing photo relative to the
traced plan. Library sizes, shapes and positions are approximations, not measured
reconstruction; these retained items use Keep with unknown allowances. The empty
bedroom photos receive no invented furniture. Public template visits start pristine;
edits and browser recovery belong to independent copies (see
[public example templates](studio-room-design.md)). Project → Reset room design
restores the copy's opening layout through the existing reversible history.

Selected furniture shows small left/right 15° rotate buttons immediately above
its highlight. The buttons follow the object's projected bounds as the camera or
piece moves, stay within the canvas on phones, and disappear on deselection or in
photoreal view. The side arrows rotate the camera by 45°. Clicking empty canvas
clears selection. Placement updates retain undo, browser/save persistence and
stale-render signatures. No model calls or canonical-state bypass were added.

Verification: production build/types/boundaries, five focused furniture domain
tests, the 76-check existing comparison/control browser suite, and the offline
Hutchinson browser check at desktop/phone widths. Captures are in
`.local/hutchinson-furniture-qa/`. No production writes, inference or deployment.

## Furnishing starters, camera and rendering styles — November 3, local

Follow-up: selected pieces now have separate left/right 15° rotation buttons on
the canvas, independent of the camera turns. They use existing placement updates,
preserving IDs, X/Z, dimensions, elevation and any recorded wall basis; normal
undo/persistence/render invalidation applies. Ordinary wheel scrolling reaches the
page. Ctrl-wheel trackpad pinch and touch pinch remain zoom gestures, with explicit
camera +/− alternatives. The default render option reads **Use current colors &
finishes**. These paths are covered by the 76-check comparison/control fixture
suite, including an actual vanity rotation and page scroll over the WebGL canvas.

This supersedes the Rotate/Move mode controls described below. Editable rooms
default to dragging furniture; blank-space camera gestures remain available, with
a compact vertical left/right/Top/Reset bar. Mouse buttons are 36 px; coarse-pointer
targets remain 44 px. Camera operations do not change placements or saved revisions.
The size/fit explanation is collapsed below the canvas as **Room dimensions & fit**.

Living room, Study and Bedroom starters are shared generic library arrangements
(`STUDIO_ROOM_PRESETS` / `studioPresetStarts`). An explicit click adds only missing
asset types, using editable concept dimensions and existing demo allowances. It
does not replace, reposition or reprice existing pieces, infer positions from a
photo, or approve fit. Capacity checks block the batch rather than truncating it.
Existing room-list matches retain their quantities and allowances. The batch is
one undo checkpoint; selecting an already-complete starter cannot add duplicates.

**Render style** sits with **Render with Muse**, separate from placement. Keep
materials, Warm & cozy, Minimal & bright and Classic & layered provide bounded
material/light directions. The optional `renderStyles` snapshot field retains
per-room choices. `/studio/model-render` accepts a validated optional style string
(300 characters maximum), asks the provider to preserve geometry and placement,
and retains existing limits and authorization. Style affects render signatures,
not furniture geometry. These remain model instructions, not output guarantees.
Older snapshots and unstylized signatures remain compatible.

Verification: build/types/boundaries/formatting; 15 legacy + 328 TypeScript tests
(52 regular-suite skips); both connected studio suites on disposable local Mongo
with fixture providers. The updated studio fixture flow passes 240 checks and
`scripts/studio-furnishings-check.mjs` passes 57 checks at 1440/1024/390/320 px,
including actual default-mode dragging, vertical controls, starter preservation,
duplicate prevention, batch undo, style persistence and overflow. Desktop and phone
captures in `.local/furnishings-qa/` were reviewed. No live model calls, production
writes or deployment were performed.

## Photo design to 3D handoff — November 3

The studio now keeps three photo-room views visible from the start: **Finishes**,
**Photo design**, and **3D layout**. Generating a photo no longer adds a new view tab.
View selection opens the corresponding Paint & floor, Restyle, or 3D tools; selecting
those tools also changes the view. Saved designs open with the matching tools.
An ungenerated photo-design view explains how to create one, and an unsized 3D view
asks for dimensions rather than falling back to an unrelated photo.

**Arrange in 3D** on a photo concept opens the layout tools. Empty layouts explain
that photo generation does not create objects. **Start from your room list** previews
conservative name-to-library suggestions and the number of starter models before an
explicit add action. Ambiguous names, accessories and unsupported items are disclosed
without silently replacing them. Each model links to its existing room-list item;
no item, allowance, action or quantity is rewritten. A null quantity gives one labeled
starter, and a known quantity supplies only the remaining unplaced count. Existing
placements are preserved; repeating the action does not duplicate completed counts.
The 60-object limit blocks the batch rather than silently truncating it.

These generic meshes use the existing concept sizes and starter positions, with
repeated models spread for selection. They do not extract positions, dimensions,
colors, exact products or room openings from the generated photo. Owners still need
to arrange/resize them and check fit. The existing furnished-render API and saved
snapshot contracts are unchanged; this adds no provider call on browsing or placement.

`node scripts/studio-design-check.mjs` runs a disposable loopback Vite preview with
all API calls intercepted and fixture responses. Its desktop/390/320 px checks cover
photo generation, stable tabs and aligned tools, room-list linkage, unknown-value
preservation, local GLB loading, furnished WebGL capture in the render request,
stale-render warnings, reload persistence, room isolation and overflow. The fixture
photo is a bundled finish preview, not new model-quality evidence. Screenshots are
written to `.local/room-design-qa/`. No live account, database or model is used.

Verification for this increment: 78 focused offline browser checks and 193 public
UI guardrails pass; desktop and phone screenshots were visually reviewed. Build,
types, dependency boundaries and formatting pass. The regular suite passes 15
legacy + 325 TypeScript tests, with 52 connected cases skipped. Real-provider photo
to exact-geometry reconstruction is not implemented or established by these checks.

## What changed

- **3D layout** adds twelve bundled GLB furniture/decor models: sofa, lounge chair,
  coffee table, rug, floor lamp, plant, double bed, desk, bookcase, dining table,
  dining chair and media console. The viewer loads actual meshes instead of only
  the room shell and fixture boxes. The models total about 131 KB.
- Models are Kenney Furniture Kit assets under CC0. The original license is included
  in `public/furniture/kenney/`; `provenance.json` pins the redistribution source
  revision, byte lengths and SHA-256 hashes. They are self-contained, with no remote
  texture dependencies. No npm dependency was added.
- Owners add pieces, select them in the list or scene, drag on the floor plane,
  and edit width/depth/height, rotation, position and display colour. Sizes and
  initial positions are explicit **concept defaults**, never photo observations,
  reported site measurements or retail specifications. Missing room dimensions
  block placement. A box room does not gain invented doors or windows.
- Each placed object references a room-list item. A matching unused item may be
  reused; an explicit new piece creates an unpriced item with proposed quantity one.
  A model can be relinked to another item. Removing a model keeps the room-list
  item; removing a room-list item removes its models. Quantity mismatches are
  flagged. The shared core checks rotated footprints against the actual room
  outline, including concave outlines. It does not approve overlaps, door swings,
  circulation, electrical work or product fit.
- Asset thumbnails are rendered from the GLB meshes in the browser using one
  shared thumbnail renderer. They are library illustrations, not generated photos
  of the owner's room.

## Room camera follow-up — November 2

The shared `mountRoomScene` viewer now supplies visible left/right 45° turns,
Top and Reset controls. Editable furniture viewers start in **Rotate** mode;
**Move** enables floor-plane dragging. A click still selects furniture in either
mode. This separates camera gestures from layout edits and retains scroll/pinch
zoom. Top frames the floor with space for the camera controls; Reset restores the
initial target and viewpoint. These are local display operations, not saved
project changes, measurements or render-invalidating edits. Controls hide while
a generated still is displayed and dispose with the scene. Phone layouts retain
44 px targets and allow the groups to wrap.

Local browser checks exercised turns, keyboard Top, Reset, drag-to-orbit over a
piece and Move-mode dragging. Turning the camera preserved the selected piece's
position/dimensions and list quantities. Phone widths of 390 and 320 px were
checked for overflow. Build/type/boundary checks pass; no provider call or hosted
deployment was part of this change.

## Photo ideas

**What would look good here?** sends the owner-scoped source photo, brief and keep
instructions to POST `/api/workspace/studio/ideas`. One server-side Muse Spark
read proposes exactly three distinct directions, each with a title, description,
photo-specific reason, editable rendering brief, palette and library asset IDs.
Tentative observations are separate from design proposals. Unknown measurements,
prices, stock and feasibility may not be invented. Runtime validation rejects
malformed directions, duplicate IDs and unsupported assets.

Cards show library furniture against the suggested palette, with **Use this idea**
(fills and focuses the editable brief) and **Try in 3D** (adds missing types of
starter pieces to the existing concept layout). They are starting pieces, not an
automatic reconstruction of the photo or an exact count/placement extracted from
prose. Add duplicates or adjust the layout as needed; choosing another direction
does not silently delete existing pieces. Ideas and the chosen brief persist with
the room. There is no model call until the owner requests suggestions or rendering.

## Furnished 3D to Muse

**Render with Muse** captures an eye-level still after all furniture loads and
sends it to POST `/api/workspace/studio/model-render`. The server validates the
image and placement contract, applies the existing per-owner repaint limit, and
calls Muse Image through the existing provider boundary. The prompt asks to keep
the camera, room geometry, openings and each object's placement, orientation,
relative scale and silhouette while refining materials and light. These are model
instructions, not a pixel-preservation guarantee.

The result is stored in the owner's private image store. The 3D/Photoreal controls
show it with a generated-concept caption and a download link. Finishes or placement
changes expose a previous-render warning; returning to the exact layout clears it.
The saved `studio-design` proposal includes placements, linked items, ideas and
`modelRenders` with their original signatures. Save still goes through the validated
proposal command; it does not record dimensions as physical facts or approve work.
Saved revisions have their own browser draft namespace. Reopening an older saved
revision must not replace an unrelated unsaved source studio. Saved links establish
the local session before reading and reset their loading/error state on navigation.

The earlier `/model/photoreal` route remains for the older measured-room viewer.
Blender HD is hidden for this new furnishing path because its current server-side
renderer does not consume these proposed furniture placements. No claim that
Blender HD produces furnished results is made.

### Provider failure diagnostics — November 2

An HTTP 503 from the studio API can wrap a Meta HTTP 404; it does not by itself
prove overload or a missing local server. The provider boundary now retains only
allowlisted machine codes and known model/endpoint values for safe logging.
Studio logs identify a 404 as model/endpoint unavailable. The viewer preserves
the API's safe failure message instead of substituting development instructions.
There is no automatic inference retry or model/Contributor-mode fallback.

`node --import tsx scripts/check-muse-models.ts` performs three authenticated,
read-only model-catalog GETs using the environment's existing key. It runs no
inference, submits no images/prompts and makes no database changes. Run it in the
environment being diagnosed; a successful local catalog check does not prove
that a deployed service uses the same key or can generate an image.

The owner's reported Railway ideas/read failures had upstream 404. Local catalog
lookups returned 200 for the configured Spark, Image and SAM IDs. The configured
paths/IDs match Meta's [models](https://dev.meta.ai/docs/models) and
[image edit](https://dev.meta.ai/docs/api-reference/images/edit-image) docs;
[error handling](https://dev.meta.ai/docs/error-handling) distinguishes model,
file and endpoint not-found errors. The failing production model-render's exact
provider code and a successful live rendering round-trip remain open.

Follow-up: with explicit owner approval, exactly two direct provider probes using
the same configured key succeeded: Spark returned a small validated JSON response,
and Muse Image edited a public bundled floor swatch into a valid 1600 × 1600 image.
No house photo or database was used. This confirms local provider generation at
the time of the checks; it does not establish that the production studio request
has recovered. A fresh production render attempt is still needed.

## Homepage directions and studio handoff

The local homepage now shows three prepared Muse photo concepts of the same Oakland
room: **Slow Sunday**, **Good Work**, and **Stay for Dinner**. Owners select a thumbnail,
use previous/next or arrow keys, swipe the photo on touch screens, and toggle the original
listing photo. There is no autoplay, extra comparison slider or provider call on browsing.
The current direction includes its palette, proposed pieces and a copyable request.
**Try this with my photo** carries a room-neutral brief into photo intake, without
asserting that the owner's room has this example's windows or pendant.

**Open in studio** creates a browser proposal from `directionDesign`, validated by the
shared studio contract. Each direction has a separate draft namespace and retains
its prepared photo concept, source photograph, matching finish picks, editable brief,
room-list quantities and illustrative 3D starter pieces. Four dining chairs are four
models linked to the same quantity-four item. Existing local arrays, including empty
arrays, take precedence over template starters on reopening. The original Oakland
listing remains unchanged; opening a direction does not run the automatic Imagine
effect or save canonical state. Saving uses the existing validated studio service.

The 3D starters are deliberately arranged in the existing room shell, not reconstructed
from the photo. They can differ from the image. Exact products and clearances remain
unverified, and all furniture allowances remain unknown until entered by the owner.
Shared finish/request signatures preserve stale-render warnings when choices change.
The preparation script makes at most two explicit Muse Image calls and refuses to
overwrite existing image paths used by saved revisions. Source/output hashes and
prompts are in `public/examples/studio-story/`; the first lounge image reuses an earlier
verified studio output. No dependency, production mutation or deployment was added.

## Verification

- `npm run build`: strict types, boundaries and both production builds pass.
- `npm test`: 15 legacy and 284 TypeScript tests pass; 52 connected cases skip in
  that regular invocation. `npm run test:connected`: all 59 pass on local Mongo.
- Domain tests cover footprint rotations, concave room boundaries, invalid sizes,
  asset hashes, original license and self-contained GLB files. Integration cases
  cover actual GLB MIME delivery, structured ideas, owner-scoped source reads,
  malformed render requests failing before provider spend, stored render images,
  and exact saved placement/render/history/allowance revisions.
- A first UI test exposed missing GLB static hosting plus an unbounded failed-load
  retry. Both were fixed; later browser checks load all twelve assets successfully.
- One bounded **real** ideas read used the bundled public Oakland room. Muse proposed
  a bay reading lounge, a home office and a dining nook based on its visible windows,
  pendant and floor. The reading-lounge starter was edited into a two-chair layout.
- One bounded **real** Muse Image call was made by the browser through the new API
  from the actual six-object 3D capture (two chairs, table, rug, lamp, plant).
  Visual inspection found the same arrangement and room corner, with more realistic
  fabric, wood, rug, plant and light. It is one case, not a general quality guarantee.
- Browser checks cover adding, linked room-list items, numeric edits, pointer dragging,
  stale/returned-to-current render signatures, saved reopening, and mobile layouts.
  One test reloaded before a save completed; the already generated output was recovered
  through the validated save service, then a further browser save/reload verified its
  inclusion with an owner allowance. No second generation was needed.
- Evidence is retained locally under `.local/studio-evidence/2026-11-02/` (not checked
  into Git). Temporary QA data uses a disposable database on local Mongo 27018.
  No Atlas writes, live-site sign-in or deployment occurred.

Still open: arbitrary model uploads, high-fidelity exact retail models, automatic
photo/scan reconstruction, product-accurate dimensions, broad room-layout generation,
collision/clearance approval, furniture installation pricing, furnished Blender HD,
full 3D render history, and direct MCP image upload/generation/return. Current model
renders retain the most recent output per room; saved historical revisions keep
earlier outputs. Furniture is not yet an exact procurement catalog.
