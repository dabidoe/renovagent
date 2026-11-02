import type { StudioItem, StudioStylingDraft } from '@renovagent/contracts';
import { styleOf, type RoomPick } from './paint-floor.js';

export const studioFinishSignature = (pick: RoomPick) =>
  JSON.stringify({
    color: pick.color,
    floor: pick.floor,
    floorStyle: styleOf(pick),
    sheen: pick.sheen,
  });

export function studioStylingSignature(input: {
  inspo: StudioStylingDraft['inspo'];
  borrow: string[];
  paint: StudioStylingDraft['paint'];
  mode: StudioStylingDraft['mode'];
  keep: string;
  finishSignature: string | undefined;
  brief: string;
  items: StudioItem[];
}) {
  return JSON.stringify({
    photo: input.inspo?.sha256,
    borrow: [...input.borrow].sort(),
    paint: input.paint,
    mode: input.mode,
    keep: input.keep.trim(),
    finishes: input.finishSignature,
    brief: input.brief.trim(),
    roomItems: input.items.map((i) => ({ name: i.name, action: i.action, quantity: i.quantity })),
  });
}
