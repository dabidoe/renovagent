# Home-centered planning experience

Implemented October 28, 2026. Frontend-only replacement of the overview for projects with the supported kitchen / powder-room photo-question recipe. Other projects retain the existing workspace. Backend and in-app model execution remain off.

## Product interaction

The overview now leads with the actual home, a working investigation proposal, and one focused next action. Listing room views use the imported Muse classifications; they are not new visual analysis. A compact house file exposes recorded year/zoning with original sources and keeps the two conflicting listing area claims inspectable. Current conditions, dimensions, applicability and rights remain unverified.

The proposal separates kitchen scope development from investigation of an additional bathroom. It is an editorial presentation of the existing study recipe, not a new generated design recommendation. A literal saved preference appears in the brief; free text is never silently interpreted into geometry or an approved option.

The next-action presenter advances through:

1. Confirm kitchen direction, or record uncertainty/deferment.
2. Choose one supported investigation focus; compatibility with other preferences remains unresolved.
3. Enter a nominated space's footprint with original units, boundary basis, method and optional observation date. Existing headroom, doorway, circulation and drainage observations are preserved. Blank, rough, irregular and example data do not establish a finished rectangular site footprint.
4. Once a positive reported finished rectangle exists, prepare a bounded cabinet/support or plumbing-service investigation request. This can run before the full survey is complete; it does not establish fit, permit readiness, or technical approval. No professional is contacted. The current increment does not ingest and reconcile the professional's response into a design.

Saved area uses the existing candidate check traces. The proportional footprint drawing only illustrates reported rectangle dimensions through shared unit normalization; it contains no inferred fixtures, openings or compliance result. Changes update this visual and the underlying existing option/sequence dependency chain.

Preferences remain editable in a disclosure. Project notes are optional and visibly have no live assistant; the full six-question classifier is not repeated in that composer. The archive is a modal of saved records, without labeling every input as a decision awaiting approval. Detailed source imports, candidate measurements and technical work remain accessible.

## Durable writes and safeguards

`HomePlan` uses `AnswerPhotoQuestion` and `SaveCandidateMeasurements` through the existing controller. `selectHomeStudy` batches `BuildProjectOptions`, `PlanProjectOption` and `SetWorkspaceView` atomically, preserving all source/answer/survey/revision guards and avoiding a jump into the old artifact viewer. A failed study selection rolls back its compiled options as well. No canonical state is patched by the React view.

The presenter excludes stale research, options, plans and surveys through `referenceCurrent`. Question presentation is ordered by the shared semantic bindings while submissions retain each question's original imported index, including reordered Muse output. Preference corrections invalidate the prior study; it must be selected again. Historical artifacts and accepted records remain available.

No new database schema, backend, provider, credential, deployment, purchasing or construction-release path was added.

## Listing image display change

Earlier intake restricted inline previews to references with declared permission. In this private planning view, an explicit **Load listing photos** action can display the original HTTPS source image already attached to the imported review, even when rights are unknown. No automatic load occurs; the rights caveat is beside the button. Requests omit the referrer. The action does not relabel permission, download/cache an asset into the project, or add imagery to exports. Source links and raw review remain accessible; failed images have a fallback. This is a deliberate viewer change, not a claim to have secured image rights. The previous intake/import permission metadata is unchanged.

## Verification and limits

Four new integration scenarios cover the next-action progression; example/irregular rejection; measurement revisions and downstream invalidation; changed direction/address freshness; atomic study/view commit and rollback; IndexedDB reopen; and reordered question identity. Existing domain tests continue covering conflict, units, release and revision rules.

Browser verification in **Muse answers · workflow QA only** revised the synthetic preference, confirmed the study became unselected, selected the basement investigation, and corrected the synthetic width from 5 ft to 6 ft while retaining the 2 m length and example basis. Saved area changed from 3.048 to 3.6576 m² and survived reload. Example values continued to require actual measurement. Study selection now stays in the home workbench. Actual preferences and measurements were not invented for the original Bingham project.

The real Bingham original kitchen image loaded from its attached source, with 1023 px intrinsic width verified. Source observations and explicit image loading were inspected in the browser. Desktop UI was visually inspected; responsive CSS is provided but phone usability has not been independently validated in this increment.

This improves the planning interaction; it does not close the original product's major capability gaps: property-specific measured layout alternatives, reconciled technical recommendations, qualified local applicability, priced quantities, comparable trade scopes, procurement, or execution coordination.

Final checks: **132 tests passed** (15 legacy JavaScript + 117 TypeScript), strict type checking, import boundaries, formatting and both production builds. The existing main-bundle size advisory remains. Browser archive inspection confirmed the prior 3.048 m² check remained an explicitly historical/stale revision while the latest retained 3.6576 m². Preview evidence: `docs/previews/home-centered-planning.png` (original Bingham, preferences unanswered) and `docs/previews/home-plan-qa.png` (synthetic workflow only).
