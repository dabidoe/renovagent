# Renovagent — Model Integration & Requirements Intelligence

**Status:** Product/engineering proposal · October 30, 2026  
**Principle:** Local-first renovation workspace; built-in AI for convenience; bring-your-own AI for portability; sourced requirements for credible contractor handoff.

## 1. Product vision

Renovagent converts homeowner intent, photos, measurements, and product selections into a persistent, editable renovation project. Its differentiator is not simply generating attractive designs: it connects proposals to measurable scope, material quantities, cited requirements, open questions, and a contractor-reviewable handoff.

A contractor should receive more than an AI-generated checklist. They should receive **the proposed work, the evidence behind it, which code/permit issues were investigated, what remains uncertain, and what changed since the last revision**. Contractors still make professional decisions; Renovagent reduces repetitive research and coordination work.

## 2. AI access modes

| Mode | User experience | Who pays model costs | Core behavior |
|---|---|---|---|
| Manual/local | Use measurements, room tools, estimates, project editor without AI | No inference costs | Deterministic operations remain available offline where feasible |
| Built-in Renovagent AI | One-click chat, image review, “Does this work?”, “Use this” | Renovagent, recovered through pay-as-you-go (PAUGO) credits | Convenient default; inexpensive model first, escalate selectively |
| Connect AI (MCP) | User connects Muse or another compatible agent | Usually user's AI provider/client, depending on its terms | External agent invokes Renovagent tools against authorized project state |
| Export AI brief | Copy structured prompt + reference images/links for any model | User's chosen model | Portable, but not automatically synchronized back without import or MCP |

**Pricing direction:** Free core and BYO-agent integration; PAUGO metered features in-app, not an obligatory subscription. Avoid charging credits for simple geometry, quantities, viewing, or editing. A possible optional cloud tier can be considered later, separately from usage charges.

**Important limitation:** MCP exposes Renovagent tools to an agent; it does not guarantee the client offers image generation, browsing, or the ability to return generated assets. Document tested client capabilities individually.

## 3. Jev as a low-cost intelligence layer

“Jev” is the working name for the inexpensive model/provider selected by the project; validate its actual supported capabilities and costs before committing to a feature or publishing price claims.

Good Jev tasks:
- Parse conversational renovation requests into structured proposed changes.
- Identify objects, finishes, and *possible* conditions in uploaded photos; distinguish observed vs inferred details.
- Extract relevant facts from retrieved code documents, manufacturer instructions, and product specifications.
- Classify which requirements might apply to a proposed change.
- Compare a design proposal with verified measurements and structured requirements.
- Identify contradictions, missing evidence, and questions for the homeowner or contractor.
- Interpret selection commands (“use option two”) and prepare a proposed project mutation.
- Summarize a revision and draft contractor-facing explanations.

Not Jev's responsibility:
- Invent code citations, legal applicability, dimensions, prices, or approvals.
- Declare structural, electrical, or plumbing work definitively compliant based only on a photograph.
- Authorize construction, purchase products, or silently overwrite approved scope.
- Replace deterministic geometry/quantity calculations or project access controls.

**Control boundary:** Models propose; deterministic tools validate; the user or authorized contractor approves; the project engine commits an auditable revision.

## 4. Requirements intelligence — core differentiator

### Problem

Contractors must keep up with changing adopted codes, local amendments, permit requirements, product installation instructions, and inspection expectations. The burden is fragmented across jurisdictions and trades. Homeowners often arrive with incomplete plans, leaving contractors to discover omissions during quoting or construction.

### Proposed solution

For each work package, Renovagent maintains a **Requirements Review** with:

1. **Jurisdiction context:** property location at appropriate granularity, authority having jurisdiction, project type, building type, and existing-building context.
2. **Source registry:** authoritative code text where accessible, official amendments, permit guidance, manufacturer instructions, and source URLs/documents.
3. **Applicability analysis:** why a requirement may apply, or why it may not; model-generated interpretations labeled as such.
4. **Evidence matching:** measurements, photos, selected products, drawings, and inspection documents tied to individual requirements.
5. **Finding status:** `verified_against_recorded_evidence`, `potential_conflict`, `needs_measurement`, `needs_source_verification`, `not_applicable_with_reason`, `contractor_review_required`, `authority_confirmation_required`.
6. **Change impact:** invalidate affected findings when dimensions, location, fixture selection, or scope changes.
7. **Contractor handoff:** a concise list of findings, citations, assumptions, unresolved questions, and required decisions.

