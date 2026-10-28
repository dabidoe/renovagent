# Agent execution, knowledge, and recovery

## Coordinator and specialists

Dwang is the user-facing coordinator. It interprets intent, identifies the next decision, creates bounded jobs, reconciles specialist findings, and explains the resulting changes. The coordinator is a persisted workflow, not one unlimited prompt.

Specialists share the same project snapshot and artifact/input revisions. Start with design/spatial planning, plumbing, and electrical; use a technical-source review capability across relevant jobs. Add other specialties only when a playbook needs them. A crew meeting is a structured review of a named scope revision; its useful output is reconciled findings/proposed changes, not character dialogue.

A specialist returns:

```text
scope and input revision
facts consulted + source/evidence references
findings (severity, applicability, affected decisions/tasks)
checks performed and calculations referenced
missing inputs and why they matter
proposed artifact/command payloads
limitations and required reviewer roles
```

Agents can disagree. Preserve conflicting findings, show their bases, and route unresolved contradictions to a decision or qualified review. Voting or averaging confidence does not resolve technical incompatibility.

## Work request contract

A work request names its goal, permitted capabilities, exact input refs, deliverable schema, success criteria, resource limits, and any reviewer requirements. Example: “Compare two fixture placements using this measured layout; identify missing inputs for clearances and drain feasibility; produce an option comparison, not an approved construction drawing.”

Before execution, check required inputs and knowledge coverage. A half-bath playbook can request a measured observation before dispatching analysis. A missing building classification must not be patched with a plausible default to make a tool call succeed.

## Durable run lifecycle

States: `queued`, `running`, `waiting_for_input`, `waiting_for_approval`, `succeeded`, `failed`, `cancel_requested`, `cancelled`.

Persist each step:

1. Authorize the originating command and capture immutable input refs.
2. Select a versioned playbook and determine a bounded work plan.
3. Retrieve permitted project context and technical sources.
4. Dispatch appropriate specialist jobs, with bounded parallelism only when independent.
5. Validate structured results, citation/evidence resolution, units, and artifact references.
6. Reconcile findings and calculate changes through deterministic tools.
7. Check that the input revision remains current. A late result may be retained as stale evidence but cannot become the current plan or release tasks.
8. Commit proposals/events through the command handler; pause for required input or approval.
9. On decision, revalidate revisions/permissions and continue from the checkpoint.
10. Mark succeeded only when the promised deliverable is persisted and queryable.

Store attempts, lease/checkpoint, tool call IDs, provider/model configuration, prompt/playbook versions, input hash, usage/cost, deadlines, cancellation intent, and error category. Do not store model hidden reasoning; store observable tool actions, concise rationale, evidence, and outputs needed to inspect the work.

### Failures and retries

| Failure | Required behavior |
|---|---|
| Provider timeout/rate limit | Bounded backoff under run budget; show pending/retry state; no duplicate project mutation |
| Invalid structured output | One bounded repair attempt using validation errors, then fail with actionable detail |
| Tool unavailable | Persist unavailable result, identify affected deliverable, offer retry or evidence entry |
| Missing/conflicting evidence | Wait for a specific input; do not manufacture a fact |
| Worker crash | Lease expires; another worker resumes from durable checkpoint; invocation/command dedupe prevents repeated effects |
| Input changed during run | Preserve result as stale; derive fresh work request or ask user to resolve changes |
| Cancellation | Stop dispatch, cancel provider calls where supported, preserve completed evidence; do not imply already-completed external effects were rolled back |
| Partial specialist success | Preserve findings and show missing coverage; do not label the whole technical review complete |

Configure finite per-job tool-call, wall-time, token/cost, and repair budgets. Limits and cancellation are enforced by runtime policy, not prompt instructions alone. Tune limits from observed reference scenarios before allowing unattended runs.

## Tool authority

Tools are narrow application operations: read project context, request source retrieval, run a unit-safe calculation, propose an artifact, ask for evidence, and submit a typed command. Tools do not expose unrestricted database writes, arbitrary shell execution, or secrets.

