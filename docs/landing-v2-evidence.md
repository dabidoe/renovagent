# Landing V2 — October 29, 2026

## Product costs and photo-first project setup — October 30, 2026

Work & costs now separates Materials and Labor. Six named retail products have real packshots, quantities, unit/line prices, retailer links and category filters; filtering recomputes the subtotal. All six materials total $129.42. Labor shows trade tasks, worker-hours and rates separately. Product references are dated, and labor is an illustrative allowance. See [price and photo provenance](landing-material-price-sources.md). No fixture prices or quantities enter the homeowner project or live catalog.

The hero accepts up to five JPG/PNG/WebP/GIF photos, with previews and removal in setup. The new responsive intake includes optional room choice, city/region/postcode/street, existing home selection, DIY/pro preference, budget, name and underway state. No location permission or external geocoder is used. Photos, initial message, user-reported facts and optional location commit in one validated repository batch. Originals survive reopening; a rejected batch leaves no partial property, project or attachment.

Unmeasured rooms now open on their saved photo and brief, with photo switching/addition. With no photo, a direct photo action replaces the bare paragraph. Measurements start collapsed and remain available; existing floor-plan and 3D workflows remain. New intake does not infer dimensions, generate designs, analyze photos or automatically request research. Existing projects and database selection were preserved.

Verification: production builds (root and active 8741 checkout), types and boundary checks pass. Full root test run: 15 legacy + 216 TypeScript pass, 38 connected-environment tests skip. The existing hosting test needed loopback access and passed after rerunning with it. New tests cover original blob recovery, metadata/location provenance, invalid-photo rejection, whole-batch rollback and preservation of an existing home. Browser review at 1280×900, 390×844 and 360×800 covered hero upload → setup preview → project creation → reload with the saved photo, optional fields, cost categories/subtotals, separate labor and loaded photos. Zero horizontal overflow on the narrow cost panel and phone intake. Creation QA used a separate localhost:8753 IndexedDB origin and a public demo image; no existing user project was changed. Concurrent Claude room-review/handoff changes in the active checkout were preserved.

Previews: [desktop setup](previews/project-start-desktop.png), [phone setup](previews/project-start-mobile.png), [saved room](previews/project-photo-desktop.png), [phone room](previews/project-photo-mobile.png), [phone hero](previews/landing-photo-input-mobile.png), [cost panel](previews/landing-costs-materials.png), [phone costs](previews/landing-costs-mobile.png).


## Agent context visual + dedicated phone comparison — October 30, 2026

The “Works with Muse” kicker, connector screenshot and screenshot framing have been removed. “Your agent. On the same page.” now accompanies a code-native diagram: actual Muse icon → room/project context → homeowner approval. The room still is an existing example render; quantities are read from the core-compiled landing fixture. This is an explanatory graphic, not a fabricated Muse conversation or live connection state. The short tested-with-Muse line and MCP source link remain.

The desktop capability matrix is retained. Phones now use their own two-column comparison built from the same keyed product records: a native platform picker, paired brand headers, feature labels spanning both columns, 14px values, and secondary plan prices. Audience is shown in the headers to remove a repetitive row. The cramped third label column and three-button selector are removed. There is no sideways table or carousel.

Verification: production build, boundaries, Prettier and diff checks pass. Browser review at 1280 × 900, 390 × 844 and 360 × 800; no horizontal overflow. Native selection changes JobTread, Buildertrend and Handoff content, logo and price correctly. The narrow-phone context sheet has 238px width and the 1600px room asset loads. Desktop matrix and source links remain present. No workspace records, database configuration, or deployment changes.

Previews: [agent desktop](previews/landing-agent-context-desktop.png), [agent phone](previews/landing-agent-context-mobile.png), [phone comparison](previews/landing-capabilities-mobile-redesign.png). This entry supersedes the earlier screenshot and phone-table layouts.


## Full capability panel — October 30, 2026

The comparison is now one full-width capability table, headed “Built around your renovation.” The pricing chart, separate sidebar, tabs, counter, arrows and swipe state/CSS are removed. Prices remain a compact secondary footer row, retaining the previously requested plan references. Muse remains immediately above. Product capabilities are keyed by named fields in a typed product record instead of relying on parallel array positions.

