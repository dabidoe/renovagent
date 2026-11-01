# Interaction audit and implementation queue

October 31, 2026. Live audit used an isolated browser example at `localhost:8757`; existing owner/Atlas projects were not modified. Source inventory covers **425 authored interactive JSX elements/forms across 40 TSX files**: 213 buttons, 61 links, 50 disclosures, 23 selects, 13 forms, 56 inputs, eight textareas and one polygon with button semantics. This includes conditionals and older paths, not only the visible product. Legacy HTML/JavaScript is outside this TSX inventory.

**L** = observed in the browser this review; **S** = source traced, not executed; **G** = depends on input, connected services, external destination or explicit consequential action. A working navigation click is not proof that the destination delivers useful work. Every individual definition, handler and location is in [CSV](control-inventory.csv)/[JSON](control-inventory.json); grouped observations are in [walkthrough evidence](live-walkthrough.json).

## Fix before a judge walkthrough

| Priority | Reproduction / finding | Required result |
| --- | --- | --- |
| P0 | Living-room example → **Change the work** opens Bathroom with vanity/toilet/tile defaults | Initialize from current room recipe and selected package IDs. Never silently change the project domain |
| P0 | Tools → **The plan** opens **Prepare the job**, including **Start simulated work**, despite an existing scope draft | Open the current saved scope/design; one deliberate empty-state action only when absent |
| P0 | Save floor length 14 → 15 ft; Measurements updates, but room prices still show the former 168 sq ft quantities | Put freshness at the totals and provide a direct validated recalculation; current/previous totals must be distinguishable |
| P0 | Main composer → Send saves only an owner note | Connect a real first-draft/revision action or clearly offer a note action. The advertised “change the plan” interaction cannot end at a saved sentence |
| P0 | Example → Materials asks to connect; Contractors opens an explanatory empty state | Prepared examples must contain inspectable materials and comparison/handoff content without setup |
| P0 | Main intake/controller reject HEIC/video; owner will use an iPhone and may supply clips | Test native owner files; normalize supported photos and define explicit video/keyframe behavior before offering it |
| P1 | Living-room example → technical stage displays **half-bath/1.3** plumbing and fixture inputs | Show relevant project tools; move unrelated engineering controls out of the product path |
| P1 | Brand **Renovagent home** leaves the current example open | Have a real Projects/Examples destination, preserving edits/context |
| P1 | Finish/view buttons measured **27 px high** at a verified 390 px viewport | Use a comfortable consistent hit area; proposed target 44 × 44 CSS px |
| P1 | Opening flooring on phone can leave its selected stage offscreen in the horizontal tab strip | Scroll selected stage into view; retain sheet close and return position |
| P1 | Handoff popup is a long raw Markdown document | Render a concise scope/material/labor/open-question preview; export retains detail |
| P1 | Multiple independent landing examples use different rooms, dimensions and unrelated subtotals | Each proof view should carry the selected example identity and consistent linked artifacts |
| P1 | Fictional contractor stars/reviews take prominent space | Use neutral example bids; reserve reviews for sourced real evidence. Emphasize scope coverage and material/labor differences |
| P2 | Facts show `finishedWidth` and `3657.6000000000004 mm` | Friendly field names and deliberate unit formatting; preserve original values in evidence detail |

The price-change case confirmed domain invalidation: Saved work marked the scope historical. The defect is the prominent room-price presentation and missing immediate recovery, not evidence that the domain failed to stale the artifact.

## Landing, navigation and onboarding

