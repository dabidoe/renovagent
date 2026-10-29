# Renovagent reconciliation: product scope meets implemented slices

October 29, 2026. Maps the product/technical direction in
`docs/RENOVAGENT_PRODUCT_SCOPE.md` and `docs/RENOVAGENT_TECHNICAL_ARCHITECTURE.md`
onto what is actually built, and records the one structural adaptation: shared
reference collections beside per-owner workspace aggregates.

## Rename (done)

The product is **Renovagent** (preferred spelling per the scope doc). Renamed:
packages (`@renovagent/*`), UI brand strings, page titles, wire header/cookies,
MCP server name, env vars, temp/test identifiers, current architecture docs,
README, and landing page.

Deliberately unchanged:

- `server/`, legacy `src/*.js`, `legacy.html`: frozen demo, retained as-is.
- `docs/history/*`, `docs/evidence/*`, `docs/Unpermitted.ai.md`: historical record.
- IndexedDB database name (`unpermitted-workspace`): no safe copy path without
  new write plumbing; invisible to users. Follow-up if ever needed.
- `LEGACY_STORAGE_KEY` (`unpermitted-opening-v1`): references legacy demo data.
- GitHub remote URLs: the repo rename is an owner action; links still work.
- Pre-rename upload host: old stored photo URLs keep routing; new uploads use
  the new host (`isLocalUploadUrl` in `@renovagent/core`).

Migrated with data preserved:

- `localStorage` mode key: new key with old-key fallback, forward-migrated on write.
- Default Mongo database `unpermitted_workspace` → `renovagent_workspace`, with a
  one-time copy on first boot when the new database is empty (verified against
  the live database: 7 projects, 3 blobs, 2 jobs copied, then the probe copy
  dropped, legacy untouched).

## Data-model adaptation

The technical doc proposes normalized MongoDB collections. The implemented
architecture keeps per-owner state in one versioned workspace aggregate with
atomic CAS, revision history, and invalidation. Both stand, split by ownership:

- **Shared reference collections (new, to build):** `jurisdictions`,
  `code_adoptions`, `code_provisions`, `source_documents`, `products`,
  `retailer_offers`, `price_observations`, `project_templates`. Global,
  versioned, import-gated; never per-owner.
- **Per-owner workspace aggregate (exists):** projects, measurements,
  annotations/regions, BOMs and purchase plans as versioned artifacts,
  approvals as decisions, agent activity as runs. Provenance, staleness, and
  acceptance rules stay in the domain, unchanged.

Consequences: retailer/catalog writes go through verified importers, never
agent prose; purchase plans and approvals reuse artifact/decision versioning
instead of inventing a second state model; price observations stay immutable
and timestamped per the doc's policy.

## MVP inventory vs implemented slices

| Scope MVP item | Status |
|---|---|
| Natural-language intake | Partial: composer, saved notes, wired photo questions |
| Address/jurisdiction selection | Done (Philadelphia intake + research) |
| Photo upload and annotation | Done (regions, inventory direction) |
| Manual measurements and corrections | Done (candidate surveys) |
| Templates and quantity formulas | Done (playbook, deterministic calculators) |
| Structured BOM | Mostly done (material plans; template BOM recipes next) |
| Code references with edition/source | Done (source register, applicability) |
| Adoption/amendment coverage | Targeted (Philadelphia; matches scope) |
| Product compatibility checks | Partial (survey checks; catalog matching is new) |
| Timestamped price comparisons | New: first unbuilt MVP block |
| Shopping list with retailer links | New: follows catalog + offers |
| Contractor review (lightweight) | Partial (decisions exist; contractor side is new) |
| Substitution approval + history | Basic (revisions/invalidation) |
| Shipping/tax/stock comparisons | New |
| External-agent invocation prototype | Done locally (stdio MCP, live-client verified) |
| Team accounts and permissions | Partial (Google/Meta accounts done; roles new) |

## Adapted next backlog (maps to the doc's section 12)

1. Define shared schemas + indexes for `products`, `retailer_offers`,
   `price_observations` (catalog first; jurisdiction/code collections reuse the
   existing source register before being split out).
2. Build the verified catalog importer with dated local observations for one
   Philadelphia project (no live scraping without rights).
3. Deterministic compatibility matching: hard constraints first, priced
   alternatives with rejected-with-reasons output.
4. `purchase-plan` + approval artifacts on the existing versioned model, with
   contractor review endpoints.
5. Replicate the fixture in Austin and San Francisco per the doc's test matrix.
6. Streamable-HTTP MCP transport (unblocks the assessed Muse custom-connector path).

## Open decisions (from the scope doc, with recommendations)

1. **MVP project type:** recommend vanity replacement in Philadelphia — closest
   to the existing half-bath reference and the doc's demo.
2. **Muse distribution:** feasibility assessed (custom connectors via hosted
   Streamable-HTTP MCP); invocation needs the hosted backend. See
   `muse-app-integration.md`.
3. **Retailers and data rights:** unresolved; curated import first, no scraping
   without terms review.
4. **Code-text licensing:** unresolved; citations + authorized excerpts only.
5. **Contractor flow:** unresolved; propose approval links before accounts.
6. **Brand:** decided — Renovagent. Domain/trademark still unverified.