Verification: production build, boundaries, Prettier and diff checks pass. Desktop (1280px) displays all four products. Phone (390px / 360px) displays Renovagent and a selectable competitor; JobTread, Buildertrend and Handoff selection was verified. Zero horizontal page overflow; no carousel remains in the DOM. Both checkout copies are synchronized for 8741. No workspace or database changes.

Previews: [desktop](previews/landing-capabilities-full-panel.png), [phone](previews/landing-capabilities-full-panel-mobile.png). This supersedes the two-view layout below.


## Muse placement + two-view comparison — October 30, 2026

Muse now sits directly above “Big plans. Without the monthly overhead.” The separate offering cards are replaced by one compact Renovagent sidebar and two manually controlled views: a three-vendor price chart and a capability table. Logo, $0 and three concise product strengths stay visible in the sidebar; it becomes a compact horizontal strip on phones. Published plans remain JobTread $199, Buildertrend from $499 and Handoff Scale $899, with pricing at the bottom in both views. Phone capabilities show Renovagent alongside a selectable competitor rather than shrinking the entire table. Source data and original brand artwork are unchanged.

Checks: production build, boundaries and changed-file formatting pass. Browser checks cover 1280 × 900, 390 × 844 and 360 × 800, panel controls, arrow-key tabs, phone competitor selection, correct visible prices and zero page overflow. Touch-swipe handling is implemented; a physical touchscreen was not tested. Both checkout copies are synchronized for the existing 8741 preview. No workspace/data or deployment changes.

Previews: [pricing](previews/landing-comparison-two-view-pricing.png), [capabilities](previews/landing-comparison-two-view-capabilities.png), [phone](previews/landing-comparison-two-view-mobile.png).


## Final marketing pass + Claude room handoff — October 30, 2026

The active review is **http://localhost:8741/**, served by `.claude/worktrees/room-3d`. Both that checkout and the root now contain the same landing changes atop `e892174`. The root's old 8742 preview is retired to avoid competing review URLs. Database configuration and records were not changed.

- Navigation sits over the image, with a charcoal surface and a native expandable phone menu. The original stacked logo remains unchanged.
- Hero annotations name IKEA ÄNGSJÖN (36-inch cabinet, $339 reference) and a 2-inch matte charcoal porcelain hex concept. Parts are grouped concisely; labor remains explicit hours × rate. Added parts prices are presentation fixtures, never catalog offers or project facts.
- The isolated living-room fixture relays 20 × 14 × 8 ft to the existing core compiler. Its 280 sq ft flooring, 68 linear ft trim and 544 sq ft wall area come from core calculations. Package buttons show those quantities instead of unresolved internal statuses. These dimensions do not change the actual example-room project.
- The third section retains the titled before/after slider on a full-width cobalt field. Materials retain product cutouts, interactive popovers, line-item quantities and the optional detailed receipt. Redundant marketing disclaimers are removed; sourcing details stay in the receipt and this evidence.
- The fourth section follows `docs/design/landing-muse-and-room.md`: real `room-photo-home.png` and `room-quote-itemized.png` captures switch with buttons. CSS crops the workspace chrome while preserving example tags on fictional contractors/quotes. Its CTA uses the existing sample-project handler.
- Comparison is four concise, branded offering cards, all visible on a wide desktop and swipeable on a phone. Prices sit at the bottom: Renovagent $0 local build, JobTread $199 for one internal user, Buildertrend starting $499, Handoff Scale $899. Selecting relevant strengths replaces the noisy checkmark matrix; no invented competitor absence or feature-parity claim is made. Model/hosting costs are not a published free hosted plan.
- Muse uses the owner's real connector capture. A CSS viewport shows only the connector and connected reply, excluding the dead tunnel URL and credential discussion. Copy describes project read/propose/save with user approval. A short caption retains the tested-build/hosted-launch boundary. No conversation is fabricated.
- Footer now has one large project CTA and a restrained original-logo/source/navigation signature.

