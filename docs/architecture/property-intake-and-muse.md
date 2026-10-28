# Address-first property intake and Muse handoff

Implemented locally October 27, 2026. Backend and in-app model execution remain off. This extends the durable workspace; it does not complete Slice 4.

The opening now leads with an address, reference views, useful public records and the next planning action. Conversation stays beside the work. Later lifecycle stages and technical checks remain available. Uploaded originals stay on the device and are not analyzed.

## Working path

1. Create a project with an address, or add the address in **Your place**. The address is a reported property fact shared by projects on that property.
2. Explicitly look up Philadelphia OPA records, then select the matching parcel. The browser sends the street address to the public city service. Other localities use the Muse handoff or source imports; there is no nationwide records adapter yet.
3. **Export Muse job**, then run it yourself with the installed CLI:

   ```sh
   npm run muse:property -- --job /path/muse-property-job.json --output /path/results.json
   ```

   This starts real research through the user's Muse account. The app never runs it automatically. The helper rebuilds a bounded prompt, disables shell/write/reminder tools and foreign personal context, limits model steps, validates the final JSON, and refuses to overwrite an existing output file. It does not modify project state.
4. **Import results** into the same project/address revision. Findings retain source URLs, retrieval dates and limitations. **Download property.md** creates the sourced Markdown record. The working plan compiles saved goals, recent user notes, local reference counts and current research; it is a versioned proposal.

Google Maps/Earth and listing searches are explicit external source links. Imported image leads appear before any preview loads. Preview loading requires a declared permission and a separate user click; permission claims remain unreviewed. No Google imagery API, scraping, automatic listing-photo collection or image analysis is connected.

## Reliability and authority

Research is a strict typed artifact proposed through validated commands. Duplicate identities, missing source references, non-HTTPS URLs, unsupported verification claims and results for old/different jobs are rejected. Research cannot overwrite measured facts or approve construction. Address changes stale dependent research and historical plans. New working-plan revisions preserve accepted history and exclude outdated research. City assessment values preserve raw values, including zero; dataset units are not inferred and recorded lot/living area is not room geometry.

## Verification

97 tests passed (15 legacy JavaScript, 82 TypeScript), plus strict type checking, import boundaries, formatting and both production builds. Six added integration tests cover persistence, accepted revision history, address invalidation, wrong-job rejection, source integrity, Markdown limits, SQL escaping, raw zero values and Muse terminal-event parsing.

Browser checks covered project creation, a real Philadelphia OPA lookup for City Hall (explicit public-building test project), parcel selection, research save/reload, Markdown/job downloads, a visibly synthetic sourced-result import, blocked unknown-permission previews, conversation-to-plan updates and local file attachment. Desktop and phone layouts were inspected. The CLI echo provider confirmed the structured terminal envelope; no live Muse model/search evaluation was performed. Source quality, imagery rights, physical conditions, full technical applicability and qualified review remain open.

## Live public-property check

The [City Hall handoff evidence](../evidence/muse-city-hall/README.md) supersedes the earlier no-live-run limit for this one case. Exported jobs now include validated current research context. Optional finding `blockedReason` is additive; blocked claims stay in research/Markdown and are excluded from the working plan. Exact repeated label/value claims cannot silently drop an existing block within the same artifact/job. All research remains unreviewed, and broader agent reliability, imagery rights, physical conditions and technical review remain open. 100 tests and production builds pass.

## Residential listing check

The [Bingham Street residential handoff](../evidence/muse-bingham-home/README.md) tests the actual home case. Additive nullable photo metadata supports gallery locators, exact source URLs, unreviewed visual notes, planning actions and blocking reasons. The working plan references the exact imported research revision, so subsequent research cannot alter historical photo references. An address change invalidates the current research and removes its photo context from the newly compiled plan. Provider output schemas now require nullable optional keys, with a regression check for strict-mode compatibility. Philadelphia street suffix normalization improves exact matches while keeping parcel confirmation explicit. 103 tests and production builds pass; automatic photo identification, embedding rights, measured conditions and qualified review remain unestablished.

