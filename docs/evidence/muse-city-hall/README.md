# Real Muse handoff check — Philadelphia City Hall

October 27, 2026. Public-property workflow test at **1400 John F Kennedy Blvd, Philadelphia PA**. This municipal landmark tests retrieval and provenance; it is not representative evidence of residential renovation readiness. Backend stayed off. Research ran through the installed Muse CLI/account and returned through the frontend file chooser.

## What happened

- The sandboxed attempt could not access the Meta Keychain entry. The authorized run with Keychain access completed research but its HTTP links failed strict import validation. Nothing was imported; this exposed missing rejected-answer retention.
- After enforcing HTTPS in the prompt/output schema, the next run returned **25 findings, 11 sources, six reference links**. It imported successfully but relied heavily on generic portals and secondary records because Atlas rendered as a JavaScript shell.
- A third run included the existing sourced OPA record in the exported job. It returned **22 findings, 10 sources, two reference links**, preserving the primary record and flagging conflicting dates/areas. Both raw successful answers were imported as separate immutable revisions. The final audited proposal retains **two explicitly blocked findings**. No source was promoted to qualified technical evidence.

The exported context contains only saved public research, labeled unreviewed. The runner validates its address/job binding and rebuilds the bounded prompt; it does not execute an exported prompt string. The app receives no credentials and starts no model runs.

## Source usefulness

| Evidence | Check and practical limit |
|---|---|
| [Exact OPA query](https://phl.carto.com/api/v2/sql?q=SELECT%20parcel_number%2Clocation%2Ctotal_livable_area%2Ctotal_area%2Cfrontage%2Cdepth%2Cyear_built%2Cnumber_stories%2Czoning%20FROM%20opa_properties_public%20WHERE%20UPPER%28location%29%3D%271400%20JOHN%20F%20KENNEDY%20BLVD%27%20LIMIT%208) | Browser returned parcel 782273400 and the supplied raw values. `year_built` is 2015, stories is null. These are assessment fields, not a physical survey. Units remain unconfirmed. Saved response included here. |
| [Library of Congress HABS data](https://tile.loc.gov/storage-services/master/pnp/habshaer/pa/pa1000/pa1054/data/pa1054data.pdf) | Opened 23-page primary historic record. Printed p. 12 supports the historic exterior dimensions and seven floors; printed p. 3 distinguishes construction, occupation and completion. The path token pa1054 is not the HABS survey identifier PA-1530. No current room geometry established. |
| [City preservation article](https://www.phila.gov/2025-02-05-historic-preservation-and-climate-action/) | Opens and supports completion in 1901. Publication date is not photo capture date. |
| [ASCE/Invention & Technology summary](https://www.inventionandtech.com/landmark_landing/80337) | Opens; useful historic overview, but secondary. Its start/area descriptions differ from other records. Do not reconcile unlike measurements by arithmetic or treat them as current survey data. |
| [L&I query](https://phl.carto.com/api/v2/sql?q=SELECT%20permitnumber%2Cpermitdescription%2Ctypeofwork%2Cdescriptionofwork%2Cpermitissuedate%2Cstatus%20FROM%20li_permits%20WHERE%20UPPER%28address%29%3D%271400%20JOHN%20F%20KENNEDY%20BLVD%27%20ORDER%20BY%20permitissuedate%20DESC%20LIMIT%2010) | Opens and returns ten rows, with 2019 dates and multiple Dilworth Park events. Supports those returned entries only. Does **not** support the claimed total of 202, nor three older permit examples absent from these rows. Both claims are blocked. No absence of later permits or current permit status inferred. |
| Atlas, general OPA, Historical Commission, zoning definition and city records guide | Portal/agency context is useful navigation, not a property determination. Atlas returned a blank fetched shell. Generic code/commission pages do not establish parcel applicability. |
| National Archives nomination; LoopNet in the earlier run | Not accessible through the independent audit fetch. Remain unverified leads. The latter is a secondary aggregator. |

## Image references

The earlier run's [PAB gallery](https://www.philadelphiabuildings.org/pab/app/image_gallery.cfm?RecordId=911AA16B-2513-454F-BBB56232DCC31B08) is real and includes historic drawings, construction photographs and nearby/context images; every individual image still needs identity/date/rights review. Its project-page count and gallery count differ. [Visit Philadelphia](https://www.visitphilly.com/things-to-do/attractions/city-hall/) and the city article provide exterior context, not current interior conditions.

The context-aware run found a [Commons gallery](https://commons.wikimedia.org/wiki/Philadelphia_City_Hall) and a [YIMBY photo article](https://phillyyimby.com/2021/05/looking-at-philadelphia-city-hall-in-center-city.html). Both open. They are source pages, not individual licensed photo records. **Zero permitted previews returned; zero remote images loaded.** No former listing photos were established. Maps/Earth/Street View remain explicit viewer/search links. A PDF/map reference is labeled separately and never counted as a loaded property photo.

## Fixes and checks

- HTTPS enforced upstream; rejected structured answers now saved separately for diagnosis, never imported as successful results.
- Exported jobs include current sourced context, and the runner validates that context against the address revision.
- Finding-to-source links and method/count labels are visible; limitations survive in the working plan and Markdown.
- Optional `blockedReason` preserves the original claim while excluding it from the compiled plan. Repeating the same label/value without its prior block in this artifact/job is rejected atomically; this is an exact-match guard, not semantic claim detection. No qualified-review unblock workflow is implemented.
- Document/map labels and unverified image dates prevent misleading presentation. Maps/listing searches remain reachable after references are imported.

100 tests passed (15 legacy JavaScript + 85 TypeScript), strict TypeScript, import boundaries, formatting and production builds. Browser verified real imports, revisions, saved-state reload, Markdown download, zero image loads, working-plan exclusion and rejected raw reimport that tried to erase the review blocks. Source audits here are human-readable comparison notes, not automated page verification or qualified design/code review.

Files retain the exported job, both successful raw responses, the blocked proposal, the final UI-exported `property.md`, and exact public API response text. Muse-reported retrieval times are provider assertions, not independently measured per-page timestamps. The first invalid answer predates diagnostic retention and was not recovered.