Verification:

- `npm run build` passes strict types, domain boundaries, frontend and foundation production builds. Existing bundle-size warning remains. Changed files pass Prettier and `git diff --check`.
- Core fixture assertions confirm 280 sq ft floor, 68 linear ft trim and 544 sq ft walls.
- Browser review at 1280 × 900, 390 × 844 and 360 × 800. No horizontal page overflow or broken visible imagery. Phone menu opens, navigates and closes; the carousel reaches Handoff and updates its selection.
- Scope tabs switch 280 sq ft flooring to 544 sq ft walls. Vanity/floor annotations and material popovers switch correctly. Work/Labor displays $450 plumbing, $1,440 tile installation and $1,890 total. Slider keyboard Right changes 50 → 51 and Left restores 50.
- Footer focuses the hero prompt. A typed brief reaches “Start with your place”; QA cancelled before creating a project, cleared the brief and restored default views. No sample-project command, data migration, server connection or deployment was performed by QA.

Previews: [hero](previews/landing-final-hero.png), [phone](previews/landing-final-mobile.png), [scope / blue slider](previews/landing-final-scope.png), [comparison](previews/landing-final-comparison.png), [Muse / footer](previews/landing-final-muse-footer.png).

Earlier entries below describe earlier revisions; this section supersedes their layout, copy and preview URL.

## Slider third and copy reduction — October 30, 2026

The owner's latest placement supersedes the earlier request to place the slider immediately after the hero. Current order: hero → compact idea-to-scope example → **See your space transform.** slider → contractor handoff → comparison → MCP/source → project CTA. The slider opens on before/after; the materials, measurement and work/cost controls sit underneath it. There is no repeated slider.

Removed redundant supporting paragraphs from transformation, handoff and agent headings; shortened the homeowner example request, evidence notes and pricing notes; replaced the handoff's site-check paragraph with three short labels. Before/After labels and one concise generated-concept note replace repeated image disclaimers. Price basis, mock-data labels and licensing limits remain concise and explicit.

Verification: production/foundation build passes strict types and boundaries; formatting and diff whitespace pass. Browser confirms third-section order, visible title above the image, no horizontal overflow at 1280px/390px, and slider keyboard 50→51→50. Preview: http://localhost:8742/#product-proof. Evidence: `docs/previews/landing-slider-third-desktop.jpg`, `landing-slider-third-mobile.jpg`.

## Object-linked hero, selected plans and labor rates — October 30, 2026

Final checks on the isolated 8742 preview: strict types, dependency boundaries and production/foundation builds pass (existing chunk warning). Desktop 1280px plus 390px/360px phone views fit. Vanity/floor controls switch the AR-style breakdown; trade-rate lines show $450 and $1,440 with $1,890 mock total. Selected chart rates are $199, from $499 and Scale $899; the comparison has five rows and mobile vendor switching works. All displayed images load; no Helper or “what’s next” text remains. Screenshots: `docs/previews/landing-ar-desktop.jpg`, `landing-ar-mobile.jpg`, `landing-selected-plans.jpg`.

Latest owner-directed refinement supersedes the kitchen/generic-pin hero described below. A different bathroom concept angle is mirrored in CSS, with SVG outlines aligned to the vanity and floor. Hover, focus or tap selects one compact breakdown. It shows a cabinet-only dated reference, example supporting parts and mock trade rates. It is a presentation example, not live AR tracking, a site scan, compatibility proof or a quote. The original logo remains unchanged. A subtle full-width nav shade is over the image. Phone hero minimum height is 640px (previously 800px); desktop is 680px.

Labor examples now use Plumbing 6h × $75/hr = $450 and Tile installation 24h × $60/hr = $1,440; no helper category. The mock total is $1,890, computed using the shared line-total helper. No values are persisted to a project or represent a contractor offer.

Comparison now selects Handoff **Scale $899/month**, JobTread **$199/month** with one internal user, and Buildertrend **from $499/month**. The official Buildertrend `/pricing-1026/` page establishes that starting price; the earlier quote-only result from `/pricing/` was incomplete. Final quotes depend on volume and onboarding. Chart entries are sorted by selected price. The five-row matrix focuses on these three workflow platforms; Homesage and weak/duplicative rows were removed. Logos and vendor links remain.

