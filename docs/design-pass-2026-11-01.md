# Design pass — 1 Nov 2026

A judge's walk through the hosted site at desktop (1280, 1920) and phone (390)
width: landing, `#connect`, `#examples`, an example studio, `#your-project`, and
the projects dialog. "Fixed" items are on `main`; "Open" items are listed with
what fixing them would take.

## What changed

| Area                             | Was                                                                                                                         | Now                                                                                                                                                                                                                   | Commit                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Hero                             | Two hand-drawn polygons (vanity, floor) that did not follow the objects; the floor outline cut through the prompt card      | SAM 3.1 masks of all four finishes (vanity, mirror, shower tile, floor), computed once by `scripts/hero-segments.ts` and committed (9 KB). The floor comes back as 33 individual hex tiles                            | `5a8ad33`              |
| Hero card                        | AI product thumbnail beside "IKEA ÄNGSJÖN"; `$/hr` labor rows with no example label                                         | Reads the landing's existing allowances (`bath-materials.ts`), shows what SAM saw ("33 hex tiles visible") and what is still unpriced, labelled "Example prices for this demo, not live offers · Outlines by SAM 3.1" | `5a8ad33`              |
| Hero pins                        | Fixed percentages; on phones they sat on the CTA pills                                                                      | Placed from the photo crop, skipped where they would cover the headline, prompt or card; four tabs in the card reach every finish on any width                                                                        | `5a8ad33`              |
| Hero links                       | 21 px text links ("Connect with Muse or your agent" among them)                                                             | Three 44 px pill buttons; the Muse icon is inside its link                                                                                                                                                            | `5a8ad33`              |
| "The room. The work. The price." | **Empty white frame on the hosted site**: images imported from `docs/previews`, which `.dockerignore` drops                 | Images bundled from `apps/web/src/assets/previews` (797 KB PNG → 330 KB JPEG)                                                                                                                                         | `70437e5`              |
| Footer / agent GitHub links      | Pointed at the old `unpermitted-ai` repo name                                                                               | `dabidoe/renovagent`                                                                                                                                                                                                  | `70437e5`              |
| Before/after caption             | "Drag to reveal the transformation" near-invisible on blue                                                                  | Light text on blue                                                                                                                                                                                                    | `3451107`              |
| Agent section                    | "Connect your agent" / "Built on MCP" were 11 px links that broke into fragments on phones                                  | Primary and secondary 44 px buttons                                                                                                                                                                                   | `3451107`              |
| Footer links                     | 14 px tall                                                                                                                  | 44 px hit areas                                                                                                                                                                                                       | `3451107`              |
| Example studio                   | 29 controls under 40 px on a phone (paint line, finish, floor material, tier, view toggle, swatches 34 px, "Listing" 16 px) | 44 px on touch screens and narrow windows, compact with a mouse; "View listing ↗" is a button                                                                                                                        | `3451107`              |
| Phone account                    | Below 480 px the header hid the account, so a phone guest had no Sign out and no Keep with Google                           | The projects dialog (header picker) always shows "Signed in as …", Keep with Google (guests) and Sign out                                                                                                             | `3451107`              |
| Desktop account                  | "Keep with Google" / "Sign out" 11 px links                                                                                 | 36 px pills                                                                                                                                                                                                           | `3451107`              |
| `#connect`                       | Copy 32 px, Make key 36 px, key name 37 px                                                                                  | 44 px                                                                                                                                                                                                                 | `3451107`              |
| Examples                         | Edits are kept in this browser (localStorage), but nothing said so                                                          | Kicker: "Example from a real listing · your changes stay in this browser" (checked: a paint and floor change survive a reload)                                                                                        | `3451107`, this commit |
| Guests                           | Signing in with Google stranded the guest's work                                                                            | The guest account becomes the Google account (workspace, keys, plans kept)                                                                                                                                            | `72b39df`              |

## Still open — looks wrong or could be better

| #   | Page · width             | What                                                                                                                                                                                                 | Severity              | Fix                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Landing · Materials tab  | `product-*.jpg` are generated images shown beside real product names; one view says "Generated style image, not an exact product photo", but the list views strip "concept" from the finish and spec | Medium (honesty rule) | Show the disclaimer on every view, or swap the thumbnails for SAM crops of `workspace-bath.jpg`                                                                                                                                                                                                                 |
| 2   | Landing hero · 1920 wide | The photo is cropped hard at wide screens; the mirror and shower leave the frame, so only two pins show (tabs still reach all four)                                                                  | Low                   | A wider hero photo, or `object-position` tuned for ≥1600 px                                                                                                                                                                                                                                                     |
| 3   | Landing hero · phone     | No pins at 390 px: every object sits behind the copy. Tabs carry it                                                                                                                                  | Low                   | Fine as is; a shorter phone hero would expose the floor                                                                                                                                                                                                                                                         |
| 4   | Projects dialog          | With no projects yet, an empty gap sits above "New project"                                                                                                                                          | Low                   | Hide the empty project list                                                                                                                                                                                                                                                                                     |
| 5   | Example studio           | Edits live only in this browser; there is no "Save to my account", so they do not follow the owner to another device or into their workspace                                                         | Medium (asked for)    | `save_plan` already stores a plan per owner, but a saved plan has no photos (`studioProject` builds photo-less rooms), so a saved example would come back 3D-only, worse than the example. Do it properly: store the listing id and per-room picks in the account, reopen in the listing studio with the photos |
| 6   | Example studio · Sources | "the public listing" is a 16 px inline link inside a sentence                                                                                                                                        | None                  | Inline links in running text are exempt; left as is                                                                                                                                                                                                                                                             |

## Next feature ideas from this pass

1. **What's already in the room (SAM inventory).** SAM 3.1 answers a phrase with every
   matching object, so a fixed vocabulary (vanity, toilet, mirror, wall tile, floor tile,
   baseboard, door, window) turns a listing photo into a list of what is present, with
   outlines and counts. It counts what is visible: the hero's "33 hex tiles" includes
   partial tiles at the edges and excludes tiles under the vanity, so it is an observation
   to show, never an order quantity. Muse Spark can name objects first and SAM outline
   them.
2. **Existing paint, nearest match.** Average the pixels inside SAM's wall mask, correct for
   white balance where possible, and find the nearest catalog colours by perceptual
   distance (CIEDE2000) in code. Jev then picks among the five nearest given the owner's
   words ("warm, not yellow"). Label it "closest catalog colour to the photo", not the
   paint on the wall.
3. **Inspiration photo → your room.** The same pipeline on someone else's photo: SAM finds
   walls, floor and cabinets; code takes their colours and nearest products; the studio
   proposes them on the owner's own photos. Reuses the studio's SAM wall masks, the paint
   catalog and Jev.

## How this was checked

- Playwright against the hosted site and a local build at 1280, 1920 and 390 px.
- A tap-target audit (anything under 40 px) on the landing, `#connect`, `#examples`, an
  example studio and `#your-project`, rerun after the fixes. At phone width the landing
  and every app page are clear, except three studio items left on purpose: an inline
  sentence link, a 36 px paint-name link and a checkbox inside its label. With a mouse,
  the landing nav and tabs stay compact at 35–38 px.
- An example studio edit (paint and floor) survives a reload; the kicker says so.
- SAM masks rendered over the photo and inspected before wiring; the shower's reflection in
  the mirror is filtered out by position.
- `npm test` (15 + 278) and `npm run build` pass after each change.
