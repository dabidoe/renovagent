# Domain record and command contracts

## Canonical records

Use stable opaque IDs and explicit `schemaVersion` on persisted documents. Every entity belongs to an authorized property/project scope. A property owns spaces and system observations; a project references affected spaces and systems. Shared physical facts are not copied into each project as independently editable truths.

| Record | Essential fields and semantics |
|---|---|
| Property | ID, owner/workspace, address/jurisdiction references, spaces, known building use, document links |
| Space | Property ID, floor/room identity, current use, measured geometry references; projects may affect several spaces |
| System | Property ID, type, components/routes/connections, observation facts, inspection/document references |
| Project | Property ID, affected space/system IDs, goal/scope, lifecycle focus, revision, selected option, playbook/version, status |
| Fact | Subject/key, typed value, unit where relevant, evidence IDs, assertion status, verification record, supersession history |
| Evidence | Original source reference, source type, author/capture/retrieval time, attachment/document locator, allowed use, version/hash |
| Conversation | Project ID, messages referencing fact proposals, commands, runs, and artifacts; conversation is not the canonical plan |
| Decision | Question, candidate alternatives, selected alternative, affected artifact revisions, actor, rationale, acceptance/rejection time |
| Artifact | ID, kind, revision, lifecycle state, schema version, typed payload, input refs, evidence refs, producer/run, freshness |
| Requirement | Jurisdiction/code basis, edition, section/table, source revision, paraphrase, applicability and exceptions, required inputs |
| Check | Requirement/method references, typed input refs, result, calculation trace, limitations, reviewer where required |
| Task | Scope/trade, dependency IDs, release conditions, completion criteria, materials/tools, assignments, evidence refs |
| Material requirement | Task/option refs, normalized specification, quantity/unit, allowance basis, compatibility constraints |
| Estimate | Selected scope revision, price sources and timestamps, currency, cost lines, allowances/exclusions, low/expected/high where supported |
| Permit / inspection | Authority, scope, application/permit reference, lifecycle status, scheduled event, result evidence, applicable task gates |
| Procurement | Approved requirement revisions, compatible item offers, package arithmetic, order/delivery/receipt and actual consumption records |
| Contractor / quote | User-provided identity, credential evidence, quote source, normalized scope inclusions/exclusions, assignments |
| Issue / change | Site discovery, affected facts/work, severity, containment task, proposed resolution, accepted change revision |
| Run / tool invocation | Scope, initiating command, input revision, checkpoint, state, attempt, dedupe key, trace, resource limits |

Do not model everything as an untyped `content` blob. Use discriminated artifact payload schemas such as `option-comparison`, `measured-layout`, `technical-check`, `task-plan`, `material-plan`, `estimate`, `quote-comparison`, `inspection-record`, and `handover-pack`.

## Facts and evidence

A measurement should resemble:

```json
{
  "id": "fact-room-width",
  "subjectId": "space-first-floor-room",
  "key": "finishedWidth",
  "value": { "kind": "quantity", "amount": 1219.2, "unit": "mm" },
  "assertion": "user_reported",
  "evidenceIds": ["evidence-user-message-17"],
  "verification": null,
  "revision": 1,
  "supersedes": null
}
```

Normalize calculable dimensions into explicit canonical units; retain original value/unit/display and measurement method in evidence. Do not treat a stated rough room dimension as finished-wall geometry. Units and allowed conversions are validated by dimension, not by string similarity.

Fact assertion states: `unknown`, `user_reported`, `observed`, `assumed`, `derived`. Verification is a separate object containing verifier role/identity, date, method, evidence, and limitations. A model's confidence score does not make a fact verified. Conflicting observations remain visible until resolved by a decision; no last-message-wins replacement of physical truth.

Source facts have independent revisions. Derived facts and artifacts declare exact input versions. A displayed value must retain the path back to its supporting message, measurement, document, or calculation.

## Artifact state and invalidation

Use separate axes:

- Content lifecycle: `draft`, `proposed`, `accepted`, `superseded`.
- Freshness: `current`, `stale`, `invalid`.
- Check result: `not_evaluated`, `needs_input`, `supported`, `not_supported`, `needs_review`.

`Accepted` means the relevant user/reviewer accepted that revision. It never means that all code requirements are met. Content can be accepted and later stale. A stale check cannot release dependent work.

Each artifact lists `inputRefs: [{kind, id, revision}]`, evidence IDs, and the producing algorithm/playbook/model/prompt version where relevant. Maintain a reverse dependency index.

On change:

1. Validate the new fact/decision and commit a new revision; preserve prior history.
2. Traverse direct and transitive dependents of the changed input.
3. Mark directly affected project outputs stale and recompute release eligibility in the same logical commit. For shared property facts, every release/acceptance evaluates current input revisions, even if cross-project cached read models rebuild asynchronously. No stale plan remains actionable between mutation and background recomputation.
4. Queue deterministic recalculation first; queue bounded interpretation/review work only where needed.
5. Produce proposed replacements with a before/after impact summary.
6. Require renewed acceptance where the accepted scope, cost, method, or task release conditions changed.

Never rewrite an old approved artifact in place. Completed physical work and inspection records remain historical facts. If changed conditions undermine them, open an issue/reinspection/remediation decision rather than pretending the work never happened.

