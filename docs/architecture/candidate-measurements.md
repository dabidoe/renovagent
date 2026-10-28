# Candidate measurements, derived checks and work updates

Implemented locally October 27, 2026. Backend off. Follow-up to [answer-driven options](answer-driven-options-and-work-plan.md); the scope recipe is now `kitchen-powder-study/2`. Qualified feasibility and construction release remain blocked.

## User workflow

Open the working brief, saved options/sequence, or the Technical checks overview → expand **Candidate measurements**. The local recipe has one active named kitchen work area, ground-floor candidate and basement candidate. Each editor saves independently. Switching among its tabs retains open unsaved edits; unsaved edits are not durable across refresh/project switching.

Record a location label, declared footprint, rough/finished/conflicting basis, observed date, measurement method, notes, individual dimensions/units, reported door-swing status and optional supporting local files. Blank dimensions and dates stay unknown. Fields cover width/length, minimum observed headroom, clear doorway, approach width and observed drain run/fall. Original units are preserved. Example measurements have a separate explicit basis and never satisfy the actual-site-survey gate.

“New candidate · clear measurements” creates a new physical location ID and clears previous values; saving replaces the active candidate for that role while retaining all earlier revisions. This is not yet an arbitrary multi-room registry or simultaneous comparison of several ground-floor/basement zones. The role field in the shared data contract is general; this versioned recipe supports these three roles only.

A save stores the survey, primary observation evidence and candidate checks atomically. If current options and a current selected study sequence exist, it also creates their next revisions using the saved dimensions. It does not revive an already-stale proposal or a rejected study. The user must explicitly rebuild stale options and sequence the desired option. Historical views remain pinned; a current latest options/sequence view advances; the technical overview remains open when edited there.

## Calculation and authority boundaries

Candidate checks use `geometry` and `mm` from the existing pure technical core, with an empty planning-input record populated only with this candidate's explicit width, length, measurement basis and observed drain run/fall. No global bathroom inputs, fixture defaults or measurements from another location are copied.

- Rectangular area/perimeter and observed gradient use the shared formulas. Rough/conflicting results are visibly provisional. Irregular/unknown footprints do not acquire an invented rectangular area.
- Headroom, doorway and approach lengths convert to millimetres without applying a code minimum. Zero is retained as an observation but is not a positive room/access dimension; zero drain fall is valid arithmetic. Negative lengths, invalid units, non-finite/oversized values are rejected.
- No fixture/cabinet specification, placement or swept-door geometry is supplied by this increment; fit remains blocked. Drain gradient does not establish sizing, routing, available connection elevations, gravity drainage or pump suitability.
- Local adopted provisions, amendments, building/use applicability, concealed services, structural design, permits and qualified review remain unresolved. No compliance/feasibility pass, price, purchase authorization, completed survey/task or inspection result is emitted.

When basic actual-site fields are present, the option's survey dependency and survey planning step move to **needs review**, never completed or construction-ready. Detailed openings/cabinet/fixture surveys and qualified review remain required. Kitchen-only consumes the kitchen role; ground-floor and basement options consume the kitchen plus their own candidate. Other candidate checks retain their independent dependencies.

## Durable model and guards

Additive payloads:

- `candidate-measurements`: physical location ID, role, label, original-unit inputs, method/date/notes, door observation and user-reported/example basis. Inputs belong to the project and are not promoted into shared property facts or overwrites of existing technical inputs.
- `candidate-checks`: exact survey reference, shared-method traces, explicit missing fields, blocked checks and limitations.

`SaveCandidateMeasurements` fences the displayed property address revision, measurement revision, options revision and selected sequence revision, alongside the existing project/property preconditions. It rejects unknown roles, future observation dates, empty/invalid input, reused location IDs across roles and missing/foreign evidence. A failed save cannot leave evidence or partial derived output. Generic proposal commands cannot forge/replace the protected records; user observations/checks cannot be accepted or declined as agent proposals.

Measurement inputs reference the exact shared address fact and primary/supporting evidence. Checks reference their exact measurement revision. Address edits stale old site evidence and fence old-address editors; goal/photo changes do not rewrite measurements of the same property. Old values remain inspectable, and current options exclude stale property measurements.

Candidate membership joins workflow context so the first survey as well as later corrections invalidate dependent work. Exact survey/check refs enter option dependencies; work sequences reference the rebuilt options. A correction stales earlier checks, options, sequence and downstream consumers while preserving accepted/history records. Unrelated candidate checks and physical calculations keep their explicit dependencies. A single saved conversation record links the survey/checks and any automatically refreshed options/sequence.

`BuildProjectOptions` now optionally accepts `surveyRefs` for backward-compatible command parsing. When surveys exist, their exact complete set is required and checked, preventing a queued build from silently consuming changed measurements. Earlier command retries keep their original fingerprints and results. No root snapshot/database migration was needed.

## Verification

Eight new integration scenarios in `tests/integration/candidate-measurements.test.ts` cover mixed units and exact arithmetic; original values/provenance; first-save and correction invalidation/refresh; accepted and historical versions; candidate isolation; rough, conflicting, irregular, partial, zero and example inputs; revision/address/selection guards; invalid observations and atomic rollback; idempotency; unsupported roles; protected writes; foreign evidence; changed-address fencing; persistence through IndexedDB close/reopen; replacement physical IDs; historical-view pinning and preservation of the technical overview.

Browser QA in **Muse answers · workflow QA only** saved all three explicitly example-based candidates, including an irregular ground-floor footprint and mixed-unit basement survey. It verified date persistence, original units on refresh, correction from 4 ft to 5 ft (area 2.4384 → 3.048 m²), current option/sequence revision advancement, and the original stale check still displaying its 2.4384 m² result. The date-entry and accessible-label gaps found in that flow were fixed. Actual owner/property measurements were not invented or copied to the original project.

Evidence: `docs/previews/candidate-measurement-entry.png`, `docs/previews/candidate-measurement-checks.png`. Full verification: **128 tests** (15 legacy JavaScript + 113 TypeScript), type checks, dependency boundaries, formatting and frontend/foundation builds passed. The existing main-bundle size advisory remains; no backend, model, deployment or credential work was started.
