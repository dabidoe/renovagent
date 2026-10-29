# Atlas workspace migration

October 29, 2026. The owner authorized moving the existing local workspace to the configured Atlas cluster. This changes durable storage; the website/API/MCP processes still run on this Mac. Hosted application deployment remains open.

## What moved

The original data was in `unpermitted_workspace` at the persistent local Mongo service on port 27018. The renamed `renovagent_workspace` database held the catalog separately. The configured Atlas `renovagent_workspace` had only an empty single-owner aggregate before transfer.

- Seven projects, with all 41 artifact identities and their historical revisions, facts, evidence, decisions, messages, command receipts and activity.
- Three original attachment blobs, verified against their evidence hashes.
- Two completed photo jobs, with their recorded input revisions and results. No model job was rerun.
- Seventeen curated products, seventeen offers and seventeen price observations. Existing demo provenance remains intact; these are not live prices.
- Twenty-five private JSON job files, including five cached image inputs and the existing model/region execution receipts.

The source/destination snapshots were written as private EJSON before mutation, retaining BSON types. Backup: `.local/backups/atlas-migration-2026-10-29T22-08-34.859Z/snapshot.ejson`; verification report alongside it. Both local databases and `.local/photo-jobs` remain untouched. Never commit these private backups or cached data.

Source snapshot SHA-256: `d153030a97ff58640d7f8f1580f92ee4f16ce94c6c415033a31ff9266a9c3462`.

## Mechanism and guards

`npm run migrate:cluster` performs a dry-run against these explicit local sources and the configured cluster. `npm run migrate:cluster -- --apply` first backs up both sides, rechecks the source hash, then uses a majority-write Atlas transaction. Shared workspace integrity, attachment hashes, catalog schemas/references, job membership, and private-file checksums are checked before commit. Active local jobs or divergent destination records stop the transfer. Identical records are safe to retry; an untouched blank destination aggregate can be replaced. The tool never merges independently edited workspaces or overwrites conflicting content.

`apps/api/src/cluster-migration.ts` contains preflight and transactional copy logic. Database configuration remains server-only in `database-config.ts`; API and both MCP entrypoints select the same configured `MONGODB_URI`. There is no automatic local/Atlas synchronization or failure fallback.

After the website resumes, navigation records such as the selected project/view and command receipts can differ from the frozen source. A later migration preflight correctly refuses that divergent workspace. Use the backup/verification report as the migration baseline; do not reset the live workspace just to make an old snapshot match.

## Portable photo inputs

`photo_job_files` stores owner/job/name-scoped private execution files outside the bounded workspace aggregate. Cached inputs are immutable and checksum-checked; owner mismatches cannot retrieve another owner's file. The authenticated asset endpoint first establishes that the requested image hash occurs in the caller's saved research and corresponding job, then reads the cloud input and verifies the decoded image hash before serving it. Older local cache reads remain compatible.

New photo jobs save their original input bytes into this store before publication and can reuse those inputs after moving the API. Future provider checkpoints/receipts still use the local worker directory; the existing historical receipts were copied by this migration, but distributed job recovery and general remote media uploads are not implemented. The aggregate still has its existing 14 MB limit. This is not a production media retention/backup policy.

## Verification

- Immediately after the transaction, every copied record matched the source, ignoring only the aggregate's storage CAS version. Source was re-read and unchanged; the private verification report records success.
- Restarted the website API on Atlas. Authenticated workspace read returned seven projects; all five private cached images returned HTTP 200 and matched their recorded SHA-256. Both jobs remained succeeded.
- Public MCP smoke read returned the migrated project list; the same endpoint returned HTTP 401 without a credential. Consumer Muse then discovered all ten tools, read the seven originals, created one separately authorized QA project and read its proposed brief back at revision 1. Independent Atlas comparison confirmed all original domain records unchanged. The reloaded website displayed that same QA project and exact brief text; its label now identifies saved intent rather than simulated output. See [consumer Muse evidence](remote-mcp-connector.md).
- Three maintained migration/storage scenarios cover conflict refusal/history preservation, active-job and orphan-catalog rejection, private-file membership/checksum/owner guards, immutable input conflicts and reconnect persistence. A fourth HTTP scenario proves authorized image rendering from Mongo with no local cache, plus unauthenticated/foreign-hash refusal.
- Connected integration suite: 28/28 passed. Regular suite, types, boundary checks, formatting and builds are recorded in `PROGRESS.md`.
