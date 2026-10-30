# Landing V2 — October 29, 2026

## Header, prompt and diagram cleanup

The public landing header now has a stronger brand lockup and functional How it works / Example project / Open workspace navigation. The home/project picker remains on the active-project workspace; it is removed from the public landing. Open workspace uses the existing homes/projects dialog, and example actions retain the existing sample-project command.

The only project prompt now sits in the opening section, followed by three idea starters. The house is secondary on desktop and omitted from the phone opening. The drafting field has constant faint grid opacity with no radial mask, corner marks or parallax movement on the landing. One thin curved workflow connector and consistent numbered stages replace the floating badges and assorted decorative treatments. Existing workspace styling is scoped separately through `is-landing`.

The before/after slider and material annotations are two selectable views of one bathroom example. Both stay mounted so illustrative selections survive view switches. Scope and handoff copy are consolidated into a three-step section. Product specs and fit checks, implementation limits and connection availability remain available through native details expanders. The bottom action focuses the single top prompt. The responsive comparison remains intact; its styles are separated into `comparison.css`.

Measured in the browser with the before/after view selected and details closed:

| Viewport | Prompt document position | Page height before | Page height after |
| --- | ---: | ---: | ---: |
| 1280px desktop | 346px (previously about 6180px) | 6778px | 3522px |
| 390px phone | 280px (previously about 7534px) | 8265px | 3886px |

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
