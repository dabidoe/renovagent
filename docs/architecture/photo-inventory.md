# Photo inventory: Hutchinson reference workflow

Implemented October 28, 2026. The reference property is **2440 S Hutchinson St, Philadelphia, PA 19148**, kept separate from the Bingham projects. Current user direction: add an additional half bath in the living room; starting condition reported by the user is a semi-finished basement with an existing half bath. Those statements are reported context, not verified conditions or authorization to build.

## What actually runs

- The external Node/Muse handoff used the configured API key for four image-attachment batches covering all 22 native Compass gallery photos, a planning synthesis, and a region-detection pass over four model-identified views: kitchen, living room, bathroom and basement. No human room labels or hand-drawn regions were supplied to the model.
- Region detection returned **27 per-photo observations**. These include floor coverings, cabinets, cooking/refrigeration appliances, visible bathroom fixtures, openings and equipment. They are not a verified count of unique physical assets. Some regions are coarse or incomplete; precise segmentation and cross-photo identity reconciliation remain open.
- The updated living-room goal triggered a separate Muse planning synthesis using the retained visual observations. Unchanged, hash-matched regions were explicitly reimported against the new research revision. This reused the original region run/model/analysis timestamp; it did not pretend a new image-analysis run occurred.
- The app itself still has no live model endpoint or Mongo connection. Research and regions are imported through validated commands. Mongo provisioning is the next increment, not an existing capability.

## Product interaction

The home inventory workbench shows the actual source photo with normalized SVG polygons. Regions preserve the full image aspect ratio and are keyboard-selectable; the element list provides another selection path. A selected element exposes confidence, visible observations, unresolved properties, recognition, label correction and keep/replace/investigate/reject direction. Original model output remains unchanged.

A saved choice updates the working brief, the emerging scope and a bounded evidence request. It does not establish measurements, material, condition, connections, applicability, fixture fit or construction readiness. Listing amenity claims remain in a separate sourced disclosure. The listing's one-bath structured field and description of a basement half bath are retained alongside the user's reported starting condition.

The current goal and its first model-proposed site measurement are visible above the photo. The initial photo follows a relevant photo reference from that scoped measurement proposal; no living-room location or enclosure geometry is invented. Detailed source imports, notes and historical artifacts remain accessible.

## Commands and persistence

`photo-inventory` and `inventory-direction` extend the artifact union additively. No snapshot migration is required. `ImportPhotoInventory` checks the current research revision and inspected-image hashes, region bounds, nonzero polygon area, identities and photo membership. `SetInventoryDirection` fences the inventory and direction revisions and records a separate user message/evidence record. Corrected labels do not replace model observations. Rejected identifications cannot also enter the proposed scope.

These records cannot be forged through generic `ProposeArtifact` or accepted in bulk as verified outputs. Direction records and inventory membership join the workflow context. A correction invalidates downstream consumers and preserves accepted/historical records. New research or goal/address context stales the old inventory; a refreshed inventory does not inherit earlier confirmations.

Import also checks a declared photo-planning goal against the current goal fact. Changing the goal cannot silently rebind old planning prose to a new goal revision. The current living-room project passed through the blocked state before its planning and region context were refreshed.

## Key and execution boundary

`scripts/muse-provider.ts` reads `MUSE_API_KEY` in Node, preferring the process environment, then server/.env, then root .env. It passes the key to the CLI via stdin, excludes it from argv, redacts provider output/errors and bounds run time/output. The key is not imported by browser code. Existing CLI auth remains a fallback when no configured key exists. The legacy server was not started.

Listing imagery is fetched temporarily for actual analysis and deleted afterward. The private viewer loads original external images only after a click, with rights unverified and no referrer. Run hashes describe inspected bytes; future stable visual history needs an authorized private asset store because external source URLs can change. No imagery is automatically licensed or added to product exports.

## Evidence and checks

Evidence lives in `docs/evidence/muse-hutchinson`: observed gallery URLs/dimensions; source-audited listing claims; neutral attachment manifest; accepted raw batches/planning provenance; region JSON and raw receipt; and the revised living-room planning result. Compass native images were observed at approximately 1500×1000 pixels. Homes.com is an alternate sourced listing; its photo quality was not established as better through the native viewer. Prices/status were not promoted into planning facts.

Integration checks cover source hash and region validation, generic-write/approval guards, user corrections, accepted downstream invalidation, source replacement, goal mismatch, IndexedDB reopen and credential stdin/redaction behavior. Browser QA uses a separate **Hutchinson · inventory QA only** project with copied receipts rebound to the same address and goal; synthetic preferences are not owner direction.

Final verification: **138 tests passed** (15 legacy JavaScript and 123 TypeScript), with strict types, dependency boundaries, formatting and both production builds passing. Browser reopening retained the actual project's scoped goal and reported basement context. Its original living-room image loaded at 1494×1000; keyboard selection switched the region inspector without saving an owner preference. Screenshots: [inventory](../previews/hutchinson-inventory.png) and [saved goal](../previews/hutchinson-project-goal.png). The existing main-bundle size advisory remains; phone usability has not been independently verified.

Remaining work includes a nominated enclosure and measured room plan, precise segmentation/correction tools, cross-photo asset identity, qualified services/code review, and measured alternatives. An existing basement half bath does not prove a usable waste/vent connection for the proposed living-room bathroom.
