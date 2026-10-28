> Historical snapshot of the earlier tracker. Claims below are retained for context, not reverified completion status. Use the canonical architecture and current PROGRESS.md.

# Progress — Unpermitted.ai

**Demo (live):** https://dabidoe.github.io/unpermitted-ai/
**Repo:** https://github.com/dabidoe/unpermitted-ai
**Goal:** One complete, persistent half-bath workflow in 10 days. Not a collection of AI outputs.

## How savings show up (our yardstick)

Every feature must answer: does it save trips, overbuy, rework, or planning time?

- [x] Grouped shopping trips vs. unplanned runs — counted live
- [x] Waste + package rounding visible on every material line
- [x] Garage inventory subtracted from the buy list
- [x] Blocked tasks + permit hold point to prevent rework
- [x] Crew findings priced as rework avoided

## Status

| Day | Focus | State |
|---|---|---|
| 1 | Foundation, schemas, demo app shell | ✅ Done — single-file demo, public repo, Pages live |
| 2 | Project intake (photos, dimensions) | ✅ Done — dimensions + photo upload beside plan, persisted in browser |
| 3 | Planning engine (tasks, dependencies) | ✅ Done in demo — phased tasks, blocked/ready |
| 4 | Materials engine (waste, packs, inventory) | ✅ Done in demo — deterministic BOM |
| 5 | Crew orchestration (Dwang, Pete, Sparky) | 🔶 Partial — rule-based findings, Meta-model architecture documented, real calls next |
| 6 | Procurement (grouped trips, export) | ✅ Done in demo — groups + shopping list export |
| 7 | Visual concepts (mockups) | ⬜ Not started |
| 8 | Contractor scope + due diligence | ✅ Done in demo — scope, scored vetting (0–100, red flags), quote normalisation |
| — | Code & permits (IBC/IPC/NEC search, Philly determinator) | ✅ Done in demo — 12-item cited extract, permit + inspection hold points |
| — | Full purchasing (tax, contingency, CSV order, leftovers) | ✅ Done in demo — all-in materials, grouped trips, returns/inventory |
| 9 | Integration & testing | 🔶 Partial — logic harness passes, browser QA pending |
| 10 | Demo video + submission | ⬜ Not started |

## Verified

- Repo is PUBLIC, `main` pushed: https://github.com/dabidoe/unpermitted-ai
- Materials logic harness: 6×4 ft room → 24 sq ft, $972 materials, 15 BOM lines, $573 est. savings (`npm test`, `tests/engine.test.js`)
- Real project structure: Vite app (`src/engine.js` pure math, `src/app.js` DOM, `src/data.js`), `npm run dev` / `build` verified
- GitHub Pages enabled from `main` / root (root `index.html` now needs the Vite build — publish `dist/` or keep Pages on the last static commit until wired)

## Known limits

- Backend now exists (`server/`: Express+TS, MongoDB, sessions, Google via Firebase, MCP tools) — crew findings still deterministic, no real AI model calls yet.
- Photo upload works locally; photos not yet stored server-side or analyzed.
- Signed-in state syncs to the API; signed-out demo state still lives in the browser (localStorage).
- Google sign-in code-complete but needs your Firebase keys (`FIREBASE_*`, `VITE_FIREBASE_*`) to activate.
- Guidance only — not a substitute for licensed trades or city inspection.

## Next up (in order)

1. Real Meta-model crew chat wired to the same project state (schema-validated).
2. Before/after concept mockup for the selected layout.
3. Recorded 3-minute demo: change one dimension → watch BOM, trips, and savings update.
