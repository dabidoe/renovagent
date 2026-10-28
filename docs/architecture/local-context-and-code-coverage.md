> Follow-up: [clearance and systems increment](slice-3-clearances-and-systems.md) supersedes the clearance/electrical/exhaust coverage and test count below. Earlier drainage and locality evidence remains applicable.

# Slice 3 follow-up — local authority and provision coverage

Delivered October 27, 2026. Source package **`philadelphia-half-bath-2026-10-27.4`**, playbook **`half-bath/1.1`**, local profile **`local-context/1.0`**. The backend and external providers remain off.

The workspace now distinguishes reported property geography, candidate authority, adoption/transition basis, local amendment, project applicability, arithmetic evaluation, and qualified review. None is interchangeable with another. All technical source/requirement records remain **unreviewed**, and `reviewComplete` remains hard-blocked to `false`.

## Source coverage added

There are 12 captured source records and six requirement records. Each source preserves its authority, jurisdiction, publication type, edition, locator, access, interpretation status, review needs, and a SHA-256 hash of the curated paraphrase. The hashes do not identify full remote source snapshots. Copyrighted model-code text has not been collected wholesale.

| Source / exact locator | Implemented use | Remaining limit |
|---|---|---|
| [PA UCC, 34 Pa. Code 403.21(a)(6)](https://www.pacodeandbulletin.gov/Display/pacode?file=/secure/pacode/data/034/chapter403/s403.21.html) | State adoption layer | Does not establish local/project applicability |
| [L&I adopted code table](https://www.phila.gov/departments/department-of-licenses-and-inspections/resources/applicable-codes/) | City adoption and retained-accessibility distinction | Exact retained section/exception mapping still requires review |
| [B-2501, pp. 1–2](https://www.phila.gov/media/20251021080549/B-2501-Implementation-of-2021-International-Codes.pdf) | Complete-filing transition; edition election, in-scope amendments and expired resubmissions; separate accessibility basis | Reported filing facts and amendment scope need review |
| [Bill 250645, P-1.1 / P-101.2](https://phila.legistar.com/LegislationDetail.aspx?FullText=1&GUID=349F6C13-53C4-4B7C-9E9F-FD51948829F0&ID=7436521) | Local plumbing adoption/scope | Redline is not flattened into executable rules indiscriminately |
| [P-103.1 / P-103.2](https://codelibrary.amlegal.com/codes/philadelphia/latest/philadelphia_pa/0-0-0-270643) and [A-301.2 / A-301.2.4](https://codelibrary.amlegal.com/codes/philadelphia/latest/philadelphia_pa/0-0-0-268148) | Separate permit rule and narrow repair exceptions | No automatic exemption, permit issuance or inspection outcome |
| [P-919.1 / P-919.2.8–9](https://codelibrary.amlegal.com/codes/philadelphia/latest/philadelphia_pa/0-0-0-312715) | Explicitly selected local single-stack method; traceable observed-fall comparison | Complete sizing, loading, routing, fittings and vent design remain unreviewed |
| [Bill 250645, P-918.1](https://phila.legistar.com/LegislationDetail.aspx?FullText=1&GUID=349F6C13-53C4-4B7C-9E9F-FD51948829F0&ID=7436521) | Flag proposed individual AAV water-closet path | This does not approve another vent design; full model/amendment relationship needs review |
| [Table P-704.1](https://codelibrary.amlegal.com/codes/philadelphia/latest/philadelphia_pa/0-0-0-312315) | Explicit formatting-ambiguity record | Deleted/replacement ranges and footnotes must be visually reconciled; no numeric general-method rule executes |
| [Candidate retained IPC 2018 405.3.1](https://codes.iccsafe.org/content/IPC2018P3/chapter-4-fixtures-faucets-and-fixture-fittings) | Unavailable exact-provision record | Publisher access returned 403; no other edition/jurisdiction or remembered minimum substitutes for it |
| [Official contractor research entrypoint](https://www.phila.gov/services/permits-violations-licenses/find-a-licensed-contractor-and-contractor-information/) | Distinguish trade license, general licensing and state registration evidence | No person or company queried, scored or vetted |
| [PWD water/sewer connections](https://water.phila.gov/development/connections/) | Record separate authority boundary for service/lateral work | Actual scope, connections and approvals require investigation |

The adoption table's old “2021 IPC” label is no longer treated as the clearance provision's complete basis. Retained accessibility and exact source access remain separate unresolved records. A city directory is likewise not evidence that a particular contractor is qualified.

## Applicability and executable boundary

Inputs now explicitly record municipal-boundary basis, country/region/municipality, optional postal/property reference, complete received filing date/type, edition election, original issued-permit reference/edition and amendment scope, stories, dwelling units, separate egress and fixture use. Missing fields load as unknown when opening earlier projects.

`determineCodeBasis` implements the captured bulletin paths. An unknown election differs from an explicitly unspecified election. The selected edition is still a candidate based on reported facts, not an approved filing. A 2018 general basis does not borrow this package's 2021 local methods.

Local amendment **execution coverage is conservatively bounded to July 1–October 27, 2026**. This is the curated package's supported window, not a claim that every amendment legally took effect on July 1. Earlier transition elections can identify a general code basis while local rule execution remains blocked pending effective-date/version reconciliation. Future dates require refreshed sources.

The half-bath method remains deliberately narrower than the entire local code: qualifying reported dwelling scope, private fixture use and new half-bath work. Outside-scope buildings/work route to review; the software does not claim that the code forbids those projects.

The new `drainage` artifact uses the selected local method, nominal diameter and measured horizontal run/fall. A shortfall is `not_supported`; a numerical threshold match is **`needs_review`**, never an approved compliance pass. Other/unknown methods cannot borrow its threshold. A proposed mixed method or excluded AAV path stays blocked. Locality/source/method ambiguity prevents execution.

Electrical, exhaust, exact fixture clearances, complete drainage sizing and complete vent design remain incomplete. No construction task is released by user acceptance.

## Local context for later commerce and contractor work

`packages/contracts/src/locality.ts` and `packages/core/src/planning/locality.ts` expose the shared reported-locality/candidate-authority contract. Postal geography never silently selects an enforcing authority. A conflicting state/municipality blocks the local path. The profile's uses are always `not-verified`:

| Future use | Evidence required before a claim |
|---|---|
| Code | Actual authority boundary, filing/building/scope basis, exact adopted provisions/amendments and qualified applicability review |
| Pricing | Offer/quote locality and scope, currency, tax/delivery basis, capture date and freshness |
| Shopping | Actual pickup/delivery coverage, dated stock/packages and product compatibility |
| Contractors | Exact identity/service area, appropriate local trade category/status/expiry, applicable state registration, insurance and scope-specific due diligence |

These are evidence contracts and visible scope boundaries, not working external integrations. The current partial floor-cost arithmetic does not certify a quote as local. Future providers must bind results to explicit locality/profile/input revisions and invalidate those results when location or service coverage changes. No shopping, credentials API, contractor scan, outreach or purchase was enabled.

## Persistence and invalidation

Workspace schema remains 2, with additive defaults/optional fields. New applicability fields become unknown, never verified, for older records. Legacy `SavePlanningInputs` command retries keep their original canonical fingerprint when the only additions are semantically absent unknown fields. Comparisons use canonical key ordering, avoiding redundant revisions caused by object field order.

Source, local-profile and playbook version drift fence acceptance and readiness before recalculation. Individual source availability can be withheld but cannot make an inaccessible or ambiguous provision usable. Locality facts with exact keys `jurisdiction`, `countryCode`, `regionCode`, `municipality`, `postalCode` participate through exact references and membership signatures; a newly added conflicting fact blocks local evaluation. Free-text addresses are not parsed/geocoded.

Source/locality/context changes stale applicability, local checks and the gated plan, while independent floor quantities/cost remain current. Route measurements stale local checks; room geometry also updates its own dependent quantities. Accepted revisions, decisions and exact conversation links remain historical records.

## Verification and open review gate

**80 tests pass**: 15 legacy characterization tests and 65 TypeScript contract/domain/repository/workspace/planning tests. New coverage includes filing branches and conflicts; locality mismatch and postal non-inference; explicit source quality/availability/window guards; local numerical boundaries and negative cases; AAV/mixed-method exclusions; retained-edition gaps; hash consistency; additive input defaults and legacy command retries; per-source and locality-fact invalidation; unchanged artifact revisions; authority-profile drift; stale acceptance; and preserved accepted history.

Strict TypeScript, dependency boundaries, production product/legacy/diagnostic builds and formatting are checked. Browser checks verify reported locality, separate general/accessibility bases, source/requirement inspection, numerical threshold versus review status, source-loss blocking and saved revision history. These remain software checks, not a qualified technical gold set.

Before reviewed guidance: obtain permitted exact retained provisions, reconcile amendment text/footnotes and effective dates, establish complete trade coverage, and record a qualified reviewer, scope, source/playbook/profile versions, findings, exclusions and date. No UI checkbox grants that role or produces an authority outcome.
