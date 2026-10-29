# Commerce catalog: tiers, pricing, and purchase plans

October 29, 2026. Implemented locally: a shared catalog (products, offers,
timestamped observations) with duplicate-proof imports, deterministic
compatibility matching and tiered purchase plans, contractor accept/decline,
and a Materials surface in the project. Prices in the seed are explicitly
labeled demo examples, never live offers.

## What was built

- **Contracts** (`packages/contracts/src/catalog.ts`): tiers (builder, mid,
  high), products with matchable specs, offers with pack sizes, immutable
  price observations (retailer, SKU, region, time, stock, source, freshness),
  BOM items with hard constraints and code topics, and purchase-plan payloads
  with lines, rejections-with-reasons, totals, and fixture/verified basis.
- **Engine** (`packages/core/src/commerce/`): hard-constraint matching (unknown
  specs reject, never pass), pack-rounded delivered totals in minor units with
  tax excluded and labeled, per-tier plan assembly (cheapest acceptable line
  wins; losers kept as rejections), and pure import validation.
- **Store** (`apps/api/src/catalog.ts`): shared Mongo collections with unique
  indexes (offer identity, observation identity). Re-imports are no-ops;
  same-ID-different-content and dangling references are rejected.
- **API**: `GET /catalog/offers` (session-gated reads) and
  `POST /catalog/import` (operator token in account mode; local session in
  local mode). Run `npm run seed:catalog` to import the curated demo set.
- **Seed** (`fixtures/catalog/vanity-philadelphia.ts`): 30" vanity replacement
  for Philadelphia 19148 — 5 BOM items, 17 products/offers/observations across
  three tiers, plus two deliberately incompatible candidates. Manufacturers,
  retailers, and prices are fictional and labeled `example-import`/`historical`.
- **Project UI**: Materials opens tiered plans in connected mode — BOM from
  template, offer matching, per-tier totals, observed dates, code topics per
  line for contractor verification, rejected candidates with reasons, and
  Accept/Decline through the existing decision commands. Fixture basis shows a
  persistent warning; nothing here is purchasable.
- **Approvals**: purchase plans are versioned artifacts; `AcceptDecision` /
  `RejectProposal` accept or decline a tier. BOM revisions stale plans, and
  plan revisions stale checkout reviews, through the existing invalidation
  path. New price observations do **not** stale saved plans: the catalog sits
  outside the workspace reference graph. A changed catalog shows up when plans
  are rebuilt or when an MCP proposal no longer matches the catalog.

## Integrity rules (October 29 follow-up)

- **Selection**: every offer for a candidate product competes. Ranking uses
  delivered cost (line total plus shipping when the offer must ship), then
  offer ID. A shipping-only offer without an estimate ranks behind every offer
  whose delivered cost is known, and the plan notes it. Out-of-stock offers are
  rejected; unknown or limited stock is kept and noted. Pack units must match
  the BOM unit (explicit `ea`/`each`/`pc` aliases only).
- **Proposal validation (core)**: `ProposeArtifact` recomputes purchase-plan
  lines against the referenced current BOM revision (one line per BOM item,
  candidate product, quantity, pack rounding, totals, currency, code topics,
  basis derived from sources). Checkout reviews must match every line of a
  current, undeclined plan. Cart links are accepted only for the documented
  Amazon cart URL.
- **Provenance (server)**: core cannot see the catalog, so MCP
  `propose_project_change` rebuilds commerce proposals from it and rejects any
  difference across the whole payload except `builtAt`. Invented prices,
  spec-incompatible candidates, and injected notes or checklist text are all
  rejected. Tiered IDs (`…:purchase-plan:<tier>`) must hold that tier. Plan
  notes are aggregated per kind and rejections capped at 200, so large BOMs stay
  within the schema.
- **Store**: `offersFor([])` returns nothing (`undefined` = no product filter).
  `importBatch` checks conflicts in every collection before writing, inserts in
  dependency order. If a later insert fails, it deletes only the IDs the driver
  reports as inserted by this call, never a concurrent import's records. Local
  Mongo is standalone, so this is compensating rollback, not a transaction; a
  concurrent reader can briefly see a partial import.

## Holes filled beyond the ask

- **Code linkage**: every BOM item and plan line carries code topics (e.g.
  `phila-plumbing-scope`) surfaced for contractor verification, with the
  standing rule that nothing is reviewed guidance.
- **No-duplicate guarantees**: unique Mongo indexes plus application conflict
  checks, verified by re-import tests and a live double-seed.
- **Rejection evidence**: incompatible and overpriced candidates persist on
  the plan with reasons instead of vanishing.
- **Currency discipline**: single-currency plans; mixed-currency candidates
  are rejected with reasons.

## Verification

- `tests/domain/commerce.test.ts` (5): matching operators, pack rounding,
  exact tier totals from the seed (builder $307.00, mid $771.00, high
  $1,912.00), both seeded rejections, import validation, and BOM → plan →
  accept through validated commands.
- `tests/integration/catalog.test.ts` (2, in `test:connected`): idempotent
  import, conflict and dangling-reference rejection, latest-observation reads,
  region filtering, session gating, and the operator-token import gate.
- Full gates: `npm test` (15 legacy + 129, 13 Mongo cases skip),
  `npm run test:connected` (14), builds, strict types, boundaries, formatting.
- Live double-seed against local Mongo: 17/17/17 then 51 skipped, no dupes.

## Limits

- Example prices only. No retailer integration, live inventory, tax, or
  checkout; cart handoff and purchasing remain unbuilt.
- One template, one region, one retailer. Jurisdiction/code collections are
  still future (the existing source register is reused via topics).
- No per-line approvals, substitutions flow, or contractor accounts — whole
  plans accept/decline through the owner's decision command.
- Catalog reads are not yet exposed over MCP; purchase plans are readable as
  artifacts through the existing tools.
