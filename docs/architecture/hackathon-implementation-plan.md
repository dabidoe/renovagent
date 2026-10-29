# Renovagent hackathon implementation plan

October 29, 2026 · Planned work for the next four–five working days.

This turns the current product conversation into an implementation sequence.
It builds on the existing repository, Mongo workspace and domain commands.
The work below is planned, not implemented.
Use this alongside the [product scope](../RENOVAGENT_PRODUCT_SCOPE.md),
[technical architecture](../RENOVAGENT_TECHNICAL_ARCHITECTURE.md) and
[delivery acceptance gates](05-delivery-and-verification.md).

## The experience we are building

Someone tells their ordinary Meta Muse agent: **“How much for this bathroom?”**
They attach a photo and a Pinterest link. They do not need construction
vocabulary, a completed survey, a chosen fixture or a sequence of setup forms.

Or they say **“I want to renovate my living room”** and upload a room photo.
Renovagent should propose two or three visually distinct directions, show what
each would look like in that room, and explain each option's scope and cost
breakdown. Picking an option develops its material requirements and sourcing.

Muse uses Renovagent to create or continue the project, understand the goal,
develop a working scope, assemble material requirements, attach suitable
products where supported, and save useful project files. The first response
provides what can be estimated now, what the estimate includes, the main cost
drivers, and the next useful question. Further details are available on demand.

The first deliverable is a substantial draft. Missing information narrows what
can be priced or purchased; it does not prevent unrelated planning work.
Construction release and actual inspection results retain their existing gates.

**Standard consumer Muse is a required demo client.** Local stdio discovery or
a developer-CLI session does not satisfy that requirement. The website provides
the same saved project, with simple Design, Materials, Contractors, and
Requirements views, plus purchases/receipts in the project files.

## Product decisions

- Start with a complete, explicitly scoped bathroom project in Philadelphia.
  The demonstrated workflow must cover multiple work packages and supporting
  materials; buying a vanity alone is insufficient. Keep the property/project
  model general, with coverage defined by versioned recipes. Prove visual
  exploration with a bounded living-room refresh/flooring example using the
  same option, quantity and materials pipeline.
- Accept casual language, inspiration, shopping links, photos and short clips.
  Reuse already-known property facts. Preserve inspiration separately from
  exact product selections and observed existing conditions.
- Produce useful work before optional questions. Ask one question at a time,
  normally no more than two before the first draft. “I don't know” remains a
  valid answer. Ask further questions when a consequential step needs them.
- Keep plain-language summaries short. Put calculations, citations, exclusions
  and unresolved details next to the affected project item or in expandable files.
- Let “make it blue,” “keep the floor,” “cheaper,” and contractor corrections
  revise the same project. Explain the consequential changes together.
- A vague room request should lead to visual choices with cost breakdowns.
  Different concepts can change the scope, rather than merely switching the
  existing catalog's builder/mid/high price tier. Selection carries through to
  materials, compatibility findings, contractor scope and shopping.
- Separate needed materials from specific products, compatible inventory,
  purchase packages, optional allowances, and acquired materials.
- Save drafts and recompute routine proposals without per-item approvals.
  Batch review at meaningful decisions. Sending an approved scope to named
  recipients and making a purchase remain explicit actions.

## Starting point and gaps

| Reuse now                                                                           | Work still required                                                                                                             |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Running local Mongo/API, owner workspaces, evidence, revisions and command receipts | Reachable authenticated service connected to an actual consumer Muse account                                                    |
| Eight local MCP tools for reads, proposals, catalog recall and checkout assembly    | Intent-level planning, project creation/continuation, attachment intake and useful project-file discovery through the connector |
| Real photo jobs and saved region proposals                                          | Inspiration/product-image search, same-room visual alternatives with costs, short-clip evidence and planning/diagnosis requests |
| Planning calculations, locality/source records and limited checks                   | Project scope feeding materials and requirements; qualified technical coverage remains open                                     |
| Catalog imports, price history, tier plans and checkout payloads                    | Full job assemblies, real dated sample offers, corrected commerce semantics and usable artifact viewers                         |
| Owner decisions                                                                     | Contractor scope/review, comparable quotes, outreach handoff and inspection responsibilities                                    |
| Attachment storage                                                                  | Receipt extraction, reviewed purchase matching and actual spending                                                              |

