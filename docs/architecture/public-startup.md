# Public startup and saved-workspace routing — November 3, 2026

## Incident

The root URL could open the active saved project's notes workspace instead of the landing page. Clicking the logo set a component flag and revealed the intended homepage. `main.tsx` also awaited `WorkspaceController.open()` before rendering anything, so public visitors and returning owners waited for session discovery and, when signed in, a full private workspace read. Previous Mongo/image caching work did not remove that dependency.

## Implemented boundary

- `PublicApp` chooses the page from the URL. `/`, landing section anchors, public examples, photo intake and Connect do not bootstrap the notes workspace. Each studio retains its own narrow session/API requests when needed.
- The existing workspace/controller loads on explicit `#workspace` routes. The studio menu uses `#workspace/projects`; selecting a saved project keeps an explicit workspace URL. The Philadelphia source panel's measured-room example uses `#workspace/example-room` and retains its existing fixture workflow.
- Public navigation uses fragment history, including logo/home, browser back/forward and refresh. Sign-in return fragments are restored before routing, including encoded saved-design IDs. Sign-in failure remains visible.
- A slow or failed workspace request has a way back home. Its eventual completion cannot render over the public page. Saved records are not reset or migrated by this fix.
- The homepage preview defers the full studio renderer until the preview enters its existing visibility boundary. The initial production entry is about 464 KB versus 1,178 KB before (uncompressed); studio, notes-workspace and 3D chunks load separately.

## Verification and limits

`scripts/startup-check.ts` exercises the built production site with a saved connected project, a seeded local project, a deliberately slow private read, blocked IndexedDB and an unavailable API. It checks root/refresh, zero private API reads and no notes-workspace chunk at public startup, gallery/home/back/forward, explicit saved-project access, retained local records, File/brief handoff through the sign-in gate, encoded OAuth returns, visible sign-in errors and leaving a slow request.

Run it after a production build:

```sh
NODE_ENV=production npm run build
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node --import tsx scripts/startup-check.ts
```

The optional `--before <built-site-directory>` records the previous behavior under the same conditions. Reports and desktop captures are written to `.local/startup-check/`. In the comparison, the returning connected owner saw the wrong page after 4,617 ms before and the landing page after 558 ms with the fix; the saved-local case also opens the landing, with zero API requests. Timings use local Chrome with 4× CPU throttling and a mocked four-second private workspace read; they are not production-network or generation-time claims. The normal public UI guardrail covers the public routes and prepared samples at desktop, 390 px and 320 px.

Private workspace reads, provider generation latency and a cold private-image transfer remain separate paths. No production accounts, uploads, inference calls, database writes or credential changes are part of this fix's verification.
