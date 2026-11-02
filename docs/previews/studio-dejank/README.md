# Studio demo cleanup — November 2, 2026

All screenshots are Playwright captures at 1440×900, on the local frontend with
API requests intercepted. No live provider, Atlas, production or deployment work.

## Phase 1 — paint and flooring first

- Paint & floor → Furniture → Restyle → Plan & budget; paint/floor opens by default.
- Paint-line and sheen edits move into Plan & budget alongside demo pricing.
  Existing defaults and saved overrides still feed the unchanged calculations.
- Restyle's main action and the work-plan action are placed early; Playwright
  verified the primary actions of all four tabs fit in the 1440×900 viewport.
- Errors have a friendly summary and closed Details disclosure. Full safe API
  messages are retained; floor failures clear the busy spinner.
- `npm test`: **328 passed** (15 legacy + 313 TypeScript), **52 skipped**, zero failures.
  The first sandbox run could not bind the existing HTTP hosting test; rerunning
  with loopback access passed. Connected/database cases remain skipped.
- `npm run build`: passed types, boundaries and both Vite builds. Existing bundle
  size warning remains.
- Added real React render tests for default tab/control placement and full error
  disclosure. Browser checks also changed sheen in Plan, verified hidden picker
  controls, and expanded a >600-character fixture failure without truncation.
- Evidence: `phase-1-before-{default,paint,furniture,restyle,plan}.png`, corresponding
  `phase-1-after-*.png`, and `phase-1-error-details.png`.

Live model success, production relay behavior and measured product fit are unverified.

## Phase 2 — honest furniture reference

- The 3D view says “Layout reference · not to scale of real products”.
- Native meshes use the largest uniform scale inside width/depth/height limits,
  centered on the floor. Neutral `#ece8e1`, roughness 0.9 material applies to both
  placements and thumbnails; the inapplicable colour control is hidden.
- Regression test exercises width-, height- and depth-limited fits. Browser QA
  loaded all twelve actual GLBs and verified uniform fit, centering, floor
  grounding (including the existing rug offset) and neutral material.
- `npm test`: **329 passed** (15 legacy + 314 TypeScript), **52 skipped**, zero failures.
- `npm run build`: passed; existing bundle-size advisory remains.
- Before/after: `phase-2-before-furniture.png`, `phase-2-after-furniture.png`;
  companion default captures retain the opening paint/floor view.

## Phase 3 — quieter Restyle

- Brief → Keep unchanged → Create room design now leads the panel.
- The suggestion card is one line plus a button. Photo upload, Your board and
  Add a link live inside one closed More options disclosure. Design approach
  controls remain available after the main flow.
- Playwright verified the primary action above the fold, a <60 px suggestion
  row, closed optional controls, then opened the disclosure, board and link form.
- `npm test`: **329 passed** (15 legacy + 314 TypeScript), **52 skipped**, zero failures.
- `npm run build`: passed; existing bundle-size advisory remains.
- Evidence: `phase-3-before-restyle.png`, `phase-3-after-restyle.png`,
  `phase-3-options-open.png`, companion default captures, and another full-error
  disclosure capture (`phase-3-error-details.png`).

## Phase 4 — recoverable photo detection failures

- SAM outlines and JEV photo reads now use the same friendly summary and full
  Details disclosure; raw failures no longer become developer-server instructions
  or truncated strings. Their existing rejection paths restore the controls and
  preserve the source photo.
- Restyle progress/errors sit beside the primary action. A rejected floor preview
  no longer leaves Restyle waiting for a floor job that already stopped. Explicit
  floor retries clear the previous error. The remaining header price-tier label
  is hidden; tier/sheens are confined to Plan & budget and the shopping list.
- Playwright injected rejected Restyle, SAM and JEV calls, checked busy-state
  recovery and full >600-character diagnostics, then verified paint selection
  and furniture placement still worked. Successful fixture retries restored a
  SAM outline and JEV carpet observations without leaving an error or spinner.
- `npm test`: **329 passed** (15 legacy + 314 TypeScript), **52 skipped**, zero failures.
- `npm run build`: passed types, boundaries and both builds; existing bundle-size
  advisory remains. Final four-tab viewport and optional-tools checks also passed.
- Evidence: `phase-4-before-restyle.png`, `phase-4-after-restyle.png`,
  `phase-4-sam-error.png`, `phase-4-jev-error.png`,
  `phase-4-detections-recovered.png`, `phase-4-error-details.png` and
  `phase-4-options-open.png`.

All four phases are UI/display-only local commits. No module renames, domain/API/
provider changes, dependencies or pushes were made. Browser tests use fixtures;
live model success, production relay behavior, connected database cases and real
product dimensions remain unverified.