| Surface / control family | Evidence | Current behavior and disposition |
| --- | --- | --- |
| Header The plan / See it work / Compare / Muse | L | All four reach their hash targets. Use for marketing; give workspace its own project navigation |
| Mobile menu and section links | L | Opens and closes after selecting Compare. Keep a usable selected section/return behavior |
| Brand/home | L | No project exit. Fix routing |
| Open workspace / project selector | L/S | Flat project modal with New project. Add clear Example vs Your projects distinction and three examples |
| Hero vanity / floor annotations | L | Switch named material, supporting parts and labor allowances. Demonstrative fixtures, not newly recognized products |
| Hero prompt → Start a project | L | Brief carries to setup. No analysis starts from the CTA |
| Add photos / drop / remove / duplicate filtering | S; earlier upload QA recorded separately | Source limits/formats traced. File chooser upload was not repeated here. Resolve iPhone-format and connected-size mismatch |
| Room choice buttons | L | Select/deselect; six large boxes consume first-screen space. Compact these below the useful input |
| My room / Inspiration | L | Changes the role of the entire selected batch. Provide separate simultaneous room/reference lanes |
| Inspiration/product disclosure, type, URL, title, preference | L | Fields open and switch with type. Keep the user's reason adjacent to the reference |
| Location, approach, budget, name, underway | L/S | Sections and type states inspected; ordinary inputs source traced. Defer optional details until useful |
| Create / Cancel / Close | L/S | Cancel inspected; new creation command path traced and earlier integration/browser evidence exists. Do not claim a new photo-to-draft end-to-end pass |
| Organized work-package tabs | S | Local fixture changes the displayed breakdown. Align with the example opened next |
| Before/after slider | L/S | Existing slider and keyboard handler inspected; previous interaction evidence retained. Avoid presenting it as live generation |
| Proof tabs: Design / Materials / Scan / Work & costs | L | All four open distinct content. Materials is a four-item decorative list, Work & costs is a six-product supporting-material reference list; they are not one complete saved project |
| Material hover/detail controls | S | Static product detail handlers; sources/allowances differ by view. Link to actual product requirements in the project |
| Cost filters / material-labor toggle | S; earlier browser QA recorded | Deterministic demo categories. Include quantity/source date and separate labor basis |
| Scan example → Explore workspace | L/S | Button calls example creation, not capture. Rename to reflect outcome or open the relevant project view |
| Room / Itemized quote preview | L | Screenshot switches; it is product proof imagery. Preserve a clear live-example entry |
| Open the example room | L/S | Existing example inspected. `sampleProject()` creates a project; define reuse/copy/reset so repeated entry does not clutter owner records |
| Comparison desktop / phone platform picker | L | Phone Buildertrend selection updates paired capabilities and price. External vendor content not re-verified in this audit |
| Footer Explore / Compare / GitHub / Start | S | Anchors/external URL/callback inventoried. Keep one consistent start/return path |

## Room, options, costs and evidence

| Surface / control family | Evidence | Current behavior and disposition |
| --- | --- | --- |
| Photo / 3D / Plan | L | All three work; plan and 3D use room geometry. Standardize the small default-looking buttons |
| Before / After | L | Swaps the example still. Selected render is illustrative; it is not a measurement update |
| More / Show dimensions | L | Menu and dimension display work. Plain-language menu is useful secondary detail |
| Download SVG | L | A drawing file was returned. The automation download wait was very slow; no product-latency conclusion is drawn from that tool behavior |
| Download GLB | S/G | Export handler present; not downloaded this review |
| Stage tabs / room pins / step-list buttons | L | Open the selected work popup. Phone should bring the selected tab into view |
| DIY / Hire a pro | L | Swaps difficulty, tools/material allowances or example labor/material bids |
| Product store links / tool links / how-to | L/S/G | URLs inspected: many are retailer or YouTube **searches**, not exact offers or vetted instructions. Label and upgrade sources accordingly |
| Item details disclosure | S | Shows requirement-level detail. Prefer readable progressive detail over repeated explanations |
| Wall colors and floor finish choices | L | Example preview and costs change. LVP/warm white was $825.60 DIY; hardwood/soft blue preview $1,414. These are fixture results |
| Use this design / Keep editing / Approve and save | L | **Use** opens a meaningful diff. Approval saves a proposed revision. Hardwood/soft blue persisted after reload. Preserve this interaction |
| Back to saved | L | Discards the unsaved preview. Keep distinct from deleting accepted history |
| Contractor example buttons | L | Itemized material/labor quote and synthetic review open. Keep comparison detail; remove fabricated social proof from the main pitch |
| Does this work? | L | Opens an extensive requirements register; too dense as a first answer. Summarize actionable findings, then expand evidence |
| Locality selector | L | NYC and SF choices change the displayed register/counts. These are assumed preview contexts, not verified jurisdiction evidence |
| Rank with JEV | S/G | Paid model path not invoked; do not count as a live verified capability from this audit |
| Contractor handoff / close | L; prior review | Document opens. Current raw Markdown is technically useful but poor presentation |
| Handoff Copy / Download | S/G | Handlers traced; not repeated to avoid altering clipboard/download state unnecessarily |
| Change the work / room type / package selection / Pin | L/S | Planner opens the wrong defaults. Selection/build handlers traced; cancelled to preserve the inspected scope |
| Best value / Priced looks / catalog tier choices | S/G | Require current connected catalog/project setup; source traced. Not a fresh live ranking/retail verification |
| Add room photos / Pin with JEV / suggested work approval | S/G | Analysis endpoint/client traced; results currently component state. Original uploads persist, pins do not survive remount |
| Measurements Edit / Close / save | L | 14 → 15 ft stored with explicit synthetic QA note. Existing scope marked stale, but totals remain prominent |
| Length/width/height, area/perimeter, units, method, notes | L/S | Input schema/choices inspected. Optional fields; do not block photo-first useful work |
| Floor-plan import / measurement photo | S/G | JSON/photo routes traced; a fresh owner scan/file upload was not provided or tested |
| Reference type / link / note / saved price / save / cancel | L | Example-domain product lead and $12.34 synthetic saved price persisted after reload. No automatic product recognition follows save |
| Open reference source | L/S/G | Correct href retained; external page not fetched or acted on |

