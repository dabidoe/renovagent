# Prompt-first workspace and Muse client direction

October 29, 2026. Prompt UI implemented locally; standard Muse-agent MCP access is a requirement, not an enabled connection.

## User direction

The initial house-first dashboard proposal was rejected as too dated and crowded. The new opening is a clean, centered prompt with a compact house/project context. House, plan, materials and contractor tools appear on demand in dialogs. The web UI is one client of the project workflow; a user's standard Muse agent should eventually be another.

## Update: the project opens on its room (October 30, 2026)

At the owner's direction, an open project now leads with its room: the 3D room
studio with annotated, priced work (see [room studio](room-studio.md)), then the
prompt. The landing page and the dialogs are unchanged; the prompt stays on the
same page, below the room.

## Implemented UI

- Replaced the permanent sidebar, lifecycle dashboard and split conversation with a white, sans-serif prompt surface. A single Tools control inside the composer opens the existing work surfaces; the separate shortcut row, tagline and footer were removed.
- Kept the existing validated controller/repository commands, revisions, source links, local/connected selection and saved drafts. The opening itself does not mutate project facts or run a model.
- Added house/project switching, an on-demand workspace menu, conversation history, a recent-message view after sending, and exact-revision artifact dialogs. New-project prompts carry into the existing creation form.
- Kept photo-review questions available through Tools → Questions from photos. Sending still uses the existing reported-direction and stale/revision checks. Plain messages remain saved notes, clearly identified as such.
- House opens the actual photo inventory where available. Plan opens a saved planning artifact, retaining revision controls and evidence. Other work stages, facts/sources and activity remain available from the workspace menu.
- Added honest materials and contractor empty states linked to the current plan. No live offer, contractor search, credential verification or outreach was added.
- Added a Muse connections explanation distinguishing working local Muse photo analysis from future standard-agent access. Corrected the composer's previous unconditional backend-off message.
- Kept `/legacy.html` and existing data. Added the missing display title for the already-present `conversation-plan` contract so the current source type-checks; no new conversation job execution was added.

Primary files: `apps/web/src/app/workspace-app.tsx`, `styles/prompt-workspace.css`, `features/conversation/composer.tsx`, `components/modal.tsx`, and `components/glyph.tsx`.

## Muse is an equal client of the workflow

Target interaction: in an ordinary Muse conversation, the user selects a house/project, requests bounded work, inspects its proposal and resumes later in the website. Facts and artifacts must not live only in browser component state or in the agent's conversation history.

The existing `server/src/mcp.ts` uses the legacy flat project model and demo engine. Do not point a standard Muse agent at that endpoint and claim integration with the new workspace.

Implement a current-workspace application service shared by HTTP and MCP. The first adapter can be a local stdio server for the installed Muse client; hosted Streamable HTTP requires account authentication and scope isolation before exposure. Confirm the installed Muse client's supported transport/configuration before shipping instructions. No automatic modification of the user's agent settings is part of this UI change.

Proposed tool boundary:

| Tool | Result and authority |
|---|---|
| `list_homes` / `list_projects` | Authorized identities and summaries; no cross-owner discovery |
| `get_project_context` | Goal, relevant facts, uncertainties, evidence metadata, current input revisions and available capabilities |
| `get_artifact` | An explicit artifact ID/revision and its freshness, limitations and evidence; historical views stay pinned |
| `request_project_work` | A bounded supported job with project ID, exact inputs, resource limits and idempotency key; unsupported work returns an explicit capability limit |
| `get_run` / `cancel_run` | Durable real progress and bounded cancellation, not simulated model activity |
| `propose_project_change` | Schema-valid proposal through shared command/application validation; cannot approve itself, forge source facts or release work |

The web app and standard Muse agent must share revision checks, input invalidation, job recovery, attachment authorization and command receipts. Keep calculations in core; expose deterministic tools rather than duplicating formulas in prompts. A successful tool call means a stored result, not professional approval. Customer approval and qualified review remain distinct.

Contract, procurement and contact integrations will require their own supported tools later. MCP does not by itself supply supplier pricing, contractor credentials or messaging permission.

Acceptance before claiming standard Muse support:

1. A normal Muse client discovers the adapter and reads the same authorized projects/artifacts as the web app.
2. A supported Muse request produces a persisted proposal visible in the web app; refresh/restart retains the result.
3. A web edit during a run prevents stale publication. A repeated tool request does not duplicate effects.
4. Both clients enforce owner scope, attachment access, cancellation, validation and approval gates.
5. Instructions configure the actual supported Muse transport with credentials kept outside source/client bundles.

## Verification for this increment

- `npm test`: 139 passed; five Mongo-dependent cases skipped without the explicit test URI.
- `npm run test:connected`: six passed against real local Mongo using isolated temporary test databases. This covers the five skipped cases plus the source-discoverability case already covered in the regular run. The first sandboxed attempt could not open the local Mongo socket; the approved local-network run passed.
- Production and foundation builds, strict TypeScript and import boundaries passed. Existing bundle-size advisory remains.
- Formatting checked for changed source files.
- Browser checks: desktop prompt; house dialog; current saved plan and revision selector; materials/contractor empty states; Escape dismissal; project switching; phone prompt at 390 and 360 pixels; 360-pixel house dialog with no horizontal overflow; an unsent QA draft survives refresh. The original QA draft and attachment selection were restored, and the browser returned to the actual Hutchinson project.
- Browser screenshots: `docs/previews/prompt-workspace-desktop.jpg` and `docs/previews/prompt-workspace-mobile.jpg`.

This changes presentation, not technical coverage or agent authority. General live conversation, standard Muse MCP connectivity, live suppliers, contractor vetting and hosted customer accounts remain unimplemented. The deeper work surfaces retain their existing functional constraints; this increment is not a full redesign of every artifact viewer.
