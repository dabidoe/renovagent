# A project service your agent can use

October 29, 2026 · Product proposal, not a claim of implemented integrations.

## The product promise

Turn an uncertain home-improvement idea into a specific, comparable, quote-ready job, then keep that job consistent when the facts change. The durable project record is the product. A homeowner should be able to use a compatible external agent or the website without rebuilding the project context.

The strongest initial deliverable is a job packet someone can actually use: existing conditions, photos, measured quantities, scope boundaries, required investigations, material specifications, exclusions, and a structured contractor response. A half-bath project with unresolved services or dimensions may only be ready for a survey or feasibility quote. Do not manufacture construction readiness to make the demonstration look complete.

## What makes this valuable

1. **A usable scope.** Specific enough to quote, with missing inputs and acceptance criteria visible. Export it and share it without requiring the contractor to join the app.
2. **Comparable offers.** Compare the same specification, quantity, availability, delivery, fees, exclusions, and quote date. Distinguish public prices from the customer's actual account offers. Account eligibility and savings require evidence; do not promise discounts simply for opening an account.
3. **Property memory.** Photos, reported preferences, measurements, past work, decisions, and receipts survive individual conversations. Every important claim has a source and an explicit status.
4. **Changes that carry through.** Correct a dimension or change a finish and show which quantities, scopes, offers, and decisions became stale. Preserve the accepted and physical-work history.

Contractor discovery is only the start. A useful comparison explains relevant work experience, evidence of credentials, date checked, scope fit, exclusions, and unresolved questions. A directory rating alone is not verification.

## An optional web interface

The opening should contain only the brand, current house, prompt, attachment control, and tools menu. Open house context, plans, quotes, and approvals when requested. Photo questions stay accessible through Tools rather than taking over the opening.

Use shared application services behind both web HTTP and external-agent adapters. Agents read bounded project context, request supported jobs, and propose typed changes. They do not directly patch canonical state. The first MCP adapter must use the current repository and revision/authorization rules, not the older demo server. Transport and authentication must be verified with the actual client before claiming Muse or GPT compatibility.

## The demonstration worth building

1. In a normal external-agent conversation, select a saved home and ask for a bounded improvement job.
2. Read existing photos and facts, and ask only for missing information that changes the work.
3. Produce a reviewable scope and traceable materials; keep unsupported technical conclusions blocked.
4. Import a real supplier or contractor quote and compare it with another on matching terms.
5. Change one measured input and show the affected quantities, scope, and quotes becoming stale.
6. Open the website and see exactly the same saved results, sources, and revisions.

This is a target demonstration. External-agent access, real offers, and the complete quote-ready packet are not implemented today.

## Implementation order

| Increment                       | Acceptance evidence                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current-workspace agent adapter | A supported external client reads the same records; a proposal persists in both clients; stale and unauthorized writes fail; retries do not duplicate effects |
| One complete job packet         | Scope and material quantities derive from explicit inputs; missing inputs block the affected output; export retains evidence and revision identity            |
| Real quote comparison           | Two sourced offers normalized to the same specification and units; exclusions and total-cost differences visible; no invented price or savings                |
| Contractor evidence             | Relevant candidates with dated source records and unresolved checks; a specific scope ready for the user to send                                              |
| Hosted customers                | Authenticated owner isolation, authorized media storage, job recovery, and tested account/data boundaries before public customer use                          |

Keep the full lifecycle architecture as the destination. These increments prioritize a demonstrable path through it; they do not replace the existing technical and release gates.

## Validate the value

Proposed pilot: five homeowners preparing real jobs. Track whether a contractor can quote without rewriting the scope, time spent clarifying the job, omitted items found before commitment, and whether the user can explain a price difference from the underlying evidence. Compare with each user's existing process. These are proposed measures, not observed results.

A paid project-preparation packet is an initial business hypothesis. Test willingness to pay for that outcome before building a broad contractor marketplace or adding many agent personas.