## Workspace menus and all stage settings

| Destination | Evidence | Current result / required disposition |
| --- | --- | --- |
| Conversation history | L | Saved owner messages and linked output history. Preserve as detail |
| Your house | L | Older address-first intake. The example lands on an empty address opening. Replace with the selected home's useful photo/context view |
| The plan | L | Routes to old planning/simulation stage instead of directly opening the scope. P0 |
| Materials | L | Local example gets “Connect … compare catalog offers.” Complete the example dataset and useful local read view |
| Contractors | L | Generic unavailable-search/outreach explanation. Route to actual handoff/quote comparison content |
| Questions from photos | S/G | Conditional photo-question selector/answer flow. Hide empty entry or explain the next useful capture action |
| Homes & projects / New project | L/S | Project list/new setup route. Needs three-example gallery, real owner separation and a reliable return |
| Saved work | L | Scope revision visible and correctly marked Inputs changed. Make current artifacts reachable from primary tabs |
| Facts & sources | L | History/source controls exist; raw technical keys and unrounded values need display polish |
| Activity | L | Fixture controls and audit history. Move simulation tooling to an engineering surface |
| Muse & connections | L | Explanatory modal links to house/photo tools; no actual pairing action |
| About | L | Contains prototype/fixture disclosures and link to earlier preview. Keep engineering information out of the main demo path |
| Import previous preview | S/G | Legacy import can create a separate project. Not executed against owner data; place in migration/developer tools |
| Stage: Understand | L | Address-first house intake |
| Stage: Explore | L | Generic simulation launcher and artifact list |
| Stage: Technical | L | Half-bath technical inputs appear in a living-room example |
| Stage: Prepare | L | Generic work-sequence simulation launcher and artifact list |
| Stage: Coordinate | L | Generic procurement simulation launcher and artifact list |
| Stage: Guide | L | Generic progress/change simulation launcher and artifact list |
| Stage: Keep record | L | Generic handover simulation launcher and artifact list |
| Source edit / history / decision accept-decline / artifact links | S/G | Command authority and history paths traced; broad mutation combinations were not executed. Test on an isolated project with fresh/stale/accepted states |
| Auth sign-in/out / grant/pairing / connected transfer | S/G | Not executed or modified. Technical/runtime gates are in the separate architecture review |
| Error Dismiss / reload / empty-state recovery | S/G | Handlers inventoried. Every relevant main-flow failure still needs a deliberate rehearsal; a 8757-origin auth warning is a QA host restriction, not proof the canonical 8741 login is broken |

## Acceptance for the next pass

Audit each main control against **result, context, persistence, back/cancel, phone/keyboard behavior, and unavailable/error recovery**. Mark it live-verified only after executing the applicable state. Keep a separate list of paid/external/owner-authorized cases. A navigation-only pass is insufficient for Create, Analyze, Recalculate, Save, Export, Connect and Reset.

No code was changed in this audit. UI fixes above are implementation work, not completed work. The current screenshots are evidence of existing behavior, not proposed finished designs: [desktop](previews/current-room-desktop.png), [phone popup](previews/current-room-mobile.png), [phone setup](previews/current-start-mobile.png).
