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
  2.4 m). In the drawing, unknown thickness is dashed and unknown height is
  orange. In 3D and Blender, walls with unknown height (or curved walls) are
  translucent orange; unknown thickness is not styled there and is recorded as
  `thicknessMeasured: false` / `displayOnly` in GLB extras. Stand-ins never
  appear in dimension labels, the drawing or area data.
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

## Project home and annotations (October 30, 2026)

At the owner's direction the project now opens on its room: the studio leads
the home screen with the "Measure this room" card under it, and the prompt
follows (narrower). The options/plan dialog no longer mounts a second scene.

- `geometry/room-annotations.ts`: one callout per included work package,
  pinned to the surfaces it acts on (paint → all walls, floor packages → floor,
  exhaust fan → ceiling, toilet/vanity → a scanned fixture of that kind).
  Without a recorded location (a measured box has no fixtures) or for
  whole-room work, the package is listed, never pinned at a guessed spot.
  Located work is numbered first.
- Costs come only from purchase-plan lines (per package and total, with the
  tier, "N of M items priced", tax/labour excluded). Nothing is derived from
  3D geometry; panels show measured geometry separately.
- The scene places pins on measured geometry (longest wall, floor, under the
  ceiling, above a fixture), fans out pins sharing a surface, and fades walls
  between the camera and the room (dollhouse cutaway). Clicking a pin or a
  surface selects the package and highlights all its surfaces.
- "Pin this work in the room" drafts the scope from a recipe's packages
  (`controller.draftScope`, pure domain, local or connected). Connected
  workspaces then price it against the shared catalog
  (`controller.priceScopeDraft`: BOM tied to the draft revision, tier plans tied
  to the BOM, as the server's `draft_scope` does).
- Without a chosen design option, the Proposed look follows the planned work
  (vinyl plank / hardwood / tile floor; carpet as the existing floor when the
  plan removes it). Illustrative swatches, not products.
- "Example project" is now a labelled living-room refresh: `[Example fixture]`
  14 × 12 × 8 ft dimensions and a drafted scope, priced from the demo catalog
  when connected (paint and vinyl-plank lines; the rest stays "not priced").

Verified: `tests/domain/room-annotations.test.ts` (box room, scanned toilet,
partial pricing, whole-home note), `room-annotations-priced.test.ts` (example
path through the demo catalog to priced pins), and headless Chrome over CDP in
local mode (pins, not priced) and connected mode against a scratch database
with the demo catalog ($724.32 mid-tier estimate, paint and floor priced).
Not verified by a person in a browser.

### Order of work, DIY difficulty and template prices

`scope/work-guide.ts` gives each package a phase (Prep → Demo → Rough-in →
Paint → Flooring → Fixtures), a DIY difficulty with a one-line reason, the tool
kit a contractor would bring, a YouTube how-to search (a search, so it always
resolves; no specific video is claimed) and a template material rate. Template
prices are typical US big-box figures for planning, labelled as such in the UI:
not quotes, not live prices. Material allowances scale with the package's own
base area from the scope draft (the smallest sq ft quantity; coats and waste are
multiples), never from 3D geometry; without it only the kit is priced and the
step says it needs a measurement. The UI shows the DIY total (materials + tools)
and states that hiring out adds labour, which is not estimated. Catalog store
prices remain available under each step and as a summary line.

The studio shows the order of work as tabs over the room; pins show name and
template price; dimension labels and downloads moved into a "⋯" menu.

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
