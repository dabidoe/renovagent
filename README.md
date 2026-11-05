<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/web/src/assets/brand/renovagent-logo-light.webp" />
    <source media="(prefers-color-scheme: light)" srcset="apps/web/src/assets/brand/renovagent-logo.webp" />
    <img src="apps/web/src/assets/brand/renovagent-logo-light.webp" alt="RenovAgent logo" width="240" height="160" />
  </picture>
</p>

<h1 align="center">RenovAgent</h1>

<p align="center"><strong>See the possibilities. Plan the renovation. Bring your AI agent.</strong></p>

<p align="center">RenovAgent is an open-source renovation studio combining AI visualization, interactive 3D mockups, material cost estimates, and persistent project workspaces.</p>

<p align="center">
  <img src="docs/media/avatar-making_something.gif"
       alt="RenovAgent mascot imagining a renovation"
       width="200" />
</p>

<p align="center">
  <a href="https://renovagent.app">Launch App</a> |
  <a href="https://www.youtube.com/watch?v=E97iGaoiMz4">Watch Demo</a> |
  <a href="docs/architecture/README.md">Documentation</a>
</p>

[![Watch the RenovAgent Demo](https://img.youtube.com/vi/E97iGaoiMz4/hqdefault.jpg)](https://www.youtube.com/watch?v=E97iGaoiMz4)

## What you can do

### 1. Select real surfaces with SAM 3.1

Upload a room photograph and identify walls and other design elements with Meta's Segment Anything technology. Experiment with paint colors on the actual room instead of a generic template.

- SAM 3.1-powered wall segmentation and masks
- Interactive paint selection and previews
- Segmentation of inspiration-image elements

![Paint preview applied to SAM 3.1 wall outlines](docs/media/sam-segmentation.png)

### 2. Reimagine your room with Muse Image

Explore new flooring and room styles using AI-generated visualizations grounded in your original photo. Apply inspiration from another room while aiming to preserve the layout and recognizable features of your own space.

- AI-generated flooring variations
- Inspiration-guided room restyling
- Before-and-after comparisons
- Suggested paints and related material searches

*Generated visualizations illustrate design possibilities; they are not measured construction documents.*

![Before-and-after room restyle in the studio](docs/media/muse-before-after.png)

### 3. Explore interactive 3D room mockups

Move beyond a flat photograph with an interactive 3D room representation. Explore layout and furniture possibilities, and produce rendered views of the modeled space.

- Interactive 3D room scenes
- Furniture and layout exploration
- Photorealistic render options
- Headless Blender Cycles rendering on Modal GPU workers
- Downloadable interior, dollhouse perspective, and top-down renders, plus a GLB model

**Modal headless 3D workflow:** the browser sends the room model and selected wall and floor finishes to the API. The API submits a render job to Modal, where Blender runs in background mode, then polls for the completed images and GLB. Results return to the studio for viewing and download. The same Blender script supports local rendering with `npm run render:room`; the hosted path requires the configured Modal render service.

**AR placement is a future direction**, not a verified feature of the current public demo.

![Blender HD render of a modeled room](docs/media/3d-room.jpg)

### 4. Turn inspiration into design choices

Upload a reference image you like. RenovAgent analyzes its visual elements, identifies relevant colors and items, suggests nearby paint matches, and helps translate that style into your room.

- Muse Spark analyzes the inspiration and room context
- SAM 3.1 identifies visual elements
- Paint suggestions use color-distance matching
- Shopping suggestions link to store searches, not unverified inventory
- Muse Image can generate an inspiration-guided restyle

![Bedroom restyled from an inspiration photo](docs/media/inspiration.png)

### 5. Save, share, and collaborate with an AI agent

RenovAgent is designed around a **persistent renovation project**, not a disposable chat session.

Create a personal workspace, retain your uploaded room photos, and let an external AI agent work with the same project through an authenticated MCP connection.

- Guest access and optional Google sign-in
- Owner-scoped project data and uploaded photos
- Agent-generated plans and shareable plan links
- Inspiration links and photos contributed through MCP
- Saved project briefs, evidence, drafts, and design decisions

**Current sharing scope:** agent-to-owner plan links and project collaboration through authenticated tools. Public project galleries and unrestricted collaborative editing are not claimed as shipped.

![Persistent project workspace](docs/media/project-sharing.png)

### 6. Plan material costs with a catalog stored in MongoDB

The connected workspace stores product specifications, retailer offers, and dated price observations in MongoDB. Saved catalog records retain retailer and SKU details, product links, pack sizes, currency, observation dates, source labels, and freshness so a material estimate has a traceable basis.

- Match material requirements against compatible catalog products
- Compare builder-grade, mid-tier, and high-end material plans
- Calculate pack-rounded quantities and material totals from stored prices
- Retain pricing details in saved purchase-plan artifacts

The curated retail catalog contains manually recorded reference prices with source notes. Demo catalogs use explicitly labeled fictional products and prices. These are planning estimates; live retailer prices, inventory, and checkout totals are not connected. Tax and labor are excluded from catalog material totals.

See [catalog implementation](docs/architecture/commerce-catalog.md) and [retail reference sources](docs/retail-reference-prices.md).

## How Meta AI powers RenovAgent

Built for the **Meta Global AI Developer Hackathon**, using **SAM 3.1, Muse Spark, and Muse Image** to connect visual design with practical renovation planning.

| Technology | Role |
| --- | --- |
| **SAM 3.1** | Segments walls and identifies elements in room and inspiration images |
| **Muse Spark** | Analyzes rooms, interprets design instructions, and translates inspiration into structured choices |
| **Muse Image** | Generates flooring edits, inspiration-guided restyles, and photorealistic room imagery |
| **Model Context Protocol (MCP)** | Connects external AI agents to persistent renovation projects and bounded proposal tools |
| **Modal + Blender** | Runs headless GPU rendering jobs for room images and GLB exports |
| **MongoDB Atlas** | Persists project workspaces, product catalogs, retailer offers, and dated price observations |
| **Railway** | Hosts the web application, API, and authenticated MCP endpoint at one public origin |

React, TypeScript, and Three.js power the browser studio. Railway hosts [renovagent.app](https://renovagent.app), with MongoDB Atlas for persistent data and Modal for the separate Blender render jobs.

## From a photo to a project

```text
Real room photos + inspiration
              |
     SAM 3.1 + Muse Spark
              |
    Surface and design choices
              |
       Muse Image edits
              |
   Interactive 3D mockups
              |
   Persistent project record
              |
   Owner + connected AI agent
              |
   Plans, references and handoff
```

The visual studio helps you explore what a space could become. The project workspace is intended to carry those ideas toward practical renovation decisions.

## Try it

**[Open the live demo](https://renovagent.app)**

You can explore prepared listing examples or start with your own room photos. The hosted experience includes guest access and a connection flow for compatible MCP clients.

**Explore the examples** (no sign-in): [all examples](https://renovagent.app/#examples) · [Philadelphia rowhouse](https://renovagent.app/#example-house) · [Oakland](https://renovagent.app/#example/oakland) · [Brooklyn](https://renovagent.app/#example/brooklyn) · [bedroom refresh](https://renovagent.app/#example/bedroom-refresh)

For agent connections, use the application's **Connect** flow to create a scoped access key. The MCP endpoint is:

```text
https://renovagent.app/mcp
```

Do not put access keys in repository files or public screenshots.

## Run locally

Requires Node.js and npm.

```bash
npm install
npm run dev
```

Open the local app at `http://127.0.0.1:8741/`.

The default local workspace uses browser storage. To run the connected API, database, and MCP services:

```bash
npm run dev:connected
```

See the [connected setup guide](docs/architecture/connected-muse-and-mongo.md) for environment configuration, database selection, credentials, and limitations.

## Development and testing

| Command | Purpose |
| --- | --- |
| `npm test` | Run contract, domain, legacy, and integration tests |
| `npm run test:connected` | Run connected integration tests against local MongoDB |
| `npm run ui:check` | Browser checks of the public pages, with screenshots in `.local/ui-check/` |
| `npm run build` | Type-check, validate boundaries, and build |
| `npm run build:pages` | Produce a static GitHub Pages package of the site |

### Repository structure

- `apps/web/` — web application and design studio
- `apps/api/` — connected API, model calls, and MCP services
- `packages/contracts/` — shared schemas and commands
- `packages/core/` — planning logic and domain rules
- `tests/` — automated verification
- `docs/architecture/` — architecture and implementation notes

## Project status and roadmap

RenovAgent is an active prototype. Its visual studio, selected 3D rendering workflows, project persistence, and MCP integrations are implemented, with functionality varying by environment and configuration.

**Planned or incomplete capabilities** include camera-based AR placement, broader sharing and collaboration, verified live supplier prices, contractor verification, purchasing, and billing.

Material prices are saved reference observations or labeled demo examples rather than live offers. AI-generated designs are conceptual; physical dimensions, material suitability, code requirements, and contractor decisions require separate verification.

For detailed implementation status and limitations, see [PROGRESS.md](PROGRESS.md) and [HANDOFF.md](HANDOFF.md).

---

**RenovAgent — from the room you have to the home you imagine.**
