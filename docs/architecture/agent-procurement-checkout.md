# Agent procurement and checkout handoff

October 29, 2026. Gives agents catalog search plus a customer checkout handoff
("you checkout and doublecheck"), and records the corpus strategy for Amazon,
Wayfair, and beyond. Receipt OCR/accounting and contractor accountability are
specified below as the queued next slices.

## Agent search (built)

Three MCP tools join the five workspace tools: `search_catalog` (products with
offers and latest dated prices), `get_offer_history` (price history), and
`build_checkout_review` (computation only — assembles the handoff, stores
nothing). The intended pattern is verified-corpus-first: the agent searches
our catalog, proposes BOMs and plans through validated commands, and any live
retailer check it performs in its own browser comes back as a dated manual
observation — never as a silently trusted price.

## Checkout handoff (built)

`checkout-review` artifacts group a purchase plan by retailer with product
URLs, per-line observed prices, subtotals, an explicit customer checklist
(quantities, ZIP/dates, final price, substitution and return terms, receipt
keeping), and `authorizationRequired: true`. Amazon groups get a real
add-to-cart URL when every SKU is an ASIN (documented convention: Amazon offer
SKU = ASIN, optional associate tag); other retailers get product links for
manual checkout. Accepting the review via decision records the customer's
authorization. Renovagent never completes purchases.

## Corpus strategy (researched)

- **Amazon**: Associates program first with product links (SiteStripe); the
  Product Advertising / Creators API unlocks only after qualifying sales, so
  API fetch follows revenue, not precedes it. Cart links work now.
- **Wayfair**: CJ Affiliate with a product data feed (same network as Lowe's).
  Rows flow through the existing affiliate normalizer; no new code per retailer.
- **Identity resolution**: UPC/GTIN lookup APIs (UPCitemdb trial, EAN-Search,
  BarcodeReport) resolve barcodes from receipts and shelves to canonical
  products for cross-retailer dedup. Identity only — never prices.
- **The real gap is attributes, not SKUs**: feeds carry prices but not the
  spec attributes (dimensions, connections) our compatibility engine matches
  on. Those come from manufacturer curation, one template at a time.

## Queued slice B: receipt OCR and project accounting (specified)

- Receipt photos upload as evidence; the existing vision provider transcribes
  line items as a **proposal** (retailer, date, SKU/description, amounts, tax).
- The customer confirms or corrects each line; confirmed lines become immutable
  `spend` records on the project (never edited — corrections supersede).
- Accounting views: budget vs actual by category, per-retailer totals, and
  plan-vs-receipt matching (this receipt line fulfills that plan line).
- Receipts stay private to the project; only operator-promoted prices enter
  the shared catalog, via the existing submission flow.

## Queued slice C: contractor accountability (specified)

- **Hours**: contractor (or customer) logs dated hours against milestones;
  entries are append-only with author and source.
- **Claim checks**: deterministic cross-checks compare progress claims ("50%
  complete, rough-in done") against recorded evidence (completed tasks,
  accepted milestones, hours, dated photos) and raise explicit mismatches —
  "claimed X, evidence shows Y" — never silent edits.
- **Timelines**: milestone dates with best-practice buffers from templates;
  slippage computed from evidence dates, surfaced with reasons.
- **Contract generation**: templated agreements assembled from project facts
  (scope, milestones, payment schedule tied to evidence gates, change-order
  rules), labeled as templates requiring professional review — never legal advice.

## Verification

- Domain: checkout grouping, Amazon cart URL construction (present, tagged,
  absent for non-ASIN), checklist/authorization, multi-retailer affiliate rows.
- MCP integration: catalog search/history over a seeded store, checkout
  computation from a stored plan with nothing persisted, unknown-plan rejection.
- Raw stdio probe re-run: 8 tools discovered, all checks pass.
- Full gates: `npm test` (15 legacy + 131, 17 Mongo cases skip),
  `npm run test:connected` (18), builds, strict types, boundaries, formatting.

## Limits

- No live inventory anywhere; affiliate prices stay advertised references.
- Amazon API gated on associate sales; Wayfair/CJ need the owner's accounts.
- UPC lookup and manufacturer curation are designed, not connected.
- Accounting and contractor slices are specified only — no code yet.
