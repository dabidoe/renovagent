# ADR 0001 — Shared domain, bounded agents, incremental delivery

Status: selected planning defaults; no migration executed
Date: October 26, 2026

## Context

The current repo contains a Vite/vanilla-JS frontend and Node/Express/TypeScript/MongoDB scaffolding. It has no real model workflow, versioned project artifacts, structured code applicability, or execution evidence model. The original broad product plan remains useful, but its ten-day checklist credited isolated demo features as complete. A frontend reskin and intake brief did not establish the end-to-end product.

## Decisions and reasons

| Decision | Reason | Revisit when |
|---|---|---|
| Vite + React + TypeScript target workspace | Existing frontend toolchain is reusable; artifact views and coordinated state need component boundaries and typed contracts. No current requirement justifies a framework/server-rendering rewrite | Concrete SEO/server-rendering or deployment requirements appear |
| Node/Express modular monolith, MongoDB metadata | Reuse current investment and keep a single domain/command authority. Avoid introducing distributed service boundaries before the workflow is validated | Measured scaling/isolation needs demand a split, or data/query constraints justify a different store |
| Two apps plus contracts/core packages | Share validation and domain math while preventing UI/database/provider coupling | Enforced boundaries become too broad for independent ownership or release |
| IndexedDB local adapter and explicit fixture runner | Build durable user workflows without credentials/backend; avoid base64 media in localStorage and fake “AI” progress | Connected use is ready; keep fixtures as deterministic test adapters |
| Snapshot + audit events; optimistic revisions | Enables history, invalidation, safe retries, and resumable work without full event-sourcing complexity | Historical replay or multi-aggregate workflows prove a need for more |
| Persisted coordinator + bounded specialists | Makes work observable/recoverable; specialists cannot bypass state validation | Evaluation proves another orchestration approach materially improves outcomes |
| Curated technical coverage before broad retrieval | A small reviewed workflow is more defensible than unsupported nationwide code claims | Sourcing, licensing, applicability evaluations, and review capacity support expansion |
| Single provider adapter first | Domain stays provider-neutral while implementation/evaluation stays tractable | Quality, modality, budget, or hackathon constraints justify a second provider |
| Poll run state first; streaming later | Durable state is the reliability foundation; a transport change should not reshape the domain | Latency/interaction measurements justify resumable SSE |

## Explicit non-decisions

- No claim that existing server scaffolding is production ready.
- No model/provider selection until current access, requirements, cost, and evaluations are known.
- No commitment to a nationwide code corpus, unlicensed publisher ingestion, or a particular vector/search service.
- No workflow vendor, message broker, payment, contractor communications, or permit integration selected yet.
- No promise that a photo establishes hidden conditions or that a generated plan has professional/authority approval.

## Questions to resolve at their implementation gate

These do not block local Slice 1:

| Question | Required by | Default until resolved |
|---|---|---|
| Exact reference-project building/scope and technical reviewer | Slice 3 technical fixture acceptance | Clearly labeled synthetic project; no reviewed compliance conclusion |
| Permitted primary-source access and licensing | Slice 3–4 knowledge integration | Links/metadata and permitted curated excerpts; uncovered provisions stay unavailable |
| Model provider, modality, structured output, run budgets | Slice 4 | Fixture adapter; no model claims |
| Hosting, Mongo transaction support, private object storage | Slice 4 connected persistence | Local repositories only; no hidden external fallback |
| Workspace roles/collaboration and sharing | Before any shared-user release | Single owner; no implicit contractor or household access |
| Privacy, retention, deletion, backup/export and restore policy | Before live user documents/accounts | Local-only demo with export; production policy must be explicit |
| Live catalog, contractor verification, scheduling integrations | Slice 5 | User-supplied evidence and export; no automated external commitments |

## Consequences

The next changes must establish domain/state correctness before expanding the UI's claims. Some existing demo math, code snippets, and task completion shortcuts will be replaced. This is intentional: reusing a visual component is cheap; preserving an unsupported assumption as domain truth is expensive.

The broad workflow remains the product. The first technical playbook is narrow enough to evaluate, but the property/artifact/run model must support a different home improvement project without a new architecture.