Preview isolation: port 8741 was found serving `.claude/worktrees/room-3d`, rather than this checkout. That server was preserved. This checkout’s frontend is on **http://localhost:8742/**; CTA setup/cancel was verified there and keeps the revised landing intact. No API was listening on 4000 during the read-only DB/config check. Main-checkout env files agree on a project-specific cluster selection; room-3d has no env files and resolves the local fallback. No connection strings were printed, database settings changed or data migrated.

## Seven-section story and vendor comparison — October 30, 2026

Latest pass follows the owner's brief: (1) existing image-led hero, (2) homeowner idea → actual recipe scope, (3) contractor review packet, (4) pricing and capability comparison, (5) product proof, (6) source/MCP story, (7) repeat project CTA. Removed the public availability/“what’s next” disclosure. The original stacked logo and image-overlay navigation remain; no hero concept disclaimer was reintroduced.

The transformation preview compiles an isolated living-room example using the real domain scope engine (4 included work packages, 15 requirements). Selecting a package shows actual requirement data and leaves unknown quantities unresolved. It never writes to the owner's project. The contractor packet is an explicitly labeled example; purchase-plan review is distinguished from unconnected quote collection.

The comparison now has one entry per vendor, with authentic logos: Homesage, Handoff Flex, JobTread and Buildertrend. Buildertrend has its own full chart position with custom-quote pricing. Eight capability rows include estimates, measurement/takeoff and the corrected available JobTread MCP connector. Phones use a two-column logo picker and visible side-by-side comparison, without per-row expanders. Primary pricing and feature evidence: [competitor sources](landing-v2-competitor-sources.md). Brand assets have their own provenance README.

Product proof retains the generated bathroom before/after slider, product image/price/supporting-part popups, material inclusion subtotals and mock crew-hour view. A new measurement view runs the actual floor-plan parser on a visibly synthetic RoomPlan-shaped file: 24 m², 20 m perimeter, 2.7 m height. Capture is stated to happen in a separate app; no integrated camera scanner is claimed. Source/MCP links target the existing repository and OpenPlan3D; a licensed Renovagent open-source release is not claimed because this checkout has no LICENSE file.

Verification: production/foundation build, strict types and dependency boundaries pass (existing chunk-size warning). Direct assertions check the engine example's package/requirement state and imported measurements. Browser checks at 1280px, 390px and 360px cover section order, all official images loaded, no document overflow, package switching, mobile competitor selection, scanner/crew tabs, product popup, slider 50→51, and the footer CTA focusing the hero prompt. A test brief reached the setup dialog unchanged; QA canceled before project creation. A mobile decoration overlapping the package control was found and fixed; selection was retested successfully.

Previews: `docs/previews/landing-story-transformation.jpg`, `landing-story-comparison.jpg`, `landing-story-comparison-mobile.jpg`. Earlier sections below describe superseded layouts.

## Full-width hero and restored page narrative — October 30, 2026

This is the latest presentation and supersedes the compact-opening and collapsed-comparison changes below. The room concept fills the hero across desktop and phone. The earlier “Turn your space into a plan” headline, a single clean prompt, and a short Muse/agent link sit over the image. Three small icon annotations expose short explanations on hover, focus or tap, with close controls and Escape dismissal. The link uses the installed Muse app icon and scrolls to the existing connection availability section; it does not create a connection or change credentials.

The before/after slider is visible again and selected by default. Materials & fit remains a second persistent view. The pricing/capability comparison is visible in the page flow again, with its existing dated sources and qualifications. It is no longer enclosed by the “Compare planning tools” disclosure.

The supporting work breakdown sits in its own section, separate from the hero. Its sample categories cover finishes, PEX/fittings/backer, screws/anchors/sealant, and crew effort. All quantities and labor values are explicitly mock marketing data; the illustrative crew is one plumber × 6 hours, one tile setter × 24 hours, and two helpers × 6 hours, totaling 42 person-hours. This is effort, not elapsed project duration, a productivity standard or an actual estimate. These UI-only examples never enter canonical project state or purchasing. Automated labor estimating remains planned.

