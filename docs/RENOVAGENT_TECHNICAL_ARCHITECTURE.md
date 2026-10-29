# Renovagent — Technical Architecture, Data Model & Implementation Roadmap

**Status:** Working engineering plan  
**Date:** 2026-10-29  
**Assumed existing infrastructure:** MongoDB; actual deployment stack and integration details to confirm.

## 1. System design

```text
User / standalone UI / external assistant (Muse, if supported)
       |
       v
Project intake API (address, photos, measurements, scope)
       |
       v
Orchestrator / agent with typed tools
       |-----------------------|------------------------|
       v                       v                        v
Jurisdiction + code      Scope + quantity        Catalog + pricing
resolver / retrieval     estimation engine       matching engine
       |                       |                        |
       |-----------------------|------------------------|
                               v
                    Constraint-aware BOM
                               |
                               v
                Approval + purchase-plan service
                               |
                               v
              Shopping lists / retailer links / carts
```

**Design principle:** Use the LLM for interpretation, clarification, and explanation; use deterministic code for arithmetic, constraints, state transitions, and pricing comparisons. Do not treat the model as the authoritative source of code adoption, product specifications, or current prices.

## 2. MongoDB collections

| Collection | Purpose | Key fields |
| --- | --- | --- |
| `jurisdictions` | Applicable governing authorities and boundaries | IDs, geography, jurisdiction type, parent/state, effective dates |
| `code_adoptions` | Which code editions apply to which scope | jurisdiction ID, code family, edition, effective date, amendments, source, verified date |
| `code_provisions` | Structured, citable code rules | source ID, section, edition, text/excerpt rights, topic, applicability, constraints, version |
| `source_documents` | Metadata and authorized searchable text | URL, publisher, license, retrieved date, checksum, document version |
| `project_templates` | Repeatable tasks and BOM recipes | scope, assumptions, formulas, components, required inputs |
| `projects` | Project scope and versioned user state | owner, location, measurements, tasks, assumptions, status |
| `annotations` | Spatial/photo markup | project ID, image ID, geometry, labels, measurement confidence |
| `bom_items` | Project material requirements | project ID, category, quantity, units, specification constraints, approval status |
| `products` | Canonical products/specifications | manufacturer, model, identifiers, dimensions, ratings, certifications |
| `retailer_offers` | Store-specific offer identity | product ID, retailer, SKU, store, URL, fulfillment methods |
| `price_observations` | Immutable timestamped pricing/stock snapshots | offer ID, observed time, amount, currency, stock status, source |
| `purchase_plans` | Candidate/approved shopping orders | project ID, BOM version, chosen offers, totals, status |
| `approvals` | Contractor/client decisions | actor, role, item/version, decision, timestamp, notes |
| `agent_runs` | Reproducibility and QA | input IDs, tool calls, data versions, outputs, errors |

Keep source document metadata separate from code rules; keep canonical product specs separate from location-specific price observations. Use stable IDs and preserve version history.

## 3. Example records (illustrative, not factual code or retail data)

```json
{
  "jurisdiction_id": "example-city",
  "code_family": "IRC",
  "edition": "TO_BE_VERIFIED",
  "effective_from": null,
  "amendment_ids": [],
  "source_url": null,
  "verification_status": "pending"
}
```

```json
{
  "product_id": "example-vanity-001",
  "retailer": "example-retailer",
  "store_zip": "19148",
  "unit_price": 249.00,
  "currency": "USD",
  "observed_at": "2026-10-29T14:00:00Z",
  "stock_status": "unknown",
  "source_type": "example-import",
  "freshness": "historical"
}
```

```json
{
  "project_id": "example-project",
  "item_type": "flooring",
  "quantity": 110,
  "unit": "sq_ft",
  "calculation": {
    "measured_area_sq_ft": 100,
    "waste_factor": 0.10
  },
  "requirements": [
    {"type": "product_compatibility", "status": "pending_review"}
  ],
  "contractor_approval": "pending"
}
```

## 4. Jurisdiction-aware code engine

### Resolution pipeline

1. Geocode a supplied address or accept explicit jurisdiction selection.
2. Resolve the appropriate governing entities (state, city/township, special district where relevant) using authoritative boundary data.
3. Identify the work type, occupancy/use, existing vs. new construction, and other facts needed to select applicable codes.
4. Query a **versioned adoption registry**: adopted code family, edition, state/local amendments, effective date, transition provisions, and source.
5. Retrieve relevant authorized code provisions and amendment text or metadata.
6. Evaluate requirements against measured/project facts; flag unknowns.
7. Emit structured requirements and human-readable explanations with citations.
8. Apply requirements as filters or approval gates in product matching and purchasing.

