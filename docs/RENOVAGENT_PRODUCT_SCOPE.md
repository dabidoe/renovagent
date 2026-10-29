# Renovagent — Product Vision, Features & Scope

**Status:** Working product specification  
**Date:** 2026-10-29  
**Working name:** Renovagent (preferred spelling; not RenovAgent or Reno-agent)  
**Former concept/name:** Unpermitted AI

## 1. Executive summary

Renovagent is an AI renovation planning and procurement agent for homeowners, apartment dwellers, contractors, homebuilders, and property investors/managers. It helps people turn a physical space and a renovation objective into an annotated project plan, a defensible bill of materials, relevant jurisdiction-specific code references, product recommendations, pricing comparisons, and reviewable purchase orders or shopping carts.

**Core promise:** Save time, money, and avoidable purchasing mistakes. Make it possible for the person paying for materials to shop and order them without creating extra work for the person installing them.

**Positioning:** Renovagent is **not** primarily an AI interior-design image generator, a generic construction chatbot, or a tool for circumventing permits. It is a location-aware renovation intelligence and procurement workflow that can operate standalone or as a callable agent through external AI experiences, potentially including Meta's Muse ecosystem (integration feasibility and requirements to be validated).

**Possible messaging:**
- **From renovation idea to ready-to-order.**
- Scan, plan, price, and shop your renovation.
- Build the right materials list before you buy.

## 2. The problem

A renovation splits responsibilities among the homeowner or client, the contractor or installer, and suppliers. The person paying wants to compare prices and buy materials directly. The installer needs products with the right dimensions, compatibility, ratings, and code suitability. The gap creates wasted sourcing time, unnecessary markups or procurement labor, wrong purchases, returns, delays, and disputes.

The product should demonstrate a concrete economic result: fewer purchasing errors, fewer back-and-forth messages, faster material specification and sourcing, and transparent delivered costs. **Avoid asserting unverified savings percentages.**

## 3. Users and jobs to be done

| User | Primary job | Key constraints |
| --- | --- | --- |
| Homeowner | Understand scope and buy suitable materials affordably | Limited construction knowledge; wants installer confidence |
| Contractor / tradesperson | Specify and approve materials without becoming a full-time shopper | Compatibility, code, timing, installability |
| Property investor / manager | Standardize and price repeat renovations across properties | Budget, consistency, procurement and schedule |
| Homebuilder | Translate plans/specifications into purchasable components | Scale, trade coordination, quantity precision |
| Apartment dweller | Plan allowable upgrades or repairs | Landlord/HOA approval, building rules, reversibility |

Initial wedge: **homeowner-funded purchasing with contractor review**. It creates an immediate two-sided reason to use the product.

## 4. Primary workflow

1. **Capture:** User enters an address or jurisdiction and project goal; uploads photos, scans, sketches, or dimensions.
2. **Annotate:** Mark walls, fixtures, measurements, constraints, and work areas; correct AI assumptions.
3. **Scope:** Agent proposes tasks, dependencies, quantities, waste allowances, and missing information.
4. **Check requirements:** Determine applicable jurisdiction/code framework; retrieve relevant provisions, manufacturer constraints, and permit questions.
5. **Specify:** Produce material requirements and identify compatibility-critical attributes.
6. **Shop:** Match products to specifications, compare sourced prices, shipping, availability, and substitutions.
7. **Review:** Homeowner and contractor review, edit, approve, or lock line items and substitutions.
8. **Purchase:** Build retailer carts, shareable shopping lists, or purchase orders; require user authorization for purchases.
9. **Track:** Preserve project versions, sourcing decisions, approvals, and eventual substitutions.

The output is not merely a list of suggested products; it is a **reviewable, traceable purchasing plan**.

## 5. Feature inventory and priorities

| Capability | MVP demo | Pilot / next | Later |
| --- | :---: | :---: | :---: |
| Natural-language project intake | ✓ | | |
| Address/jurisdiction selection | ✓ | | |
| Photo upload and basic annotation | ✓ | | |
| Manual measurements and corrections | ✓ | | |
| Automatic room measurement from scans | | ✓ | |
| Reusable project templates and deterministic quantity formulas | ✓ | | |
| Structured bill of materials (BOM) | ✓ | | |
| Relevant code references with edition/source | ✓ | | |
| State/local adoption and amendment coverage | Targeted | Expand | Nationwide |
| Product compatibility checks | ✓ | | |
| Timestamped retailer price comparisons | ✓ | | |
| Shopping list with retailer links | ✓ | | |
| Contractor review/approval workflow | Lightweight | Full collaboration | |
| Substitution approval and change history | Basic | Full | |
| Shipping, taxes, stock, and delivered-cost comparisons | Basic where verified | ✓ | |
| Multi-retailer cart creation / checkout integrations | | ✓ | |
| External-agent invocation (Muse or other) | Prototype if supported | ✓ | |
| Automated purchasing | | | Only with explicit user authorization |
| Contractor/team accounts, permissions, and job management | | ✓ | |
| Scheduling, contractor bidding, and full construction PM | | | ✓ |

