# Sample rooms in photo intake

November 2, 2026. UI and static assets only; local branch, not pushed/deployed.

## Main demo route and entry points

The landing page (`features/landing/landing.tsx`) renders the compact
`features/project-start/photo-picker.tsx`. Start a project passes its File objects
and brief through `workspace-app.tsx` to `#your-project`, which renders
`features/house-example/own-studio.tsx`.

One shared `AddPhotoSheet` is used by the landing PhotoPicker and the OwnStudio
room-photo button. It offers **Take photo** (image file input with
`capture="environment"`), **Upload**, and **Sample rooms**. The generic PhotoPicker
opts in explicitly, so inspiration/reference inputs do not acquire site-room
samples accidentally.

The other investigated entry points are separate workflows:

- `room3d/room-welcome.tsx` and `room3d/owner-photos.tsx` belong to the older
  measured-room workspace, via `RoomStudio`.
- `house-example/house-example.tsx` → Add photos or plans attaches evidence files
  to the prepared whole-house case through the workspace controller. It does not
  use the studio-photo intake route.

Those entry points retain their existing behavior.

## Upload and live behavior

`public/starter-rooms/manifest.json` is parsed per entry with a small Zod schema
in the UI. Missing/blank source or license, invalid filenames and duplicate IDs
are excluded before rendering. A malformed top-level manifest shows a retryable
friendly error with closed **Details**.

Selecting a sample fetches the full static JPEG and constructs a File. The
existing intake build checks `/session`; signed-out account mode presents
**Continue as guest**, awaits `/auth/guest` and the normal session resume, then
uploads. Both sample and owner files call the shared UI upload helper using
`workspaceRequest('/studio/photo', file)`: raw POST, JPEG Content-Type,
X-File-Name and same-origin credentials. There is no sample-only API, source-fact
mutation, fixture-project import or canned-result fallback.

The normal `/studio/read` and `/studio/walls` run after upload. Paint & floor
remains the default tab. A sample chip fills the editable Paint & floors prompt
and focuses it; **Apply** is still required for `/studio/imagine`. Existing floor,
detection, Restyle and project-save paths remain unchanged.

**Sample room ⓘ** appears on the current room's project header, with the source
and license in its hover title and a keyboard/touch disclosure. Attribution and
suggestions follow the uploaded image hash in browser storage; intake recovery
also retains metadata alongside the File bytes. They survive reload in that
browser. This deliberately adds no API/domain fields: attribution does not
travel to another browser with a saved project link, and clearing browser data
removes it. Server-side provenance would require a separately scoped change.

## Assets, excluded candidates and owner slots

Two approved source photos only:

- `public/example-room/before.jpg` → living-room.jpg, 1600 × 1000.
- `public/examples/bedroom-refresh/before.jpg` → bedroom.jpg, 1200 × 1200.

Both are labelled **Renovagent owner photo / Owner-provided for demo**, as
specified by the owner. JPEG quality 85, long edge capped at 2048; native sources
are smaller and were not upscaled. Thumbnails are 400 × 250 and 400 × 400. Four
JPEGs total about 545 KiB. Originals are untouched.

**Excluded pending the owner's decision:** all candidates in
`public/examples/hutchinson/`, `public/examples/brooklyn/`, and
`public/examples/oakland/`, because they are listing-derived or have unclear
redistribution rights. No licensing decision was inferred from existing use.

Four reserved slots (kitchen, bathroom, office, dining) and exact JPEG/thumbnail/
manifest steps are in [the gallery asset README](../../public/starter-rooms/README.md).
They are documentation placeholders; no empty, unlicensed cards appear to judges.

## Verification

- `npm test`: **15 legacy tests pass; 323 TypeScript tests pass; 52 skipped;
  0 failures**. Five new tests cover manifest/render filtering, asset sizes,
  identical sample/user request shape and exact bytes, static fetch failure,
  and intake recovery with attribution/suggestions. Initial sandbox-only hosting
  failure (`listen EPERM`) passed on rerun with local loopback permission.
- `npm run build`: typecheck, dependency boundaries and both production builds
  pass. The existing bundle-size warning remains.
- `scripts/verify-sample-rooms.mjs`: **65 Playwright assertions pass** with a local
  Vite frontend and intercepted APIs only. It checks desktop landing → sample →
  guest → studio and phone intake → sample → guest → studio, raw bytes/headers,
  guest mint ordering, source/license disclosure, Paint & floor default, chip
  prefill with no model call, normal Apply routing, reload recovery, ordinary
  file upload parity, invalid-rights filtering, friendly fetch failure/Details,
  hidden native inputs, readable chips and no horizontal overflow.

Run the browser check against a frontend-only local Vite instance (default port
8745); it refuses non-loopback URLs and intercepts every `/api/` request:

```sh
npm run dev -- --port 8745 --strictPort
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node --import tsx scripts/verify-sample-rooms.mjs
```

Use an existing Playwright installation; no dependency was added/downloaded.
Without PLAYWRIGHT_MODULE, the script uses a resolvable `playwright` package.

Screenshots were visually inspected at the requested viewport sizes. API responses
are explicit browser-test fixtures with unknown dimensions, empty masks and no
generated previews; the UI screenshots do not establish provider success:

| Viewport   | Add-photo sheet                                          | Project started from a sample                                   |
| ---------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| 1440 × 900 | [Sheet](../previews/sample-rooms/add-photo-1440x900.png) | [Project](../previews/sample-rooms/sample-project-1440x900.png) |
| 390 × 844  | [Sheet](../previews/sample-rooms/add-photo-390x844.png)  | [Project](../previews/sample-rooms/sample-project-390x844.png)  |

**Unverified in this change:** live guest service/database persistence, SAM/Muse
reads or generations, physical phone camera behavior, provider quotas/latency,
and saved-link attribution on another browser (unsupported by this UI-only
metadata). No live provider calls, Atlas writes, credential changes, deployment
or push occurred. There are no API/provider/domain changes.
