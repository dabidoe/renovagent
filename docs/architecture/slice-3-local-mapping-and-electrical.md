# Slice 3 — local clearance mapping and selected electrical provisions

October 27, 2026 · `half-bath/1.3` · `philadelphia-half-bath-2026-10-27.6`.

This increment retrieves exact selected residential electrical clauses and records candidate local section mappings. **It is not complete electrical design coverage, reviewed compliance guidance or construction authorization.** Backend and real agent execution remain off. Qualified reviewer and reviewed gold set: none.

## Clearance mapping

[Bill 250645, P-1.1 / P-101.2](https://phila.legistar.com/LegislationDetail.aspx?FullText=1&GUID=349F6C13-53C4-4B7C-9E9F-FD51948829F0&ID=7436521) incorporates IPC 2021 and applies local plumbing scope to qualifying homes. The publisher’s public read-only [IPC 2021 Chapter 4](https://codes.iccsafe.org/content/IPC2021P3/chapter-4-fixtures-faucets-and-fixture-fittings) was accessible in the browser despite research-fetch 403 responses.

The recorded candidate mapping separates:

- General geometry: IPC 2021 405.3.1 and door/egress interference under 405.3.3.
- [Local Section 405](https://codelibrary.amlegal.com/codes/philadelphia/latest/philadelphia_pa/0-0-0-305704): setting/alignment and public/employee compartment privacy amendments. The captured amendment page displays no replacement numeric 405.3.1 provision. This is a source comparison, **not a certified finding that no other amendment exists**.
- Retained accessibility: B-2501’s separate 2018 / A117.1-2009 basis still needs a qualified scoping and section-level determination. IPC 404 accessibility references and general IPC 405 geometry cannot be collapsed into one retained rule. The 2018 excerpt does not substitute for the changed 2021 adjacent-fixture wording.

The assessment exposes separate general-clearance and retained-accessibility checks. Numeric clearance compliance remains blocked: the existing footprint drawing does not establish all obstruction envelopes, compartment conditions, door sweep or accessible layout. Private dwelling use does not establish an accessibility exemption or trigger public/employee partition requirements.

## Electrical text and local comparison

Exact clauses were inspected in public publisher read-only pages. The app retains short curated paraphrases and locators, not copies of the code or hashes of full remote text.

| Selected provision | Retrieved basis | What remains blocked |
|---|---|---|
| Scope / alterations | [IRC E3401.1–4](https://codes.iccsafe.org/content/IRC2021P3/chapter-34-general-requirements) | Confirm building, service, design method and affected existing systems |
| Bathroom circuit / exception / load limits | [E3703.4 and E3702.3](https://codes.iccsafe.org/content/IRC2021P3/chapter-37-branch-circuit-and-feeder-requirements) | Full circuit tracing, load/design review, conductors, panel and protection |
| Basin outlet placement | [E3901.6](https://codes.iccsafe.org/content/IRC2021P3/chapter-39-power-and-lighting-distribution) | All basins/outlet count, mounting, vertical offset, listing and inspection |
| Bathroom GFCI | E3902.1 on the same publisher page | Actual branch voltage/phase/to-ground scope, accessibility and protection tests |
| Bathroom lighting | E3903.2 including its exceptions on the same page | Actual lighting/control design, sensor/manual-override conditions and installation |
| Residential tub/shower receptacle restriction | [Certified Bill 260395, pp. 32–36, R-E4002.11](https://files.amlegal.com/pdffiles/Philadelphia/260395.pdf) and [34 Pa. Code 403.21(a)(7)](https://www.pacodeandbulletin.gov/Display/pacode?file=/secure/pacode/data/034/chapter403/s403.21.html) | Qualified retained/replacement mapping and actual wet-zone geometry; do not borrow model NEC exclusion zones/exceptions |

The state amendment enumeration and certified local package display no replacement for the selected E3703.4, E3901.6 or E3902.1 clauses. The application labels that comparison **candidate incorporation / unreviewed**. Qualified completeness, current errata/TIA applicability and project-specific review remain necessary. Other electrical requirements, including AFCI, tamper resistance, grounding, equipment listing and broader wiring/service design, are not established by this subset.

The [official 2020 NEC free reader](https://link.nfpa.org/free-access/publications/70/2020) redirected to NFPA login. No login/account/credential work was performed. The NEC alternative has an explicit unavailable-source record and stays blocked. IRC cross-references and training summaries do not substitute for complete NEC text, exceptions, errata or TIAs.

## Implemented comparison and durability

`electrical.ts` requires an explicit reported IRC Part VIII design basis, a qualifying unambiguous detached dwelling or single-family townhouse, a complete candidate 2021 local filing basis, reported service within the E3401 envelope, and available path/provision sources. Ambiguous twin/duplex classification, NEC alternative, missing/out-of-scope service or conflicting locality cannot execute the comparison.

Only the selected basin’s reported **outside-edge distance** is compared against E3901.6. Boundary match is `needs_review`; exceeding the limit is `not_supported`. Unknown measurement basis or source/path gaps produce `not-evaluated` with no required threshold. This does not evaluate mounting/listing, other basins, accessibility or complete outlet compliance. All construction gates remain blocked.

New `context.electrical` fields default to unknown/null. They use existing validated commands, exact four-group revision preconditions and backward-compatible fingerprint normalization. The `mapping` check contract is additive. Context changes conservatively invalidate source, code, drainage and task outputs, preserving independent geometry/floor quantities/cost. Accepted historical revisions remain intact. Playbook/source version guards fence older results before recalculation. Sourced locality conflicts also clear mapping status and numeric thresholds.

## Verification

- `npm test`: **91 passing tests (15 legacy + 76 TypeScript)**.
- New tests cover current general versus retained accessibility mapping; public/private compartment scope; exact circuit, GFCI, lighting and local wet-zone records; distance boundary/shortfall; service/building/NEC/source guards; unknown-field compatibility; invalidation; accepted history; IndexedDB reopen; and conflicting locality suppressing both mapping and threshold.
- `npm run build`: strict TypeScript, import boundaries, workspace/legacy and foundation builds pass.
- `npm run format:check`: passes.
- Browser: existing preview preserved on port 8741. Explicitly synthetic service/path facts and basin measurement saved. Boundary match remains review-only; an out-of-range revision remains unsupported after reload. No observations were professionally verified. [Preview evidence](slice-3-electrical-mapping-preview.png).

## Open acceptance gates

Qualified reviewers must reconcile amendment completeness and project scope; determine retained accessibility applicability; inspect complete geometry; verify actual electrical circuits, loads and protection; and establish the missing NEC/other electrical coverage before any reviewed-compliance or construction-release capability is introduced.