## Task release and completion

Separate physical progress (`not_started`, `in_progress`, `completion_reported`, `completed`) from computed readiness (`ready`, `blocked`, `needs_review`).

A task is ready only if:

- Required predecessor acceptance/completion conditions are satisfied.
- Referenced plan/check revisions are current and appropriately accepted/reviewed.
- Required decisions, permit/inspection gates, and resource conditions are satisfied.
- No unresolved issue explicitly blocks that work.

Completion is a command with acceptance evidence, not a checkbox directly setting `done`. A recorded inspection must distinguish requested, scheduled, passed, failed, and canceled; scheduling alone cannot satisfy a passed-inspection gate. The authority's actual outcome is supported by a record, not a specialist's inferred approval.

Reject cycles, missing dependency IDs, incompatible units, duplicate incompatible material specifications, and unsupported numerical conclusions before publishing a plan.

## Commands, queries, and events

All writes enter through commands. Use a runtime schema for each discriminated payload; TypeScript types alone cannot validate tool or network input.

```ts
// Target shape; the runtime implementation belongs in packages/contracts.
type CommandEnvelope<T> = {
  commandId: string;               // stable across retries
  projectId: string;
  baseRevision: number;            // optimistic concurrency
  type: string;                   // discriminated by runtime schema
  payload: T;
};
```

Actor/owner identity and capabilities come from the trusted execution context, not a client/model-supplied `actorId`. Property-level edits include a property revision precondition. Commands involving shared facts validate all relevant revision preconditions. Publication/release commits must fence those versions atomically with the write; a prior read followed by an unguarded write is insufficient.

Initial command vocabulary:

| Command | Effect |
|---|---|
| `CreateProject` | Link a goal/scope to a property/spaces; start with unknown facts |
| `RecordFact` / `ResolveFactConflict` | Add or supersede a sourced assertion; trigger invalidation |
| `AttachEvidence` | Register an authorized source or completed attachment upload |
| `RequestWork` | Create one bounded, versioned run from a user intent |
| `ProposeArtifact` | Submit schema-valid output with exact input/source refs |
| `AcceptDecision` / `RejectProposal` | Resolve a specific current proposal, never a floating latest result |
| `PublishPlanRevision` | Validate DAG, quantities, check/gate refs and scope before making a plan available |
| `ReportTaskCompletion` / `AcceptTaskCompletion` | Record evidence, then apply task-specific acceptance rules |
| `RecordInspectionResult` | Add authority/evidence-linked result; release only matching conditions |
| `ReportDiscovery` / `ApproveChange` | Capture changed conditions, identify impact, and accept a replacement scope |
| `RecordActual` | Record receipt, delivered quantity, consumption, labor/cost actual, or handover record |

Permission-sensitive commands are allowed only to matching roles and capabilities. User approvals and professional/authority reviews are distinct. The agent cannot grant itself a reviewer role.

Responses:

- Accepted: committed revision, event IDs, affected/stale artifact IDs, optional run ID.
- Duplicate command with identical payload: original result, without a second mutation or run.
- Same command ID with a different payload: reject as idempotency misuse.
- Revision conflict: return current revision and a structured conflict summary. Never blindly retry a stale decision or overwrite newer facts.
- Validation/authorization failure: no partial domain write; structured reason and field/condition errors.

Queries are read models: workspace summary, current facts/evidence, artifact history, next actions, run activity, and plan readiness. They must not mutate the project or invoke hidden agents.

Event examples: `FactRecorded`, `ArtifactInvalidated`, `WorkRequested`, `RunWaitingForInput`, `ArtifactProposed`, `DecisionAccepted`, `TaskReadinessChanged`, `InspectionRecorded`, `ChangeApproved`. Events include ID, project ID, committed revision, causation/correlation IDs, type, schema version, and time. Store a snapshot plus audit/domain events; full event-sourced reconstruction is not required initially.

## HTTP and progress contract direction

Future endpoints are thin application-service adapters:

- `POST /api/projects` — create a scoped project.
- `POST /api/projects/:id/commands` — submit a validated envelope.
- `GET /api/projects/:id/workspace` — revisioned read model.
- `GET /api/projects/:id/artifacts/:artifactId?revision=…` — immutable artifact revision.
- `GET /api/projects/:id/runs/:runId` — durable status and bounded progress.
- `POST /api/projects/:id/runs/:runId/cancel` — request cancellation, with authorization.
- Attachment initiation/completion/read routes — separately scoped; original files do not travel inside a chat JSON payload.

Short commands return a committed result; long work returns `202` with a persisted run ID. Progress may initially poll; later streaming uses event IDs and reconnection cursors. A dropped connection cannot lose the underlying run or make a retry create duplicate work.

## Material and estimate correctness

Use quantities with dimensional units and decimal/minor-unit monetary arithmetic with explicit currency. Separate needed quantity, waste allowance, available compatible inventory, purchase package count, and leftover quantity. Inventory is a quantity with specification/condition, not a boolean subtracting one arbitrary unit.

A normalized material requirement and a retailer offer are separate records. Merge only specification-compatible requirements. Price/availability sources have timestamps and stale policies; a fixed demo price cannot be labeled live. Totals include known exclusions, allowances, taxes/delivery where sourced, and cannot imply a complete project cost from partial materials alone.
