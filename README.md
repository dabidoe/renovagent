# Unpermitted.ai

**Questionable name. Surprisingly sound advice.**

An AI construction crew that helps homeowners plan a renovation once — and stop losing money on extra store trips, overbuying, and rework.

**Live demo concept:** Convert a first-floor space in a Philadelphia rowhouse into a half bathroom.

## Run it

No build step. Serve the folder and open the page:

```bash
python3 -m http.server 8741 --bind 127.0.0.1
# open http://127.0.0.1:8741/index.html
```

Or open `index.html` directly in a browser. Project state is saved in your browser (localStorage).

## How it saves customers time and money

- **Fewer trips:** materials are consolidated into phased purchasing groups instead of unplanned one-off runs.
- **Less overbuy:** every material shows need → waste allowance → package rounding → buy quantity. Existing garage inventory is subtracted.
- **Less rework:** tasks stay blocked until prerequisites and permit/inspection hold points are cleared. Specialist crew reviews flag missing vent paths, GFCI, and fan issues before work starts.
- **Budget control:** changing dimensions, layout, floor finish, or budget instantly recalculates cost, materials, trips, savings, contractor scope, and the revision log.

## What's in the demo

- Intake for room dimensions, stack distance, layout, floor finish, and budget.
- Phased task plan with dependencies and hold points (Dwang, GC).
- Deterministic bill of materials with waste, package rounding, inventory, and source-task traceability.
- Grouped shopping trips and an exportable shopping list.
- Crew Meeting with structured findings from Dwang (GC), Pete (plumbing), and Sparky (electrical).
- Contractor scope-of-work generator and due-diligence checklist (unknown = unverified).

## Product and technical plan

See [docs/Unpermitted.ai.md](docs/Unpermitted.ai.md) for the full plan, data models, agent workflow, evaluation criteria, and 10-day delivery plan.

## Safety

Guidance only. This is not a substitute for licensed trade advice or city inspection. Plumbing and electrical work usually requires permits and inspections — the app flags those hold points; it does not help dodge them.

## Hackathon

Indie Developer track · October 2026 · Initial use case: first-floor half-bathroom renovation.
