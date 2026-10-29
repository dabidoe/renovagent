# Connected photo analysis and Mongo workspace

Implemented October 28, 2026. This is a local, single-owner connected increment of Slice 4, not a deployed multi-user service or completion of the technical-review gates.

## User outcome

The preview can connect its saved workspace to Mongo, select saved source photos or upload JPEG/PNG/WebP images, request real Muse analysis, observe persisted job progress, and receive new research and photo-inventory revisions automatically. Manual research/region imports remain optional compatibility tools. The general conversation and lifecycle fixture runner remain explicitly simulated.

The first connection previews project scope and copies the whole IndexedDB snapshot, including historical revisions, command receipts, events and attachment bytes, into an empty Mongo workspace. Hashes and reference integrity are checked before the atomic commit. The original local database remains intact. An existing Mongo workspace opens without being overwritten or merged. Once connected, a failed server connection does not silently switch authoritative writes back to IndexedDB.

## Running locally

- `npm run dev:connected` supervises the persistent local Mongo runtime, API and Vite preview. Stop separately started copies before using it.
- Alternatively run `npm run dev:mongo`, `npm run dev:api` and `npm run dev` separately.
- Mongo listens on `127.0.0.1:27018`; the API listens on `127.0.0.1:4000`; Vite stays at `127.0.0.1:8741` and proxies `/api`.
- `WORKSPACE_MONGODB_URI` can select another database. The default is `mongodb://127.0.0.1:27018/renovagent_workspace`. Legacy server settings/routes are not reused.
- `MUSE_API_KEY` remains Node-only, using the existing process/server/.env/root .env lookup and stdin handoff to the installed Muse CLI. Neither credentials nor the local API session token are bundled into the frontend.

The Mongo launcher uses the `mongodb-memory-server-core` binary manager to run **real MongoDB 8.0.16 with persistent WiredTiger files** at `.local/mongo`. Despite the library name, app data is not kept in an ephemeral test database. Shutdown disables cleanup, restart uses the same dbPath, and the port is fixed. The binary downloads from MongoDB's distribution service on first start. `.local/` is ignored by Git and contains private database files, session material and bounded job evidence; it must be backed up separately.

## Persistence and authority

`apps/api/src/repository.ts` embeds the workspace, command deduplication records, events, attachment bytes and job metadata in one Mongo aggregate. Each mutation performs a version-fenced compare-and-swap replacement. Domain writes still go through `handleCommand`; the server supplies owner identity and time. Batch failure commits nothing. Duplicate identical commands return their original receipt; conflicting revisions remain errors.

The aggregate has a **14 MB JSON size limit**, below Mongo's document limit. Attachment bytes are base64 encoded in this initial bounded implementation. A larger private blob store and multi-document transaction design are future work; oversized writes fail with prior state intact. This is not an unlimited media repository or offline sync implementation.

The HTTP adapter implements the existing repository interface. Mode selection persists after a successful connection. Connection runs through the controller's mutation queue, so subsequent edits use the selected authority. Server commands do not trust client-provided actor/owner/time.

## Photo execution

The server accepts only a bounded selection of saved source IDs or attachments belonging to the project. It captures address, goal, research and inventory revisions, and stores the exact research snapshot/manifest before dispatch. No human room labels are provided to the image classifier. Historical source references for the same address revision remain selectable after a subset refresh, labeled as earlier review; this does not claim those observations were refreshed. Address changes fence those references out.

Jobs permit one active analysis per workspace, one to eight photos, six provider calls per attempt, a fifteen-minute wall budget, and two recovery attempts. Calls individually time out. Muse shell, write, web, reminder and unrelated-context tools remain disabled. Cancellation aborts the provider process and prevents publication. Renewable worker leases fence claims; an unexpired lease is not reclaimed by another worker. Restart recovers expired work from saved review/region files and batch receipts. Provider execution is not a distributed exactly-once external service: a crash before persisting a provider response may repeat that call, within the attempt budget. Domain publication is atomic and deduplicated.

Inputs are cached privately with SHA-256 and original dimensions. Classification/planning and region receipts remain under `.local/photo-jobs/<job-id>`. A second region pass uses those same bytes. The authorized photo-asset endpoint serves cached bytes matching the saved hash; older imported reviews with no cache fall back to their recorded external source. Uploaded originals use virtual source references resolved to authorized local blobs, not invented public web pages. No image rights are inferred.

After validation, one aggregate commit proposes the new research, imports the region inventory, invalidates downstream records, and marks the job succeeded. The worker checks its lease and the captured domain inputs again at commit. Changed inputs retain evidence but produce a stale job and no new current artifacts. Prior accepted revisions and physical-work history are preserved. New inventory revisions do not inherit earlier identification confirmations.

## Local access boundary

This runtime binds to loopback, uses a private HttpOnly SameSite cookie, restricts host/origin/fetch-site, requires a custom workspace header for session creation and mutations, and validates request size, collection structure and schemas. Attachments, job metadata and cached image reads require the same local session. Public image retrieval requires HTTPS, checks all resolved addresses, pins the accepted address into TLS, rejects redirects and bounds time/bytes/type. Uploads are resolved from the authorized project, never fetched through their virtual URL.

This is **not production account authentication**. Multi-user identities, TLS, hosted secrets, provider quotas/billing, storage retention, restore automation and deployment hardening remain open. Dependency audit still reports five pre-existing advisories in the legacy Firebase/grpc chain and Zod; this increment adds request/structure budgets and remains loopback-only. It does not claim production security clearance or complete Slice 4 acceptance.

## Verification evidence

The full suite ran with real Mongo enabled: **144 tests passed** (15 legacy JavaScript + 129 TypeScript), zero skipped. Six new connected scenarios cover snapshot migration, concurrent/deduplicated commands, atomic invalid-output rollback, downstream invalidation with accepted history, stale late results, recovery/cancellation, HTTP origin/session/owner guards, attachment bytes/reconnect, and historical source discoverability. Existing credential tests now also exercise provider cancellation and call budgets. Types, import boundaries, formatting and both production builds pass; the existing frontend bundle-size advisory remains.

Browser verification connected all seven existing projects, then requested a real four-photo Hutchinson job through the UI. It produced 32 observations and automatically advanced research and inventory from r2 to r3. The owner goal and basement context stayed intact. Mongo and API were stopped/restarted; the complete workspace SHA-256 was identical before and after Mongo restart (`80b5dfae3532ddc4164ff95b2e71c8ad7450060f68222e2110c790f58baebb43`). Reload restored connected mode and the new observations. Original IndexedDB state was retained. A separate labeled QA project uploaded the already-inspected public source photo through the file chooser, analyzed its actual stored pixels, saved seven new observations, cleared the prior QA direction from current scope through invalidation, and rendered the original at 1494 pixels wide through the authenticated hash-addressed asset endpoint. No synthetic preference was added to the actual home.

Measurements, exact segmentation, services feasibility, code applicability and qualified technical review remain open. No construction work is released by a successful photo job.

Preview evidence: [completed in-app job](../previews/muse-mongo-connected.png) and [cached photo with current regions](../previews/muse-mongo-regions.png). The final browser was returned to the actual Hutchinson project. A quiet production-bundle scan confirmed configured Muse credentials were absent.
