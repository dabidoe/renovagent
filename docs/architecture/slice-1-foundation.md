# Slice 1 implementation and verification

Implemented October 26, 2026, alongside the existing preview. This document records Slice 1 at delivery. The product frontend now uses this repository through the [Slice 2 workspace](slice-2-workspace.md); the original localStorage frontend remains at `/legacy.html`. No backend, credentials, or model calls were activated.

## Implemented surface

| Area | Files / behavior |
|---|---|
| Runtime contracts | `packages/contracts/src/`: versioned Property, Space, Project, Fact, Evidence, Artifact, Decision, Workspace; typed quantities and commands |
| Pure domain | `packages/core/src/domain/`: command validation, provenance, normalization, revision fencing, canonical command fingerprints, audit events, transitive invalidation, reference integrity |
| Repository port | `packages/core/src/ports/project-repository.ts`: atomic single/batch execution, reads, attachment reads, backup and raw recovery exports |
| IndexedDB adapter | `apps/web/src/adapters/indexeddb/`: transactional workspace/blob persistence, additive DB v1→v2 upgrade, owner checks, no destructive recovery fallback |
| Legacy import | `apps/web/src/adapters/fixtures/import-legacy.ts`: explicit preview, atomic additive import, retained original JSON/messages/unmapped fields, photo references, no inferred approvals |
| Browser diagnostic | `/foundation.html`: a separate database for each check URL; real IndexedDB verification without modifying current preview storage |
| Reference fixture | `fixtures/projects/foundation-scenario.ts`: command-driven two-project dependency scenario |
| Verification | `tests/contracts`, `tests/domain`, `tests/integration`; TypeScript, import-boundary check, repeatable formatting, separate diagnostic bundle |

## State and transaction semantics

The local adapter stores one versioned workspace metadata snapshot, with a separate blob object store. This deliberately serializes local metadata writes across projects: property facts and cross-project invalidation commit together, avoiding an interim window where a dependent project appears current.

The snapshot contains facts/artifact histories, decisions, audit events, and committed command fingerprints/results. A read-write IndexedDB transaction performs read, synchronous domain reduction, reference validation, blob adds, and snapshot write. No network or asynchronous provider work occurs inside that transaction. Attachment digest calculation occurs before opening it.

A failed command or batch aborts the complete transaction. The integration suite checks both domain rejection and an asynchronous IndexedDB constraint failure. Successful command IDs are retained for durable idempotency; rejected commands do not advance revisions or leave partial records. An identical command returns its original result even after reopen; a different payload using the same ID is rejected.

Fact values retain the original supplied value/unit and normalized canonical value. All facts remain explicitly unverified. Shared facts require the current property revision as well as project/fact revision preconditions. Artifact content/history stays available when inputs change; freshness changes and impacted project revisions/audit events commit atomically.

Attachments have SHA-256-bound metadata, immutable blob IDs, and original/derived evidence links. Exact retry bytes are accepted; mismatched or unused bytes are rejected. Original and derived attachments are not collapsed into one data URL.

## Implemented commands

- `CreateProject`: create/link a property and spaces, without inferred physical facts; supports several projects.
- `AttachEvidence`: add project/private or shared property evidence; attachment bytes commit with metadata.
- `RecordFact`: explicit new assertion or superseding revision with evidence, scope, type/unit checks and downstream invalidation.
- `ProposeArtifact`: typed payload, exact input revisions, scope/reference/DAG validation. Late results referencing old input are retained as stale.
- `AcceptDecision`: record user acceptance of named current artifact revisions; stale and cross-project acceptance is rejected. Acceptance is not professional or code approval.

No technical check can be recorded as a supported compliance conclusion in these initial schemas. Task views expose `blocked` when stale and otherwise `needs_review`: the actual technical/inspection release engine belongs to Slice 3. No command in this slice can mark physical work completed or an inspection passed.

## Acceptance evidence

`npm test`: **36 tests pass — 15 existing preview/legacy tests and 21 new foundation tests.**

New checks include:

- malformed/unsupported schemas, quantity units, provenance, identity and owner boundaries;
- no invented starting site facts, explicit unit normalization, incompatible corrections;
- reference dependency graph invalidation, current unrelated artifacts, preserved accepted content;
- shared-property changes affecting two projects atomically, late/stale output, reference/task cycles;
- database close/reopen preserving two projects, fact history, events, retry results and original/derived media;
- simultaneous repository connections: one same-base edit succeeds, the other conflicts without lost work;
- whole-batch rollback and rollback after asynchronous storage failure;
- content-bound attachment retries and no orphan records from failed writes;
- additive legacy import, preserved source/conversation, no permit/completion promotion, invalid import rollback;
- additive v1 database upgrade and raw read-only recovery of an unsupported stored schema;
- persisted retry results after reopen and canonical fingerprinting independent of JSON object-key order.

Real browser checks at `http://127.0.0.1:8741/foundation.html` passed: two projects, five dependent stale artifacts across projects, unrelated output preserved, idempotency, revision conflict, original/derived bytes and links after close/reopen, and data after full page reload. The existing opening and its “How it works” interaction were smoke-tested without changing its saved project.

`npm run build` passes TypeScript and dependency boundaries, builds the existing product to `dist/`, and compiles the diagnostic separately to `.foundation-build/`. `npm run format:check` passes for new foundation sources. The diagnostic is excluded from the product bundle.

## How to inspect

1. Run `npm run dev`; the established preview URL is `http://127.0.0.1:8741/` when that port is available.
2. Open `/foundation.html` on the same server and click **Run browser verification**. Each initial URL gets a new isolated check database.
3. Reload the same check URL to verify stored state and attachment bytes are restored. Expand the stored snapshot to inspect history and events.
4. Use **Preview existing project** to inspect the legacy import warnings/counts. **Import a separate project** explicitly copies it into this check database and leaves the source localStorage value unchanged.
5. Use a new `/foundation.html` URL without a `check` parameter for another clean verification run. No diagnostic deletes existing databases.

The application repository can be imported from `@renovagent/web-foundation`; contracts/core use their workspace package names. TypeScript source exports are intended for Vite/tsx in this local slice, not a published Node package. Emitted/package distribution contracts will be established with server integration.

## Limits and next boundary

- This is a single-owner local persistence foundation. The local owner context is an application boundary, not internet authentication. Server authorization remains Slice 4.
- Full-snapshot writes prioritize correctness for small local projects; large histories need indexing/compaction before scale. No retention or pruning policy silently removes source data.
- Browser storage can be cleared/evicted by the browser/user; it is not a cloud backup. Backup/recovery APIs return structured bundles containing Blob objects; portable archive UI/restore is not implemented.
- The legacy snapshot is preserved verbatim. Legacy strings are retained as reported text; structured interpretation requires a later reviewed command. Existing compressed images cannot reconstruct camera originals.
- Fact derivation, technical requirements/check evaluation, planning formulas, inspections, job execution, and provider orchestration remain later slices.
- Slice 2 is not implemented. Integrate this repository into the working project workspace through commands and queries, not by copying mutable domain state into components.
