# Editable studio furniture and photo-led ideas

November 2, 2026. Implemented locally; not deployed. Extends
[the saved photo studio](studio-room-design.md). This is a concept-layout workflow,
not a furniture measurement, exact-product or installation approval system.

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