**Never call a design “code approved” merely because a model reviewed it.** The product can say “passes recorded dimensional check against cited rule” when supported; official compliance and permits are separate statuses.

### Source discipline

- Prefer primary sources: official jurisdiction websites, adopted code references, published amendments, permit offices, and manufacturer instructions.
- Record **edition, effective/adoption date where known, section, URL, retrieval date, and source excerpt or anchored reference**.
- If full copyrighted code text is inaccessible, store a reference and a limited, attributed summary; do not fabricate text or imply full coverage.
- Explicitly mark unknown local amendments, exceptions, and applicability questions.
- A model's answer is **not itself a code source**.
- Recheck time-sensitive requirements before contractor handoff; cache intelligently but retain provenance.

## 5. “Does this work?” review workflow

Example: homeowner uploads a closet photo and proposes converting it into a powder room.

1. Read project geometry, existing observations, selections, jurisdiction, and current scope.
2. Retrieve previously verified requirements and identify gaps needing new research.
3. Run deterministic checks first (known fixture clearances, area, collision, dependencies).
4. Ask Jev to compare the proposal and evidence with sourced requirements; require structured findings and source IDs.
5. Present three categories: **passes known checks**, **potential conflicts**, **unresolved / measure or confirm**.
6. Offer actionable next steps: measure, change design, choose a product, ask contractor, or request authority confirmation.
7. On “Select this,” show the scope/material/requirement changes and request approval before committing.
8. Save review results and invalidate only affected checks when the project changes.

## 6. Contractor handoff package

The handoff should include:

- Project overview, location/jurisdiction, and scope version/date.
- Work packages by trade, sequencing, assumptions, exclusions, and dependencies.
- Dimensioned room geometry and provenance of measurements.
- Photos, selected designs, products, quantities, and dated price assumptions.
- **Requirements register**: source citations, applicability rationale, review status, and outstanding permit/inspection questions.
- “Contractor must verify” checklist ranked by impact (e.g., hidden conditions, utility capacity, clearances, drainage, structural changes).
- Decisions needed, open questions, and change log.
- Contractor response fields: confirm, correct, substitute, price, flag conflict, request site measurement.

**Value proposition:** less time rebuilding homeowner intent, researching repeat questions, and discovering quote-changing unknowns. Do not market it as guaranteed permit approval or a replacement for contractor judgment.

## 7. Technical architecture

```text
Renovagent browser / future mobile app
  ├─ Local project editor, room geometry, calculations, offline storage
  ├─ Built-in AI interface (PAUGO)
  └─ Connect AI / export brief
                │
         Renovagent API + MCP (Railway candidate)
          ├─ Authentication, per-project authorization
          ├─ Project CRUD, optimistic revision checks
          ├─ Tool execution, approval gates, audit events
          ├─ AI routing: Jev → stronger model only when needed
          ├─ Requirements source registry / retrieval / review
          └─ Usage metering, budget ceilings, rate limits
                │
          ├─ MongoDB: projects, users, revisions, findings
          └─ Bunny Storage/CDN: images, scans, renders, exports
```

- **Railway:** reasonable candidate to host existing Node API and remote HTTPS MCP server; verify deployment, persistence, environment secrets, request timeouts, and cost on the actual service.
- **MongoDB free tier:** suitable for early structured project data, not an unlimited media archive; add ownership indexes and versioned mutations.
- **Bunny:** use object storage for large assets, CDN for delivery; confirm Bunny Storage is actually enabled (CDN alone is not storage).
- **Browser:** keep geometry, takeoffs, and other deterministic operations local where practical.
- **Security:** no provider API keys in frontend; validate every MCP/API project access; signed asset URLs or appropriate access policy; protect user property photos and addresses; rate-limit public endpoints.

## 8. Suggested data contracts

