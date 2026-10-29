# House-first workspace and job preparation proposal

October 29, 2026 · Proposal, not implementation evidence

**Updated direction:** the user rejected the dashboard-style concept. The [prompt-first workspace](../architecture/prompt-first-workspace.md) supersedes this proposal's opening navigation: one clean prompt with tools and artifacts revealed on demand, plus standard Muse-agent access as a required future client. The materials, contractor and persistence requirements below remain relevant.

## Recommendation

Make Renovagent feel like a persistent workspace for a house: identify the home, choose a project, describe what you want, and inspect the work produced. The opening experience should answer three questions immediately: **Which house am I working on? What are we trying to do? What happens next?**

Keep the existing React/TypeScript, domain commands, revision history, repository interfaces and bounded Muse photo jobs. Redesign the information hierarchy around them. Add procurement and contractor workflows as durable artifacts, not extra chat personas or decorative tabs.

Working assumption: homeowners and owner-renovators are the first audience, with multiple houses/projects supported. A remodeler's multi-client CRM can follow using explicit workspace membership; it should not dominate the first experience.

This proposal supplements the [architecture](../architecture/README.md) and its [delivery gates](../architecture/05-delivery-and-verification.md). It does not supersede technical review or mark Slices 3–6 complete.

## What the audit found

Reviewed the running desktop preview at `http://127.0.0.1:8741/`, the current source, architecture specifications and latest progress entries. The active screen was the Hutchinson inventory workspace. This was a read-only planning review; no provider run, database migration or deployment was performed.

| Area | Evidence today | Implication |
|---|---|---|
| UI | House address repeats in sidebar, header and content; large editorial headings, micro-labels, lifecycle navigation, photo regions and diagnostics compete | Simplify hierarchy, use normal reading sizes and move implementation details into settings/activity |
| Project focus | The selected “The plan” screen can display the photo inventory workbench; conversation is behind “Project notes” | Navigation should name the object being opened; the assistant should be easy to reach from any work product |
| Property/project foundation | Separate property and project IDs, commands, revisions and durable repositories already exist | Build an explicit house picker and project picker rather than replacing the domain |
| Storage | Persistent real local Mongo, with `.local/mongo` WiredTiger files; current workspace API defaults to loopback port 27018 | “Memory server” is the launcher library name, not an indication that saved data vanishes on shutdown |
| Atlas | Local configuration files contain Atlas-style SRV connection strings under `MONGODB_URI`; the current API reads `WORKSPACE_MONGODB_URI` | The presence of Atlas configuration does not prove the current workspace uses it; cluster connectivity, ownership and backups remain unverified |
| Muse | Real revision-bound photo classification/region jobs run through `apps/api`; general conversation/lifecycle jobs remain simulated | Extend the existing bounded worker pattern to real work requests before advertising a general connected assistant |
| MCP | `server/src/mcp.ts` serves the older flat project/demo engine | Rebuild a thin adapter over current application services; connecting the old endpoint would expose different project semantics |
| Materials | Some deterministic geometry, quantities, packaging and money arithmetic exist | A complete materials list, live supplier offers and purchasing workflow still need to be built |
| Customers | Local single-owner access is implemented | This is not production customer authentication or multi-customer isolation |

The latest connected-increment report records 144 passing tests. This planning task did not rerun them. The top summary rows in `PROGRESS.md` still describe older backend-off behavior; reconcile those rows in the next implementation change without erasing historical evidence.

## Product and visual direction

### Landing and return visits

Use one clear promise: “Plan the work. Know what to buy. Find the right help.” The first screen has a single prompt, “What would you like to improve?”, an optional photo/document attachment, and a simple way to choose an existing house or add a new one. An address is context, not the only possible starting input.

Below the opening, show one clearly labeled example deliverable: a scope, materials list or quote comparison. Avoid unsupported savings, contractor counts and progress metrics. Returning users open their last house/project directly; the marketing page remains available separately.

Natural-language examples describe intended capabilities only where implemented. Unsupported requests should produce a useful saved intent and explain the next available step, not simulate completed research.

### House and project structure

Proposed route structure:

```text
Landing / start
Homes
  House overview
    Photos, rooms, shared facts and documents
    Active and past projects
    Project
      Overview · Plan · Materials · Contractors · Files
      Contextual assistant and activity
Account / workspace settings
```

