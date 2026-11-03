# Quieter room studio — November 2, 2026

The furniture view now starts with Add furniture and the selected piece. The
12-piece catalog opens on request and closes after adding. Multiple placements
use a compact selector; the selected piece keeps rotation handy, with position,
size and item linking inside a closed disclosure. Reference notes stay available
on demand. Existing layout warnings remain visible.

The header uses a small example-budget link instead of a large dark budget card.
Room tabs no longer repeat prices. Shopping list lives in Plan & budget. The
sidebar is narrower, and the 3D scene fits the available desktop height. Camera
Rotate/Move stay visible; turns, Top and Reset sit behind View. Model geometry,
planning calculations, APIs, providers and saved data were not changed.

Playwright checks at **1440×900 and 1000×900** used local intercepted API fixtures.
They verified closed library/advanced controls, automatic library closing after
adding, selected-piece editing, dimension changes, switching pieces, camera Top
and Reset, camera controls within the viewport, paint/floor choices, and shopping
list/local-code access. No horizontal overflow was observed. No live generation
or database operation was performed.

- `npm test`: **333 passed** (15 legacy + 318 TypeScript), **52 skipped**, zero failures.
- `npm run build`: types, boundaries and both builds passed. Existing bundle-size
  advisory remains. Connected database and live provider behavior remain unverified.

| Width    | Before                                     | After                                     |
| -------- | ------------------------------------------ | ----------------------------------------- |
| 1440×900 | [Furniture](before-furniture-1440x900.png) | [Furniture](after-furniture-1440x900.png) |
| 1000×900 | [Furniture](before-furniture-1000x900.png) | [Furniture](after-furniture-1000x900.png) |

Plan access: [1440×900](after-plan-1440x900.png), [1000×900](after-plan-1000x900.png).
