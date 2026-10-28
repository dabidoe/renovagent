# Muse actual-image review — 7149 Bingham Street

Tested October 27, 2026. This closes the earlier **manual photo-identification** gap for the same public listing. Backend and in-app model execution stayed off. Muse ran through the installed CLI/account; its results entered the product through the file import control.

## Actual inputs, not photo-link research

The native listing gallery exposed 35 image URLs in rendered `data-src` attributes. All 35 were enumerated into neutral numbered IDs. No room was selected or labeled by Codex for this run. Muse received batches of seven actual downloaded image attachments under generic filenames, plus the project goal and ordered IDs. The listing description, earlier human visual notes, prior room labels and property research were excluded from its image-review prompts.

The runner used an empty preset and an isolated temporary workspace, with web, shell, write and reminder tools disabled and foreign personal context excluded. Each successful receipt records the source URL, photo ID, SHA-256 of the attached bytes, Muse run ID and model. The first one-image probe and all accepted/rejected batch answers are retained as JSON. Public photo bytes were used temporarily for the requested analysis and deleted afterward; no image binaries were added to the repository or served by the app.

## Result

- **35/35 image attachments reviewed** across five accepted image runs.
- Muse independently classified photo 11 as **kitchen**, 18 as **bathroom** and 25 as **basement**, with specific visible features and uncertainties. Those classifications were not manually corrected.
- All 35 analyses remain in the imported research artifact. Twelve references were selected by a bounded goal/diversity rule using Muse's classifications, with at most two photos per view category.
- A separate Muse planning pass used only its own image observations and uncertainties to produce **six photo-linked planning questions and eight next steps**. No human room labels or old visual-audit notes entered that pass.
- The result was imported as a new proposed revision, survived reload, and produced a new working-plan revision. Earlier manual and research revisions remain available. Physical facts, accepted history and construction gates were not overwritten.

Examples of Muse's resulting decisions: retain or change the kitchen elements and peninsula; establish whether the existing bathroom is part of the scope; decide whether basement or an understair area should be measured as a powder-room candidate. Its next steps identify specific kitchen, bathroom, basement headroom and circulation measurements. These are early planning proposals, not proof of feasibility or a complete trade/design package.

Photo classifications are **views**, not counts of distinct rooms. Multiple bathroom photos do not establish multiple bathrooms or adjacency. Confidence is model-reported. Neither images nor their labels establish dimensions, concealed services, current conditions, hazardous materials, compliance or permission to build. Existing record conflicts and blocked violations research remain intact.

## Failures caught and fixed

One batch marked readable, classified images as “unreadable”; another returned only one result for seven attachments. Both were rejected and retained. The runner resumed only validated batches after re-downloading and matching their hashes; rejected batches were re-inspected by Muse. No missing or contradictory labels were repaired manually.

Per-batch schemas now constrain exact result counts and allowed photo IDs. Runtime validation rejects missing/duplicate IDs, contradictory unreadable claims, missing attachment coverage, missing sources and selected references that do not match reviewed inputs. Some constrained raw answers had clipped planning text; the complete planning synthesis is displayed separately, and incomplete raw text is labeled in the inspection viewer.

The downloader now accepts the public CDN's global IPv6 records while rejecting local/private destinations, redirects, unsupported image types and oversized inputs. Downloads fail closed; a failed run does not import partial work. Receipts support source-byte-matched resume. Import metadata remains an unreviewed assertion, not a signed provider or qualified-review certificate.

## Product path

**Export photo review job** exports known exact image references with neutral IDs and the saved base research. The CLI keeps that base data out of the vision prompt:

```sh
npm run muse:photos -- --job /path/muse-photo-review-job.json --output /path/photo-results.json
```

Then **Import results**. A job exported from this completed case contains all 35 references. Before a full gallery manifest has been collected, an exported job covers only the exact image URLs already known to the project; it does not silently discover the rest of a provider's gallery. Remote listing DOM discovery remains external to the backend-off app.

The review panel shows all identifications, confidence, uncertainty, questions, next checks and attachment provenance. The working plan shows complete synthesis questions and linked references. `property.md` retains both the raw review index and planning synthesis. Preview rights remain unknown; the UI loaded zero remote images and continues to open exact photos at the provider.

## Verification and retained evidence

**109 tests passed** (15 legacy JavaScript + 94 TypeScript), strict TypeScript, import boundaries, formatting and both production builds. New tests cover neutral inputs, exact batch identity, contradictory status rejection, receipt coverage, bounded reference selection, unchanged facts/blocks/preview rights, source-linked planning synthesis, persistence, historical receipts, goal-change invalidation and public-download guards.

Browser checks verified import, 35-photo coverage, 12 exact references in the working plan, six questions/eight steps, refresh persistence, a new 35-reference export job and UI-generated Markdown. The review panel layout was visually checked and corrected.

`accepted-batches/` contains the actual image-run prompts, input hashes and model answers; `rejected-batches/` contains both rejected replies. `planning.json` is Muse's separate synthesis prompt/answer. `manifest.json`, `muse-vision-results.json` and `property.md` retain the input map, full imported result and UI export. Nothing in these artifacts certifies present site conditions or qualified technical review.
