> This records the opening prototype design. The current product interaction direction is the full [project workspace and lifecycle](../architecture/01-product-and-workspace.md); an intake brief is its first artifact, not the product destination.

# Opening experience — design briefs

## Product direction

Source: docs/Unpermitted.ai.md, especially the primary demonstration, shared project model, and homeowner usability criterion.

A homeowner arrives with a space and an uncertain idea. Help them express the goal, collect the important constraints, and turn those details into a preliminary project brief. The opening experience earns trust through useful questions and visible memory. Detailed quantities, procurement, specialist reviews, and contractor coordination follow once there is enough context.

## A. Fieldnotes — selected

**Feeling:** An architect's notebook: considered, practical, quietly optimistic.
**Visual language:** Warm ivory, ink, muted ultramarine; editorial serif headlines with clean system sans for the working interface. Fine rules, generous margins, a small architectural line drawing. No decorative metrics.
**Opening:** One invitation, one composer, optional photo, two clear example projects. A short three-step explanation shows the journey without a dashboard.
**Conversation:** Dwang is the single guide. Replies ask one focused question. A small note shows which brief details changed.
**Brief:** A drawer holds user-provided facts, unknowns, and the next question. Open on demand; edit and export at any time.
**Why selected:** Combines the clarity of a work tool with a more distinctive, welcoming character. Makes the brief feel like the tangible product of the conversation.

## B. Kitchen table

**Feeling:** A helpful local design studio.
**Visual language:** Cream, terracotta, soft rounded cards, friendly humanistic typography.
**Opening:** A conversational greeting and a prominent room photo area. Crew identities appear as small contextual introductions.
**Tradeoff:** Warm and approachable, but risks repeating the previous version's decorative character treatment and card overload.

## C. Clear workspace

**Feeling:** A precise professional planning tool.
**Visual language:** White, slate, a single blue action color, compact typography and almost no illustration.
**Opening:** A full-width chat with an optional outline pane. Project history provides most navigation.
**Tradeoff:** Highly functional, but less memorable and more likely to resemble a generic chat application.

## Interaction contract

- No prefilled room, costs, savings, location, or completed progress.
- Explain the intended product separately from what this frontend demo implements.
- Guided local intake extracts supported facts; it is not open-ended model reasoning.
- Store photos as visual references only; do not imply photo analysis.
- Preserve conversation, facts, and photos across reloads on this device.
- Confirm a new-project reset before replacing the current local project.
- Facts can be corrected in conversation or edited directly in the brief.
- Export a preliminary brief, including unknowns and explicit demo limitations.
- Phone layout keeps the composer accessible and opens the brief as a full-height sheet.

## Review scenarios

1. Start empty: understand the promise and find the composer without reading documentation.
2. Describe a half bath in a Philadelphia rowhouse; receive a relevant follow-up.
3. Add dimensions, a budget, basement access, and a timeline; see those facts in the brief.
4. Correct a dimension or budget; preserve unrelated details.
5. Attach a photo; preview, remove, and restore on refresh. No analysis claims.
6. Ask an unsupported question; receive an honest explanation and a useful way forward.
7. Edit and export the brief. Start a new project only after confirming.
8. Repeat at phone width, with keyboard navigation and reduced motion.

## Technical specificity — revised product direction

The opening must communicate more than renovation inspiration. The core product is a job-specific technical investigation that connects adopted requirements, physical conditions, and execution dependencies.

The selected visual direction remains Fieldnotes. Revised headline: **Know what works. Before you build.** The three explanatory steps now establish constraints, trace requirements, and sequence the work.

### A useful technical answer

Every applied requirement needs:

- Authority and jurisdiction, adopted edition, section/table, and local amendment status.
- A concise paraphrase linked to its primary source, with retrieval date.
- Applicability reasoning: building use, unit count, stories, alteration scope, and relevant exceptions.
- Required site inputs, source of each measurement, and explicit unknowns.
- A supported conclusion or unresolved check, plus the consequence for layout, materials, or work order.
- A verification or inspection gate before dependent work is released.

A room photo or floor area alone cannot establish fixture clearances, an achievable drain connection, framing suitability, or an applicable code path. Do not promote existing demo CODE_DB extracts into authoritative rules: their citations and applicability have not been audited.

### Implemented frontend

Building/use intake; project-specific technical investigation topics; evidence requests; investigation sequence; curated official Philadelphia adoption reference with source link and check date. These export with the brief. Section-level requirements are not yet retrieved or applied. The source card is an adoption reference, not a compliance result.

### Next functional slice

One real Philadelphia half-bath investigation: establish code applicability; retrieve and review the exact adopted fixture, drainage, venting, electrical, and exhaust provisions and local amendments; collect the necessary measured geometry and system observations; connect supported checks to a dependency plan. A model should help interpret and request evidence, while deterministic code handles calculations. Keep each source and decision inspectable.

Official adoption reference reviewed October 26, 2026: https://www.phila.gov/departments/department-of-licenses-and-inspections/resources/applicable-codes/


## Verification

- Production Vite build passes; 15 tests cover the existing engine, fact extraction and corrections, uncertainty, export, and contextual technical investigations.
- Browser checked: example project, multi-fact intake, correction, reload persistence, photo selection and send, brief preview, direct editing, and Markdown download.
- Phone-width iframe checked at 390 px, including the brief sheet and building/use follow-up.
- Frontend imports only local intake/technical modules; no auth, backend, or model requests are part of this opening flow. Google Fonts is used for typography.