Earlier architecture notes describe the state at different increments. Their
future-work lists are not an instruction to rebuild capabilities already present.
The previous review's commerce findings are open until reproduced and fixed.

## Delivery sequence

Days are working targets; each outcome must meet its gate before being credited.

Protect the standard Muse connection, useful first draft, full-scope materials
with visual/costed choices, and contractor/inspection handoff if time tightens. Reduce catalog breadth,
design-option count and integration sophistication before dropping the complete
journey. Record any unconnected external step explicitly in the demo evidence.

### Day 1 — Prove Muse and get the first useful response

Extend the current MCP implementation with a reachable authenticated transport
and account-scoped application services. Test the actual connection and auth
flow supported by the target Muse account before choosing deployment details.
Use a narrowly scoped demo endpoint when appropriate; preserve the local preview.

Expose project creation/continuation, evidence intake, bounded work requests,
status and project-file discovery. Return typed results, missing inputs and
artifact links/references. Tool names and deployment/auth details are resolved
in this slice, rather than assuming an unverified Muse attachment or OAuth flow.
Use an upload handoff if Muse cannot transfer an attachment directly.
Allow early design exploration from a photo and goal without mandatory address
research. Request locality when local pricing or requirements need it. The
current photo worker's address prerequisite needs a bounded adaptation for
this intake path; preserve unknown property facts rather than inventing them.

For a first bathroom request, produce a real saved brief, initial scope and
cost basis. Give a range only where its quantities/rates and basis support it;
separate material subtotal, labor, delivery/tax and unknown work. Prepare dated
sample pricing and a declared scenario so the demo can answer the cost question.
An example scenario stays visibly separate from the user's physical facts.

**Gate:** In ordinary Muse, a casual request creates a saved project and useful
draft; the web workspace opens that same revision. A repeat does not duplicate
it. Cross-owner access fails. Unknown measurements remain unknown. Record the
client/account flow actually tested and the observed response time.

### Day 2 — Show visual choices, their costs and the full materials plan

Build the Design and Materials views around the same project. Import accessible
link metadata/specifications with provenance; retain inaccessible links and
offer screenshot/upload input. Never describe an unread Pinterest link as
visually inspected. Interpret preferences from actual supplied evidence.

Implement the visual pipeline below as a first-class work request available
through Muse and the website. Generate a small initial batch of options and
reuse previews until their inputs change. Resolve the provider/access path in
this slice; finding references and generating previews are separate operations.

Curate a small recipe set covering the declared bathroom work packages:
preparation/removal, finishes, fixture installation and supported service work.
Use manufacturer installation documents, approved reference material and
explicit component relationships to capture the easily forgotten parts.
Evaluate broader datasets alongside this work; acquiring a large corpus is not
a prerequisite for demonstrating a complete supported scope.

Every requirement carries its purpose/task, specification, quantity basis,
source and status. Unresolved pipe routes or concealed conditions remain
conditional requirements. Explicit, justified consumable allowances are
separate from measured quantities. Missing offers stay visible as unpriced
requirements; they cannot disappear from the total's coverage description.

**Gate:** A vague living-room request produces two or three same-room visual
options with different scopes and source-based cost breakdowns. Choosing the
hardwood option produces its flooring assembly, quantities and supporting
materials; changing area or finish updates the corresponding costs and visual
revision. “Make it blue” updates design direction; supplied dimensions or
manufacturer specs support at least two genuine compatibility checks. A full
reference BOM is independently checked against the declared scope, including
supporting components. Inspiration alone cannot establish fit or installation
quantities. The first draft appears without a compulsory materials questionnaire.

### Visual recognition → references → options → priced scope

**Already implemented:** actual image-attachment recognition, approximate
per-photo regions, saved observations, user corrections and keep/replace
direction. See [connected photo jobs](connected-muse-and-mongo.md),
`apps/api/src/photo-jobs.ts`, `scripts/muse-inventory.ts`, and
`apps/web/src/features/work/inventory-workbench.tsx`.