The header carries “Hutchinson house › Living-room half bath”, with separate house and project selectors. Create another project against the same property without duplicating its address and shared observations. Do not merge properties by normalized address automatically; duplicate reconciliation must be explicit.

The house overview is a compact summary and visual index of the property. The project overview shows the goal, current state, one next decision, and recent outputs. Rooms/photos open a dedicated inspection surface. Full source provenance remains available from each relevant fact or result.

The assistant is a consistent “Ask about this project” entry. On desktop it opens a side panel; on phones it opens a full-screen conversation with a clear return to the previous artifact. It can reference the current room, material or contractor. Switching projects restores each project's own draft and conversation. Scope is visible before sending.

### Visual rules

- Use a warm neutral background, strong dark text, one restrained green accent, consistent spacing and quiet dividers. Reserve warning color for actionable uncertainty.
- Use a readable sans-serif for app navigation, forms and tables; reserve an optional serif for landing-page expression. Remove oversized compressed headings and tiny all-caps body labels.
- Give the work surface most of the width. Avoid nested cards, multiple permanent sidebars and full-page stacks of disclaimers.
- Show brief, specific statuses such as “Needs measurements”, “Draft for pricing”, “Price checked [date]” and “Insurance evidence missing”. Source and technical detail open on demand. Material blockers remain beside the affected action.
- Replace customer-facing “Mongo connected” with “Saved”. Put database/provider diagnostics in settings. Distinguish local-device storage from account storage where that affects access or recovery.
- Use permitted property imagery or a useful empty state. Do not make essential navigation depend on loading an external listing photograph.
- Materials and Contractors can appear as honest empty states until functional; their presence is not completion evidence.

### Mobile is part of each increment

Design the same workflows at 360, 390, 768 and 1440 pixels. Use a compact house/project header and a small primary navigation with an overflow menu. Keep the assistant reachable, the main action above the on-screen keyboard, and touch targets about 44 pixels. Turn dense materials rows into expandable cards while preserving units, price basis and exclusions. Support camera/upload progress, recoverable errors and saved drafts; do not imply offline connected writes are supported.

## Materials, suppliers and cost comparisons

Treat this as three linked records:

1. **Requirement:** what the selected work needs, independent of a seller.
2. **Compatible product:** a specification/SKU that can satisfy that requirement, with substitution constraints.
3. **Offer:** a supplier's dated price and fulfillment conditions for that exact product/quantity/account context.

Each requirement needs trade/task, room, specification, quantity and unit, formula/input references, waste or allowance basis, package rounding, compatible owned inventory, installation accessories, optional alternatives and procurement phase. Include consumables and rentals when the playbook supports them. Distinguish measured, estimated, allowance and unknown quantities. Unknown is not zero; partial totals must say what they exclude.

Avoid one giant LLM-generated shopping list. Shared domain code calculates quantities and totals. Versioned playbooks supply supported rules. Agents identify candidate products and sources; validated commands create proposed material/offer artifacts. A changed dimension, selected fixture or scope makes dependent quantities, offers and quote comparisons stale.

Supplier search uses the property's location and user-selected radius, delivery/pickup preferences and needed-by date. Start with one market and a small supplier set, plus quote upload/manual offers. Record branch, service area, exact SKU/variant, pack size, stock evidence, minimum order, quote expiry, delivery, tax basis and account/promotion conditions. Never assume a national website price or inventory result applies to the local branch.

Rank **best comparable total among checked offers**, not an unsupported “best price anywhere”. Compare matching coverage/specifications and whole required packages, then include known tax, fees, delivery and eligible discounts. Show unresolved cost components, number of suppliers checked, timestamps and tradeoffs. Cheapest single line, lowest delivered basket and fewest pickup stops are different choices. Travel cost requires a user-supplied basis.

