# Homepage promises vs. what is built — October 31, 2026

This audit takes each promise the landing page makes (`apps/web/src/features/landing/`) and checks it against the code on `main` (`aea2f51`). It aims to find where a visitor, a contractor or an agent would hit a wall.

**How each row is known:**

- **run**: checked by a request or by running the stack.
- **code**: inferred from reading the code. Not exercised end to end.

**Statuses:**

- **Works**: works for a real project.
- **Local only**: works on the owner's laptop only.
- **Example only**: shown for the labelled example project, never for a real one.
- **Missing**: nothing in the code backs the promise.

## 0. The public homepage does not load

The GitHub Pages site serves the repository's raw root `index.html`, unbuilt (**run**).

- `curl https://dabidoe.github.io/renovagent/` is identical to `index.html`.
- The page asks for `/apps/web/src/main.tsx` at the domain root, which returns 404.
- Even the `/renovagent/`-prefixed path serves raw TSX as `application/octet-stream`.
- So a visitor sees a blank page, and every promise below goes unseen.

There's also a stale line: the deployed `<title>` still reads "Know what works. Before you build."

**Fix (small):** publish the built site instead of the repository root, using the `vite build` output with the `/renovagent/` base path. Or stop Pages and use the hosted container (section 2) as the one public URL.

A static Pages build can only run the browser-only (IndexedDB) mode. Photos, Jev, Muse, looks pricing and sign-in all need the API.

## 1. Promise by promise

| #   | Promise (landing copy)                                                                                             | Status                                     | Evidence                                                                                                                                                                                                                                                                                                                                                                        | Fix                                            |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| P1  | "Turn your space into a plan": prompt plus photos starts a project                                                 | Works locally                              | `project-start/`, `project-intake.ts`; staged photo upload (code; upload tested in `connected-workspace.test.ts`)                                                                                                                                                                                                                                                               | Hosting (section 2)                            |
| P1a | Starter "Renovate a room"                                                                                          | Works for **bathroom or living room only** | Only two scope recipes are registered (`draft-scope.ts:49`); the room picker hardcodes them (`room-studio.tsx:434,440`) (code)                                                                                                                                                                                                                                                  | Medium per new room type (a recipe each)       |
| P1b | Starter "Diagnose a problem" (dishwasher not draining)                                                             | **Missing**                                | No diagnosis flow; "diagnos" appears only in landing copy and photo-review prompts (code). The prompt starts a generic project with nothing behind it                                                                                                                                                                                                                           | Large; or drop the starter                     |
| P1c | Starter "Review a quote"                                                                                           | **Missing**                                | No quote upload, parsing or review code (code)                                                                                                                                                                                                                                                                                                                                  | Large; or drop the starter                     |
| P1d | "Connect with Muse or your agent"                                                                                  | Local only                                 | MCP over HTTP is a separate loopback process on 4010 (`mcp-http.ts`). It was verified with the Muse app only through a one-hour tunnel (`remote-mcp-connector.md`)                                                                                                                                                                                                              | Hosting plus MCP in the container              |
| P2  | Before/after transformation                                                                                        | Example only (labelled generated)          | Static generated images in the landing (code)                                                                                                                                                                                                                                                                                                                                   | n/a, honest as labelled                        |
| P3  | "From the pipe to the last screw": materials, quantities                                                           | Works (two recipes)                        | Requirement lists and BOM per recipe; retail reference catalog, 59 products (run, earlier this week)                                                                                                                                                                                                                                                                            | Coverage grows with recipes                    |
| P3a | Labor as "Hours × trade rate"                                                                                      | **Copy doesn't match code**                | Example labor is per measured sq ft or a flat amount (`example-quotes.ts`, `Rate`). No hourly or trade-rate data exists (code)                                                                                                                                                                                                                                                  | Small: change the copy. Large: real labor data |
| P4  | "Change a finish. The room and the price change with it."                                                          | Works                                      | Looks and Best value reprice the room ($566.84 to $1,482.65 on the example) (run)                                                                                                                                                                                                                                                                                               | n/a                                            |
| P4a | "See what it takes to do it yourself, or **what a pro quoted**"; itemized contractor quote                         | **Example only**                           | Contractors, ratings and reviews are fictional fixtures "never shown for a real project" (`example-quotes.ts` header). A real project gets DIY costs and no quote (code)                                                                                                                                                                                                        | Needs contractor participation (section 3)     |
| P5  | "Import RoomPlan or OpenPlan3D. Review and save your measurements."                                                | Works                                      | JSON import and multi-room guard (`room-dimensions-card.tsx:86-144`, `floor-plan.ts`) (code plus tests). We supply no capture app; the user must export JSON elsewhere                                                                                                                                                                                                          | n/a                                            |
| P6  | "Muse reads your project and proposes changes. You decide."                                                        | Local only                                 | Proposal-grade MCP tools (`start_project`, `propose_project_change`) behind owner grants (`mcp-http.ts:81-84`). Photo jobs spawn the `muse` CLI on this Mac                                                                                                                                                                                                                     | Hosting; Muse runtime in the container         |
| P6a | "Built on MCP" link                                                                                                | Stale                                      | Links to the old `github.com/dabidoe/unpermitted-ai` (it redirects) (code)                                                                                                                                                                                                                                                                                                      | Trivial                                        |
| P7  | Comparison row "Work together: **Your agent & contractor**"; "the people doing the work. Together in one project." | **Missing for contractors**                | A workspace has exactly one owner: `checkedWorkspace` refuses any other owner (`repository.ts:59-61`). There are no members, invites, roles or share links in the API or contracts (code). "Accept plan / Decline" is the homeowner approving a purchase plan (`purchase-plans.tsx:206-211`). The contractor "handoff" is a Markdown package to paste (`contractor-handoff.ts`) | Large (section 3)                              |
| P7a | "$0 / month" next to $199 to $899 competitor plans                                                                 | Local build only                           | The comment says $0 describes the local build (`comparison.tsx:21-22`). A hosted service has real Atlas, hosting and model costs per photo                                                                                                                                                                                                                                      | Decide pricing or reword                       |

