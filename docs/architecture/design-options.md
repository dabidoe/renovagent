# Same-room design options with costs and generated previews

October 29, 2026. Implemented locally; hackathon step 3. One room photo plus a
vague request ("I want to renovate my living room") becomes three options for
the same room, each with its own scope, its own materials cost range and a
labeled generated concept preview. "Make it blue" and "I like the hardwood one"
revise the same saved project.

## Flow

1. **Photo.** The owner's photo is uploaded (`POST /api/workspace/design/photo`,
   or `scripts/design-demo.ts`). The original file's SHA-256 and the owner's
   permission statement are kept; a bounded JPEG derivative (macOS `sips`,
   ≤1600 px) is stored in the owner-scoped `design_images` collection, never
   in the workspace document.
2. **Options.** `BuildDesignOptions` (MCP `build_design_options`, website API)
   saves `<project>:design-options` from the versioned `living-room-refresh` v1
   recipe: *Fresh walls, keep the carpet*; *Light-oak hardwood + fresh walls*;
   *Wood-look vinyl plank + fresh walls*. Each option is a package set plus a
   direction (wall color, floor finish). Every preview starts `pending`.
3. **Costs.** Each option's requirements are recomputed from the recipe and the
   stored inputs, priced at view time through the same BOM → tier-plan engine
   as Materials, and summarized as a builder-to-high materials range, priced
   N of M requirements, and the biggest unknown. Prices are not frozen into the
   options artifact.
4. **Previews.** The API process's preview worker picks up pending previews
   (on each request and every 3 s), one at a time per workspace. It runs Muse's
   `image_generation` tool on the stored photo with a deterministic edit
   instruction ("keep camera, geometry, stairs, furniture…; change only…"),
   normalizes the result and records it with `RecordDesignPreview`. A result
   whose option changed meanwhile is discarded and the new direction is
   generated instead. Failures are recorded and can be retried. Paid calls are
   bounded: at most two per option direction, a commit failure records the
   preview as failed, and a direction that cannot be recorded at all is not
   retried by that process.
5. **Revise and select.** `ReviseDesignOptions` (MCP `revise_design_option`,
   website buttons) changes a direction, re-queues only that preview, records
   the preferred option, or retries a failed preview. The preferred option
   drafts its full scope (`scope-draft`, with its colors in the specs) and, in
   the same update, proposes the BOM and tier plans for its priceable items, so
   Materials follows the selection. A preference is a proposal, not an accepted
   decision.
6. **New measurements.** Rebuilding from the same photo with new values keeps
   directions, previews and the preference; only quantities and costs change.

## Rules and provenance

- Agents cannot hand-write `design-options`; only the three validated commands
  produce it. `RecordDesignPreview` is not on the MCP proposal allowlist and is
  issued only by the server worker.
- A preview is current only for the exact direction it was generated for, and
  must come from the options' source photo.
- Provenance per preview: kind `generated-concept`, source photo hash, the
  exact prompt, provider (`Muse CLI image_generation tool`), the chat model
  Muse reported (`muse-spark-1.3-contributor` in testing), run ID and time. The underlying image
  model is not named because Muse does not report it. Every preview is labeled
  "Generated concept — not a photo" and does not establish fit, materials,
  condition or feasibility.
- Muse preview runs use an isolated temporary workspace containing only the
  photo (passed by absolute path), with shell/web tools, reminders and
  personal context off, `--contributor-mode off`, and four model steps max.
  Muse still reported the `-contributor` model with that flag set, so whether
  contributor mode is actually off is unconfirmed. The result is read from the
  newest image in the throwaway workspace, not from the model's reply. The write tool cannot be disabled because
  the CLI then withholds `image_generation`; the throwaway workspace contains
  only the photo copy.
- No area is inferred from pixels. Floor and wall quantities need dimensions;
  paint also needs ceiling height.

## Sources (fetched 2026-10-29)

| Source | Supports |
| --- | --- |
| [This Old House, floating engineered wood floor](https://www.thisoldhouse.com/flooring/how-to-install-a-floating-engineered-wood-floor) | Carpet removal; foam/cork underlayment on wood subfloors, vapor barrier on concrete; trimming casings; transition strips; quarter-round fastened to the baseboard |
| [Xulon LVP click installation guide](https://cdn.shopify.com/s/files/1/0007/1578/4252/files/Xulon_Luxury_Vinyl_Planks_Click-Installation_Guide.pdf) (text extracted) | Never over carpet; quarter round instead of removing baseboards; undercut door jambs; never fasten moldings to the plank; underlayment not necessary (≤1.5 mm); T-molding in doorways |

Flooring overage stays an unset allowance. Two finish coats is a stated recipe
selection.

## Demo catalog

`fixtures/catalog/living-room-philadelphia.ts`: 15 fictional products/offers/
observations (paint, engineered hardwood, vinyl plank, underlayment,
quarter-round) across three tiers, labeled `example-import`/`historical`. Pack
sizes carry each fictional product's own coverage (sq ft per gallon/carton/
roll, lin ft per piece). New IDs only. `npm run seed:catalog` now imports both
demo fixtures (existing identical records are skipped); it has not been run
against Atlas.

## Verification

- `tests/domain/design-options.test.ts` (7): three options with different
  scopes; per-option pricing (hardwood > vinyl > paint at every tier); "make it
  blue" re-queues one preview and keeps history; selection drafts the chosen
  scope with its colors and no decision; previews attach only to their
  direction and source photo; no hand-written options; new measurements keep
  previews and preference.
- `tests/integration/design-options.test.ts` (3, real Mongo, fake preview
  provider): MCP build → worker → stored, checksum-verified previews → summary;
  revise/select → redraft plus BOM and three plans citing it; a preview
  finished after a mid-flight change is discarded and regenerated; replay and
  unknown-photo refusal; storage faults call the provider once per option and
  never loop.
- The shipped `MusePreviewProvider`, run from the repository root on the
  owner's living-room photo (vinyl plank + soft blue walls), changed only the
  floor and walls, kept camera, stairs, furniture and ceiling, wrote nothing
  into the repository, and took 29 seconds. An earlier prototype edit (light-
  oak floor) took 24 seconds. The running API has not yet generated previews
  for a saved project.

## Limits

- One room recipe with design options (living room). The bathroom recipe has
  scope drafts but no visual options yet.
- Muse cannot upload a photo over MCP; the photo is uploaded on the website API
  or by the demo script, and MCP tools reference it by hash. The website has no
  upload button yet.
- Preview images are served by the loopback API; a remote Muse client cannot
  open those paths.
- Previews are generated only while `npm run dev:api` runs with a Muse key;
  image conversion uses macOS `sips`.
