# Renovagent: from prototype to a convincing demo

October 31, 2026 · Product/design brief and interaction audit. Technical implementation remains with Claude. This packet specifies the experience and acceptance gates; it does not claim these changes are implemented.

**Subsequent UI implementation:** [one coherent example project](example-studio-polish.md) records the living-room walkthrough now built, its browser checks and remaining limits. The three proposed city projects and capture additions below remain future work.

**Current main example:** [Hutchinson whole-house concept](hutchinson-whole-house-concept.md) replaces the single-room landing example with the owner's listing photos, optional plans, actual SAM/Blender/Muse outputs and editable concept scope. It records the prepared-case boundary and integration handoff.

**Owner direction:** three projects—NYC, San Francisco, Hutchinson. Hutchinson is the real live demonstration; owner photos/videos are forthcoming. iPhone 16 Pro available. Photos must be sufficient to start and obtain useful work. Live capture is desirable; AR and measurement are optional enhancements. No judging deadline has been supplied.

## The skeptical judge's objection

“I can give a general assistant a room photo and ask for renovation ideas, a shopping list and a rough budget. Why would I use this?”

Our answer must be visible in a project that remains coherent when the homeowner changes their mind:

1. The person points at the actual item in their own photo and supplies a reference for the result they want.
2. The project connects that item to the work behind it: removal, supporting parts, preparation, selected products and trade labor.
3. One change—keep the vanity, change the floor, choose a cheaper finish—updates the relevant scope, shopping requirements and cost basis together.
4. The contractor and Muse work from that same saved project, including what changed and what still needs checking.

The distinguishing product is this connected, inspectable decision loop. A model call, an MCP connector, a pretty generated room or a scanner by itself does not establish its value. These features matter when they make a real homeowner decision easier and reduce missing or contradictory work.

**Suggested opening line:** “Show us your room and the look you want. We’ll connect it to the work, materials and people needed to get there.”

## What would make me say “worth doing”

| Buyer question | Proof the demo must show |
| --- | --- |
| Does it understand my room? | Original photo remains visible; an identified object/region and the owner's correction are saved |
| Is it more useful than an image generator? | Selected finish expands into work, supporting materials, costs and responsibility |
| Can I trust the number? | A line expands into quantity basis, source/date, exact or alternative product, and labor basis; unpriced items are visible |
| What happens when I change my mind? | A meaningful change shows additions/removals and the affected totals, saves, and survives reload |
| Can someone act on it? | A compact contractor packet carries the selected scope, product links, supporting parts and open questions |
| Is Muse actually involved? | Consumer Muse reads or revises this exact project; the website displays the resulting saved revision |

**The centerpiece interaction:** tap a vanity → inspect the fixture and supporting plumbing work → say “keep the plumbing where it is” or choose a different product → inspect exactly which work/cost changes. Use only calculations and product matches supported by the implementation. This is a proposed demo, not a claim that reference matching already works.

## Three examples, three reasons to care

| Project | Story | What it proves |
| --- | --- | --- |
| **NYC · Bathroom refresh** | “I like this bathroom. What does it take to get close to this in my apartment?” | Visible design choices connect to the hidden materials and work; fixture, fixings, fittings, preparation and labor stay distinct |
| **SF · Living-room refresh** | “Can I get this look without replacing everything?” | Keep vs replace, inspiration-driven alternatives, supporting trim/prep, and a defensible cost comparison |
| **Hutchinson · Owner project** | “Here is my actual space. Here is what I want to change.” | New owner inputs enter the same workflow; a correction and revision persist outside the prepared examples |

Cities must affect actual supplied project context and applicable questions where implemented. A different skyline or a city dropdown alone is not a distinct example. Do not invent regional price multipliers, adopted-code conclusions, verified contractors or structural feasibility. Full content/asset requirements are in [three-project spec](three-project-spec.md).

## A polished example is a complete product state

The current example has a useful room, finish picker and work popups. It is incomplete as a tour: Materials opens a connection message; Contractors opens a generic explanation; The plan opens an older simulated workflow; a measurement correction leaves old prices prominent.

Each prepared example needs an original room, inspiration, two relevant options, a selected scope, supporting materials, separate labor, real source links, dated price basis, one meaningful change and a readable handoff. Every main tab must contain the same project's work. The example opens immediately and supports a safe per-visitor copy/reset without creating duplicates in the owner's actual workspace.

**Visual direction:** lead with one large actual-room image. Put object details and work/costs in a consistent inspector. Use one compact row of options and a clear selected state. Use a consistent bottom sheet on phones. Show the affected uncertainty at its item, with deeper evidence on demand. Preserve the original stacked logo. Remove repetitive introductions, giant empty cards, placeholder reviews and technical implementation vocabulary from the main journey.