**Earlier product direction:** the historical
[Concept & Visualization Studio](../Unpermitted.ai.md) explicitly called for
multiple design alternatives, mockups and rough-cost comparisons. This plan
restores that interaction to the hackathon journey while retaining the current
domain and technical boundaries. Generated previews and image search are not
connected capabilities in the reviewed working tree.

| Step                              | Useful output                                                                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Understand the supplied room      | Visible floors, walls, openings and furnishings with source-photo regions, uncertainty and reported keep/replace preferences                         |
| Find references                   | Source-linked inspiration images and product references matching the goal; distinguish similar appearance from exact product identity/specifications |
| Visualize alternatives            | Two or three labeled concept previews based on the same original room view, with proposed changes and retained elements explained                    |
| Price the work behind each option | Task/material requirements, quantity basis, labor basis where supported, removal/preparation, delivery/tax coverage and conditional work             |
| Select and refine                 | One saved option revision driving the detailed materials, contractor brief, requirement checks and purchasing alternatives                           |

For the living-room example, candidate scopes could be a paint/decor refresh
retaining the floor, hardwood replacement plus the refresh, and a wood-look
flooring alternative on a comparable scope. These are illustrative option
recipes, not recorded owner preferences or claims about the existing floor.

An option card should show a room preview, a short change summary, material and
labor amounts/ranges where supported, and its largest unknown cost driver.
Expandable detail includes the full breakdown and sources. If area is missing,
show sourced unit rates/conditional estimates and ask for an approximate room
size; do not infer accurate area from pixels. Hardwood scope includes the
relevant preparation, installation supplies, transitions and trim, not only
the advertised flooring price. Unknown floor condition remains conditional.

Keep original photographs, retrieved reference images and generated concept
previews separately identified. Attach preview outputs to their source-photo
hash, option revision and generation provenance. Preserve the room's visible
layout/retained features where possible; disclose conceptual geometry or
appearance changes. A generated image cannot prove fit, exact material identity
or installation feasibility. Actual product claims require their own sources.
Respect reference-image access/reuse status when showing or generating from
them. Return the saved option artifact and a supported preview or project-view
link through Muse; test what the actual client displays.

### Day 3 — Make the job specific enough to quote and inspect

Generate a contractor scope containing the outcome, work packages, existing
evidence, exclusions, unresolved conditions and owner-supplied materials.
Record responsibility for permits, rough/final inspections, corrections and
closeout rather than silently assuming the installer handles all of them.

Reuse the source/applicability machinery for project-specific requirement
findings and an inspection checklist. Cite supported requirements and expose
coverage gaps in context. A numeric fit check or accepted proposal cannot
become a claim that the bathroom complies or has passed inspection.

Support contractor corrections and uploaded/pasted quotes against one named
scope revision. Compare inclusions, exclusions, allowances and inspection work.
Separate necessary corrections from discretionary upgrades, with their basis.
For vetting, attach dated identity/license/insurance evidence where actually
available; missing evidence is not a verified credential or an invented score.

Prepare a concise outreach message and scope attachment for named recipients.
Connect actual sending through the selected authorized communications path;
record delivery status only from a real result. Keep a useful export when the
demo's communication channel cannot send. Outreach is complete only when its
actual behavior has been tested, not when a button or message draft exists.

**Gate:** A contractor correction updates affected requirements/materials/costs
with a visible change summary. Two quotes can be compared without forcing the
homeowner to normalize them. Inspection ownership and unresolved requirements
are visible. Any outbound action shows its recipients and content for approval.

### Day 4 — Source, hand off and record purchases

Load real, dated, appropriately sourced products/offers for the demonstration.
Prioritize expensive selections and compatible alternatives, and retain the
full materials list with its unpriced coverage. Compare known delivered costs
and explain missing fees, observation age and availability.

Produce grouped shopping links and a contractor-reviewable handoff. Verify any
retailer cart-population mechanism separately; record product links, prepared
carts and actual orders as different outcomes. Support owner purchase/storage
arrangements without treating a receipt as proof of delivery or installation.

Extract a receipt into a review proposal, match lines to material requirements,
and confirm the batch once. Record purchases/spend through validated commands;
retain unmatched items and uncertain OCR fields for correction. Repeated uploads
or retries must not double-count spending or inventory.

