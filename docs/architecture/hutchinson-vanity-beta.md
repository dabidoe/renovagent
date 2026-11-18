# Hutchinson vanity beta

The example route is `#example/hutchinson-vanity/r1`. Selecting the floating oak option opens `#example/hutchinson-vanity/r2`. Each route restores its own selection, product price and scope. The revisions are curated demo snapshots based on real product listings and an existing bathroom reference. They do not create an issued contractor quote or mutate a workspace.

The existing full-bath photo is `public/examples/hutchinson/photo-09.jpg`. The room and clearances are preliminary. The product prices were checked on November 16, 2026. [Freestanding Glacier Bay](https://www.homedepot.com/p/203486567) · [Floating DeerValley](https://www.homedepot.com/p/331833458)

## Image provenance

Asset: `public/examples/hutchinson/vanity-oak-concept.jpg`. Generated with built-in ImageGen from the existing full-bath photo as visual reference and exported as JPEG for the browser. The rendered cabinet is illustrative.

> Create one photorealistic architectural concept render of the finished vanity replacement for Renovagent. Input is a reference for bathroom arrangement and existing finishes. The full bath is compact, beige stone-effect rectangular wall tile, white toilet centered between vanity and beige bathtub, high white horizontal window over tub, mirrored cabinet with globe lights above vanity. Keep those fixtures, tile, and the vanity location. Replace the gray floor vanity with one compact wall-hung natural oak single-drawer floating vanity in the spirit of DeerValley DV-1BV0268NW, simple horizontal grain, smooth front, white rectangular ceramic sink top, chrome single-hole faucet as illustrative. Show the open strip of wall/floor beneath the oak vanity clearly with a slightly lower and wider doorway camera angle. Warm natural daylight, crisp professional interior photography. No extra décor, no text or overlay. Landscape 3:2. This is an architectural concept view only. Save generated artifact and expose its local path if available.

## Verification

The build and local Chrome checks passed. Rev 01 shows $159. Rev 02 shows $410.97 and the $251.97 increase with the wall support check. The copied URL reopened Rev 02 in a fresh mobile context. Both visuals decoded and the mobile layout fit 390 px. The standalone Sites source upload is pending authorization to transfer the demo images and estimate to the external host.

## Full-bath scope expansion

The existing upper-floor CubiCasa listing plan in `photo-21.jpg` labels the bath 6′4″ × 5′8″. The owner supplied an 8′ ceiling assumption and a $150–$250 labor allowance for replacing one window. The shared bathroom recipe produces a 35.9 sq ft gross rectangular floor estimate and a 192 sq ft gross wall envelope. Confirm net floor coverage, tile waste, exposed painted surface, and the actual window opening on site. The reference tile is Daltile Glendale Ivory, $26.36 for a 15.6 sq ft case on November 16, 2026. Three cases round up the gross area before deductions and overage. [Retail listing](https://www.homedepot.com/p/313783852)

The Hutchinson photo and concept use manual guides. The SAM view reuses saved 3.1 masks on their original sample image for the vanity, floor tile and shower wall. That sample has no window mask. Automatic approval review blocked transfer of the Hutchinson photo and concept to Meta for segmentation. The user's approval to transfer those specific files remains pending.

Local Chrome verified each scope choice, SAM provenance, the plan close-up, both partial budget ranges, and 390 px layout.

## Graphics and quiet annotations

The demo uses pinned Tabler MIT icons and two local CC0 texture samples. Transparent resting pins become visible on hover, keyboard focus or selection. Touch users can select the same targets. The tile picker swaps the local texture, product source and budget together. The shared URL keeps the selected tile. Generic Kenney bathroom models are imported into the existing library with hashes and source revision. They now drive the live schematic room preview.

On November 17, local Chrome checks passed at 390 and 1440 px for resting transparency, hover and touch selection, both local texture loads, the gray tile budget and scope URL. No provider inference was needed.


## Live model swaps and fixture annotations

The proposed-room view now loads the local Kenney cabinet, sink, toilet and bathtub models in Three.js. Switching vanity revisions changes the cabinet color, height and mounting position between white freestanding and floating oak. The same revision selects the sourced material cost and contractor installation checks. Both tile choices also update the schematic floor texture and retain their product price in the shared URL. These are generic meshes, not exact retailer models; fixture positions and display transforms are illustrative, not measurements or fit evidence. The 8′ height remains the owner's assumption.

Vanity and mirror pins open compact annotations in both the photo and proposed view. The vanity describes the existing painted standard vanity, standard sink and faucet before offering the priced replacement picker. The mirror annotation identifies the three-panel mirrored cabinet and light bar and keeps them in the contractor checklist. Model pins are projected from the scene anchors after viewport changes. WebGL renders only on load or resize; local assets require no inference calls.

Local Chrome verification on November 17 passed at 1440 and 390 px: both model variants loaded, the vanity popup described existing conditions, swapping restored the oak model while preserving gray tile in the URL, the mirror popup opened, and the contractor table showed DV-1BV0268NW / $410.97, Nova Falls Gray and $629.79–$729.79. No browser page errors were observed. Production build, type checking and dependency boundaries passed. No native app changes, provider calls, deployment or fit verification were performed in this slice.