Every tool call is authorized against the run's project scope and capabilities. Tool output is validated and persisted before the model consumes it. Documents, search results, photos/OCR, and contractor submissions are untrusted data; instructions embedded in them do not grant permissions or replace tool policy.

Internal reversible proposals can be created automatically. Accepting changed scope/cost, releasing work, and recording completion follow domain rules. Purchases, contractor outreach, permit submissions, and other external commitments require explicit user authorization for the action. No current UI or architectural plan grants standing permission for these integrations.

## Technical knowledge pipeline

A good answer needs a traceable chain:

**Jurisdiction and project classification → adopted code basis → exact source provision and amendments → applicability/exception analysis → project input evidence → calculation or interpretation → conclusion and affected work.**

Separate these records:

1. **Adoption source:** authority, geography, editions, effective dates, transition rules, amendments, and exceptions. The existing Philadelphia reference is only this first layer.
2. **Source provision:** licensed/permitted source content, edition, section/table, stable locator, retrieved date, revision/hash, and access/use limits.
3. **Applicable requirement:** why the provision applies to this building/work scope and which exceptions have been examined. It may remain unresolved.
4. **Project check:** exact required inputs, evaluation method, result, and supporting calculations/review.

Retrieval alone cannot make a requirement applicable. A source that mentions a number does not authorize applying it to a different occupancy, edition, alteration path, fixture, or local amendment regime.

### Retrieval strategy

- Begin with a small reviewed source set for the reference jurisdiction/project scope. Use exact metadata lookup and primary-source retrieval before introducing semantic search.
- Store the authority and adoption evidence separately from publisher model-code content. Review local/state amendments, effective dates, and transition/accessibility exceptions.
- Prefer exact edition/section retrieval; supplemental semantic search proposes candidates for review rather than authoritative answers.
- Retain permitted snapshots or hashes/locators sufficient to reproduce the basis. Respect publisher licensing and quotation limits; do not assume unrestricted full-code ingestion rights.
- Fetch failures, paywalls, ambiguous amendments, and insufficient coverage are explicit unresolved states. Use a licensed source integration or professional review where necessary; do not substitute remembered model prose.
- Source changes mark dependent applicability findings/checks for review. Refresh schedules are defined by source type; record `retrievedAt`, `reviewedAt`, and applicable effective dates.
- Code citations shown in the UI open the actual supporting source/section and the applicability rationale, not just a publisher home page.

The initial reviewed coverage matrix lists building classification, fixture geometry, drainage/venting, electrical, exhaust, permits, and inspection sequencing. Every topic is `covered`, `partial`, or `unavailable`, with scope and reviewer. The workflow cannot claim comprehensive technical review while a required topic is unavailable.

## Models, calculations, and review

Use a provider-neutral structured-output adapter, initially implemented for one provider. Select the provider/model against the evaluation set and current hackathon constraints when integration begins; do not bake an untested model name into the domain.

Models are useful for extracting proposed facts, asking targeted questions, retrieving/interpreting sources, comparing options, and generating proposed plans. Deterministic functions handle unit conversion, geometry calculations within declared assumptions, quantities/package rounding, estimate totals, dependency validation, readiness, and invalidation.

A supported check states exactly what was checked. A successful fixture-clearance check is not an overall finding that a bathroom is feasible or compliant. Technical methods outside curated coverage remain unresolved and route to the appropriate reviewer.

## Evaluation and observability

Use a versioned, sanitized scenario set with expected supported behavior and explicit unacceptable outcomes. Include ambiguous building type, obsolete edition, missing local amendment, unknown concealed system, conflicting measurements, unsupported layout, evidence in the wrong unit, and instructions embedded in a retrieved document.

Record source resolution, fact/quantity correctness, unsupported claims, missing-input handling, invalidation correctness, task release errors, completion evidence, retries, latency, and cost. Prompt/model changes run the same evaluations. A qualified domain reviewer defines the technical gold set and release threshold before real technical conclusions are presented as reviewed.

Every user-visible output links to its run and input/source basis. Operational logs carry correlation IDs and bounded redacted metadata; private room photos, addresses, credentials, and full user documents are not dumped into logs by default. Attachments and exports follow the same owner isolation as project queries.
