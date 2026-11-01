# One coherent example project

Implemented October 31, 2026, after the owner prioritized a polished example over additional functionality. This updates the existing living-room fixture; NYC, SF and Hutchinson projects remain separate proposed work.

The example now opens as one workspace with **Design → Work & costs → Handoff**. A large room image remains the visual anchor. Finish swatches preview the existing rendered variants and use the shared scope/quote calculations. The primary actions lead through the walkthrough. Measurements and inspiration sit in a collapsed details area; the generic note composer and simulation tools no longer lead the example.

The costs inspector separates materials, DIY tools and installation labour. Example cost details use the matching complete example allowance rather than fictional ratings/reviews. Retailer links remain searches for finish specifications, not verified SKU matches or live prices. The contractor brief renders headings, lists and tables; planning basis and technical context remain accessible in disclosures and in the complete Markdown export.

The example can be opened from the project picker or landing page. Reopening reuses the saved example instead of creating another fixture. The brand home control now returns to the landing page without deleting the project. Real projects retain their existing workspace.

Connected Muse rendering, Jev value selection, looks and requirements review remain accessible under **Muse & project tools**, calling the original RoomStudio handlers and endpoints. Claude's provider/model integration remains outside this UI pass.

## Verified

- Production build, TypeScript and dependency boundaries pass.
- Fourteen targeted tests pass: room sources, example variants, quotes, measurement persistence/invalidation, review card and handoff rendering. The new handoff test retains folded context and checks that project text cannot become executable HTML.
- Browser: finish preview, change review, explicit save, reload persistence, DIY/pro split, work annotation, readable handoff, Photo/3D/Plan controls, before/after, project picker, example reuse and brand home.
- At 390 × 844, the chapter controls remain visible while the inspector scrolls into view. Page scroll width equals viewport width. Pins have accessible work names and 44px phone targets. Reduced-motion preference is respected.
- Editing measurements exposes the stale-scope banner and the handoff action requires refreshing the scope. Refreshing recalculates the displayed quantities and allowances.

Preview: the existing root checkout at `http://localhost:8741/`. The separate 8757 browser origin was used for local UI checks; no database, credentials, provider configuration or backend implementation was changed in this pass. SVG/Markdown download handlers were retained; their contents continue to come from the existing core generators.

## Visual evidence

- [Desktop](previews/example-studio-desktop.png)
- [Phone](previews/example-studio-mobile.png)
- [Phone costs](previews/example-studio-costs-mobile.png)

## Limits

The room pictures are the existing synthetic 3D renders. Costs and contractor installation amounts remain example allowances, not real bids. This does not implement reference recognition, live product matching, a new Muse pipeline or native capture. The new presentation deliberately concentrates on the working design/scope/cost/revision loop.
