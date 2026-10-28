# Property working record

Address: 1400 JOHN F KENNEDY BLVD, Philadelphia PA
Project: Public-building workflow test only. Explore the address-first research and planning handoff.

Status: unreviewed research; not a measured survey, code determination or verified current condition.
Method: muse · Job: project:ea60488c-22af-48ae-a7d4-e79a8e05b483:property:fact:26c8bae6-1427-4c08-b657-4e65474f268a:1

## Useful findings

| Finding | Record value | Source | Limit | Review |
|---|---|---|---|---|
| Assessment parcel | 782273400 | phila-opa | Assessment record; may be historic, estimated or different from current conditions. Supplied record preserved; do not treat as independently re-retrieved by this run. | Unreviewed |
| City record address | 1400 JOHN F KENNEDY BLVD | phila-opa | Assessment record; may be historic, estimated or different from current conditions. | Unreviewed |
| Recorded living area | 891135 | phila-opa | Raw OPA total_livable_area; confirm dataset units. Lot/assessment data is not a measured room or building footprint. Disagreement: ASCE/NPS summary reports over 1 million sq ft originally; different definitions or dates may explain the difference. | Unreviewed |
| Recorded lot area | 330443 | phila-opa | Raw OPA total_area; confirm dataset units. Lot/assessment data is not a measured room or building footprint. Disagreement: ASCE summary says building covers 14.26 acres; do not convert or reconcile until OPA units and coverage definition are confirmed. | Unreviewed |
| Recorded lot frontage | 524 | phila-opa | Raw OPA frontage; confirm dataset units. This is a parcel/frontage record, not a measured building width. Compare building dimension finding separately. | Unreviewed |
| Recorded lot depth | 442 | phila-opa | Raw OPA depth; confirm dataset units. This is a parcel/depth record, not a measured building depth. Compare building dimension finding separately. | Unreviewed |
| Recorded year built — disagreement flagged | 2015 | phila-opa | Assessment record; may be historic, estimated or different from current conditions. Explicit disagreement: NPS/ASCE/HABS sources report construction 1871/1872–1901 and completion in 1901, not 2015. Treat 2015 as an unverified OPA field requiring assessor confirmation, not as the historic construction date. | Unreviewed |
| Recorded zoning | CMX5 | phila-opa | Assessment record; may be historic, estimated or different from current conditions. Confirm current zoning and overlays in Philadelphia Atlas before any planning. | Unreviewed |
| OPA stories field | null (not reported) | phila-opa | Null in the returned OPA record; absence is not evidence of story count. Use the separate HABS/ASCE story finding. | Unreviewed |
| Building identity and use | Philadelphia City Hall — municipal government building at the Broad and Market / Penn Square location | asce-cityhall | Seat-of-government use is a public-building reference for this workflow test only; no residential room inference is made. | Unreviewed |
| Historic construction period | Construction began 1871/1872 and was completed in 1901 | asce-cityhall | Secondary ASCE landmark summary citing the NPS nomination dated August 11, 1976; construction start is reported as 1871 in some sources and 1872 in the ASCE page opened here. | Unreviewed |
| Building dimensions reported by HABS/ASCE | 486 feet by 470 feet | asce-cityhall | Reported building measurement, not lot frontage/depth and not a current measured survey. Units are feet as stated by the source. | Unreviewed |
| Stories reported by HABS/ASCE | 7 stories | asce-cityhall | Historic/landmark summary; does not confirm current interior floor configuration. | Unreviewed |
| Tower height reported by NPS/ASCE | 548 feet above ground including tower and statue | asce-cityhall | Historic landmark summary including tower and William Penn statue; not a zoning height determination. | Unreviewed |
| Historic rooms and area reported by ASCE | Originally contained 634 rooms with over 1 million square feet of space; building covers 14.26 acres | asce-cityhall | Original/historic description; conflicts in scope with raw OPA total_livable_area and must not be averaged with it. | Unreviewed |
| National Historic Landmark record lead | Philadelphia City Hall NHL/NRHP nomination file 76001666, dated 12/08/1976 in the Archives file title | nps-nhl | NPS nomination PDF discovered in search results; large PDF was not text-fetched in this run, so details beyond the file identification need direct PDF review. | Unreviewed |
| Philadelphia Historical Commission role | Commission identifies/designates historic landmarks, maintains the Philadelphia Register of Historic Places, and reviews work to historic properties | phila-historical-commission | General commission role, not a property-specific designation confirmation in this run. Confirm this parcel on the Philadelphia Register before assuming review triggers. | Unreviewed |
| CMX-5 zoning district meaning | CMX-5 = Center City Core Commercial Mixed-Use | phila-zoning-code | Code-library text opened was truncated; this is the district name from search/code text, not a use-permission or compliance determination. | Unreviewed |
| City Hall address in a current City of Philadelphia page | City Hall, Room 156, 1400 John F. Kennedy Boulevard, Philadelphia, PA 19107 | phila-records-cityhall | Current phila.gov contact/subpoena guidance page opened 2025-07-24; confirms municipal use of the address, not parcel dimensions. | Unreviewed |
| L&I permits count at exact address | 202 permit rows for UPPER(address) = '1400 JOHN F KENNEDY BLVD' | phila-li-permits | CARTO li_permits query result at retrieval; dataset may lag eCLIPSE and the same street address includes Dilworth Park/City Hall operations. Owner names and contractor personal details were excluded. | BLOCKED: Source audit: the cited SELECT query has LIMIT 10 and returns total_rows 10, not a COUNT result. It does not substantiate the claimed total of 202. Obtain the exact count-query result before use. |
| Most recent permits returned by L&I dataset | 2019-11-12 operations permit 26673 (Dilworth Park tent) COMPLETED; 2019-10-10 electrical permit 1018075 ACTIVE in dataset | phila-li-permits | Dataset snapshot returned no rows newer than 2019 in the 10-row descending sample; do not conclude no later permits exist in eCLIPSE. | Unreviewed |
| Earlier building-system permits at exact address | 2019 plumbing permit 950181 COMPLETED; 2013 fire-suppression permit 466457 EXPIRED in dataset; 2013 electrical permit 471841 ACTIVE in dataset | phila-li-permits | Examples from the first CARTO rows; statuses are dataset statuses and may be stale. No permit approval is claimed for any proposed work. | BLOCKED: Source audit: permits 950181, 466457 and 471841 are absent from the cited ten-row result. The current source URL cannot substantiate these examples or statuses. Obtain a query returning these specific rows. |

