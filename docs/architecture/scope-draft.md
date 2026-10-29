# Scope and materials draft from casual intent

October 29, 2026. Implemented locally; the hackathon step 2 slice. A casual
request ("how much for this bathroom?") becomes a saved scope draft with work
packages and a complete requirement list, before anyone measures anything.

## Flow

1. `start_project` (MCP) saves the project and relayed brief.
2. `draft_scope` (MCP) takes the declared work packages, the request text and
   only the values the person actually gave. `amount: null` records
   "I don't know". It runs the validated `DraftScope` command and returns a
   bounded summary with at most two next questions.
3. In the same atomic update it proposes `<project>:bom` for the requirements
   the catalog can price, then builds the three tier plans server-side with
   the same engine the website uses. The BOM references the exact draft
   revision and each plan references the BOM, so the staleness chain runs
   draft → BOM → purchase plan → checkout review. The reply gives each tier's
   materials subtotal for the priced items, labeled with its price basis, and
   a coverage line ("prices cover N of M requirements; not priced: labor…").
4. The website opens the draft in Saved work (`ScopeDraftView`). When a draft
   exists, Materials no longer offers the fixed 30 in vanity template; it
   explains what the draft still needs before pricing.

A retry with the same `requestId` and identical content replays. Reusing a
`requestId` with changed content drafts anew rather than returning old work.

## Rules

- **Validated generator only.** `ProposeArtifact` refuses `scope-draft` content
  and the `:scope-draft` identity; agents cannot hand-write a requirement list.
- **Recipe registry.** `bathroom-refresh` v1 (`packages/core/src/scope/`)
  defines seven packages: removal/protection (added automatically), vanity,
  toilet, floor tile, paint, exhaust fan, and conditional service work. Unknown
  package or recipe IDs are rejected. A recipe version bump marks older drafts
  non-current through `technicalVersionCurrent`.
- **Inputs.** Recorded workspace facts (`finishedLength`, `finishedWidth`,
  `ceilingHeight`) take precedence and are input references, so correcting a
  fact stales the draft. Relayed values stay inside the artifact as
  `agent-relayed`, are never promoted to facts, and a conflicting relayed value
  is noted. Each input records whether it is a fact, relayed, explicitly
  unknown, or not yet provided. Explicitly unknown inputs are not asked again.
- **No physical defaults.** Count items (seal, bolts, supply lines) are
  quantified immediately. Area and perimeter items show their formula and stay
  null until dimensions exist. Gross wall area does not deduct openings, and
  says so. Product-rate items (mortar, grout, paint, fan rating) wait for the
  selected product's published data.
- **Blocking is local.** Each requirement lists the inputs it waits on; nothing
  else is blocked. Questions are ranked by how many requirements they unblock.
- **Statuses:** quantified, needs-input, needs-product-spec, conditional
  (depends on what is found on site), needs-source (allowance with no supportable
  value).
- **BOM integrity.** A BOM citing a scope draft may omit requirements but
  each item must equal its requirement's ID, quantity, unit, category,
  constraints and code topics (core check). Over MCP, every candidate must be a
  catalog product of the item's category.
- **Pricing coverage.** Only quantified requirements with a catalog category
  and matching catalog products enter the BOM. Everything else is listed as
  unpriced. Labor, permit fees, tax, delivery and disposal are stated as not
  priced, never shown as zero.

## Sources and what they support

| Source | Retrieval | Used for |
| --- | --- | --- |
| Renovagent bathroom-refresh recipe v1 | Internal, unreviewed | Component relationships and quantity formulas |
| Demo vanity-replacement template v1 | Internal demo selections | Vanity constraints that match the demo catalog; the 31 in top is used only with a 30 in cabinet and is labeled as the demo catalog's pairing |
| [Kohler service kit instructions 1365041-9](https://techcomm.kohler.com/techcomm/pdf/1365041-9.pdf) | Fetched 2026-10-29; text extracted and quoted | “Install the new T-bolts and wax ring”; “Connect the new water supply hose”; “Inspect and repair the water supply stops, as needed” |
| [Broan S50U instructions, “Install the Fan”](https://www.manualslib.com/manual/457322/Broan-S50u.html?page=2) | Fetched 2026-10-29 | “Install 4\" round duct and extend duct to outside through a roof or wall cap”; damper opens freely; “Tape all duct connections” |
| Published tile overage guidance | Web search summary 2026-10-29; no page opened | Shows overage figures vary (about 5–35%), so no single value is used |

**Allowances.** Tile overage is the only explicit allowance and has **no
value**: published guidance does not support a single percentage without the
selected tile, layout and installer. No other allowance is quantified. The
Kohler and Broan statements were read from the fetched documents; the overage
range is a search summary only, and the page it was first attributed to could
not be opened (rate-limited), so no page-specific claim is made.

## Verification

- `tests/domain/scope-draft.test.ts` (9): BOM-from-draft integrity (loosened
  constraints, invented items, changed quantities rejected); full scope with nothing measured;
  relayed values quantify without becoming facts; "I don't know" retained and
  not re-asked; package selection drives questions; unknown IDs rejected;
  direct proposals blocked; facts take precedence and corrections stale the
  draft; idempotent replay and revision conflict; BOM bridge reproduces the
  demo vanity totals and leaves uncatalogued items unpriced.
- `tests/integration/mcp-workspace.test.ts`: `draft_scope` over MCP end to end,
  including replay, changed-request redraft, the derived BOM and server-built
  plans ($307.00 / $771.00 / $1912.00 demo materials subtotals for the vanity
  package), their staleness after a new draft, and wrong-category BOM
  rejection.
- `tests/integration/commerce-views.test.ts`: the viewer renders packages,
  open quantities, conditions and source retrieval labels.

## Limits

- One recipe (bathroom refresh). Living-room/flooring and visual options are
  the next slice.
- The demo catalog covers only the vanity package. Toilet, tile, paint and fan
  items are unpriced until real dated offers are imported.
- The website can view drafts but has no form to create one; drafting runs
  through the agent connection.
- Replays of a `draft_scope` request return the current draft, which may be a
  later revision than the one the original call produced.
