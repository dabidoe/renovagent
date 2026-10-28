# Slice 2 — Durable project workspace

Implemented October 27, 2026. The main preview now uses the Slice 1 repository. Agent work remains local, explicit simulation; no backend or model was activated.

## User-facing workflow

- Create and switch between several property-linked projects without replacing earlier work. Projects can begin in exploration or with work already underway; the latter starts with evidence reconciliation, not assumed completion.
- Keep conversation alongside the selected working artifact on desktop. A keyboard-accessible range control changes the panel proportions.
- On a phone, switch between work and conversation. Saved-output links open the work tab. The project menu exposes projects, lifecycle stages, facts/sources, activity, import, and help.
- Request simulated work for understanding, options, technical investigation, preparation, resource coordination, execution, and handover.
- Explicitly advance persisted checkpoints: queued → running → waiting for input → running → saved proposal. There is no timer pretending a model has analyzed anything.
- Respond to a waiting run, attach a local photo/document, inspect the saved output, and accept or decline its exact revision.
- Inspect facts, their revision history, source messages/files, and artifact inputs. Corrections make dependent proposals stale and prevent stale decisions.
- Reopen any historical output through its original conversation link. The viewer shows its original revision, historical status, and a separate link to the latest revision.
- Inspect decision history and run/audit activity. Simulated failures can be retried up to three attempts; cancellation and prior attempts remain in the record.
- Resume projects, conversations, unsent drafts, attachment references, selected views, and waiting workflow states after refresh.

## Files and boundaries

| Area | Entry points |
|---|---|
| React workspace shell | `apps/web/src/main.tsx`, `app/workspace-app.tsx`, `app/presentation.ts` |
| Application adapter | `app/workspace-controller.ts`: serialized command batches and repository queries; view components do not patch canonical records |
| Conversation | `features/conversation/composer.tsx`: saved drafts, message/clarification submission, local reference files |
| Work | `features/work/artifact-panel.tsx`, `artifact-view.tsx`: typed payload viewers, revision selection, evidence basis, decisions |
| Property evidence | `features/properties/sources-panel.tsx`, `media.tsx`: fact history, originals and object-URL cleanup |
| Activity | `features/activity/run-card.tsx`: persisted checkpoints, advance/retry/cancel, explicit test-failure control |
| Shared UI | `components/modal.tsx`, `glyph.tsx`, `styles/workspace.css` |
| Contracts | `packages/contracts/src/workflow.ts` and additions to workspace/command/artifact schemas |
| Pure simulation | `packages/core/src/domain/workflow.ts`: bounded fixture state transitions and typed outputs; no React, provider, network, or storage imports |
| Input context | `domain/input-context.ts` and `invalidate.ts`: exact consumed inputs plus context membership for missing-fact/file additions |
| Tests | `tests/integration/workspace.test.ts`, alongside the existing contract/domain/repository suites |

## New domain contracts

Workspace snapshot schema **2** adds messages, drafts, per-project views, active selection, and runs. Slice 1 schema-1 snapshots are migrated in memory without discarding existing properties, facts, artifacts, audit events, or attachments; a subsequent atomic commit persists the new shape. Unsupported schemas are still refused and remain recoverable.

Commands added:

- `AppendMessage`: persists user context and its evidence, clearing the corresponding sent draft.
- `SaveDraft`: persists text and reference IDs with a draft revision precondition. Draft/view changes do not advance the domain project revision or trigger invalidation.
- `SetWorkspaceView`: selects a scoped project/surface/artifact revision/mobile tab.
- `RequestWork`: creates a clearly simulated, versioned, bounded run from the current input snapshot.
- `TransitionRun`: validates run revision and checkpoint before advancing, answering, failing, retrying, or canceling.
- `RejectProposal`: records an explicit declined decision; it is not an acceptance or professional review.

Run proposal creation, its output reference, checkpoint/history, and conversation link commit together. Accept/decline decisions resolve the waiting run in the same transaction. Technical check results cannot be recorded as supported compliance conclusions, and the fixture cannot release construction tasks or certify completion.

A run records exact fact/evidence revisions and the relevant input-set signature. Newly recorded site facts or files can invalidate a proposal that was produced with missing context. A proposal that becomes stale while awaiting a decision moves to a failed/retryable simulation checkpoint. A changed input snapshot or replaced target revision during work prevents late publication. Ordinary conversation notes and draft edits do not masquerade as verified site facts.

## Simulation content

Outputs are fixture-backed comparisons, investigation outlines, task outlines, scope/procurement notes, and handover checklists. Bathroom/room and flooring examples have appropriate illustrative diagrams/content; they are not measured designs or technical playbooks. Every agent message, run, and generated artifact is labeled simulated. No source retrieval, code applicability analysis, live estimate, actual purchasing, contractor contact, inspection, or photo/document interpretation occurs.

The normal composer records context. Explicit work controls request fixture jobs; a waiting run can consume the user's clarification. This is not an open-ended model chatbot.

## Migration and preservation

The current workspace database is separate from the previous opening's localStorage key. Import is opt-in: preview its counts/limits, then create a separate project with the original snapshot retained as source evidence. Earlier chat content remains accessible in that source archive; it is not relabeled as newly generated agent work.

The earlier frontend remains available at `/legacy.html`, and is included in the production build. Its original source files and localStorage value remain intact. `/foundation.html` still runs isolated foundation diagnostics; its separate bundle is not part of the main product output.

## Verification

**49 tests pass:** 15 existing preview/legacy tests, 21 foundation tests, and 13 new workspace integration tests. New checks cover project/draft/view persistence, waiting run reopen/resume, exact-revision decisions and links, failure/retry/cancellation, late outputs, newly added missing context, file references, stale edit rollback, schema-1 migration, flooring-specific fixture content, and retry limits.

TypeScript (including unused-code checks), package dependency boundaries, formatting, and builds pass. Product and preserved legacy entries build to `dist/`; the diagnostic builds separately.

Real-browser checks completed:

- Create the explicit simulated example; save an option comparison and accept revision 1.
- Create a second project on the same property; switch back and restore the first project's draft, conversation, artifact, and decision.
- Refresh and retain project/view selection and unsent text.
- Advance a technical fixture, refresh while waiting for input, then resume with a clarification and photo reference.
- View the same stored original reference on a 390 px phone-width workspace.
- Switch work/conversation; open a proposal from conversation; use the mobile project/stage/source menu.
- Correct a consumed fact on phone; retain fact revision history, show the failed/retryable run, and disable decisions on the stale output.
- Regenerate an option comparison as revision 2, then open the older conversation link and confirm it still opens revision 1 with a historical banner.

## Remaining boundaries

This is the local workspace/fixture slice. Real technical calculations, reviewed code retrieval/applicability, task release semantics, authoritative quantities/estimates, professional review, and provider orchestration remain later slices. There is no background agent worker. Explicit simulation controls persist steps; they do not imply unattended execution.

Local storage is single-owner, device-bound, and not cloud backup or collaborative sync. Concurrent domain edits use revision fencing and visible conflicts; live cross-tab notifications and collaborative draft merging are not implemented. Legacy imports preserve the archive rather than reconstructing missing camera originals or unverified completion claims.

Next implementation, when requested: Slice 3, the deterministic technical planning core and curated evidence/requirements coverage. Do not connect real models to bypass that foundation.
