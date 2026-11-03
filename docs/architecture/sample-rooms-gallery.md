# Sample rooms in photo intake

November 2, 2026. UI and static assets only; local branch, not pushed/deployed.
Expanded in the owner-requested follow-up from two owner photos to eight rooms,
with six attributed Unsplash photos and editable furniture prompts.

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
in the UI. Missing/blank source or license, invalid filenames, unsafe source/license URLs and duplicate IDs
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
and focuses it; **Apply** is still required for `/studio/imagine`. **Try furniture ideas** opens Restyle. Each room has two furnishing directions;
choosing one fills the editable brief and sets Furnish mode without a provider
call. **Create room design** uses the unchanged `/studio/restyle` endpoint with
the uploaded image hash, owner edits and existing floor-preservation flag.
Room-type filters and per-photo photographer links make the eight-room grid
browsable. Existing floor, detection and project-save paths remain unchanged.

**Sample room ⓘ** appears on the current room's project header, with the source
and license in its hover title and a keyboard/touch disclosure. Attribution and
suggestions follow the uploaded image hash in browser storage; intake recovery
also retains metadata alongside the File bytes. They survive reload in that
browser. This deliberately adds no API/domain fields: attribution does not
travel to another browser with a saved project link, and clearing browser data
removes it. Server-side provenance would require a separately scoped change.

## Assets, excluded candidates and owner slots

Eight photos are published: the two original owner-approved sources plus six
curated Unsplash photos. The new set contains an empty apartment (Lisa Anna), a
sunlit kitchen (Cat Han), a bathroom (Christa Grover), a calm bedroom and
forest-view dining room (Clay Banks), and an artist studio (Annie Spratt).

Each external photo page identifies the free Unsplash License. Photographer,
source page and license links are retained in the manifest/UI, with checked date,
download URL, exact output dimensions/byte counts and SHA-256 hashes in
`public/starter-rooms/provenance.json`. Full credits/source links and licensing
basis are in [the asset README](../../public/starter-rooms/README.md). Photos are
labelled Unsplash License, not public domain. This is an interactive design sample
set, with no runtime stock-photo API, search or provider-key requirement.

The two originals keep the specified owner-photo credit/license. Six new JPEGs
use a 2048 px long edge at quality 85 with 400 px thumbnails; together the twelve
new assets total 2,318,173 bytes (about 2.21 MiB). No image generation or prepared
furniture output is included in the sample-upload path. Furniture prompts are
editorial starting points; model outputs still require the user's normal action.

**Excluded pending the owner's decision:** all candidates in
`public/examples/hutchinson/`, `public/examples/brooklyn/`, and
`public/examples/oakland/`, because they are listing-derived or have unclear
redistribution rights. No licensing decision was inferred from existing use.

Four reserved slots (kitchen, bathroom, office, dining) and exact JPEG/thumbnail/
manifest steps are in [the gallery asset README](../../public/starter-rooms/README.md).
They are documentation placeholders; no empty, unlicensed cards appear to judges.

## Verification

- `npm test`: **15 legacy tests pass; 324 TypeScript tests pass; 52 skipped;
  0 failures**. Six gallery tests cover manifest/render filtering, asset sizes,
  identical sample/user request shape and exact bytes, static fetch failure,
  intake recovery with attribution/suggestions, and pinned source/asset provenance. Initial sandbox-only hosting
  failure (`listen EPERM`) passed on rerun with local loopback permission.
- `npm run build`: typecheck, dependency boundaries and both production builds
  pass. The existing bundle-size warning remains.
- `scripts/verify-sample-rooms.mjs`: **111 Playwright assertions pass** with a local
  Vite frontend and intercepted APIs only. It checks desktop landing → sample →
  guest → studio and phone intake → sample → guest → studio, raw bytes/headers,
  guest mint ordering, source/license disclosure, Paint & floor default, chip
  prefill with no model call, normal Apply routing, reload recovery, ordinary
  file upload parity, invalid-rights filtering, friendly fetch failure/Details,
  hidden native inputs, readable chips and no horizontal overflow. The expanded
  checks also cover all eight thumbnails, room filters, source/license links,
  sourced-file byte parity, furniture brief editing and the real Restyle request
  shape. Its intercepted provider failure stays visible without a canned result.

Run the browser check against a frontend-only local Vite instance (default port
8745); it refuses non-loopback URLs and intercepts every `/api/` request:

```sh
npm run dev -- --port 8745 --strictPort
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node --import tsx scripts/verify-sample-rooms.mjs
```

Use an existing Playwright installation; no npm dependency was added/downloaded.
The six licensed source-photo downloads were explicitly requested by the owner.
Without PLAYWRIGHT_MODULE, the script uses a resolvable `playwright` package.

Screenshots were visually inspected at the requested viewport sizes. API responses
are explicit browser-test fixtures with unknown dimensions, empty masks and no
generated previews; the UI screenshots do not establish provider success:

| Viewport   | Add-photo sheet                                          | Project started from a sample                                   |
| ---------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| 1440 × 900 | [Sheet](../previews/sample-rooms/add-photo-1440x900.png) | [Project](../previews/sample-rooms/sample-project-1440x900.png) |
| 390 × 844  | [Sheet](../previews/sample-rooms/add-photo-390x844.png)  | [Project](../previews/sample-rooms/sample-project-390x844.png)  |

Additional furniture-brief screenshots (before the normal generation action):
[1440 × 900](../previews/sample-rooms/sample-furniture-1440x900.png) and
[390 × 844](../previews/sample-rooms/sample-furniture-390x844.png).

**Unverified in this change:** live guest service/database persistence, SAM/Muse
reads or generations, physical phone camera behavior, provider quotas/latency,
and saved-link attribution on another browser (unsupported by this UI-only
metadata). No live provider calls, Atlas writes, credential changes, deployment
or push occurred. There are no API/provider/domain changes.
