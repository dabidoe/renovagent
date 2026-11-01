# Inspiration → products → work

October 30, 2026: capture and durable reference context. **November 1: recognition and restyle in the studio (below).** Exact product matching and reference-driven scope generation remain subsequent increments.

## Product direction

People arrive with a Pinterest image, a designer's page, a product link or a photo of a room they love. They need to say **what they like**, identify the pieces, find an exact product or a suitable alternative, and understand the materials and labor needed to recreate the result in their own space.

The target flow is:

1. Add the actual room and inspiration separately; retain original images and source links.
2. Identify visible objects and finishes, with image regions and uncertainty. Ask what the homeowner wants to carry forward: color, material, shape, layout, or a particular item.
3. Find exact products where supported by a visible label or source page; otherwise offer clearly identified visual alternatives. Keep dimensions, finish, pack size, retailer URL, dated price, availability context and fit questions together.
4. Relate chosen products to the actual measured room. Propose work packages, quantities, supporting parts, preparation and labor through the existing scope/domain system.
5. Let the person approve the proposal; preserve substitutions, sources and earlier revisions for the contractor.

A vanity picture is not a complete scope. Supply lines, PEX, elbows, valves, fixing hardware, mortar, grout, edge trim, waste, preparation and trade hours remain part of the work where applicable. These come from measured facts and versioned playbooks, not image-derived guesses.

## What works now

- Project setup labels uploaded images as **My room** or **Inspiration** and accepts an inspiration/product link, title, preference note and optional product price in USD. An inspiration photo can retain its source and note in the same evidence record.
- Every project has an **Inspiration & products** board. Add images, links or both after creation. Cards retain the original image, source link, what the person likes and a saved price/date. External images, Pinterest pages and retailer metadata are not fetched automatically.
- `Evidence.source.reference` is an additive typed field (`room`, `inspiration`, `product`) validated by the existing `AttachEvidence` command. Old snapshots remain valid. Originals retain their blob/hash metadata; saved prices remain user-provided references and do not become catalog offers, verified prices or canonical cost facts.
- Intake commits references and original blobs with the project in one repository batch. Later reference saves leave unsent conversation drafts and earlier room photos intact.
- MCP `get_project_context` exposes the reference metadata alongside evidence IDs and original attachment metadata. Model-facing descriptions also distinguish references from existing conditions.
- The room welcome view, connected property-photo picker/job validation, and the active checkout's JEV owner-photo selector exclude inspiration/product images from site-photo analysis. They remain available in the reference board. No broad image-recognition or purchase operation starts from saving a reference.

## JEV and the next implementation

The active `.claude/worktrees/room-3d` checkout has concurrent JEV work for bounded image observations/boxes and requirement relevance. This increment preserves that work and adds reference separation; it does not replace its provider, start model jobs or introduce credentials.

Use JEV for bounded questions and grounding against candidates (for example whether a floating vanity is visible and its location). Open-ended discovery needs a model path that can return structured descriptive candidates. Exact model/SKU and price require product-source evidence; visual similarity alone should produce a candidate rather than an exact match.

The next recognition artifact should bind to the original reference evidence ID/hash and contain object/region IDs, labels, visible attributes, uncertainty and the actual provider/model receipt. Homeowner preferences and candidate product matches remain separate records. Product matches need explicit exact/similar status and source IDs. Selected matches can then feed existing scope and catalog commands, with quantities and labor calculated by the shared core. Changing a reference, preference, product, measurement or price must invalidate dependent proposals and preserve accepted history.

The existing site-inventory import contract should not be reused to turn an inspiration room into the property's inventory. A dedicated reference-analysis job/artifact and its acceptance tests are still required. No claim of implemented automatic identification, live retailer matching, pricing refresh, receipt parsing or reference-driven estimates is made here.

## Verification

Full root suite: 15 legacy plus 220 TypeScript tests pass; 38 connected-environment cases skip. New tests cover reference originals and prices through IndexedDB reopen, no promotion into site observations/cost facts, unchanged unsent drafts, rejection of unsafe/incomplete source batches and rejection by the existing site-photo job. Root and active checkout builds/type/boundary checks pass.

Browser checks use a separate localhost:8756 production-preview IndexedDB origin with the public generated bathroom demo image. Inspiration → source/note → project creation → reload and separate product-link/price save → reload pass. Desktop 1280×900, phone 390×844 and a 360×800 editor were reviewed; no horizontal overflow. Existing user projects were untouched. The API was reloaded with its original environment launcher; database configuration was not changed.

Previews: [desktop](../previews/project-references-desktop.png), [phone](../previews/project-references-mobile.png).

## November 1: inspiration in the studio (Slice A, `4e947d1`)

The paint and floor studio (examples and `#your-project`) has an **Inspiration** panel. This is separate from the workspace board above: the studio keeps its state per browser, the board keeps evidence in the project.

| Step             | Where                       | What                                                                                                                                                                                                                                                                            |
| ---------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upload           | `/studio/photo`             | The owner's photo, owner-scoped by SHA-256. Listing example photos are uploaded with `origin: 'listing-example'` so their provenance stays                                                                                                                                      |
| Name and outline | `/studio/inspo`             | Muse Spark returns up to six `{phrase, name, kind}` items (`inspoSchema`, `inspoItems` lowercases, validates and de-duplicates). SAM 3.1 outlines each phrase in parallel. Cached per owner and photo; costs 1 read and 1 segment per item                                      |
| Colours          | browser (`inspo-panel.tsx`) | Trimmed mean (25th–85th brightness percentile) of the pixels inside each mask, at ≤ 640 px                                                                                                                                                                                      |
| Paint            | `/paint/nearest?hex=`       | Three nearest catalog paints by CIE76 ΔE; `close` is ΔE ≤ 12. The UI hides the options when nothing is close                                                                                                                                                                    |
| Shop             | `shop-links.ts`             | Amazon, Wayfair and Target **searches** for the item's description. Amazon carries `RENOVAGENT_AMAZON_TAG` only when set; the disclosure then shows                                                                                                                             |
| Restyle          | `/studio/restyle`           | Muse Image edits the room photo with the inspiration photo as a reference; prompt from `restylePrompt(items, paint)`: change only the ticked items, keep the framing. The result is fitted back to the room size and stored; the **Inspired** tab compares it with the original |

Not done: products are never identified as exact SKUs; colours are read from the photo, not measured; the restyle is a picture, not a plan, and Muse adds borrowed furniture to empty rooms. Agents adding to this panel (Slice B) is the next increment.

Verification: unit tests for `nearestPaints`, `inspoItems` and `restylePrompt`; integration tests with stubbed models for analyse caching, listing-example upload, restyle owner scoping (404 for another owner's inspiration) and `/paint/nearest`. A local end-to-end with the real models on a local database: 6 items in 21 s, restyle in 28 s, Inspired tab survives reload.