### Important code-model rules

- Do **not** infer applicable code from county alone; legal authority and local amendments may vary by municipality.
- Do **not** assume IBC 2024 or any newest model edition applies. Residential work may fall under IRC, rehabilitation/existing-building provisions, and separately adopted trade codes.
- Track **effective dates**, code editions, amendments, and source verification dates independently.
- Store provision citations, applicability conditions, exceptions, and provenance. Never manufacture a section number.
- If source/adoption is uncertain, mark the rule `unverified` and require clarification; do not silently fill gaps with generic model knowledge.
- Confirm copyright/licensing and permitted ingestion/reproduction of ICC and other standards before storing or redistributing full text. A citation and limited authorized excerpt may be safer than copying entire copyrighted works.
- Code analysis is decision support, not a substitute for inspections, permitted design documents, or final authority decisions.

### Proposed requirement object

```json
{
  "requirement_id": "req-123",
  "project_id": "project-123",
  "jurisdiction_id": "city-123",
  "code_family": "plumbing",
  "edition": "verified-edition-placeholder",
  "section": "verified-section-placeholder",
  "source_url": "https://example.org/source",
  "applicability": "conditional",
  "conditions": ["fixture configuration must be confirmed"],
  "constraint": {"attribute": "installation_spec", "operator": "review"},
  "verification_status": "needs_site_confirmation",
  "last_checked_at": null
}
```

## 5. Products, compatibility and pricing

### Product matching

Match on **hard constraints first** (dimensions, electrical characteristics, connection types, applicable ratings/listings, installation requirements, required accessories), then optimize soft preferences (finish, brand, appearance, price, lead time). A low-cost product that fails a hard constraint is not a valid substitute.

### Price observation policy

Every price has: retailer, exact SKU/offer, store or fulfillment region, currency, amount, timestamp, source, and availability status. Where possible also track shipping, tax assumptions, pickup eligibility, bulk discounts, and returns. Historical observations are useful for estimates and ranking but **must not be represented as live inventory or guaranteed checkout prices**.

Suggested initial refresh: daily for high-traffic demo SKUs where allowed, weekly for slower-moving products, plus on-demand verification before purchase. Actual cadence depends on permitted API access, rate limits, and observed volatility. Use retailer APIs/feeds or authorized partnerships when possible; validate terms before scraping.

### Pricing comparison

Compare **total delivered project cost**, not just sticker price:

`line_total = unit_price × required_purchase_units + estimated_shipping + estimated_tax + other_known_fees`

Normalize pack sizes and rounding (e.g., flooring boxes, tile cartons), avoid double-counting shipping, and label uncertain fees. Price the full BOM with alternatives and sourcing tradeoffs, not merely the cheapest individual SKU.

## 6. Search and indexing

- MongoDB geospatial indexing for project locations and jurisdiction boundaries, where suitable; authoritative polygon resolution may require specialized geographic data/services.
- Compound indexes on `(jurisdiction_id, code_family, effective_from)` and `(product_id, observed_at)`.
- Text/search or vector retrieval for authorized code passages and project templates; use metadata filters to enforce jurisdiction, edition, and effective date before semantic ranking.
- Structured queries for product specifications, hard compatibility constraints, and offers. **Do not use vector similarity as a substitute for spec matching.**
- Preserve source and model/tool versions in `agent_runs` for regression testing.

## 7. Agent tools / API contracts (proposed)

```text
resolve_jurisdiction(address, project_date, work_type)
get_applicable_codes(jurisdiction_id, project_type, project_date)
retrieve_code_requirements(code_set_ids, task, project_facts)
create_or_update_scope(project_id, user_inputs, annotations)
calculate_bom(project_id, template_id, measurements)
match_products(bom_item_id, hard_constraints, region)
get_offers(product_ids, location, max_age)
compare_purchase_plans(project_id, offer_ids)
request_approval(project_id, item_ids, reviewer)
export_purchase_plan(project_id, format)
```

Return typed JSON with evidence IDs, confidence/verification states, explicit missing inputs, and user-action requirements. External assistant integration (including Muse) is conditional on supported platform capabilities and permissions; do not assume a published integration exists.

## 8. Pilot markets and test matrix

