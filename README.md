# Renovagent

**From renovation idea to a quote-ready plan.**

A persistent project for your house, your AI agent, and the people doing the work. Collect the evidence, define the job, and keep decisions connected as the project changes.

[Product direction](docs/design/agent-first-product.md) · [Architecture](docs/architecture/README.md) · [Build status](PROGRESS.md) · [Current handoff](HANDOFF.md)

## The idea

Tell your agent what you want to improve. Renovagent should turn that brief into a specific scope, traceable materials, and comparable supplier offers and contractor quotes. Your agent and the website work from the same project record.

The website stays simple: a prompt, a home selector, and project tools when you need them. The durable project is the product; chat is one way to use it.

## What works today

This is an early development project. The current local working tree includes:

- Persistent projects, source evidence, versioned artifacts, and saved drafts.
- A prompt-first workspace with house, plan, history, and evidence tools.
- Shared deterministic planning calculations and downstream invalidation when facts change.
- A connected MongoDB/API workspace with bounded Muse photo-analysis jobs; API and MCP share the configured Atlas cluster.
- An authenticated MCP connector, tested in the consumer Muse Mac app: discover projects, start a separate project and save/read its proposed brief.
- Optional Google/Meta sign-in with per-owner workspaces (needs your OAuth clients; see the accounts doc).
- A demo commerce catalog with tiered purchase plans and contractor review (example prices only).
- **Hosted** at https://renovagent-production.up.railway.app: listing examples and your own photos in a paint and floor studio (SAM 3.1 walls, Muse Image floors and restyles, 3D rooms), inspiration photos turned into items, paints and store searches, one-click guests, and `/mcp` for your own agent.

General messages in the website are saved notes; the tested consumer Muse connection uses the shared MCP tools. Both local stdio and authenticated Streamable HTTP expose owner-scoped reads and proposals. Live supplier pricing, contractor verification, purchasing and billing remain open. The older MCP demo uses a different project model.

See [current implementation and limits](docs/architecture/connected-muse-and-mongo.md), [Atlas migration](docs/architecture/atlas-migration.md) and [consumer Muse connection evidence](docs/architecture/remote-mcp-connector.md).

## Run locally

```bash
npm install
npm run dev
```

Open [the workspace](http://127.0.0.1:8741/) or [the landing page](http://127.0.0.1:8741/landing.html). The default workspace uses this browser's IndexedDB; no account is required.

For the connected workspace (API and frontend still run locally):

```bash
npm run dev:connected
```

Follow the [connected setup guide](docs/architecture/connected-muse-and-mongo.md) for MongoDB, server-only credentials, explicit data transfer, and current limits. The static website cannot run these local services.

The connected launcher uses the configured `MONGODB_URI` cluster by default. See [database selection](docs/architecture/remote-mcp-connector.md#database-selection) for explicit local mode; selecting a database does not synchronize or merge it with another copy.

## How it fits together

```text
Web workspace       External agents (local MCP)
       \                    /
        Shared application services
                    |
          Validated domain commands
                    |
       Versioned project + evidence
```

Models propose changes. Shared domain code validates units, revisions, dependencies, and release rules. Reported facts, assumptions, retrieved sources, and verified evidence stay distinguishable. A proposal cannot approve itself or release construction work.

## Development

| Command                  | Purpose                                              |
| ------------------------ | ---------------------------------------------------- |
| `npm test`               | Legacy, contract, domain, and integration suites     |
| `npm run test:connected` | Integration checks against local test MongoDB        |
| `npm run build`          | Types, dependency boundaries, and production builds  |
| `npm run build:pages`    | Build a static GitHub Pages package in `pages-dist/` |

The Pages package puts the landing page at the root and the prototype at `workspace.html`. It does not publish anything. See [publication notes](docs/design/github-pages.md).

## Repository

- `apps/web/` — React workspace and browser adapters
- `apps/api/` — optional local workspace API and bounded Muse jobs
- `packages/contracts/` — runtime schemas and commands
- `packages/core/` — domain logic, calculations, and repository ports
- `landing.html`, `src/landing.css` — public landing page
- `tests/` — behavior and integration verification
- `docs/architecture/` — target architecture and implemented-slice evidence
- `legacy.html`, `server/` — earlier demo, retained during migration

The half bath is the first reference scenario, not the limit of the product. The name does not mean skipping permits: required professional reviews, permits, and inspections remain part of the workflow.
