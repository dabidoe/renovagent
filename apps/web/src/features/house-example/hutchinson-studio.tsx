import { HUTCHINSON } from './hutchinson-project.js';
import { PaintFloorStudio } from './paint-floor-studio.js';

export function HutchinsonStudio({ onRoomExample }: { onRoomExample?: () => void }) {
  return (
    <PaintFloorStudio
      project={HUTCHINSON}
      kicker="Example · from a real listing"
      sources={
        <>
          <ul>
            <li>
              Photos and floor plans:{' '}
              <a href={HUTCHINSON.listing} target="_blank" rel="noreferrer">
                the public listing
              </a>{' '}
              (Bright MLS photos; CubiCasa plans, “deemed highly reliable but not guaranteed”).
            </li>
            <li>Ceiling height 9′: reported by the owner.</li>
            <li>
              3D rooms: traced from the listing floor plans; door and window heights are for
              display. The rear bedroom photo is matched to that room by us.
            </li>
            <li>
              New floors: Muse Image edits of each listing photo (prompts and hashes beside each
              image). Wall outlines: SAM 3.1 masks of every image.
            </li>
            <li>
              Quantities: the living-room recipe (2 coats; openings not deducted). Prices: an
              example catalog for this demo, not live offers. Labour is quoted separately.
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
