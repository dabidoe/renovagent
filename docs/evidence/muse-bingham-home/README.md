# Residential Muse handoff — 7149 Bingham Street

Tested October 27, 2026, using the [public @properties listing, MLS PAPH2657666](https://www.atproperties.com/PAPH2657666/7149-bingham-street-philadelphia-pennsylvania-19111-brightmls). The native page displayed Active and a 35-photo gallery during the browser check; future availability is not established. This is an unaffiliated public-listing research test for a kitchen refresh and possible additional powder room. No ownership or work authorization is claimed. Backend and in-app model execution stayed off.

## Outcome

Real Muse CLI research returned **16 findings, five sources and eight reference entries**. It preserved the supplied primary OPA context and flagged disagreements. It found exact Compass photo URLs but explicitly did not view the images or identify their rooms. One gallery-remainder entry and the unresolved violations finding were blocked in the raw answer.

The raw answer was imported as its own revision. A separate **source-audited import** now holds **17 findings, six sources, four identified photo references and one blocked finding**. The reviewed import is labeled `user-import`; browser-audit notes are explicitly marked. Original Muse output remains in history and in `muse-raw-results.json`. These are source-comparison notes and unreviewed observations, not qualified technical verification.

## Useful property context

| Source | What was checked | Limit |
|---|---|---|
| Exact public OPA query, retained in the job and response text | Parcel 532382800; living area raw 1512; lot raw 3163; frontage/depth raw 25/127; year 1925; stories 1; zoning RSA3 | Assessment fields; units of raw dimensions remain unconfirmed. No room geometry or current zoning applicability is inferred. |
| [Compass MLS syndication](https://www.compass.com/homedetails/7149-Bingham-St-Philadelphia-PA-19111/1OGO6J_pid/) and native listing | Three bedrooms, one bath; structured area 1,512 sq ft; description claims over 1,600; listing explicitly reports two levels | Conflicts preserved against the area description and OPA story count. Listing/OPA agreement can reflect reused assessor data, not independent measurement. |
| Muse's exact `permits` query | Independently opened; zero rows returned for the exact address string | Does not establish absence of permits, approvals or current compliance. Query may miss address variants or other records. |
| Atlas / violations | No readable property evidence established in the run | Violations remain blocked. No clean-history or code-compliance claim. |

Current scope facts, conflicts and targeted next checks appear in the working plan. No retrieved field overwrites a measured project fact or releases construction.

## Real photo references

I inspected these actual images in the native 35-photo gallery and recorded the observed URLs. They were **not identified by Muse vision**. No photo was downloaded, copied into the app, or declared licensed for embedding.

| Native gallery number | Identified view | How it feeds the plan |
|---|---|---|
| 11 | Kitchen: visible cabinets, peninsula, windows and rear door | Measure room/cabinet runs and openings; verify services and work limits on site. |
| 18 | Existing bathroom: visible toilet, window and enclosure | Collect a measured layout and locate accessible services; no clearance or waste/vent determination from the image. |
| 25 | Basement: stairs, ceiling areas and overhead ductwork | Check actual ceiling/headroom/access constraints and service locations for the candidate powder room. |
| 1 | Front exterior | Confirm current access and delivery/site constraints using current photos and a survey where needed. |

Each reference now carries a gallery locator, exact source-photo URL, unreviewed visual notes and a planning action. Both the gallery and exact photo links appear in the saved working plan. The kitchen URL was independently loaded as a 1023×681 image at the provider. Capture dates and current conditions remain unknown. All four preview permissions remain unknown, so the app loaded zero remote images; references open at their source.

## Gaps fixed

- Common street suffixes normalize for Philadelphia exact-address queries: `Bingham Street` now matches `BINGHAM ST`. Parcel confirmation remains explicit; no fuzzy parcel selection or guessed physical dimensions.
- Muse's strict output schema requires every property to be listed as required. Optional annotations are now nullable in the provider schema and normalize to absent values in the contracts. The first attempt failed at API validation before research; the corrected retry completed. A regression check traverses every schema object.
- Photo references previously stopped at intake. They now feed a versioned plan section and clickable reference details, resolving the exact research revision rather than whatever research is newest.
- Additive metadata supports actual photo identifiers, source URLs, unreviewed observations, planning checks and blocking reasons. Markdown retains those details. Unknown preview rights still block inline loading.
- The research prompt asks for specific relevant photos, honest viewing limitations and goal-relevant findings before generic metadata. A source audit still had to identify the useful rooms in this case; automatic visual research is not established.

## Verification

**103 tests passed** (15 legacy JavaScript + 88 TypeScript), strict TypeScript, import boundaries, formatting and both production builds. Added coverage checks suffix normalization, strict provider schema compatibility, nullable metadata, preservation of historical photo references, unchanged physical facts and removal of photo references from the current plan after an address change invalidates research.

Browser checks covered real project creation, failed-then-corrected street matching, explicit parcel selection, exported context, raw and source-audited imports, four exact photo links in the working plan, refresh persistence and UI-generated Markdown export. Public API response text, job, raw result, audited proposal and `property.md` are retained here. Muse-reported retrieval timestamps remain provider assertions, not independent per-page timing evidence.