```json
{
  "requirementFindingId": "rf_123",
  "projectId": "proj_123",
  "scopeRevision": 7,
  "workPackageId": "bathroom_ventilation",
  "jurisdiction": {"name": "unverified", "codeEdition": null},
  "source": {
    "kind": "official_guidance",
    "url": null,
    "section": null,
    "retrievedAt": null,
    "verificationStatus": "not_yet_verified"
  },
  "finding": {
    "status": "needs_source_verification",
    "summary": "Confirm applicable ventilation requirements",
    "evidenceIds": ["photo_4"],
    "unknowns": ["Exhaust route not recorded"]
  },
  "modelAssessment": {
    "provider": "jev",
    "modelVersion": "record_actual_version",
    "isInterpretation": true
  },
  "review": {"approvedBy": null, "approvedAt": null}
}
```

Useful tool operations (adapt to existing MCP names rather than duplicating them):

- `get_project_context(projectId)`
- `get_requirement_sources(jurisdiction, workType)`
- `review_design_against_requirements(projectId, revisionId)`
- `list_unresolved_requirements(projectId)`
- `propose_project_change(projectId, change)`
- `approve_project_change(projectId, proposalId)`
- `export_contractor_handoff(projectId, revisionId)`

## 9. Model routing and cost control

- Free deterministic operations never call a model.
- Run small-model interpretation only on relevant user actions or changed dependencies.
- Cache requirement retrieval by jurisdiction, edition, source revision, and work category.
- Cache assessments by project revision + relevant evidence/source hashes; invalidate narrowly.
- Escalate for ambiguity or higher-impact questions; do not silently retry expensive calls indefinitely.
- Charge PAUGO credits for actual hosted AI operations; show cost or estimated credit usage before costly generation.
- Allow BYO-agent MCP workflows without charging Renovagent inference credits (cloud storage or premium services may have separate policies).
- Record latency, tokens, cost, failures, correction rates, and human overrides; optimize for **accurate useful findings per dollar**, not cheapest token alone.

## 10. Connect AI page

**Navigation label:** Connect AI  
**Suggested route:** `/connect`  
**Technical docs:** `/docs/mcp`  
**Candidate endpoint:** `/api/mcp`

Headline: **Your renovation. Your AI.**

Show Muse prominently for the hackathon. Provide tested connection instructions for each supported client, a copyable remote endpoint/configuration, available tool capabilities, authentication requirements, and a prompt export with reference images for non-MCP clients. Mark untested clients as unverified; don't promise identical image/search/write capabilities across providers.

## 11. Roadmap / priorities

### Now — hackathon

1. Keep the current Muse integration demonstrable and prominent.
2. Finish the homeowner → editable project → requirements/open questions → contractor handoff journey.
3. Add a lightweight “Does this work?” review backed by existing evidence and **real citations**; otherwise return unknowns.
4. Make “Use this option” propose a revision and require user approval.
5. Document the architecture and demo with explicit shipped-vs-planned status.

### Next — early public product

1. Deploy API/MCP on Railway or comparable hosting; connect MongoDB and Bunny Storage.
2. Add secure accounts, project ownership, private media, and revision-safe synchronization.
3. Build `/connect` with Muse, additional tested MCP clients, and prompt export.
4. Implement PAUGO credit metering and server-side cost ceilings for built-in AI.
5. Add contractor comments, corrections, and handoff review states.

### Later — defensibility

1. Jurisdiction-aware, continuously maintained requirements source registry.
2. Better source freshness checks, impact-aware invalidation, and contractor feedback loops.
3. Parametric Room Studio and optional splat/scan reference layers.
4. Broader catalog integrations, shared projects, and optional paid cloud conveniences.

## 12. Success metrics

- Percentage of projects that reach a useful, shareable contractor handoff.
- Number of source-backed findings versus unsupported assertions.
- Reduction in unanswered contractor questions after handoff.
- Rate of model findings corrected by humans.
- Cost per successful scope review and per active project.
- Repeat project editing, handoff sharing, and contractor return usage.

---

**Positioning:** *Renovagent is the renovation workspace that turns ideas into buildable, reviewable projects. AI helps interpret the work; sourced requirements, measurable geometry, and human approvals keep the project grounded.*