The header now displays the owner's original transparent PNG with the symbol above the wordmark. The earlier hand-redrawn shape was replaced. Original artwork is byte-for-byte preserved in `apps/web/src/assets/brand/renovagent-logo.png`; symbol/favicons are crops/resizes of that same artwork, without added geometry. See [brand asset provenance](../apps/web/src/assets/brand/README.md).

Verification: `npm run build` passes types, boundaries and both production builds (existing chunk-size warning remains). Changed source formatting and `git diff --check` pass. Browser checks at 1280 × 900, 390 × 844 and 360 × 800 show no horizontal overflow. All three desktop annotation buttons are unobscured; phone tap/focus opens a popup and Escape closes it. A kitchen brief carries unchanged into setup, which QA closes without creating a project. Slider Right changes 50 → 51 and End reaches 100; removing the $680 wall-tile allowance changes the illustrative subtotal to $664. The Muse link reaches `#agent-connection`. Defaults are restored after QA. No API, storage, credentials, pricing verification, purchasing or construction release behavior changed.

Previews: [desktop hero](previews/landing-cinematic-desktop.jpg), [phone hero](previews/landing-cinematic-mobile.jpg), [desktop annotation](previews/landing-cinematic-annotation.jpg). These are browser viewport checks, not physical-device or accessibility certification.

## Design review follow-up — October 30, 2026

The opening now names scope and materials as the outcome. The prompt has a visible **Start a project** action, explains the next setup step, and shows the prototype/review boundary beside that action. Idea starters have 44px minimum height. Essential material provenance, generated-image notes, fit details and subtotal exclusions use 13px text on desktop and phone.

The bathroom example opens on **Materials & fit**, with a compact example scope and unresolved measurement/fit/installation questions above it. Before/after remains available and both views stay mounted to preserve selections. Its labels now say **Before concept** and **Renovated concept**, with generated-illustration labels. The full existing pricing/capability comparison is retained inside a closed **Compare planning tools** disclosure after the agent section; its dated source snapshot and qualifications remain intact. Muse's stable-hosting limitation is visible without expanding connection details.

Verification on the canonical React `/` entry, using `localhost:8741`:

- `npm run build` passes types, dependency boundaries, frontend and foundation builds. Existing bundle-size warning remains. Changed source files pass Prettier and `git diff --check`.
- Browser viewports at 1280 × 900, 390 × 844 and 360 × 800 show no horizontal overflow. The comparison also fits when expanded at each width. The default desktop page is 2567px tall; the 390px page is 3474px tall, with materials selected and disclosures closed. These are layout observations, not conversion results.
- Diagnose a problem fills its exact brief, and the labeled submit action carries it into **Start with your place**. QA closed the dialog without creating a project. Open workspace still opens **Homes & projects**.
- Removing the $680 wall-tile allowance changes the illustrative subtotal from $1,344 to $664. That selection survives switching to Before / after and back. The allowance was restored. Slider keyboard checks cover Right (50 → 51), Home (0) and End (100); the comparison disclosure also responds to Enter.
- The phone quick-preview link expands the fit/specification details. The footer action focuses the one opening prompt. The prompt and default illustrative selections were reset after QA; no canonical project records were created or changed.

Previews: [desktop opening](previews/landing-review-desktop.jpg), [phone opening](previews/landing-review-mobile.jpg), [desktop material example](previews/landing-review-materials.jpg). This is viewport testing, not physical-device or full accessibility certification. Retail prices, supplier stock and technical guidance were not reverified by this design pass. No API, storage, deployment or purchasing behavior changed.

## Header, prompt and diagram cleanup

The public landing header now has a stronger brand lockup and functional How it works / Example project / Open workspace navigation. The home/project picker remains on the active-project workspace; it is removed from the public landing. Open workspace uses the existing homes/projects dialog, and example actions retain the existing sample-project command.

