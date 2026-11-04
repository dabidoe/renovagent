# Public startup and saved-workspace routing — November 3, 2026

## Simplified header — November 4, local

The public header contains Connect, Studio, + New Project and Account. Studio
opens the gallery at `#studio`; + New Project opens photo intake at `#new-project`.
The old `#examples` and `#your-project` fragments are replaced with their canonical
routes on entry, retaining existing shared links and sign-in returns. Both homepage
gallery buttons read “Try studio.” Header links wrap when needed on narrow phones.
Account retains sign-in, guest recovery and sign-out; Open my projects is inside
the account dialog and remains available before sign-in. The Google sign-in and
guest recovery actions include a decorative multicolor Google G. Session requests,
provider configuration, draft flushing and OAuth redirects are unchanged.
The offline account-navigation check covers header labels, four header actions,
Google icons, guest sign-in, saved-project access and recovery at
1440/1024/768/390/320 px. No real OAuth, production writes or deployment.

## Incident

The root URL could open the active saved project's notes workspace instead of the landing page. Clicking the logo set a component flag and revealed the intended homepage. `main.tsx` also awaited `WorkspaceController.open()` before rendering anything, so public visitors and returning owners waited for session discovery and, when signed in, a full private workspace read. Previous Mongo/image caching work did not remove that dependency.

## Implemented boundary

- `PublicApp` chooses the page from the URL. `/`, landing section anchors, public examples, photo intake and Connect do not bootstrap the notes workspace. Each studio retains its own narrow session/API requests when needed.
- The existing workspace/controller loads on explicit `#workspace` routes. The public **My projects** link now uses `#projects`, with saved studio revisions opening directly; the older notes picker remains at `#workspace/projects`. Selecting a notes project keeps an explicit workspace URL. The Philadelphia source panel's measured-room example uses `#workspace/example-room` and retains its existing fixture workflow.
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

## Account and project discovery — November 3 follow-up

The public header now shows Sign in/Account and a visible My projects link. Navigation wraps in document flow (two columns at 320/390 px); it does not use an overlay menu. Account discovery makes a narrow `/session` request without awaiting it before rendering the landing or loading private project records. The startup guard allows that request while continuing to prohibit private workspace reads on public startup. Earlier zero-total-API measurements above describe the prior increment.

`#projects` loads owner-scoped projects only after explicit navigation. Saved studio cards link to the latest recorded design revision; notes projects retain the older workspace picker. A separate browser-recovery card points to the current studio, which may contain unsynced edits. Failed reads show retry and do not report an empty account. Guest accounts explain how to retain access with Google.

An empty home-page “try your own” action resumes the current studio instead of replacing it with an empty intake. Google navigation waits for queued intake file transactions, and intake recovery preserves the actual photo/plan files. This does not add cross-device browser-draft sync, automatic account-saving of browsed examples, or new server persistence. Existing studio autosave, revision conflicts and retry commands remain unchanged.

Verified locally: production build/types/boundaries; five focused sync/recovery tests; startup regression checks; 202 public UI guardrails; and `scripts/account-navigation-check.ts` at 1440/1024/768/390/320 px. The latter intercepts all API requests and checks unobscured navigation by hit-testing, sign-in dialog bounds, guest session updates, saved-design discovery and reload. Phone sign-in and phone/desktop project screenshots were visually reviewed in `.local/account-navigation-check/`. No real OAuth round-trip, production account write or deployment was performed.