The competitors in that comparison (JobTread, Buildertrend, Handoff) all ship client or subcontractor portals. Next to them, P7 is the promise that fails hardest.

## 2. "Atlas isn't enough": hosting

Atlas is only the database. Everything else runs on one laptop at `127.0.0.1`:

- **API on 4000:** `server.ts`. It has public-host support (`hosting.ts`), but it has never been deployed.
- **MCP over HTTP on 4010:** a separate process, not in the container.
- **Workers:** photo and design workers run in-process, so a host can run only one replica.
- **Muse photo jobs:** need the `muse` CLI, which isn't in the image.
- **Images:** HEIC conversion uses macOS `sips`, so the container needs a Linux converter. That's a new dependency that needs approval.
- **Sign-in:** Google and Meta. Google's unverified (testing) mode admits only listed test users; leaving it needs a privacy policy, terms and a data-deletion path. None exist yet.

What already exists:

- a `Dockerfile` and `railway.json`;
- documented owner steps (`hosted-deployment.md`);
- `/healthz` and `/readyz`;
- the same-origin cookie, Origin and Host checks.

Unverified:

- A cold start reads the owner workspace. From this laptop the API took about two minutes to listen (run); a host near Atlas should be faster.
- Railway's Host routing against the API's strict Host check (`hosted-deployment.md` flags this).

**Minimum to put the app at a URL:** about one to two days of work.

1. Deploy the container to the `*.up.railway.app` URL.
2. Allow Railway in Atlas network access.
3. Register Google's hosted callback.
4. Add MCP over HTTP to the container (a second listener or path).
5. Point `/healthz` checks at `/readyz`.

The Muse photo pipeline and HEIC support can follow; without them, planning still works and photo jobs fail with a stated error.

## 3. Contractor handoff needs a sharing model, not just hosting

Even once the app is hosted, a contractor still has nothing to open. They get only what the owner pastes from the Markdown export. To make "your agent & contractor" true:

1. **Project membership.**
   - Today a workspace is one aggregate document per owner, and access is all or nothing.
   - The project needs a membership record: project, user, role (`owner`, `contractor`, `viewer`) and who invited them.
   - Requests from a member must be authorized per project, inside the owner's workspace.
   - This touches `repository.ts`, the session code in `server.ts` and contracts. It's the largest change.
2. **Invite or share link.** An expiring, revocable, single-project token, one per contractor. It's the same idea as the MCP owner grants (`mcp-http.ts:81`), which already expire, can be revoked and are rechecked on each request. Those grants cover the whole workspace and serve agents only.
3. **A contractor surface.**
   - A read view of the handoff package: scope, measurements, BOM, review findings. `contractor-handoff.ts` already assembles this content.
   - A way to respond: a quote per work package (materials plus labor, matching `example-quotes.ts`), questions, accept or decline.
   - Responses arrive as **proposals** the owner accepts (AGENTS.md: agent and third-party output proposes, never patches canonical state).
4. **Concurrency.**
   - Two people plus agents writing one owner aggregate will collide on its version check.
   - At today's 3 MB per workspace, every write re-uploads the whole document.
   - The history-archiving migration (`runtime-fixes-2026-10-31.md`, F4) should come first, or contractor responses should be stored outside the aggregate.

**Smallest honest version for a demo:**

- a hosted URL;
- a per-project, read-only share link that renders the existing handoff package in the browser;
- a "send a quote" form that lands as a proposal on the owner's project.

That delivers the core of P4a and P7 without full multi-user editing.

## 4. Suggested order

1. **Today:** fix the Pages site (section 0), or take Pages down until hosting is live. Fix the "Built on MCP" link, the labor copy (P3a) and the two unbacked starters (P1b, P1c): drop them or mark them "coming soon".
2. **Hosting** (section 2), so P1d and P6 work beyond this laptop.
3. **History-archiving migration** (F4), before multiple writers.
4. **Share link plus contractor quote proposals** (section 3), which makes P4a and P7 true.
5. **Pricing story** for P7a, once hosted costs are known.

What already holds up and is worth leading with:

- finish-to-price changes;
- itemized materials with dated retail references;
- RoomPlan and OpenPlan3D import;
- agent proposals under owner approval.
