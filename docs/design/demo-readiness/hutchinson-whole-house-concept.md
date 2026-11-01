# Hutchinson: listing evidence to a whole-house concept

October 31, 2026. Implemented prepared walkthrough at `http://localhost:8741/#example-house`. This supersedes the single-room example as the main landing-page example. The finish-and-cost studio remains available as a separate synthetic case.

## Owner direction and experience

2440 S Hutchinson St, Philadelphia is the owner's house. The selected direction is **whole-house refresh plus investigation of a new living-room half bath**. Six area groups connect source views to proposed work, supporting materials and the next decision. Areas can be deferred and the new-bath investigation can be excluded without deleting evidence of the existing basement bath.

Concept planning starts with photos and intent. Dimensions are optional. Listing plans and public records can supplement the concept if available; neither is a prerequisite. No city-record search is implemented by this UI. A later measured takeoff supplies quantities and a defensible budget. The prepared scope deliberately contains no invented dimensions, quantities, labor hours or prices.

The three chapters are The house, Project plan and Behind the vision. Evidence views keep originals, object regions, listing plans, the interactive ground-floor model and the generated look separate. The original stacked brand mark is preserved. Phone layouts use horizontally scrollable area/evidence controls and a stacked inspector. Chapter transitions return to their content instead of leaving the reader at the old page's scroll position.

## Actual inputs and outputs

| Artifact | Basis and boundary |
| --- | --- |
| 18 listing photos and 4 listing-plan images | Retrieved from the existing corpus's public Compass image URLs. Every JPEG hash matches the original October 28 Muse input receipt. Public source URLs, hashes and listing link are retained. |
| Historical Muse review and inventory | Existing repository evidence: per-photo review across all 22 images and 27 region observations across four inventory views. These are region observations, not 27 unique physical objects. Uncertain interior photos 08 and 10 remain additional views, without an invented upstairs assignment. |
| SAM 3.1 floor segmentation | A real new `sam-3.1` request on photo 04. Run `resp_6ae602098b994d9932174530`; two masks at 1494 × 1000. The interactive overlay uses those exact mask paths. Other available region overlays remain labeled saved Muse proposals. |
| Blender ground-floor reference | A real Blender render and GLB built from listing plan photo 20. The living/dining extents 13′1″ × 23′2″ and kitchen 9′6″ × 15′3″ anchor a concept footprint. The dining label overlaps the open room and is not added again. Wall height 2.4 m, thickness 0.1 m, openings, stairs and furniture are display assumptions, never canonical measurements. |
| Muse Image concept | A real `muse-image-1.0` edit using the Blender PNG as its input. The receipt links exact input/output hashes and prompt. It is a generated visual direction; it can deviate from the intended geometry and is not a construction layout. |

The honest chain is **photos → Muse review + SAM; listing plan → Blender reference → Muse Image**. SAM did not automatically reconstruct this geometry, and this image was not generated through a mask-conditioned renovation edit. The new bath remains an investigation; its feasible position and services are unresolved.

## Saving and integration boundary

`saveHouseCase` calls existing validated workspace-controller methods. It reuses a property with the same recorded address, creates a distinct project, and attaches the current concept brief, validated choices and original source/model receipts. Subsequent saves update that project's direction while preserving prior files. Choices and provenance survive repository close/reopen. No domain geometry facts are fabricated.

Historical Muse output retains its historical goal and run identity in an archival attachment. It is **not rebound as a newly generated typed property-research, inventory or scope artifact for the new owner goal**. The six-area work proposals are curated from owner direction and the source corpus. This is a prepared walkthrough, not a general automatic whole-house planner.

The Photos or plans control attaches originals through the existing file command and leaves them available for subsequent analysis. It does not trigger a new whole-house model/Blender pipeline. Existing generic intake/model batch limits are unchanged. Static prepared media are served from `public/examples/hutchinson`; saving archives their provenance rather than uploading every static asset into the repository again.

Muse & project tools opens the existing tools flow after saving the case if necessary. New consumer-Muse read/revise behavior for this house has not been verified. API, core, shared contracts, provider implementation, Mongo configuration and credentials were not changed. Claude's next integration can replace the prepared scope with newly proposed artifacts while preserving sources, owner choices and measured-vs-concept separation.

## Reproduction and receipts

- `node scripts/prepare-hutchinson-example.mjs` regenerates the corpus from cached source photos and existing receipts. `--download` fetches and hash-checks the public source images.
- `blender --background --python scripts/blender/hutchinson_concept.py` creates the reference PNG, GLB and metadata. The editable `.blend` stays under ignored `.local/blender-sources/`.
- `scripts/capture-hutchinson-visuals.ts --sam` and `--look` make real provider requests using existing server-side provider helpers. Both outputs already exist; do not rerun paid calls merely to browse the case.
- `public/examples/hutchinson/{source-provenance,sam-floor,blender-reference,muse-concept}.json` preserve the chain. No credentials are included.
- `hutchinson-corpus.ts` is generated. The renderer/model helpers and CSS live in `apps/web/src/features/house-example/`.

Vite now ignores nested Claude worktrees and generated output directories when watching, preventing unrelated parallel builds from reloading the working preview. Host/proxy configuration is unchanged.

## Verification

Twenty targeted integration tests passed across the whole-house case, project intake, references, room studio, example photo and review handoff. The five new house tests cover source hashes and uncertain assignments, actual SAM/Blender/Muse receipt chains, dimension-free scope and bath exclusions, persistence without historical-artifact rebinding, and invalid choices rejecting before writes. Persistence uses fake IndexedDB; no owner project was created for QA.

Desktop and 390 × 844 browser checks covered source photos, pointer and keyboard mask selection, listing-plan levels, Blender model, generated look, area deferral/recovery and chapter navigation. The phone check caught and fixed a flex intrinsic-width overflow. Both layouts now fit the viewport; interactive 3D has a saved-render fallback and retry. These browser checks do not verify iPhone Safari/WebGL performance, new-upload generation or construction feasibility.

## Optional 3D path

[Meta SAM 3D Objects](https://github.com/facebookresearch/sam-3d-objects) is a possible object-reconstruction experiment, separate from the [hosted Muse model catalog](https://dev.meta.ai/docs/models). Its documented local setup requires Linux/NVIDIA hardware with at least 32 GB VRAM. It is not a replacement for a measured building model or an implemented Muse 3D endpoint in this app. Keep the current Blender path for the prepared walkthrough; investigate reconstruction separately without blocking photo-first concept planning.