| Market | Geographic test | Data challenge |
| --- | --- | --- |
| Philadelphia | Older rowhouses and residential renovations | City/state code adoption and rehab rules |
| San Francisco | Bay Area urban municipality | California adoption and municipal amendments |
| Los Angeles | Second California jurisdiction | Different municipal rules, local offers |
| Austin | Texas municipal market | Adoption/version differences and product availability |
| New York City | Apartment and dense-building projects | NYC-specific code framework and building restrictions |
| Columbus or Indianapolis | Midwestern contrast | Conventional residential supply and jurisdiction rules |

Select exact municipal boundaries and project addresses before claiming code applicability. One city per metro for the initial registry; expand to neighboring municipalities only after the lookup works.

## 9. MVP milestones

### Phase 0 — Feasibility and data rights
- Confirm exact MVP project type and sample address.
- Verify authoritative code-adoption sources and licensing for one jurisdiction.
- Verify retailer data acquisition rights and SKU matching quality.
- Determine whether Muse supports the intended invocation, auth, and commerce flows.

**Exit criterion:** one lawful, citable code source and one viable pricing feed or authorized catalog import.

### Phase 1 — Philadelphia vertical slice
- Photo upload, manual measurement, and simple annotations.
- One validated project template and deterministic BOM calculator.
- Philadelphia-specific jurisdiction/code retrieval with citations and unknowns.
- Small curated catalog with timestamped local prices.
- Product matching, rejected incompatibilities, shopping-list export.

**Exit criterion:** a real sample project yields a correct, auditable, reviewable materials list.

### Phase 2 — Multi-market demonstration
- Replicate same scope in Austin and San Francisco, then expand to NYC, LA, and a Midwestern city.
- Demonstrate code-adoption differences where verified, location-specific price differences, and dated observations.
- Add contractor review, substitutions, and approval state.

**Exit criterion:** same project produces market-appropriate, traceable plans without invented rules or prices.

### Phase 3 — Commerce and integrations
- Live offer verification and shipping/tax estimation.
- Retailer cart/order handoff where APIs permit.
- External agent callable tools; user identity, permissions, audit logs.
- More project templates, team accounts, and repeatable professional workflows.

**Exit criterion:** end-to-end approved purchase plan with user-controlled checkout.

## 10. Evaluation / regression tests

Create a fixed set of project fixtures and expected outcomes. Test:

1. **Jurisdiction accuracy:** address near a municipal boundary; unknown jurisdiction; changed adoption date.
2. **Code accuracy:** outdated edition, amendment override, irrelevant section, unverifiable citation.
3. **Quantity arithmetic:** odd room dimensions, waste factors, pack rounding, missing measurements.
4. **Compatibility:** wrong voltage, wrong connection size, incompatible accessories, nonmatching dimensions.
5. **Price integrity:** stale observations, missing stock, SKU mismatch, shipping exceeding apparent savings.
6. **Approvals:** contractor rejects an item; substitution triggers reapproval; BOM changes after approval.
7. **Safety of actions:** no purchases, sharing, or external changes without appropriate user authorization.

Log failed cases with the exact project fixture, retrieved source versions, model/tool version, and expected/actual outputs.

## 11. Key engineering risks

- **Data rights:** model-code text and retailer catalogs may require licensing or authorized feeds.
- **Code accuracy:** amendments, rehabilitation rules, special cases, and effective-date transitions are complex.
- **Product normalization:** retailer titles and SKUs may be incomplete or misleading.
- **Inventory volatility:** price and availability vary by store and date.
- **Measurement uncertainty:** photos alone may not supply purchase-grade dimensions.
- **Agent reliability:** plausible explanations must not override deterministic rules or source evidence.
- **Platform dependency:** Muse integration and checkout capabilities must be verified rather than assumed.

## 12. Immediate implementation backlog

1. Choose the first demo project and create a known-correct reference BOM.
2. Define MongoDB schemas and indexes for `jurisdictions`, `code_adoptions`, `code_provisions`, `products`, `retailer_offers`, and `price_observations`.
3. Build an importer for verified jurisdiction/code-adoption metadata.
4. Create a curated product catalog with canonical identifiers and one or more dated local price observations.
5. Implement deterministic quantity and compatibility checks.
6. Add agent tool wrappers with strict JSON contracts and evidence links.
7. Build a simple annotated project UI and purchase-plan export.
8. Run the same fixture in three cities and compare outputs against manually verified references.

---

**Architecture principle:** The model orchestrates; the data sources establish facts; deterministic tools calculate; humans approve consequential purchasing decisions.