The only project prompt now sits in the opening section, followed by three idea starters. The house is secondary on desktop and omitted from the phone opening. The drafting field has constant faint grid opacity with no radial mask, corner marks or parallax movement on the landing. One thin curved workflow connector and consistent numbered stages replace the floating badges and assorted decorative treatments. Existing workspace styling is scoped separately through `is-landing`.

The before/after slider and material annotations are two selectable views of one bathroom example. Both stay mounted so illustrative selections survive view switches. Scope and handoff copy are consolidated into a three-step section. Product specs and fit checks, implementation limits and connection availability remain available through native details expanders. The bottom action focuses the single top prompt. The responsive comparison remains intact; its styles are separated into `comparison.css`.

Measured in the browser with the before/after view selected and details closed:

| Viewport       |        Prompt document position | Page height before | Page height after |
| -------------- | ------------------------------: | -----------------: | ----------------: |
| 1280px desktop | 346px (previously about 6180px) |             6778px |            3522px |
| 390px phone    | 280px (previously about 7534px) |             8265px |            3886px |

Verification: production/foundation build, types and boundaries pass. Browser checks at 1280px, 390px and 360px confirm header/prompt visibility and no horizontal overflow. Open workspace opens Homes & projects. The Diagnose a problem starter carries its exact brief into the existing setup dialog; QA closed the dialog without creating a project. Removing $680 gives a $664 subtotal, which survives Before / after → Materials & fit switching; the slider remains keyboard operable. The phone quick-preview link opens the previously collapsed specs and fit checks. All visible images load at 360px. The empty landing prompt and default example selections were restored after QA. No database, authorization, purchasing or technical domain behavior changed.

Screenshots: [desktop opening](previews/landing-cleanup-desktop.png), [phone opening](previews/landing-cleanup-mobile.png). Earlier notes below describe superseded presentation iterations.

## Responsive comparison and product annotations follow-up

The owner requested a readable mobile comparison and richer material annotations. The single poster embed is now replaced by two responsive panels: a proportional vendor pricing chart and a capability matrix. Phones get horizontal price bars and expandable per-capability comparisons instead of a shrunken image or sideways table. The original supplied graphic is preserved in the assets and docs. Prices link to primary vendor sources checked October 29; Buildertrend is custom quote. Renovagent is labeled a working prototype, with license/pricing still unfinalized. Unknown competitor capabilities remain unknown.

Four new 480px product style illustrations (vanity, mirror, white subway tile, charcoal hex tile) appear in scene callouts, list rows and selection details. Thumbnails inspect a product separately from checkboxes that include/exclude the allowance. Details show format/dimensions, finish, quantity basis, supplier, fit checks and omitted installation materials. Phones get a selected-product preview immediately under the room, with a link to the detailed checks. Concept sizes are explicitly illustrative, not inferred room measurements. The IKEA reference remains cabinet-only and the generated vanity is not an exact SKU photograph. All four cutouts are generated illustrations, not retailer photography; prompts and provenance are in [landing-product-images.json](landing-product-images.json). No project state or commerce backend changes.

Verification: production/foundation build, type checks and dependency boundaries pass. Browser checks at 1280px, 390px and 360px confirm the layout; 360px document width is 360px and all images load. Thumbnail/pin selection changes the detail card without changing the subtotal. Removing the $680 tile allowance changes $1,344 to $664. The mobile MCP comparison expands to show each vendor; the quick preview link navigates to the selected material specs. Screenshot evidence: [desktop annotations](previews/landing-products-desktop.png), [mobile product preview](previews/landing-products-mobile.png), [mobile pricing](previews/landing-comparison-mobile-pricing.png). The earlier implementation notes below describe previous iterations where superseded.

## Original increment

The canonical React landing at `/` now has a spacious animated hero, a dedicated project prompt, a draggable before/after comparison, and selectable HTML material callouts with a checkbox-driven subtotal. The existing brand mark and project command paths are retained. The older static `landing.html` is not this entry point.