## Muse attached-image review

The [actual 35-image review evidence](../evidence/muse-photo-vision/README.md) closes the earlier manual-identification limit for this case. `PropertyResearch.photoReview` is additive and stores model classifications, uncertainties, questions, next checks, attachment hashes and run provenance. Full analyses persist independently of the bounded selected references. A model-only synthesis supplies complete photo-linked planning questions. Imports require the current goal revision as well as the address dependency, so later goal changes invalidate visual planning. No image classifications become measured facts or qualified approvals. The external `muse:photos` CLI uses temporary actual attachments; the app only exports jobs/imports proposals, keeps unknown-rights previews unloaded and can expose every raw result. Remote gallery discovery and worker orchestration remain outside the backend-off UI. 109 tests and production builds pass.

## Photo questions become durable conversation inputs — October 27, 2026

The six questions in the real Bingham Muse receipt now have a conversation reply path. Choose a question (or “Answer next”), inspect its photo sources and uncertainty, choose reported direction / unsure / defer, and send a literal response. This uses local validated commands and IndexedDB; the backend remains off and no model interprets answers.

`AnswerPhotoQuestion` validates the project, current exact research revision, question index, expected answer revision and attached evidence. It atomically stores a typed `photo-planning-answer` artifact revision, a user message linked to that exact answer revision, evidence, a refreshed working plan and cleared draft. A response is not a physical fact, an accepted design decision, or a technical approval. Direct generic creation or replacement of response records is rejected. Correcting a response preserves every earlier version and its original source review. The source review preserves exact photo URLs, hashes, run/model receipts, visual confidence and uncertainties.

The working plan includes all six questions, their latest literal responses and source photo IDs. Its next-work queue keeps unanswered, unsure and deferred questions open. Captured direction advances that question out of the clarification queue; it does not semantically resolve every clause of a free-text answer. The user explicitly chooses the response meaning. Muse's original user-choice recommendations remain for reconciliation against the reported direction; site measurements and qualified review never become completed from a chat response. No new options, measured geometry, code conclusions or prices are generated from these answers.

Response IDs bind to the research artifact revision plus question index. A replacement research import requires reconfirmation even if the question wording is unchanged. Goal/address changes stale the old source review and its responses. Earlier stale responses remain in history but are excluded from current plan direction and recent-current-context notes. Current-review answer revisions join workflow input capture, so first answers and corrections invalidate prior simulated proposals and reject late output. Technical calculations retain their existing explicit physical fact dependencies; reported preferences do not overwrite measurement inputs. The working plan also references exact response revisions, invalidating downstream artifacts that depend on it. Accepted history is retained and stale acceptance remains blocked.

Question drafts save the source revision, question index, expected answer revision and response meaning alongside text and attachments. Refresh and project switching preserve the reply destination. Old-review drafts require explicit reselection; a changed response revision conflicts rather than silently overwriting. When an answer updates an open latest working plan, the view advances to the new revision; deliberately historical views and conversation links remain pinned.

Verification: four new integration scenarios use the six actual Muse questions, with clearly labeled synthetic responses. They cover all six answers, literal plan compilation, uncertainty/defer queues, correction history, accepted revisions, exact message links, IndexedDB close/reopen, draft context, idempotency, conflicting/stale/invalid writes with no partial mutation, source/goal/address invalidation, late simulated work, dependent versus unrelated artifacts, and current versus historical plan views. Full suite: 113 passing tests (15 legacy JavaScript + 98 TypeScript). Strict type checking, import boundaries, formatting and both builds pass. Vite still reports the existing main-bundle size advisory.

Browser verification used a separate **Muse answers · workflow QA only** project with a copied source receipt and the exported QA job binding, not a new research run. All six reply paths, a correction, unsure/defer status, draft refresh and automatic latest-plan advancement were exercised. No owner preferences were invented for the original Bingham project; it remains at 0/6 captured directions, with question 1 ready. Screenshot: `docs/previews/muse-question-answers.png`.
