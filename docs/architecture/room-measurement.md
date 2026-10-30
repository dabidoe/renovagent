# Room measurement capture

Status: steps 1 and 2 implemented (local).

## Why

Scope drafts already compute paint, flooring and trim quantities from three
measurement facts: `finishedLength`, `finishedWidth` and `ceilingHeight`
(`packages/core/src/scope/draft-scope.ts`). Until those facts exist, area
items stay `needs-input`. Measurement capture is therefore a way to record
three facts with evidence, independent of how the person measured.

Capture method is recorded but never upgrades a value to verified. Tape,
phone AR apps and LiDAR scans all produce user-reported facts the person
confirms by saving.

## Research summary (2026-10-29)

- iOS Safari has no WebXR `immersive-ar` or hit-test support, so in-browser AR
  measurement would be Android-only. Not pursued.
- Apple RoomPlan exports USDZ natively; `CapturedRoom` is also encodable to
  JSON. Apple publishes no accuracy specification.
- OpenPlan3D (`theLodgeBots/open3dFloorplan`, MIT, SvelteKit/Three.js) imports
  RoomPlan JSON in its web editor; its free iOS Capture app needs LiDAR. Its
  capture-app source does not appear to be in the repo.
- ReMeasure (Apache-2.0, Kotlin/ARCore), ar_measure (MIT, Flutter, untested on
  hardware) and ScalAR (MIT, Unity) are early projects; interaction references
  only, not dependencies.

## Step 1 — "Measure this room" (implemented)

- Contract: `packages/contracts/src/room-dimensions.ts` — input schema
  (positive lengths reusing `lengthSchema`, method enum
  `tape-measure | phone-ar-app | lidar-scan`, notes, optional photo evidence).
- Core: `packages/core/src/scope/room-dimensions.ts` — `roomDimensionCommands`
  builds one `AttachEvidence` user observation (method and values, marked not
  verified) plus one `RecordFact` per supplied dimension. Facts are always
  project-scoped with `subjectId = projectId`; later saves supersede the same
  fact IDs.
- Scope drafts now carry a `factContext` over every measurement fact key
  (`scopeFactKeys`). A draft compiled before a dimension existed has no
  `inputRef` to it, so the signature is what stales the draft on a first-time
  measurement.
- MCP `draft_scope` folds `scopeFactSignature` into its idempotency key, so a
  retry with the same `requestId` after new measurements drafts anew instead of
  replaying the blocked draft.
- Web: `RoomDimensionsCard` in the options and plan stages; saved values show in
  the units originally typed; a stale scope draft shows a re-draft prompt. An
  optional photo is attached as original evidence and cited by each fact.
- No MCP write tool: agents cannot record source facts. Muse relays dimensions
  through `draft_scope` `reported` values (`agent-relayed`, unverified); the
  person records facts in the workspace.

Expected side effect: `finishedWidth`/`finishedLength` are also bathroom
technical-planning keys, so saving them stales technical artifacts that depend
on them.

Unchanged values are skipped on re-save (the form prefills saved values), so
fixing one dimension does not stale work that depends only on the others.

Verified: domain tests (`tests/domain/room-dimensions.test.ts`); controller save
with a photo blob and card render tests (`tests/integration/room-dimensions-card.test.ts`,
fake IndexedDB); MCP re-draft plus stale BOM and purchase plans against real
local Mongo (`tests/integration/mcp-workspace.test.ts`). Not verified in a live
browser session.

Scope drafts saved before this change have no `factContext`; re-draft them once
so later measurements stale them.

## Step 2 — Floor plan import (implemented)

OpenPlan3D (`laanlabs/openPlan3D`, MIT; the old `theLodgeBots/open3dFloorplan`
URL redirects there) exports a RoomPlan-shaped JSON and imports raw Apple
RoomPlan `CapturedRoom` JSON. One importer therefore covers iPhone LiDAR scans
and plans drawn or corrected in OpenPlan3D's 2D/3D editor. We integrate through
the file, not by porting its SvelteKit editor; the card links out to it.

- Core: `summarizeFloorPlan` (`packages/core/src/scope/floor-plan.ts`) is pure
  and runs in the browser. Floor area and perimeter come from scanned floor
  polygons (shoelace), else from walls that close exactly one loop (OpenPlan3D
  exports carry `floors: []`). Transform conventions follow OpenPlan3D's
  importer. Returns metric values plus wall count, spaces, openings, scan
  confidence and notes.
- No invented defaults: OpenPlan3D falls back to a 280 cm wall height; we do
  not. Disagreeing wall heights (beyond 5 cm) or missing heights leave ceiling
  height unknown with the range shown. A scan covering several spaces keeps the
  total floor area but drops the outline perimeter, which omits interior walls.
- Openings are listed, not deducted: paint stays gross (overbuys slightly).
- New project facts `floorArea` (area) and `floorPerimeter` (length). Recipes
  (bathroom and living room, now v2) use them in place of length × width for
  floor area, perimeter, wall area and the fan's room-size check, so L-shaped
  rooms come out right. These inputs are fact-only: `DraftScope` rejects them
  as relayed values, and drafts list them only once recorded.
- Web: "Import floor plan" in the room card fills the form for review; saving is
  the confirmation. The original JSON is attached as `application/json`
  evidence, so the full geometry (walls, openings, positions) is preserved for
  later use, and every recorded dimension cites it.
- Verified: `tests/domain/floor-plan.test.ts` (rectangle, L-shape, multi-space,
  height disagreement, OpenPlan3D wall loop, rejection, import → draft
  quantities); controller evidence test; parsed OpenPlan3D's own sample scan
  (`test-roomplan.json`: 47.74 m² over four spaces, perimeter and height left
  unknown). Not yet tested on a scan from our own iPhone; Apple publishes no
  accuracy figure. Not verified in a live browser.

Next: split multi-space scans into rooms (OpenPlan3D's room detection), a
geometry artifact for the full plan, and an MCP read tool over it.

## Out of scope

WebXR, native AR apps (Unity/Flutter/Swift), deducting openings from wall area
(changes recipe formulas), and treating any capture method as verification.
