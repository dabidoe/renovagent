# Photos first; live capture when it improves the decision

October 31, 2026. Owner has an iPhone 16 Pro and explicitly says native AR/measurements are useful but not essential. This supersedes any interpretation that a native app is required for the core demo.

## Recommendation

Complete **pictures + inspiration → useful project draft → revision → handoff** first. Add live camera capture to reduce input friction. Treat native AR as an optional extension with its own acceptance gate. A native wrapper or attractive scan does not compensate for an empty Materials tab or a plan that does not react to user input.

There are three different capabilities; do not blur their labels or implementation status:

| Capability | User value | Proposed priority |
| --- | --- | --- |
| Choose/take a photo, annotate the captured still | Fast room evidence; works without a room scan | Essential photo path, camera convenience next |
| Short clip → selected time-stamped frames | Adds context without asking the owner to photograph every angle | Valuable if supported end to end; do not advertise native video understanding for a frame-only path |
| Native spatial capture/world-anchored work | Optional geometry or work pinned to physical surfaces as the camera moves | Add after the complete photo path and real-device proof |

## Existing gaps that matter first

- Main project-photo and generic attachment validation allow JPG/PNG/WebP/GIF, but not HEIC/HEIF or video. The dedicated photo-analysis selector is narrower still. Native iPhone files may therefore need a supported normalization path.
- There is no dedicated Take photo / Capture walkthrough flow in the reviewed intake. A file picker is not a polished camera workflow.
- Intake, connected command upload and design-image upload use different limits/stores. Normalize and bridge them without losing original evidence hashes or duplicating project identity.
- JEV's newer region/pin result is transient component state. Saving the original file does not save the interpretation. Persist a source-bound analysis artifact before building more overlays.
- The existing RoomPlan/OpenPlan3D import can already consume geometry; it has not been proven with the owner's own captured room. That is a useful later integration boundary.

## Focused live-capture experience

1. **Add photos** and **Take a photo** are equally clear entry points into the same project.
2. Camera capture offers a usable preview, retake and save. Denied camera access returns to photo-library input without losing the brief.
3. The person can mark or correct a visible item. Run analysis explicitly on a captured image; do not issue paid model requests on every camera frame.
4. Save the original, selected derivative/frame, source hash/time and result. The project can reopen this state later.
5. Show the item's work/material details and allow one change. The same change reaches the scope and handoff.

This flow can be useful before any spatial measurement. A box in a still photo should remain a photo annotation; a genuine AR pin must stay in the right physical place as the device moves. Do not imply the former proves the latter.

## If native AR is added

Apple documents RoomPlan as camera/LiDAR-assisted room capture with parametric room data and USD/USDZ output. `CapturedRoom` also supports encoding for a structured export. These capabilities can feed our existing importer; they do not supply a complete renovation scope or expose concealed services. [RoomPlan overview](https://developer.apple.com/augmented-reality/roomplan/), [CapturedRoom](https://developer.apple.com/documentation/roomplan/capturedroom), [encoding captured rooms](https://developer.apple.com/documentation/roomplan/capturedroom/encode(to:)).

The owner's iPhone 16 Pro includes a LiDAR scanner, so the hardware path is available. Apple also lists HEIF/JPEG/DNG photo capture and common video formats, reinforcing why real-file intake deserves attention first. This does not establish that our app is installed, signed, compatible or tested on that phone. [Apple technical specifications](https://support.apple.com/en-us/121031).

The smallest useful native slice would capture one room/selected surface, let the owner review it, and attach its data/media to the existing project. The same web/Muse project must show the result. Preserve a clear distinction between scanned geometry, user corrections, inferred labels and actual product selections. Device support checks, camera permission, cancellation and review are part of this slice.

World-anchored tasks require additional tracking/coordinate/relocalization work beyond importing a room model or drawing image boxes. Scope that deliberately; do not assume RoomPlan alone produces stable task anchors across sessions. We have not verified such a native implementation in this audit.

**Native go/no-go:** demonstrate a benefit that is visible in the project—less manual entry, a correctly located task, or a materially improved affected quantity—and show it on the actual phone through to a saved project revision. If that gate is not met, present the completed photo flow and keep capture on the roadmap. Measurements stay optional to the first useful response.

## Rehearsal acceptance

- Native owner photo formats and a realistic file batch pass on the actual phone, including the connected upload path.
- A clip has an explicit bounded behavior and traceable selected frames; otherwise the UI offers photos only.
- Upload/capture cancellation, retry and denial preserve the project brief and selected references.
- Two different views of the same room do not silently become two rooms or duplicate one fixture in quantities.
- No measurements are inferred from an ordinary photograph without a supported basis. Unmeasured work still gets a useful scope draft.
- Photo-only and capture-assisted starts converge on the same saved artifacts; switching devices/Muse does not create another unrelated workspace.