The before image is deliberately dated but usable: fiberglass shower, faded curtain, tan vinyl, dark laminate vanity, medicine cabinet and exposed-bulb light strip. Both images are generated illustrations. They are not evidence of a completed project, measured geometry, or compatible products. Built-in image generation prompts and export provenance are in [landing-v2-image.json](landing-v2-image.json). Final asset: `apps/web/src/assets/examples/bath-before.jpg`.

The interactive list is presentation-only and never writes canonical state. It uses the shared core `lineTotalMinor` calculation. The IKEA cabinet is a dated retail reference, explicitly not the exact generated fixture; mirror, shower finish and floor values are fictional allowances. The $1,344 subtotal is not a full renovation estimate. Scope, measurements, missing materials, installation and other unpriced costs are stated in the interface.

The supplied brief remains a proposal. At the owner's subsequent explicit request, the interim text/pricing comparison was replaced with their complete `Renovagent_ Complete Renovation Workflow.png` graphic. It is copied into the web assets, displayed full-width without cropping, and linked at full resolution for zooming. The original graphic contains pricing and capability claims that have not all been verified (including an older Buildertrend price); an adjacent caption identifies it as a comparison concept requiring verification. This is not a verified current capability matrix. Contractor counterproposals and stable hosted MCP remain labeled in development elsewhere on the landing.

Graphic replacement verification: `npm run build` passes; the image loads at desktop and 390px, page width stays 390px, full-size links target the bundled source asset, and the discarded “Your project comes first” text is absent. Preview: [competitor graphic on landing](previews/landing-v2-competitor-graphic.png).

Primary sources checked October 29:

- [IKEA ÄNGSJÖN cabinet](https://www.ikea.com/us/en/p/aengsjoen-bathroom-vanity-with-drawers-oak-effect-20535355/): $339, cabinet only; stock and project fit unverified.
- [Handoff plans](https://help.handoff.ai/en/articles/13745799-handoff-plans-compared): Flex $149/month; MCP on Scale.
- [JobTread pricing](https://www.jobtread.com/pricing): $199/month for the first internal user; additional users cost extra.
- [Buildertrend pricing](https://buildertrend.com/pricing/): custom quote.

Verification:

- `npm run build` passes type checks, dependency boundaries, frontend and foundation builds. Existing large-chunk warnings remain.
- Browser: slider keyboard 50 → 51, Home → 0, End → 100; pointer drag 50 → 75.
- Removing the $680 shower allowance changes $1,344 → $664. Floor callout switches the detail panel. Refresh resets these unsaved illustrative selections.
- Hero CTA focuses the separate project prompt; bathroom idea fills “I want to refresh a bathroom.” No project was created during this QA.
- Pause control changes to Play; reduced-motion CSS disables floating animation.
- 390px phone check: document width 390px, all images loaded, compact 44px material hotspots; desktop visual check also completed. This is browser viewport testing, not physical-device testing.
- Screenshots: [comparison](previews/landing-v2-comparison.png), [mobile materials](previews/landing-v2-mobile.png).

No API, database, credential, hosting or purchasing behavior was changed by this landing increment.

### Image-overlay navigation and visual product exploration — October 30, 2026

- Removed the separate white header band. The original stacked logo and navigation now sit over a kitchen hero; the bathroom remains the before/after and materials reference scene.
- Materials view now leads with a full-width annotated room. Hover, keyboard focus or tap opens a product image, price basis and supporting parts. Mobile details flow below the photo. Vanity additions are explicitly mock allowances and do not change the existing material subtotal.
- Replaced the three text cards and long agent strip with a visual Muse → Renovagent → homeowner/contractor connection. Existing material/crew mock workup remains available in a disclosure; the slider and competitor comparison remain in place.
- Verified at 1280px and 390px: image-overlay navigation, product popup and mobile sheet, unchanged $1,344 example subtotal ($664 with wall-tile allowance removed), slider keyboard adjustment 50→51, agent anchor. Production/type/boundary/foundation build passes. Existing bundle-size warning remains.
- Evidence: `docs/previews/landing-overlay-desktop.jpg`, `landing-overlay-mobile.jpg`, `landing-product-popup.jpg`.