## Navigation contract

Proposed desktop destinations: **Room · Design · Work & costs · Products · Handoff**. Keep **Projects/Examples** in the header and project context visible. These are view names for one durable project, not five separately maintained datasets.

On phones: **Room · Plan · Costs · More**, with the selected object opening an accessible sheet. Targets should be at least 44 × 44 CSS px as our design acceptance target. The selected work-stage tab must scroll into view. Forms preserve input; cancel/back returns to the originating object or tab. The brand/home action has a real destination.

Place facts/history/advanced technical inputs in contextual detail. Place developer fixtures/simulation stages outside the ordinary product menu. Preserve those tools for engineering; do not present them as the homeowner workflow. Only offer consequential actions when their prerequisites exist, with a specific recovery action when unavailable.

Do not ask for all setup information before returning useful work. First screen: room photos, separate inspiration images/links, and one short brief. Budget and rough location are lightweight optional context. Measurements arrive when the affected calculation needs them. A photo-only start must produce a structured first draft with unmeasured quantities left open; it must not fabricate dimensions or stop at an empty room.

## Suggested three-minute demonstration

| Time | Presenter action | Visible evidence |
| --- | --- | --- |
| 0:00–0:20 | Open NYC from the three-project gallery | A finished, immediately useful project opens; owner problem is one sentence |
| 0:20–0:50 | Tap the vanity and expand work/costs | Supporting parts and trade work tied to that object |
| 0:50–1:20 | Open SF and select keep vs replace | Scope changes and an understandable materials/labor comparison |
| 1:20–2:10 | Open Hutchinson; add or select the owner's room photo and correct one observation | Real input and a saved correction, not just a prepared render |
| 2:10–2:40 | Ask Muse to make one bounded change | Same project/revision updates in the web view |
| 2:40–3:00 | Open the handoff | A compact actionable result that survives refresh |

These are proposed presentation timings. Rehearse on the actual network/device. Have previously completed results available as explicitly saved work; never disguise replayed results as a new live run. For a shorter slot, use one prepared case plus Hutchinson rather than rushing three full tours. Interactive exploration after the pitch should remain coherent.

## Build order

1. **Repair the example's main path.** Correct room defaults, plan routing, stale-price presentation, empty Materials/Contractors destinations and Home. These affect judge trust before any new AR feature.
2. **Make the photo path work with the owner's files.** Normalize iPhone formats, define clip/keyframe handling, preserve originals and connect reference analysis to the same project. The source currently rejects HEIC/video at the main intake.
3. **Prepare NYC and SF as two complete stories.** Give each its own assets, scope, sources and saved revision; connect all displayed numbers to the selected project. Consolidate independent marketing fixtures that currently show unrelated rooms/areas/totals.
4. **Rehearse Hutchinson on the real device and consumer Muse.** Start with one useful supported task; disclose the scope boundary beside any unsupported addition/feasibility question. Use the technical work Claude is handling to satisfy shared-storage/runtime gates.
5. **Add a useful live-capture enhancement if time permits.** The demo must pass without it. See [capture/AR decision](capture-and-ar.md).

## Go/no-go before presenting

- All five primary destinations open useful content for each example; no hidden switch into simulated work.
- Every visible primary action has a tested result, cancel/back and sensible loading/error state. External/provider actions have their own live verification.
- A design revision changes dependent work/costs, then survives reload. A measurement correction cannot leave an apparently current old total.
- The first draft works from pictures and a brief; optional measurements do not become an entry requirement.
- Products have source URLs and dates; matches distinguish exact items from visual alternatives. Labor identifies the trade, quantity/hour basis and rate where established.
- The owner's actual iPhone images work; video has a defined supported behavior or is clearly not offered.
- One consumer-Muse action and the website show the same project and saved revision.
- NYC, SF and Hutchinson remain separate contexts. Demo reset cannot overwrite Hutchinson or another user's project.
- A complete 390 px phone walkthrough and keyboard/desktop walkthrough pass, including sheets, selected tabs, focus and return navigation.

## Deliverables and evidence

- [Interaction audit and prioritized fixes](interaction-audit.md)
- [Three-project content/asset/acceptance spec](three-project-spec.md)
- [Photo, live capture and optional native AR decision](capture-and-ar.md)
- [425 authored JSX elements/forms — CSV](control-inventory.csv), [JSON](control-inventory.json)
- [Observed walkthrough results](live-walkthrough.json)

425 is a source inventory, not 425 successful click tests. It includes dynamic templates, conditional branches and older screens; repeated runtime instances are not separately counted. The audit labels live observations separately from source-only or gated actions. No production source, shared project data, model access or deployment was changed in this review.
