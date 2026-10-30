# Landing and workspace image prompts

Illustrative images for the website. They are concepts, never photos of a real
project, and the page labels them that way.

- **Save to:** `apps/web/src/assets/examples/`, using the filenames below.
- **Reference crops:** `.local/design-shots/crops/`. These are gitignored and were
  cut from the boards in `docs/pics/`.
- **How to use the references:** attach the crop as a composition or image
  reference at about 30–50% strength. That matches the board framing without
  copying the soft upscaled pixels.

## Shared style line

Start every prompt with this, except the hero, which has its own:

> Photorealistic interior photo, bright soft daylight, neutral white and warm
> oak palette, clean modern American home, eye-level wide-angle 24mm,
> uncluttered, no people, no text, no logos, no watermarks, no measurement
> labels.

## 1. Idea cards (must redo)

Use a 4:3 ratio, at least 1200×900.

| Save as | Reference | Prompt (after the style line) |
| --- | --- | --- |
| `kitchen.jpg` | `crops/pp-kitchen.png` | A modest kitchen ready for an update: white shaker cabinets, white quartz counters, stainless range, small window over the sink, light wood floor. Lived-in but tidy, slightly dated hardware. |
| `bath.jpg` | `crops/pp-bath.png` | A small bathroom: oak single vanity with white top, black-framed mirror, glass walk-in shower with white subway tile, toilet, dark hex floor tile. Straight-on view across the vanity toward the shower. |
| `basement.jpg` | `crops/pp-basement.png` | A partially finished basement: drywall painted greige, recessed lights, low ceiling, beige carpet, one egress window, a simple sofa. Feels like a space that's ready to be made into a real room. |
| `floor.jpg` | `crops/pp-floor.png` | Low-angle close view across newly installed light-oak wide plank flooring meeting a white baseboard, soft window light raking across the boards, shallow depth of field. |

## 2. Hero (optional, sharper)

- **Save as:** `hero-blueprint.jpg`
- **Ratio:** 5:6 portrait, at least 1100×1320.
- **Reference:** `crops/hero-house.png`
- **Why redo:** the current upscale works, but its dimension text is garbled.

> Architectural visualization of a modern two-story house shown as a
> semi-transparent blueprint overlay on a photoreal render: cutaway living
> rooms visible on both floors, blue (#3B82F6) translucent wireframe volumes
> and thin construction lines extending past the building, perspective floor
> grid underneath, pure white background, airy, technical, minimal. No text,
> no numbers, no dimension labels.

Dimension callouts, if we want them, are added in CSS so they stay crisp and say
something deliberate.

## 3. Project screen photo (next: Board B)

- **Save as:** `workspace-bath.jpg`
- **Ratio:** 4:3, at least 1600×1200.
- **Reference:** `crops/bath-b.png`
- **Prompt:** the same as `bath.jpg`, plus:

> eye-level, camera 6 ft back, full vanity and shower visible, centered.

Keep the image free of overlays. Measurement brackets are drawn in SVG from
stored measurements, never baked into the picture.

## Generating

- **Muse:** the existing preview provider path takes about 30 s per image.
- **Any generator:** use the prompt plus the reference crop at 30–50% strength.
