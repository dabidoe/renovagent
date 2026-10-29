# Real retail pricing: access decision and ingestion

October 29, 2026. Decides how Renovagent gets real Home Depot / Lowe's /
local-supplier prices, and implements the ingestion and recall plumbing. No
scraping is built or planned.

## Decision

Home Depot and Lowe's publish no public product/pricing API. Their sites
aggressively throttle automated access, and scraping violates their terms.
Two lawful channels, both implemented:

1. **Authorized affiliate/catalog feeds.** Home Depot via Impact Radius,
   Lowe's via CJ Affiliate (also Impact/FlexOffers). Feeds carry SKUs, names,
   links, and advertised reference prices — partial catalog coverage, no live
   store inventory, refreshed on the network's schedule. Requires the owner's
   approved affiliate accounts.
2. **Verified manual observations.** Shelf tags, store checks, and receipts
   recorded by users, quarantined until operator review. Lawful everywhere,
   including local suppliers that have no data feed at all.

Paid scraper APIs were evaluated and rejected for now: ToS-gray, fragile, and
a liability the product's trust model cannot carry. Revisit only with counsel
and explicit owner sign-off.

## What was built

- **Feed normalization** (`normalizeAffiliateRows`): documented minimal rows
  (retailer, SKU, name, price, availability, region) map deterministically to
  products/offers/`retailer-api` observations, so re-imports are no-ops.
  Feed-specific fetching (Impact/CJ dashboards or APIs) maps into rows first;
  direct API clients are future work pending the owner's credentials.
- **Recall**: product text search (`GET /catalog/search`), SKU/retailer offer
  lookup, and per-offer price history (`GET /catalog/offers/:id/history`).
  Offers carry optional store IDs/names for local-stock nuance.
- **Submissions**: signed-in users post shelf/receipt prices
  (`POST /catalog/submissions`); account mode quarantines them as pending and
  invisible to pricing reads. Operators approve/reject
  (`POST /catalog/submissions/:id/review`, operator token); approval appends
  one `manual-entry` observation unless the fact is already recorded. Local
  mode records immediately since the owner is the operator.
- **Operator tooling**: `seed-catalog --file` imports arbitrary curated
  catalog JSON through the same validated, duplicate-proof path.

## Workflows

- **Affiliate onboarding (owner action):** apply to Impact (Home Depot) and CJ
  (Lowe's); export or pull the product feed; map to affiliate rows; import
  with the seed script. Expect advertised prices, not live store totals.
- **Manual capture:** find the offer (search/SKU), submit the observed price
  with store context in the note; review queue approves genuine sightings.
- **Local suppliers:** operator creates the product/offer (retailer name,
  region, store) once via file import; users submit prices against it.

## Verification

- Domain: deterministic affiliate normalization (ids, minor units, missing
  prices, invalid rows) alongside the existing commerce suite.
- Integration: recall (search/SKU/history), full quarantine lifecycle
  (pending invisibility, approval, already-recorded dedup, rejection,
  unknown-offer and future-time guards, local direct path), and HTTP
  session/operator gating.
- Full gates: `npm test` (15 legacy + 130, 15 Mongo cases skip),
  `npm run test:connected` (16), builds, strict types, boundaries, formatting.

## Limits

- No live inventory or checkout totals from any retailer; affiliate prices are
  advertised references with feed delay.
- No receipt OCR, no per-user submission history UI, no direct Impact/CJ API
  clients yet.
- Local-supplier offers still need operator creation before users can price them.
