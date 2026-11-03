# Starter room photos

The eight published photos now have **prepared, editable sample projects** under
`public/examples/starter-<id>/`. Choosing one opens `#example/starter-<id>` directly,
without an account, upload, room read, segmentation call or image generation.
Each project includes a Muse Spark room read, estimated dimensions, SAM wall masks
for the source and generated images, and saved light-oak and walnut floor previews.
Paint choices tint the saved masks locally. Other floor looks are unavailable in
these prepared samples; custom Restyle still uses the normal live endpoint when
requested. Samples are proposed concepts, never measured rooms or verified fit.

Selections, price tier, room dimensions, furniture and design drafts stay in the
browser with a separate namespace per sample. **Save project** creates an account
copy through the existing validated studio-design proposal flow. Source/license
credit is retained in the project, including account snapshots. Browsing does not
create an account or write to the workspace.

`preparation.json` beside each project records source/output SHA-256 hashes, model
IDs, room-read and segmentation run IDs, prompts and checkpoints. Source copies
are byte-identical to the gallery originals. Generated floor filenames include
their output hash. `scripts/prepare-starter-rooms.ts --run` prepares/resumes this
bounded set; it requires current owner approval for model spend, checks source
identity and reuses completed outputs instead of regenerating them. It enables
prepared selection in the manifest only after all projects validate.

## Published assets and rights

Eight room photos cover living rooms, bedrooms, a kitchen, bathroom, dining room
and artist studio. The empty apartment is useful for furnishing from scratch;
the furnished photos are useful for changing furniture, accessories and finishes.

| ID              | Photographer / source                                                                                            | License                                          | Full JPEG   | Thumbnail |
| --------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------- | --------- |
| living-room     | Renovagent owner photo (`public/example-room/before.jpg`)                                                        | Owner-provided for demo                          | 1600 × 1000 | 400 × 250 |
| bedroom         | Renovagent owner photo (`public/examples/bedroom-refresh/before.jpg`)                                            | Owner-provided for demo                          | 1200 × 1200 | 400 × 400 |
| empty-apartment | [Lisa Anna / Unsplash](https://unsplash.com/photos/an-empty-kitchen-and-living-room-in-an-apartment-PfeKrK-V_XA) | [Unsplash License](https://unsplash.com/license) | 2048 × 1365 | 400 × 266 |
| sunlit-kitchen  | [Cat Han / Unsplash](https://unsplash.com/photos/modern-kitchen-with-island-and-large-window-VgyN_CWXQVM)        | [Unsplash License](https://unsplash.com/license) | 2048 × 1365 | 400 × 266 |
| bright-bathroom | [Christa Grover / Unsplash](https://unsplash.com/photos/white-empty-bathroom-LGJ6MkX-la4)                        | [Unsplash License](https://unsplash.com/license) | 1365 × 2048 | 266 × 400 |
| calm-bedroom    | [Clay Banks / Unsplash](https://unsplash.com/photos/a-cozy-bedroom-with-a-neatly-made-bed-UvVHCAz9mFY)           | [Unsplash License](https://unsplash.com/license) | 1366 × 2048 | 267 × 400 |
| forest-dining   | [Clay Banks / Unsplash](https://unsplash.com/photos/a-dining-room-with-a-table-and-chairs-aYjdg6wZrOU)           | [Unsplash License](https://unsplash.com/license) | 2048 × 1365 | 400 × 266 |
| artist-studio   | [Annie Spratt / Unsplash](https://unsplash.com/photos/empty-room-Qh64IU1A8wM)                                    | [Unsplash License](https://unsplash.com/license) | 2048 × 1365 | 400 × 266 |

The six external photo pages each list the free Unsplash License (checked
November 2, 2026). [The license](https://unsplash.com/license) permits downloading,
copying, modifying and distributing photos, including commercial uses, while
restricting unmodified photo sales and building a competing photo service.
These are free-use stock photos, not a claim of CC0/public-domain status. They
are curated input photos for interactive design; no photographer endorsement
is implied. Photographer credits link to the original photo page in the gallery
and the project info disclosure. The disclosure also links the license.

`provenance.json` records the six source pages, photographers, download URLs,
license, check date, exact shipped sizes and SHA-256 hashes for full photos and
thumbnails. Rights for the two original owner photos remain owner-provided.

JPEG quality is 85, long edge capped at 2048 without upscaling. Thumbnails use
a 400 px long edge. Six new photos plus thumbnails total 2,318,173 bytes
(about 2.21 MiB). The files are local static assets; gallery use does not contact
Unsplash or need an API key. There is no runtime stock-photo search or scraping.

Every room has two finish prompts and two furniture directions. Furniture
prompts are editable UI suggestions, not observations or generated results.
**Try furniture ideas** opens Restyle; a direction fills the brief, and the
normal **Create room design** button runs the existing live request. The two floor
previews and their wall masks are already saved, with no request on selection. Prompts
ask to retain fixed room geometry/openings; model compliance is not guaranteed.

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

   Use the actual source/license if different. For external photos, also include
   HTTPS `sourceUrl` and `licenseUrl` fields and retain a provenance record. The thumbnail is derived from
   `file` by replacing `.jpg` with `-thumb.jpg`. Missing/blank source or license,
   invalid paths and duplicate IDs are rejected. Suggestions are editable prompts,
   not model findings; choosing one only fills Paint & floors. Apply runs normally.

4. New entries without `prepared: true` retain the raw-upload path. With current
   owner approval for model spend, run `node --import tsx scripts/prepare-starter-rooms.ts --run`
   to prepare the room read, masks and previews. Run `npm test` and `npm run build`,
   then open Add photo → Sample rooms and check direct opening, preview changes,
   attribution and reload persistence. Browser QA with intercepted
   APIs is documented in `docs/architecture/sample-rooms-gallery.md`. When expanding
   the approved gallery, update the explicit approved-ID assertion in
   `tests/integration/sample-rooms.test.ts` after reviewing the new photo rights.

Legacy raw-upload attribution still follows the uploaded hash in browser storage,
including recovered intake files. Prepared samples restore their metadata from
the manifest when opened directly; source/license text and the source-page link
also travel in their saved project snapshots. Existing API/domain schemas remain
unchanged. No sample dimensions are recorded as canonical physical facts.
