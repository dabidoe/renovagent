import { EXAMPLE_PRIVACY_NOTE } from './example-privacy.js';
import { HUTCHINSON, HUTCHINSON_DESIGN } from './hutchinson-project.js';
import { PaintFloorStudio } from './paint-floor-studio.js';

export function HutchinsonStudio({ onRoomExample }: { onRoomExample?: () => void }) {
  return (
    <PaintFloorStudio
      project={HUTCHINSON}
      publicTemplate
      autoImagine={false}
      initialDesign={HUTCHINSON_DESIGN}
      kicker="Listing example · address changed for privacy"
      sources={
        <>
          <ul>
            <li>
              Photos and floor plans: owner-supplied listing (Bright MLS photos; CubiCasa plans,
              “deemed highly reliable but not guaranteed”). {EXAMPLE_PRIVACY_NOTE}
            </li>
            <li>Ceiling height 9′: reported by the owner.</li>
            <li>
              3D rooms: traced from the listing floor plans; door and window heights are for
              display. The rear bedroom photo is matched to that room by us.
            </li>
            <li>
              Living/dining furniture: editable library approximations arranged from the listing
              photo, marked Keep. Sizes and fit are unverified; the china cabinet uses a bookcase
              stand-in. Edits create your own copy; Reset room design restores these starters.
            </li>
            <li>
              New floors: Muse Image edits of each listing photo (prompts and hashes beside each
              image). Wall outlines: SAM 3.1 masks of every image.
            </li>
            <li>
              Quantities: the living-room recipe (2 coats; openings not deducted). Prices: an
              example catalog for this demo, not live offers. Labor is quoted separately.
            </li>
          </ul>
          {onRoomExample && (
            <button type="button" className="link-button" onClick={onRoomExample}>
              The measured-room example: work steps, quotes and Blender stages
            </button>
          )}
        </>
      }
    />
  );
}
