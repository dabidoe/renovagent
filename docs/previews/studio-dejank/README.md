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
