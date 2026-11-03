# Local bathroom concept assets

November 3, 2026. Implemented locally, not deployed. Extends the existing furniture
placement workflow without new dependencies, downloads, AI calls or database work.

Six GLBs from the owner's LowPolyBathLaundry_v1.0 pack are available in Furnishings:
toilet, double vanity, shower stall, bathtub, pedestal sink and vanity mirror.
**Bathroom** adds toilet, vanity, shower and mirror as editable starter placements.
The six models total about 56 KiB on disk. Other pack files are preserved untouched.

## Import and provenance

Run from the repository root:

```sh
node scripts/assets/import-bathroom.mjs [path/to/LowPolyBathLaundry_v1.0]
```

The importer copies six self-contained GLBs and LICENSE.txt to the Git-ignored
`public/furniture/bathroom/`. It writes the metadata-only catalog at
`packages/core/src/geometry/bathroom-assets.json`. Three.js measures transformed
mesh bounds; published rounded README dimensions are not silently used as geometry.
Metadata includes source SHA-256, bounds, width/depth/height in metres, semantic
category, mounting, base/back anchors, axis conventions and normalization. The
browser and Blender normalize bounds to base center at runtime; source files are
never rewritten. No proprietary mesh content is stored in the catalog.

The pack's project-use license permits apps and renders but prohibits redistribution
as standalone assets or an asset pack/library and prohibits AI training. The source
pack and runtime GLBs are ignored by Git; no models have been committed. A clean
checkout requires the local import before these fixtures can load. The browser
only offers fixture library entries and presets whose local meshes exist at build
time; clean hosted builds retain the standard furniture library. This increment
does not provision a hosted deployment or package these files into Modal.

## Placement and limits

Existing validated studio placements now accept optional `yM` and `wallId` fields.
Old placements remain compatible. X/Z are room floor coordinates, Y is elevation,
positive rotation is Three.js rotation around Y. Blender maps these to
`(xM, -zM, yM)` and positive Z rotation. The shared wall helper places a back anchor
inside a referenced wall with concept offsets; the editor preserves edited depth
and elevation on wall snapping. Wall references record the chosen placement basis,
not a live attachment constraint. Dragging and numeric position edits remain free.
The inward normal is selected toward room bounds center; complex concave layouts
need manual checking. Starter pieces are not auto-packed into small rooms.

Source-mesh dimensions are illustrative, not measured product dimensions or verified
site facts. Mirror elevation (1.15 m) is an explicit editable concept starter.
Fixtures have no invented prices: room-list allowances remain null until entered.
Code-clearance envelopes are explicitly null and separate from visual mesh bounds;
there is no clearance, overlap, plumbing, mounting, or installation approval.
Source materials are retained; changing Color tints a main material.

## Local Blender

The existing headless generator accepts optional `placements`, resolves bathroom
asset IDs through the catalog, verifies hashes, imports GLBs and uses the same
normalization/coordinates as the browser. Unknown IDs fail explicitly instead of
substituting invented geometry. Rooms without placements follow the original path.

```sh
node --import tsx scripts/render-bathroom.ts
npm run render:room -- plan.json .local/my-room --placements placements.json
```

The first command creates a visibly hypothetical 4 × 3 × 2.5 m bathroom in
`.local/bathroom-concept/`, with four walls, floor, toilet, vanity, shower and mirror.
It produces `perspective.png` (isometric cutaway), `interior.png` (eye level),
`plan-top.png`, `room.glb`, the exact input JSON and Blender log. Cutaway walls are
restored before GLB export and the interior render. Samples/resolution are reduced
for this local smoke test; the regular renderer's defaults are unchanged.
The older hosted HD API/Modal path is not extended to receive studio placements.
The browser's existing Muse capture path remains compatible; no Muse call was made.

## Verification

- `npm run build`: types, domain dependency boundaries, both Vite builds pass.
- `npm test`: 15 legacy + 330 TypeScript tests pass, 52 connected tests skipped.
- Eight focused domain tests pass, including actual imported file hashes, catalog
  bounds/provenance, bathroom starters, wall placement and unknown allowances.
- `node scripts/bathroom-assets-check.mjs`: offline Chrome loads all six actual GLBs;
  verifies normalized bounds at 90° rotation, elevation, thumbnails, four-piece
  starter, additions, numeric edits, wall snap and reload persistence; no page errors.
  Screenshot: `.local/bathroom-concept/webgl.png` (all six models in a fixture studio).
- Installed Blender 3.3.0 produced both requested views; images visually inspected.
  The demonstration is a concept arrangement, not a measured bathroom design.

## Files changed for this increment

- `scripts/assets/import-bathroom.mjs`: reproducible local import and catalog generation.
- `packages/core/src/geometry/bathroom-assets.json`: six-fixture semantic metadata.
- `packages/core/src/geometry/studio-furniture.ts`, `packages/core/src/index.ts`:
  library entries, bathroom preset/name matching and shared wall placement.
- `packages/contracts/src/studio-furniture.ts`: fixture IDs, optional elevation/wall reference.
- `apps/web/src/features/room3d/furniture-assets.ts`: local GLB paths, elevations,
  material tinting and accurate license metadata.
- `apps/web/src/features/house-example/furniture-panel.tsx`: fixture selection,
  elevation/wall controls and unknown allowances.
- `packages/core/src/scope/demo-furniture.ts`,
  `apps/web/src/features/house-example/paint-floor-studio.tsx`,
  `apps/web/src/features/house-example/listing-studio.tsx`: null fixture allowances
  while retaining existing furniture demo budgets.
- `scripts/blender/room_to_blender.py`, `scripts/render-room.ts`,
  `scripts/render-bathroom.ts`: local asset import/placement and demo renders.
- `tests/domain/bathroom-assets.test.ts`, `tests/domain/studio-furniture.test.ts`,
  `tests/domain/studio-edit-history.test.ts`, `scripts/bathroom-assets-check.mjs`:
  catalog, compatibility, pricing and offline WebGL/UI verification.
- `.gitignore`, `tsconfig.json`: restricted-file exclusions and metadata JSON imports.
- `PROGRESS.md`, `docs/architecture/README.md`, this document: implementation record.

These are this increment's changes; unrelated existing workspace edits were preserved.