Sherwin-Williams is a useful candidate integration, but account eligibility and actual quotes must be established. Its official registration page distinguishes PRO+ business accounts from PaintPerks homeowner/DIY accounts. The product can identify relevant programs, store eligibility evidence and compare actual account-specific offers; it cannot promise a universal discount or invent business credentials. Account enrollment, accepting terms, credit applications and purchasing remain explicit user actions. A cash/trade account must not be confused with financing. [Official registration](https://www.sherwin-williams.com/account/register).

Provider feasibility is a bounded discovery task: establish allowed access, authentication and branch-level coverage before committing to an API integration. If an authorized feed is unavailable, use user-supplied quotes and source-linked dated offers. Do not make fragile automated checkout or unrestricted scraping a launch dependency.

## Contractor discovery and scopes

Start with scope creation and comparable quotes, then add discovery. A directory without a specific scope is unlikely to improve the job.

The scope package includes project and revision, relevant rooms/photos, existing reported conditions, work items by trade, specifications, measured quantities, exclusions, owner-supplied materials, protection/cleanup, access constraints, sequencing, inspection/permit responsibilities where established, acceptance evidence and unresolved survey/design work. Export a reviewable package and a structured response schedule. Use “site visit / feasibility scope” when design is unresolved; don't turn a study proposal into instructions to build.

Contractor discovery records business identity, service area, trade and matching project experience. Evidence is separate for license/registration, insurance, references, relevant past work, availability and quote fit. Each check includes source, checked date, name/identifier match and expiry where relevant. A missing or ambiguous result is “not verified”, not a pass or an adverse conclusion. Reviews inform investigation; they do not establish credentials or workmanship.

For the Philadelphia reference market, official city resources link both local licensed-contractor lookup and Pennsylvania home-improvement registration lookup. The checks must depend on location, trade and scope; do not equate these categories or invent one universal “vetted” score. [Philadelphia contractor resources](https://www.phila.gov/services/property-lots-housing/find-a-licensed-contractor/).

Normalize quotes against the same scope revision: inclusions, exclusions, allowances, materials supplied, schedule, payment milestones and warranty terms. Highlight omitted work rather than ranking by headline price. Generate the scope and message draft first. Outreach needs explicit recipients and user authorization; preserve the exact shared revision and attachment list. The first increment can deliver an export without any messaging integration.

## Connected agents and MCP

Keep Muse behind the current Node provider boundary. Generalize the photo-job pattern into bounded jobs such as summarize evidence, propose scope, research supplier offers and normalize quotes. Each job names inputs/revisions, allowed capabilities, output schema, resource limits and success criteria. The UI shows persisted queued/running/waiting/failed/completed states and a link to the actual result.

For the first real conversation loop: accept a request → resolve house/project/context → ask a necessary question or start a supported job → validate a proposal → show changed artifacts → obtain any required acceptance. New claims remain proposals; the assistant cannot overwrite source facts, approve itself or mark inspections passed.

MCP has two possible roles: exposing Renovagent project tools to an external agent, and consuming approved external tools from the application's worker. Neither is required to make the existing Muse integration useful. MCP standardizes context/tool exchange; application orchestration and authority remain our responsibility. [Official architecture](https://modelcontextprotocol.io/docs/learn/architecture).

Implement external read tools first (`list_homes`, `get_project`, `get_scope`, `get_material_plan`), then bounded proposal/job tools through the same application services. Scope every tool to the authenticated workspace. Do not expose generic Mongo writes or reuse the old demo MCP planner. Test cross-account reads, stale proposals, malicious retrieved text, cancellation and retries before enabling remote access.

## Customer records and MongoDB

Keep MongoDB: the project already has an adapter and a document-oriented domain. Atlas is the recommended managed destination when hosted customer accounts are in scope. The existing local launcher is not Atlas Local. MongoDB documents Atlas Local separately as a development/testing deployment. [MongoDB deployment options](https://www.mongodb.com/docs/deployment/).

Proposed logical records are accounts/workspaces/memberships, customer profiles, properties, projects, facts/evidence, artifacts/revisions, conversations, runs, supplier offers, contractor evidence and quotes. Customer information includes contact preferences, authorized collaborators and property relationships. Do not turn those into editable owner IDs from the browser; identity comes from server authentication. A future professional workspace can link multiple client profiles explicitly.

The current 14 MB single Mongo aggregate embeds attachment bytes and job metadata. It is useful for the bounded local increment but unsuitable as the long-term multi-customer/photo layout. Move original/derived media to private object storage; retain hashes, metadata and authorized references in Mongo. Split aggregates deliberately, with atomic transactions or a proven commit design preserving command receipts, revisions and outbox publication.

Migration steps: verify the intended Atlas project/cluster and access → back up/export the local workspace → introduce auth and tenant-scoped repository contracts → dry-run migration into a separate destination → compare counts, hashes and revision references → test attachment authorization, restore and rollback → opt in to server authority. Retain the original until verification succeeds. Do not silently merge IndexedDB, local Mongo and Atlas or fall back to local writes after a cloud outage.

Observed setup issue: `atlas-credentials.env` is untracked and not covered by the current explicit `.gitignore` entries. Add its exclusion during configuration cleanup before staging changes; do not copy its contents into docs or client bundles. No credential values were printed during this audit. A remote connection was not attempted.

Before hosting customers, require session revocation, owner isolation across routes/jobs/tools/exports/blobs, retention/deletion/export behavior, backup/restore evidence, provider usage limits and deployment hardening. These are requirements for the hosted increment, not prerequisites for improving the local UI.

## Reviewable implementation sequence

These increments map onto the existing delivery slices; they are not a replacement numbering system or calendar promise. Build them in order, with independent UI work proceeding without live supplier access.

| Increment | Scope and likely code areas | Acceptance evidence |
|---|---|---|
| A. New shell and first impression | Extract shell/navigation from `apps/web/src/app/workspace-app.tsx`; add landing, house/project selectors, shared primitives and tokens | Existing projects reopen; two projects under one property switch correctly; browser history, keyboard/focus and drafts work; local and connected modes survive refresh; `/legacy.html` remains usable |
| B. House and project workspaces | Refactor `features/work/home-plan.tsx`, `inventory-workbench.tsx` and intake surfaces into overview, rooms/photos and details; add contextual assistant entry | The first viewport identifies house, goal and next action; source detail is reachable; photo selection and saved direction still work; mobile workflows checked; stale and historical artifacts remain distinguishable |
| C. Real bounded assistant | Extend `apps/api` jobs and provider adapter; typed requests/results in contracts and domain | A supported request produces a persisted artifact; unsupported intent is explicit; refresh/restart, retry, cancellation, stale input and invalid output do not corrupt state |
| D. Detailed materials and scope pack | Add supported material-plan/specification contracts, playbook rules and shared calculators; export contractor investigation/pricing scope | Each quantity traces to inputs; unknowns and exclusions remain visible; package rounding/compatible inventory are correct; edits invalidate affected outputs; scope is clearly draft or appropriately reviewed |
| E. Supplier comparisons | One-market adapters, manual/quote import, dated offers and basket comparison | Different pack sizes normalize correctly; missing fees/stock stay unknown; account conditions and expired quotes are visible; changing scope invalidates comparisons; no unsupported savings claim |
| F. Contractor evidence and quote comparison | Discovery adapters, evidence checklist, scope-linked quote normalization and export | Applicable credentials matched to identity; missing evidence is explicit; bids share a scope revision; omissions are visible; no unsolicited outreach |
| G. Hosted customer accounts | Tenant auth, private media, Atlas migration, backups/restore, operational limits | Two-account isolation across every surface; migration integrity and rollback; no browser secrets; deletion/export and recovery demonstrated before hosted release |
| H. MCP access | Current application-service adapter after account authorization is established | Tools access the same canonical state; owner checks, revision conflicts and proposal-only model writes verified; no dependency on legacy demo records |

A–B are a coherent visual redesign milestone. C–F produce the first useful preparation workflow locally. G is required before any public multi-customer launch; it may precede external-provider integrations if accounts are needed for their authorization. H follows a concrete external-agent use case. Technical release gates remain in force at every stage, including when UI, sourcing or quote features work.

For each change, run relevant domain/integration checks plus existing `npm test`, `npm run build` and formatting/boundary checks as applicable. Exercise real desktop/phone user paths and record screenshots, failures, simulated components and unverified capabilities. A green build alone cannot complete a product increment.

## First implementation brief

Start with **A and B**: landing, home/project picker, clean overview, rooms/photos detail, contextual composer and mobile navigation. Preserve controller/repository semantics and data. Keep unfinished capabilities in honest empty states. Use the actual saved Hutchinson goal and evidence in the real app; do not populate owner preferences, measurements, prices or contractor claims to make screens look complete.

Then prove one path: request a project → collect missing measurements → propose a scope and traceable materials → compare dated offers → export the same scope for contractor pricing → import/compare a quote → change one input and see affected results marked stale. The half bath remains the reference project, with explicit unresolved design/site investigation. Use a smaller flooring or painting playbook later to prove the UI and records are not bathroom-specific.

Decisions to confirm during implementation: homeowner versus professional priority (default homeowner), first supplier market (default Philadelphia reference context), preferred first bounded non-photo Muse job, and Atlas destination for a future hosted increment. None blocks the local UI redesign.