**MVP does not promise:** guaranteed code compliance, certified plans, exact pricing from stale observations, universal product compatibility, automated permitting, or completed purchases without authorization.

## 6. Code-aware shopping: intended experience

Example user request: “I'm replacing my bathroom vanity. My contractor says I can buy the materials. Figure out what I need, flag any code or compatibility issues, and find good prices.”

The agent should:
- Resolve the project location and identify the adopted code editions relevant to the work. **Do not assume the newest model code is adopted.**
- Determine whether IRC, IBC, existing-building/rehabilitation, plumbing, electrical, mechanical, energy, accessibility, and local rules are relevant to this project; IBC alone is not enough for residential work.
- Explain *which* rule matters, *why*, and link to the source, edition, section, and effective date when available.
- Distinguish verified code requirements, inferred applicability, unknown site conditions, and recommendations.
- Convert applicable constraints into procurement filters and approval questions.
- Allow contractor confirmation and local-authority verification for uncertain conditions.

**Trust model:** “According to [source/section] for [jurisdiction/edition], this requirement appears applicable; verify final specifications and installation with your contractor or local authority.” Keep cautions contextual, especially at approval/purchase, rather than cluttering every response.

## 7. External agent / Muse distribution

**Hypothesis, not confirmed integration:** A user could invoke Renovagent from a broader assistant experience (such as Muse) without opening a separate renovation app. Renovagent acts as a specialized service for scope generation, code-aware materials specification, price comparison, and order preparation.

Potential callable capabilities:
- `resolve_jurisdiction(address, project_type)`
- `create_project_scope(project_input)`
- `estimate_materials(project_id)`
- `check_requirements(project_id)`
- `find_compatible_products(bom_item_id, location)`
- `compare_offers(product_ids, fulfillment_location)`
- `build_purchase_plan(project_id)`
- `request_contractor_approval(project_id)`

These are **proposed interface concepts**, not claims about Muse's available APIs. Validate platform integration, permissions, user identity, data access, checkout support, and commercial terms.

## 8. Geographic pilot and demo plan

Proposed market coverage:
- San Francisco Bay Area (pick an exact city for adoption; test municipal variation)
- Austin, Texas
- New York City
- Los Angeles
- Philadelphia
- One smaller Midwestern market (e.g., Columbus, OH, or Indianapolis, IN)

Start with one complete workflow in **Philadelphia**, then test the same project across three markets and ultimately six. The jurisdiction is the municipality or other legally applicable authority—not simply the county or metro area.

**Strong demo:** Same 100-sq-ft bathroom flooring or vanity project in Philadelphia, Austin, and San Francisco. Show (a) location-specific code retrieval, (b) transparent quantity calculations, (c) different local offers/delivered prices, (d) an incompatible product rejected with reasons, and (e) a contractor-reviewable purchase list.

## 9. Success criteria and evaluation

- **BOM completeness:** required components present, with missing measurements explicitly flagged.
- **Quantity accuracy:** calculations match independently checked project fixtures and tolerances.
- **Code traceability:** each claimed requirement cites the applicable jurisdiction, edition, provision, and source; no fabricated citations.
- **Compatibility:** reject known-incompatible products and explain why.
- **Price integrity:** every displayed offer has retailer, location, observation time, and freshness status.
- **Purchasing readiness:** clear approved vs. pending items, delivery considerations, and explicit user authorization.
- **Value:** measure minutes saved, number of clarification cycles, prevented bad purchases, and actual total delivered-cost differences against a manual baseline.

## 10. Decisions still open

1. Exact MVP project type: vanity replacement, flooring, or another narrow workflow.
2. Muse integration feasibility and whether Renovagent is invoked externally, embedded, or both.
3. Initial retailers, lawful data access methods, and affiliate/transaction economics.
4. Source/licensing strategy for ICC and other code materials.
5. Minimum contractor approval flow and whether a contractor account is needed for the demo.
6. Brand/domain/trademark availability for **Renovagent** (not yet verified).

---

**Product principle:** Make the *right* materials easier to specify, compare, approve, and purchase—not merely cheaper to find.