## Sources

- phila-opa: Philadelphia Office of Property Assessment · public record (supplied lead, preserved) — https://phl.carto.com/api/v2/sql?q=SELECT+parcel_number%2Clocation%2Ctotal_livable_area%2Ctotal_area%2Cfrontage%2Cdepth%2Cyear_built%2Cnumber_stories%2Czoning+FROM+opa_properties_public+WHERE+UPPER%28location%29+%3D+%271400+JOHN+F+KENNEDY+BLVD%27+LIMIT+8 (retrieved 2026-10-27T20:49:46.723Z)
- phila-li-permits: Philadelphia L&I permits · CARTO li_permits query for exact address — https://phl.carto.com/api/v2/sql?q=SELECT+permitnumber%2Cpermitdescription%2Ctypeofwork%2Cdescriptionofwork%2Cpermitissuedate%2Cstatus+FROM+li_permits+WHERE+UPPER%28address%29+%3D+%271400+JOHN+F+KENNEDY+BLVD%27+ORDER+BY+permitissuedate+DESC+LIMIT+10 (retrieved 2026-10-27T21:00:00.000Z)
- asce-cityhall: ASCE/Invention & Technology landmark summary · Philadelphia City Hall (cites NPS nomination) — https://www.inventionandtech.com/landmark_landing/80337 (retrieved 2026-10-27T21:00:00.000Z)
- nps-nhl: National Park Service / National Archives · Philadelphia City Hall NHL nomination PDF (search-discovered) — https://catalog.archives.gov/medialz/electronic-records/rg-079/NPS_PA/76001666_NHL.pdf (retrieved 2026-10-27T21:00:00.000Z)
- loc-habs-cityhall: Library of Congress HABS data pages · Philadelphia City Hall (search-discovered PDF) — https://tile.loc.gov/storage-services/master/pnp/habshaer/pa/pa1000/pa1054/data/pa1054data.pdf (retrieved 2026-10-27T21:00:00.000Z)
- phila-records-cityhall: City of Philadelphia · Getting City records (lists City Hall Room 156 address) — https://www.phila.gov/2025-07-24-getting-city-records-a-simple-guide-to-subpoenas/ (retrieved 2026-10-27T21:00:00.000Z)
- phila-historical-commission: City of Philadelphia · Philadelphia Historical Commission — https://www.phila.gov/departments/philadelphia-historical-commission/ (retrieved 2026-10-27T21:00:00.000Z)
- phila-zoning-code: Philadelphia Code via American Legal · zoning district definitions including CMX-5 — https://codelibrary.amlegal.com/codes/philadelphia/latest/philadelphia_pa/0-0-0-289458 (retrieved 2026-10-27T21:00:00.000Z)
- wikimedia-commons-cityhall: Wikimedia Commons · Philadelphia City Hall category (search-discovered image lead) — https://commons.wikimedia.org/wiki/Philadelphia_City_Hall (retrieved 2026-10-27T21:00:00.000Z)
- phillyyimby-cityhall: Philadelphia YIMBY · Looking at Philadelphia City Hall in Center City (search-discovered photo article) — https://phillyyimby.com/2021/05/looking-at-philadelphia-city-hall-in-center-city.html (retrieved 2026-10-27T21:00:00.000Z)

## Image references

- Map/category lead — Wikimedia Commons Philadelphia City Hall category page (not a single-photo page; verify each file license before reuse) — https://commons.wikimedia.org/wiki/Philadelphia_City_Hall; source: wikimedia-commons-cityhall; reference type: Source page; reported image date (basis unverified): unknown; preview permission: unknown. Not verified as current.
- Specific article photo lead — Philadelphia YIMBY, Looking at Philadelphia City Hall (publication page; photo capture dates not established here) — https://phillyyimby.com/2021/05/looking-at-philadelphia-city-hall-in-center-city.html; source: phillyyimby-cityhall; reference type: Source page; reported image date (basis unverified): unknown; preview permission: unknown. Not verified as current.

## Next useful questions

- This is Philadelphia City Hall, a public municipal building — which specific public-building area, system, or workflow handoff is being tested, and what is the authorized scope?
- L&I violations could not be verified in this run: the li_violations CARTO query returned HTTP 400, so should the handoff use eCLIPSE/Atlas directly to confirm open violations before planning?
- Can you confirm the OPA units and explain the flagged disagreements — OPA year_built 2015 versus historic completion 1901, and OPA raw areas versus ASCE over-1-million-sq-ft/14.26-acre coverage?
- No Google Maps/Earth/Street View or former listing page was opened as a verified property-specific lead in this run; do you want map-viewer leads added as non-evidence references only, with previewUrl still null?
- Can you provide current interior/exterior photos and any measured drawings for the exact area in scope? Do not infer room sizes or concealed conditions from parcel or landmark summaries.

Tax/assessment area and lot dimensions are not room measurements or a building footprint. Listing images can be historic. Findings do not overwrite project facts or release work.
