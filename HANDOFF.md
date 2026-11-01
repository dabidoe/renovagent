# Renovagent handoff

**Updated 1 November 2026 (America/New_York).** This file replaces the 29 October handoff. That version's tunnel URL, grant expiry, QA project IDs and "uncommitted work" note are historical. Git history has them.

Any agent or person picking this up should read this file first, then [AGENTS.md](AGENTS.md). Read the linked docs only for the area you are changing.

## Resume here

- **Deadline:** Meta Global AI Developer Hackathon submission is due **4 Nov 2026, 9:00 PM ET** (Cerebral Valley portal). Judging runs 4–8 Nov and finals are 9 Nov.
- **Judging weights:** Impact 30%, use of Meta AI tooling beyond a basic integration 25%, technical depth 20%, and a demo that holds up live (including the video) 25%.
- **Live site:** https://renovagent-production.up.railway.app. Railway redeploys every push to `main` in about 2–3 minutes. Health check: `/healthz`.
- **Priorities until the deadline:** a live demo that works and deeper use of the Meta models. Defer billing, Premium, Bunny and Stripe; they are in [launch-checklist.md](docs/launch-checklist.md) and not built.
- **In progress:** Slice B of inspiration. The owner's own agent (Muse, or any MCP client) can add links, products and photos to the studio's inspiration panel. See [Next work](#next-work).

## What a judge sees

| Where                             | What it does                                                                                                                                                                                                                                                                                   | Main code                                                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/` landing                       | A hero bathroom with SAM 3.1 outlines of vanity, mirror, shower tile and floor (computed once, committed). A card per finish with example prices. Before/after, "the room, the work, the price" preview, agent section                                                                         | `apps/web/src/features/landing/` (`hero-scene.tsx`, `hero-segments.json` from `scripts/hero-segments.ts`)              |
| `#examples`                       | Three real listings: Hutchinson, Oakland, Brooklyn. Each opens a paint and floor studio                                                                                                                                                                                                        | `listing-studio.tsx`, `hutchinson-studio.tsx`, `public/examples/<id>/` (built by `scripts/prepare-listing-example.ts`) |
| Studio (examples and own project) | Per room: photo before/after with SAM wall masks tinted to the chosen paint, Muse Image floors, 3D room, priced paint and floor list, "Imagine" (words to paint and floor picks), **Inspiration** (photo you love → items, colours, 3 nearest paints, shop searches, restyle → _Inspired_ tab) | `paint-floor-studio.tsx`, `inspo-panel.tsx`, `paint-floor.ts`, `apps/api/src/studio.ts`                                |
| `#your-project`                   | Owner uploads their own photos and an optional floor plan → SAM walls, Muse Spark reads (room type, ceiling height from doors), Muse floors, priced plan                                                                                                                                       | `own-studio.tsx`, `own-project.ts`                                                                                     |
| `#connect`                        | Signed-in owner (guest or Google) makes or revokes 7-day agent keys for `https://<site>/mcp`. Muse and any MCP client                                                                                                                                                                          | `apps/web/src/features/connect/`, `apps/api/src/mcp-access.ts`, `mcp-http.ts`                                          |
| Workspace (project picker)        | The older prompt-first project workspace: projects, evidence, inspiration & products board, scope drafts, design options, review, contractor handoff                                                                                                                                           | `apps/web/src/app/workspace-app.tsx`, `features/*`                                                                     |

**Accounts:**

- "Continue as guest" gives a private workspace in one click, capped at 20 per hour per address. `RENOVAGENT_GUESTS=off` turns it off.
- "Add Google" turns the guest into a Google account in place (`completeLogin(..., guestId)` in `apps/api/src/accounts.ts`).
- Meta login has been dropped. Don't add the Facebook JS SDK.

**Where edits are kept:**

- Example studio edits stay in the browser (localStorage `renovagent.studio.<id>.*`, `renovagent.example.<id>.edits.v1`). The kicker says so. There is no "save to my account" for examples; the owner rates it low priority.
- Own-project photos are stored on the server for each owner, keyed by SHA-256.
- Agents save paint and floor plans with `save_plan`, which hands the owner a link.

## Meta models: where each is used

All calls are server-side through `scripts/muse-provider.ts`, against `https://api.meta.ai/v1` with `MUSE_API_KEY`. Older workspace photo jobs still use the `muse` CLI.

| Model                                           | Used for                                                                                                                              | Entry points                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **SAM 3.1** (`samSegmentText`)                  | Wall masks, hero outlines (counts 33 hex floor tiles), and outlining each inspiration item                                            | `/studio/walls`, `/studio/inspo`, `/photos/segment`; parsing in `apps/api/src/segmentation.ts` |
| **Muse Spark** (`museJson`)                     | Room reads (type, ceiling height from door heights), "Imagine" words → picks, naming what makes an inspiration look                   | `/studio/read`, `/studio/imagine`, `/studio/inspo`                                             |
| **Muse Image** (`museEditImage`, about 20–30 s) | New floors on the real photo, restyle a room with the look of an inspiration photo (reference image), photoreal stills of the 3D room | `/studio/floor`, `/studio/restyle`, `/model/photoreal`                                         |
| **Jev** (TypeSafe, `TYPESAFE_API_KEY`)          | Ranking review findings, best value across tiers, pinning photos                                                                      | `apps/api/src/jev.ts`                                                                          |
| Blender on Modal                                | HD Cycles renders of the measured 3D room                                                                                             | `modal/render_room.py`, `/model/hq-render`                                                     |

**Per-owner limits:** each owner gets 60 segment calls, 12 repaint calls and 10 read calls per 10 minutes (`apps/api/src/studio.ts`).

**Paint matching:**

- `nearestPaints` uses CIELAB distance (CIE76 ΔE) in `packages/core/src/commerce/paint-colors.ts`.
- Matches with ΔE ≤ 12 (`FAR_MATCH_DE`) count as close. Further than that, the UI says nothing is close.
- The palette is Sherwin-Williams, loaded with `npm run seed:paint`; the brand file is not in git. Without it the app falls back to six starter colours.

## Rules that must not be broken

These come from the owner across sessions. They are not visible in the code.

**Honesty**

- No invented physical defaults, code citations, live prices, verified contractor credentials or savings claims.
- Demo prices stay labelled ("Example prices for this demo, not live offers").
- Generated images are labelled as generated. The Inspired view says "a picture, not a plan".
- Don't show the AI `product-*.jpg` images as product photos.
- Shopping links are **store searches**, never a claimed product, price or stock. The Amazon tag (`RENOVAGENT_AMAZON_TAG`) is added only when set, and the disclosure then shows.
- Example reviews are never shown as Google's.
- An agent's finds are shown as found by the agent and not checked.

**Sources**

- No scraping: no Pinterest, IKEA or retailer page fetching.
- No downloading retailer images.
- The server never fetches an image URL (SSRF risk).
- Inspiration photos arrive only by the owner's upload.
- The brand paint swatch files and raw listing photo folders stay out of git.

**Secrets**

- Never commit `.env`, `server/.env` or `atlas-credentials.env`.
- Never print credentials, tokens or partial API keys.
- Mask Mongo URIs: `sed -E 's#//[^@ ]*@#//***@#g'`.
- Provider keys stay on the server.
- The render token lives only in the Modal secret, `.local/render-token` and `.env`.
- MCP keys go only into the agent's secure credential field. Docs use `reno_YOUR_KEY`. Mask `.ca-secret` in screenshots.

**Live data**

- No scripts that write to, or take screenshots against, live Atlas or the live site without the owner asking that time. That includes guest sign-ins, uploads and model spend.
- Run e2e against local Mongo on port 27018.
- Read-only page loads of the live site are fine.

**Owner-only steps**

- The owner does the GitHub settings, Railway variables, Atlas users and network, Google Cloud and Meta console.
- New npm dependencies and downloads need the owner's approval first.

**Agent authority**

- Agents propose; they never approve, record site facts, pass inspections or buy anything.
- MCP writes go through validated commands or dedicated narrow tools.

## Run, test, deploy

**Local**

| Command                  | What                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `npm run dev`            | Frontend only, http://127.0.0.1:8741 (IndexedDB workspace)                                               |
| `npm run dev:connected`  | API, MCP (4010) and frontend against the **configured database, which is Atlas**. Writes go to real data |
| `npm run dev:local`      | The same against local Mongo on 27018                                                                    |
| `npm run dev:accounts`   | Turns Google sign-in on locally                                                                          |
| `npm test`               | 15 legacy JS plus about 280 TS tests (contract, domain, integration)                                     |
| `npm run test:connected` | Integration suites against a real local Mongo on 27018 (about 57)                                        |
| `npm run build`          | Types, boundaries, production builds                                                                     |
| `npx tsc --noEmit -p .`  | Fast type check                                                                                          |

**Before every push:**

1. `npx tsc --noEmit -p .`
2. `npm test`
3. `npm run test:connected`, with mongod running on 27018
4. `npm run build`
5. `npx prettier --write` on touched files

**Local e2e with real models but local data** (how the inspiration feature was tested):

```bash
set -a; . "/Users/deastridge/Documents/Meta hackathon/.env"; set +a
env -u RENOVAGENT_PUBLIC_URL -u RENOVAGENT_HOST -u META_APP_ID -u META_APP_SECRET \
  GOOGLE_CLIENT_ID=e2e-client GOOGLE_CLIENT_SECRET=e2e-secret PORT=4100 \
  RENOVAGENT_MONGO_URI=mongodb://127.0.0.1:27018/renovagent_workspace \
  node --import tsx apps/api/src/server.ts
npx vite --config .local/vite.e2e.config.js   # 8743, proxies /api to 4100
```

- The fake Google client turns account mode on, so "Continue as guest" works.
- The local database has no paint palette, so paints fall back to the six starter colours.
- Local mongod binary: `.local/mongodb-binaries/mongod-arm64-darwin-8.0.16 --dbpath <dir> --port 27018 --bind_ip 127.0.0.1`.

**Git**

- Commit to `main` and push. There is no PR flow for the hackathon.
- Parallel agent sessions use a detached worktree (`git checkout --detach origin/main`, commit, `git push origin HEAD:main`), then fast-forward the main checkout.
- Railway deploys `main`. Watch with a read-only page load, never by signing in.

**Deploy configuration (Railway Variables, names only)**

- **Database:** `RENOVAGENT_MONGO_URI`. Precedence is `RENOVAGENT_MONGO_URI` → `WORKSPACE_MONGODB_URI` → `MONGODB_URI`. A URI with no database path means `renovagent_workspace`.
  - **Unverified:** which database the live URI names. The launch checklist proposed `/renovagent_demo`. The Sherwin-Williams palette (1526 colours) was counted in `renovagent_workspace`. Check in Railway before any data work.
- **Site:** `RENOVAGENT_PUBLIC_URL`.
- **Sign-in:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- **Models:** `MUSE_API_KEY`, `TYPESAFE_API_KEY`.
- **Renders:** `RENOVAGENT_RENDER_URL`, `RENOVAGENT_RENDER_TOKEN`.
- **Optional:** `RENOVAGENT_GUESTS`, `RENOVAGENT_AMAZON_TAG`, `RENOVAGENT_CATALOG_OPERATOR`.
- **Don't set:** `PORT` is injected. `GOOGLE_REDIRECT_URI` is derived.
- **Atlas password rotation:** update `.env`, `server/.env` and Railway together.

**Local configuration traps**

- The `.env` URI has no database path, but scripts run against it have landed in the `test` database. Name the database explicitly.
- `MONGODB_URI_LOCAL` points at an old 27017 service, not 27018.

## MCP for agents

The endpoint is `https://<site>/mcp`, a stateless Streamable HTTP endpoint. Each key belongs to one owner and expires after 7 days. Owners make keys at `#connect`. Local stdio: `npm run serve:mcp`.

**Tools (from `CAPABILITIES` in `apps/api/src/mcp.ts` and `mcp-studio.ts`)**

| Kind                            | Tools                                                                                                                                                                                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read                            | `list_homes`, `list_projects`, `get_project_context` (includes inspiration and product references), `review_scope`, `export_contractor_handoff`, `list_project_files`, `get_artifact`, `get_design_options`, `search_catalog`, `get_offer_history`, `build_checkout_review` |
| Studio                          | `list_floor_styles`, `find_paint_color`, `plan_paint_and_floor`                                                                                                                                                                                                             |
| Propose (not on read-only keys) | `start_project`, `draft_scope`, `build_design_options`, `revise_design_option`, `propose_project_change` (allows only `ProposeArtifact`, `SaveDraft`, `AppendMessage`)                                                                                                      |
| Hosted with a propose key       | `save_plan`, which saves a paint and floor plan and returns a link for the owner                                                                                                                                                                                            |

Consumer Muse on Mac connected and created and read projects on 29 Oct ([evidence](docs/architecture/remote-mcp-connector.md)). The hosted `/mcp` replaced the temporary tunnel.

## Inspiration, as built (Slice A, `4e947d1`)

**The flow**

1. In any studio, under Imagine, the owner chooses **Use an inspiration photo**.
2. The photo is uploaded owner-scoped through `/studio/photo`.
3. `/studio/inspo` runs: Muse Spark names up to 6 items, each with a phrase, name and kind (walls, floor, bedding, textile, furniture, lighting, decor). SAM 3.1 then outlines each phrase.
   - The result is cached for each owner and photo.
   - It costs 1 read plus 1 segment per item.
4. In the browser:
   - each item's colour is a trimmed mean of the pixels inside its mask;
   - walls call `/paint/nearest`, which returns the 3 nearest paints;
   - the other items get Amazon, Wayfair and Target search links (`shop-links.ts`).
5. **Restyle** (`/studio/restyle`) sends the room photo plus the inspiration photo as a reference to Muse Image, with only the ticked items and the chosen paint.
   - The result is stored and shown in an **Inspired** tab with a slider.
   - It persists per room in localStorage.

**Measured locally with the real models:** about 21 s to analyse, about 28 s to restyle.

**Known behaviour:** Muse adds the furniture you borrow. An empty room gains a bed. Untick furniture to change finishes only.

## Next work

1. **Slice B: the agent adds to the inspiration panel.** A tool for the owner's own agent to save a link, product or photo to that owner's inspiration list. The studio's panel shows them with "Found by <agent> · not checked", and the owner can add their own links there too.
   - Links are validated like `projectReferenceSchema`: http(s) only, no credentials.
   - The server never fetches URLs.
   - Photos come only as bytes the agent already holds, with a size cap.
   - Read-only keys can't use it.
   - Status: see [PROGRESS.md](PROGRESS.md).
2. **Bedroom refresh example.** A worked inspiration example (a saved Pinterest pin applied to the owner's bedroom). Ship the before/after and extracted items, never the pin itself. Status: see PROGRESS.
3. **Design-pass open items:** see [docs/design-pass-2026-11-01.md](docs/design-pass-2026-11-01.md). Medium: the `product-*.jpg` disclaimer on every Materials view.
4. **Paint lines** (owner: "good enough for now"):
   - tiers are contractor, mid and designer, not real Sherwin-Williams lines;
   - sheen (Matte, Eggshell, Satin) exists;
   - Behr is not loaded.
5. **Demo video and submission text.** Not started.

**Not built** (do not claim):

- billing and credits;
- live retailer prices;
- contractor verification;
- purchasing;
- reviewed code guidance;
- saving an example to an account.

## Where the details live

| Area                                           | Doc                                                                                                                                                                                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status, newest first                           | [PROGRESS.md](PROGRESS.md)                                                                                                                                                                                                             |
| Architecture index and implementation boundary | [docs/architecture/README.md](docs/architecture/README.md)                                                                                                                                                                             |
| Hosting                                        | [hosted-deployment.md](docs/architecture/hosted-deployment.md), [launch-checklist.md](docs/launch-checklist.md)                                                                                                                        |
| Accounts                                       | [accounts-and-google-login.md](docs/architecture/accounts-and-google-login.md)                                                                                                                                                         |
| MCP                                            | [mcp-workspace-adapter.md](docs/architecture/mcp-workspace-adapter.md), [remote-mcp-connector.md](docs/architecture/remote-mcp-connector.md)                                                                                           |
| Inspiration                                    | [inspiration-and-products.md](docs/architecture/inspiration-and-products.md)                                                                                                                                                           |
| Studio and examples                            | [example-studio-polish.md](docs/design/demo-readiness/example-studio-polish.md), [hutchinson-whole-house-concept.md](docs/design/demo-readiness/hutchinson-whole-house-concept.md), [room-studio.md](docs/architecture/room-studio.md) |
| Model integration                              | [MODEL_INTEGRATION.md](docs/MODEL_INTEGRATION.md)                                                                                                                                                                                      |
| Last design review                             | [design-pass-2026-11-01.md](docs/design-pass-2026-11-01.md)                                                                                                                                                                            |