**Gate:** A compatible alternative has a traceable price comparison. A receipt
updates purchased quantities, remaining requirements and actual spending after
review. Changing a selected product exposes affected compatibility findings,
quotes and shopping revisions. Known purchases/history remain preserved.

### Day 5 — Demonstrate continuity and make it easy

Finish photo/clip annotations and a bounded diagnostic example using the same
evidence, findings and project files. Demonstrate plausible causes, the next
useful observation and a repair handoff; unsupported conclusions remain open.
Use uploaded clips and conversation for the prototype. Continuous live video,
general appliance coverage and advanced room reconstruction are follow-on work.

Rehearse the whole flow in standard Muse and the web workspace, including
mobile review, refresh, interrupted work and one changed input. Repair friction
found in that journey before expanding coverage. If four days are available,
fold this verification into every slice and reserve the final half-day for it.

**Gate:** The same project survives client switching and restart; real work
status reflects real execution. The demonstration shows one substantial bathroom
plan, living-room visual alternatives with cost breakdowns, one meaningful
compatibility correction, a quote/inspection handoff, dated shopping links
and receipt reconciliation. A short diagnosis shows reuse of the
same product model, with its supported limits stated.

## Implementation boundaries

Keep `packages/contracts` responsible for runtime payloads and commands;
`packages/core` for pure calculations, assemblies, compatibility and invalidation;
`apps/api` for authenticated services, providers, jobs and storage; and
`apps/web` for review/editing. HTTP and MCP call the same application services.
Extend typed artifacts as each slice needs them; do not create parallel browser,
MCP and server planning engines or replace the working workspace aggregate.

The consumer Muse agent coordinates the interaction. Renovagent supplies bounded
capabilities and durable project knowledge. Existing `Run` records currently
describe simulations only: introduce honest real-run contracts/checkpoints for
new connected work instead of relabeling fixture progress. Model findings propose
changes; trusted source facts, user decisions and inspection results preserve
their distinct authority.

Fix the commerce defects inside the slices that depend on them: validate BOM
and plan references/calculations on the server; track source revisions; retain
all offers per product; enforce units and availability; compare known shipping;
prevent orphaned imports; preserve empty search results; and render complete
materials/purchase/checkout content before accepting it. These support the full
journey and should not become an independent rewrite program.

## Evidence required to call the prototype ready

- Record the complete ordinary-Muse journey, including authentication and shared
  project persistence. A standalone MCP test is supporting evidence.
- Check the reference materials/quantity fixture and real product specs against
  their sources. Show unknown or conditional work and partial price coverage.
- Verify that each visual option's displayed cost comes from its corresponding
  scope/material quantities and dated cost basis. Selecting a different option
  or editing area updates that scope's materials, estimate and preview status;
  retained original photos never change. Check both room examples in Muse.
- Exercise compatibility failure, changed inputs, stale publication, rejected
  import, repeated requests and duplicate receipts with meaningful tests.
- Exercise scope/quote differences and actual inspection-state evidence. A
  scheduled inspection never becomes passed through inference.
- Verify recipient/content approval for tested outreach and authorization for
  purchasing actions. Clearly label exported, simulated and externally completed
  steps in the demo record.
- Run `npm test`, `npm run test:connected`, `npm run build`, and formatting checks
  appropriate to changed files. Preserve the working preview and actual owner data.
- Update `PROGRESS.md` with the behavior that passed and the remaining limits.
  Keep technical review, external integrations and data coverage honest.

## Supporting sources and connection checks

Meta's [connector guidelines](https://platform.muse.ai/docs) describe API/MCP
documentation, authentication and tool permissions. They support investigating
the integration; the exact transport, attachment flow and persistence behavior
must be verified in the target consumer Muse account.

Home Depot documents [cart sharing](https://www.homedepot.com/c/share-a-cart)
and [editable quotes](https://www.homedepot.com/c/create-a-quote). These establish
human-facing handoff options, not an implemented public cart-writing API.
Retailer accounts, commercial access and connector distribution dependencies
must be surfaced when tested rather than hidden behind a simulated success.
