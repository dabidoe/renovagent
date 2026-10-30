# Room studio: one measured model, every view

Status: implemented (local). Builds on [room measurement](room-measurement.md).

## Shape

`roomModelFromPlan` (`packages/core/src/geometry/room-model.ts`) is the single
parser for RoomPlan captures, OpenPlan3D exports and OpenPlan3D project files.
Every output reads its `RoomModel`, so they cannot disagree:

| Output             | Where                                         | What it shows                                              |
| ------------------ | --------------------------------------------- | ---------------------------------------------------------- |
| Floor-plan summary | `scope/floor-plan.ts`                         | Proposed area, perimeter, height for the person to confirm |
| Plan drawing (SVG) | `geometry/plan-drawing.ts`                    | Dimensioned plan in named layers, ft-in and metric         |
| Surface links      | `geometry/room-surfaces.ts`                   | Each wall/floor/ceiling/fixture → scope items and products |
| 3D viewer          | `apps/web/src/features/room3d`                | Orbit, click a surface, Existing/Proposed look, GLB export |
| GPU render         | `scripts/render-room.ts` + `scripts/blender/` | Perspective and top-down Cycles renders, GLB               |

Plan coordinates are metres, x right and y down the drawing (RoomPlan x/z and
project-file x/y both map there, as in OpenPlan3D). three.js uses (x, up, y);
SVG uses (x, y); Blender uses (x, −y, up). An asymmetric L-room test pins the
orientation; the Blender top-down render and the SVG of the same scan match.

## Accuracy rules

- No invented physical values. Missing thickness or height stays null in the
  model. Views need something to draw, so they use display stand-ins (0.08 m,
  2.4 m) drawn in a distinct style (dashed/orange in the drawing, translucent
  orange in 3D and Blender) and flagged `displayOnly` in GLB extras. Stand-ins
  never appear in dimension labels, the drawing or area data.
- Geometry and quantities stay separate. Surface panels show measured geometry
  (labelled as such) and, separately, scope quantities from the draft, which
  reads recorded facts. Requirement quantities are package totals; nothing is
  split per wall. Whole-home plans carry a note that their geometry is not this
  room's quantity.
- The studio reads the plan file cited by the current room facts; if newer
  measurements did not come from it, the view says it may be out of date.
  Without a plan it shows a box from measured length × width, labelled so.
- Scanned fixtures are existing items. They link to a scope package only when
  that package is in the draft, never as a proposed product.
- Door swings are not drawn: captures do not record them.
- Colours and floor finishes in the Proposed look are illustrative swatches
  (`geometry/finish-swatches.ts`), not product photos. Purchase-plan products
  show name, retailer, SKU, price and freshness; the catalog has no product
  images yet, so the panel says "No product image on file".

## Wiring and other trades

The drawing has an empty `layer-electrical` (`data-status="not-recorded"`).
No capture records outlets, switches or circuits, and drawing them without a
record would be invention. The next step is a recorded electrical survey
(points the person or an electrician places, with evidence) feeding that layer
and a matching 3D overlay.

## Running it

- Web: options and plan stages show the studio under "Measure this room" once a
  plan or length × width is saved. three.js loads lazily (its own chunk); if
  WebGL is unavailable the plan drawing is shown.
- GPU: `npm run render:room -- plan.json out/ --wall sage --floor "light oak"
--samples 128` (needs Blender; `BLENDER` env var overrides the path).

## Verified

`tests/domain/room-model.test.ts` (opening placement, sills, fixtures, floor
transform, mirroring), `room-surfaces.test.ts`, `floor-plan.test.ts` (unchanged
after the refactor), `tests/integration/room-studio.test.ts` (plan selection,
out-of-date warning, box fallback). Headless Chrome (SwiftShader WebGL) ran the
full flow (create project → import plan → draft scope → studio → select
surfaces → plan tab) against OpenPlan3D's fixtures; Blender 3.3 rendered the
same scan. Not verified on a scan from our own iPhone or by a person in a
desktop browser.

## Next

Split multi-space plans into rooms; recorded electrical survey layer; product
media on catalog records; an MCP read tool over the room model and surfaces;
server-side render jobs.
