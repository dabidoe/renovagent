# Runtime fixes after the storage review — October 31, 2026

This note follows the findings in `runtime-storage-technical-review.md` (October 30). It records what changed, what was measured, and what remains open.

## Measured first (read-only, Atlas)

On the largest owner workspace (3,058,258 BSON bytes), read through the repository:

| Step                                    |      Time |
| --------------------------------------- | --------: |
| Fetch the aggregate document            | 34,630 ms |
| Validate it (schema and integrity)      |     69 ms |
| `structuredClone` of it                 |      8 ms |
| Version-only lookup                     |     39 ms |
| Read with the new cache (after warm-up) |  43–79 ms |

**The cost is transfer, not validation.** The full document moves at roughly 90 KB/s from this cluster. The review's 35-second `/session` timing matches one full fetch.

**The review's mechanism for `/session` doesn't apply in account mode.** In account mode, `/session` is two small account lookups. The slow responses there are better explained by full-document reads from workers and polling running alongside it.

Where the bytes are:

- saved artifact revisions: 1.94 MB (for example, 13 revisions of one scope work plan, 327 KB);
- the command idempotency log: 0.77 MB;
- jobs: 88 KB.

## Changed

| Finding      | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F4 reads     | `MongoWorkspaceRepository.read()` keeps a validated copy per database, collection and owner. It returns that copy (cloned) when a projected `version` lookup still matches, and fetches only when the version moved. Every aggregate write goes through `update()`'s version compare-and-swap, so another process's write is picked up. `version()` is public.                                                                                                                        |
| F4 workers   | `PhotoWorker.tick()` claims its guard before the first `await` and releases it in `finally`, so slow reads can't stack ticks. The design worker already did this.                                                                                                                                                                                                                                                                                                                     |
| F4 readiness | `GET /readyz` answers 200 only if the workspace database returns a version lookup within 2 s. `/healthz` stays liveness only. Requests taking a second or more are logged as `[slow] METHOD path status ms`, without query strings or bodies.                                                                                                                                                                                                                                         |
| F2 config    | `workspaceMongoConfig` no longer chooses local Mongo when nothing is configured; it stops with an actionable error. Settings come from, in order: `RENOVAGENT_ENV_FILE`; this checkout's `.env`/`server/.env`; or, in a git worktree, the main checkout's. The result names the file used. Local Mongo needs `RENOVAGENT_MONGO_TARGET=local`, and `RENOVAGENT_LOCAL_MONGO_URI` takes precedence over the older `MONGODB_URI_LOCAL`. The Jev and Muse key readers use the same lookup. |
| F2/F5 launch | `npm run dev:connected` starts the API, MCP HTTP (4010, optional: if it exits, the site keeps running) and Vite, all with one resolved environment. `npm run dev:local` does the same against an explicit local Mongo on 27018. Neither needs `.local/with-main-env.ts`.                                                                                                                                                                                                              |
| F5 proxy     | Vite's `/mcp` proxy now targets 4010, where MCP listens, instead of 4000.                                                                                                                                                                                                                                                                                                                                                                                                             |
| F7 uploads   | `POST /blobs/:id` takes one attachment's raw bytes (up to 20 MiB; images and PDF), under the same origin, client-header and owner checks as commands. It refuses to overwrite existing different bytes. The browser adapter stages each image or PDF this way, then sends the command without inline bytes; a later command is accepted only if its reference matches the staged hash and type. Other types, MCP and backup import still send bytes inline.                           |
| F1 default   | With no saved storage choice, the app opens the shared workspace when the API answers and this browser has no local projects, and remembers that choice. Browsers with local projects keep their current behavior; nothing is hidden or switched silently. In account mode a first visit therefore lands on sign-in.                                                                                                                                                                  |

**Tests:**

- cached reads are copies, and are refreshed after outside versioned writes;
- overlapping ticks don't stack;
- missing config is an error;
- worktree and explicit-file discovery, and the `dev:local` URI;
- a 10 MiB staged upload commits, and the header, type and overwrite guards hold.

## Still open

- **F4, the real size problem.** Every write still uploads the whole aggregate. Archiving superseded artifact revisions and old idempotency records needs a reviewed migration, which wasn't run on the live workspace. The connected photo panel's 2.5-second polling (another session's component) was not changed; it now hits the cache.
- **F1 label.** A visible "shared / this browser" storage label and a per-project import of alternate-origin records are not built.
- **F3.** Alias retirement (`MONGODB_URI`, `WORKSPACE_MONGODB_URI`) is not done. The main `.env` and `server/.env` both still hold the workspace URI, and **both must be updated when the Atlas password is rotated**, because `server/.env` is read last.
- **F6.** The end-to-end workflow, and saving Jev photo readings, are not done.
- **F8.** The container still needs a Linux image converter in place of macOS `sips`, the Muse runtime, and MCP. Adding a converter dependency is a download that needs approval.
