> Updated by the [local mapping and selected electrical increment](slice-3-local-mapping-and-electrical.md). The source recovery and observation work below is historical; see the follow-up for current mappings, numerical scope and verification.

# Slice 3 — clearance and systems evidence increment

October 27, 2026 · `half-bath/1.2` · source package `philadelphia-half-bath-2026-10-27.5`.

Backend and real agent execution remain off. No qualified domain reviewer or reviewed technical gold set exists. This increment closes retrieval and durable-observation gaps; it does **not** complete the Slice 3 reviewed-guidance gate.

## What changed

- Recovered the exact [ICC publisher excerpt for 2018 IPC 405.3.1](https://www.iccsafe.org/wp-content/uploads/2018SC-PMG_P405.3.1.pdf), including the accessible children’s exception. Source criteria are distinct from the manufacturer constraints in the geometry calculator. The retained 2018 accessibility policy does not prove that this entire general geometry section is retained or unamended. No code-clearance pass executes.
- Captured [local M-101.2 residential exception](https://codelibrary.amlegal.com/codes/philadelphia/latest/philadelphia_pa/0-0-0-270589) and [R-1.1 adoption](https://codelibrary.amlegal.com/codes/philadelphia/latest/philadelphia_pa/0-0-0-272229). Qualifying dwellings use the residential mechanical path. The IMC private-bathroom rate is not substituted.
- Retrieved publisher indexed excerpts for [2021 IRC M1505.4.4 and footnote a](https://codes.iccsafe.org/content/IRC2021V3.0/chapter-15-exhaust-systems) and [R303.3 and exception](https://codes.iccsafe.org/content/IRC2021P1/chapter-3-building-planning). Direct page retrieval returned 403; these records explicitly identify indexed excerpts, not full-text snapshots. Rates, rating pressure and window/mechanical alternatives remain model criteria until adopted amendments are reconciled.
- Added [city electrical implementation training](https://www.phila.gov/media/20250801084048/2021-Code-Adoption-Electrical-Webinar-Slides.pdf), PDF pp. 12–15, 21 and 27–28. It supplies specific circuit, basin-outlet and GFCI research locators. It is a summary, not full adopted NEC text/exceptions. Its estimated transition dates are superseded by B-2501; it never selects a filing edition.
- Added durable, explicitly unverified observations: dwelling form, circuit rating/served scope, basin outlet distance, reported GFCI, fan operation/rated cfm/rating pressure/discharge and supporting record references. Defaults remain unknown; old records and legacy command retries remain compatible.
- Four separate blocked checks identify circuit/outlet, GFCI, exhaust capacity/rating and ventilation/discharge review. Each shows source criteria, observations, missing exact text/design evidence and the qualified reviewer needed. Reported attic/interior/crawlspace discharge is flagged as a conflict with the retrieved model criterion, not an applied local finding.

## Implementation and limits

`systems-review.ts` is a pure review-register generator, deliberately without a compliance evaluator. `referenceCriteria` in the check contract cannot establish `evaluation.required` or a supported result. Missing sources suppress the criteria. Missing dwelling form or local basis leaves systems applicability unresolved; outside playbook scope remains outside coverage.

Observations are stored in the existing versioned context group through `SavePlanningInputs`. Context changes conservatively invalidate sources, applicability, drainage and tasks; geometry, floor quantities and partial material cost remain independent. Future finer-grained systems dependencies can reduce this deliberate over-invalidation. Historical accepted revisions remain intact. Existing version guards fence the previous playbook/source package before recalculation.

Local residential routing records use the same conservative July 1–October 27 capture window as the existing local methods. No statutory effective-date claim is inferred from that window. All hashes identify curated paraphrases, not remote full-text content.

## Verification

- `npm test`: **84 passing tests — 15 legacy JavaScript + 69 TypeScript**.
- New tests: exact clearance retrieval versus unresolved local mapping; exception visibility; source-loss suppression; apparently adequate equipment never unlocking review; unsafe reported discharge; outside scope and backward-compatible unknowns; invalid negative observations; IndexedDB reopen; accepted-history preservation; systems/source invalidation with independent quantities unchanged; construction tasks blocked.
- `npm run build`: strict TypeScript, boundary checks and both frontend builds pass.
- `npm run format:check`: passes.
- Browser: saved explicitly synthetic fan observations (50 cfm at 0.1 inch water column, reported attic discharge), generated a new assessment revision, verified the blocked criteria and separate history. Refreshed and confirmed persistence. Preview remains on port 8741.

## Required next evidence

1. Qualified section-level retained accessibility / local fixture mapping, adult/child use, all obstruction/door/compartment conditions and actual clearance envelopes.
2. Complete adopted NEC / IRC electrical text, exceptions and state/local reconciliation; licensed electrician circuit/load/conductor/panel/outlet/protection review and tests.
3. Adopted residential ventilation amendments, complete fan listing/performance/control evidence, duct design, exterior termination/opening/lot clearances and whole-house ventilation/energy review.
4. Named qualified reviewers and reviewed boundary scenarios before any supported compliance or construction release capability.
