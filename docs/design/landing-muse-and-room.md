# Landing brief: show it working (Muse + the room)

October 30, 2026. For Codex, who owns the landing redesign (port 8742). This
is a content brief, not a layout: keep your visual system. Two changes matter
most for the hackathon: show the room product, and show that Muse can actually
drive it.

## 1. The "Built for your agent" section: show, don't describe

Today (`apps/web/src/features/landing/landing.tsx`, `agent-strip`) the section
is text only, and its details say "Authenticated MCP reads and a separate QA
brief write/read were tested with Muse through temporary HTTPS." Accurate, but
nobody outside the team can read it.

Replace with a two-column block: copy on the left, a real screenshot on the
right.

**Image.** A real screenshot of the Muse Mac app connected to Renovagent. The
owner has one: Muse's connector card, "Renovagent · Connector · Connect",
followed by "Renovagent is connected." Ask them to save it as
`docs/previews/muse-connector-connected.png`. Before you publish it:

- Blur or crop the `trycloudflare.com` address. It's a dead test tunnel, but a
  URL on the landing invites people to try it.
- Crop to the connector card and the "connected" reply. Drop the long
  paragraphs about credentials.
- Caption it plainly: "Muse connecting to a Renovagent project (test build)."

Use only real screenshots. Don't mock a Muse conversation; a fake one in the
spot that says "this works" undercuts the whole section. If the image isn't
ready, ship the copy without it.

**Copy (replace the current block):**

- Eyebrow: `WORKS WITH MUSE`
- Heading: `Plan it in a chat. It lands in your project.`
- Body: `Ask Muse about your room. It reads your saved project, proposes the
work and saves it back. You approve every change.`
- Three short chips: `Reads your project` · `Proposes changes` ·
  `Never approves for you`
- Status line (small, not hidden in a details element): `Tested in the Muse
app. A permanent connection arrives with our hosted launch.`

Avoid: "MCP", "authenticated", "QA brief", "write/read", "HTTPS", "revision".
A single "Built on MCP" footnote is fine for technical judges.

## 2. Show the room

The product now opens on a 3D room with the work pinned in it, a DIY price
next to a pro quote, and a popup for each step. That's the most demoable thing
we have, and the landing doesn't show it.

**Images** (real captures, 1440 px wide, in `docs/previews/`):

| File                      | Shows                                                               |
| ------------------------- | ------------------------------------------------------------------- |
| `room-quotes-home.png`    | The room, DIY ≈ $868.60 vs Hire a pro $1,953.24, example quotes     |
| `room-task-diy.png`       | Vinyl plank step: Medium difficulty, materials, tools, how-to video |
| `room-task-hire.png`      | Same step, three example contractor quotes (materials + labour)     |
| `room-quote-itemized.png` | One example quote, itemized per step, with a review                 |

Crop to the room card. They are from the labelled example project. Keep the
"Example" tags visible in any crop, since the contractors, reviews and quotes
are made up.

**Copy:**

- Heading: `See your room, the work and the price.`
- Three points:
  - `Every job pinned where it happens, in order: prep, demo, paint, floors.`
  - `DIY or hire out: what it costs you, and what a pro quoted.`
  - `How hard it is, the tools you'd need, and a how-to video.`
- Button: `Open the example room` (calls the existing `onExample`).

## 3. Wording rules for the whole page

- Don't name the 3D tooling (no "Blender", "Gaussian splat", "three.js",
  "GLB"). Say "3D room". Judges who care will ask.
- Phone measuring: `Measure with your phone · coming soon`. The iPhone app is
  `coming soon` too. No App Store badge.
- Prices: "typical big-box prices", never "Home Depot price". The store links
  are searches, not quoted prices.
- Example contractors and reviews are labelled "Example", never shown as
  Google reviews and never with a Google logo.
- Delete the "quote comparison is in development" line in the workflow
  status. It now exists in the example (with example quotes).

## 4. What is true today (for any claim you write)

| Claim                                   | Status                                                  |
| --------------------------------------- | ------------------------------------------------------- |
| Muse connects and reads/saves a project | Tested once over a temporary tunnel (Oct 29)            |
| Muse on a permanent link                | Not yet: needs hosting with the MCP endpoint inside it  |
| 3D room with pinned, priced work        | Live in the app (example project)                       |
| DIY price                               | Template typical-retail prices, labelled                |
| Contractor quotes                       | Example fixtures only; real quote upload is coming soon |
| Phone room scan                         | Coming soon (imports scan files today)                  |
