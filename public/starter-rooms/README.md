# Starter room photos

These are **source photos**, not prepared example projects. Choosing one fetches
its JPEG into a File; the normal intake checks the session, offers guest minting,
and uploads the raw file to `/api/workspace/studio/photo`. Room reads, wall
detection, paint/floor generation and Restyle use the existing live endpoints.
No masks, dimensions, prices or generated images are bundled in this gallery.

## Published assets and rights

| ID          | Original in this repository                  | Rights supplied by owner                         | Full JPEG   | Thumbnail |
| ----------- | -------------------------------------------- | ------------------------------------------------ | ----------- | --------- |
| living-room | `public/example-room/before.jpg`             | Renovagent owner photo / Owner-provided for demo | 1600 × 1000 | 400 × 250 |
| bedroom     | `public/examples/bedroom-refresh/before.jpg` | Renovagent owner photo / Owner-provided for demo | 1200 × 1200 | 400 × 400 |

JPEG quality is 85, long edge capped at 2048 without upscaling. Thumbnails use
a 400 px long edge. Originals are unchanged. Rights are owner-provided claims,
not independently verified licensing advice.

Excluded pending the owner's rights decision: `public/examples/hutchinson/`,
`public/examples/brooklyn/`, and `public/examples/oakland/`. They contain
listing-derived photos or have unclear redistribution rights. Existing uses
elsewhere are outside this gallery change.

## Four reserved slots

These placeholders are documentation only; no empty or unlicensed card is shown.
Each can become any room type, not just the suggested one.

| Reserved ID    | Full JPEG          | Thumbnail                | Suggested room |
| -------------- | ------------------ | ------------------------ | -------------- |
| owner-kitchen  | owner-kitchen.jpg  | owner-kitchen-thumb.jpg  | Kitchen        |
| owner-bathroom | owner-bathroom.jpg | owner-bathroom-thumb.jpg | Bathroom       |
| owner-office   | owner-office.jpg   | owner-office-thumb.jpg   | Office         |
| owner-dining   | owner-dining.jpg   | owner-dining-thumb.jpg   | Dining room    |

## Fill a slot (or add a different room)

1. Use a JPEG you own or have explicit permission to redistribute in this public
   demo. Give it a lowercase, hyphenated filename, e.g. `owner-kitchen.jpg`.
2. Resize to a maximum 2048 px long edge and save JPEG at about quality 85. Drop
   that file into `public/starter-rooms/`. On this Mac, the installed tool can
   prepare it directly from an original outside the public folder:

   ```sh
   agent-media optimize-web /absolute/path/to/my-kitchen.jpg --format jpeg --max-size 2048 --quality 85 --out public/starter-rooms/owner-kitchen.jpg
   agent-media optimize-web public/starter-rooms/owner-kitchen.jpg --format jpeg --max-size 400 --quality 85 --out public/starter-rooms/owner-kitchen-thumb.jpg
   ```

3. Append an object to the array in `public/starter-rooms/manifest.json`:

   ```json
   {
     "id": "owner-kitchen",
     "title": "Kitchen",
     "roomType": "kitchen",
     "file": "owner-kitchen.jpg",
     "source": "Renovagent owner photo",
     "license": "Owner-provided for demo",
     "suggestions": ["Sage walls + light oak floor", "Warm white walls + walnut floor"]
   }
   ```

   Use the actual source/license if different. The thumbnail is derived from
   `file` by replacing `.jpg` with `-thumb.jpg`. Missing/blank source or license,
   invalid paths and duplicate IDs are rejected. Suggestions are editable prompts,
   not model findings; choosing one only fills Paint & floors. Apply runs normally.

4. Run `npm test` and `npm run build`, then open Add photo → Sample rooms and check
   the thumbnail, upload, attribution and suggestions. Browser QA with intercepted
   APIs is documented in `docs/architecture/sample-rooms-gallery.md`. When expanding
   the approved gallery, update the explicit approved-ID assertion in
   `tests/integration/sample-rooms.test.ts` after reviewing the new photo rights.

Attribution follows the uploaded hash in browser storage, including recovered
intake files. It survives reload in the same browser. It is UI metadata, not a
new canonical fact or server-side license record, and does not travel to another
browser with a saved project link. Existing API/domain schemas remain unchanged.
