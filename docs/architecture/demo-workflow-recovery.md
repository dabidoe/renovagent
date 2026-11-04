# Demo workflow recovery — November 3, 2026

Local fixes following the owner's live troubleshooting notes. These changes are
not a claim that the hosted build or a fresh Meta inference run has been verified.

## Fixed paths

- **Work-plan schema rejection:** the studio save HTTP response contains
  `artifactRef` and `snapshot` in addition to `projectId` and `revision`. A TypeScript
  cast did not remove those fields. Spreading it into the strict prepare-scope
  request caused rejection. StudioSync now retains only save metadata, and the
  caller explicitly selects the four accepted work-plan request fields.
- **Repeated-photo collisions:** each newly uploaded studio gets its own UUID.
  Reusing the same photo no longer shares finish, render-history, or save-link
  storage keys with an earlier studio. Analysis retries retain the studio ID.
  The browser still has one current draft; use My projects for saved studios.
- **Saved-link continuation:** completing inline guest sign-in retries loading
  the requested design. Access still requires the owner of that private link;
  creating a different guest does not transfer ownership.
- **MCP photo intake:** `upload_design_photo` stores owner-provided base64 image
  bytes through the existing normalization/image-store service. It returns the
  normalized `sourcePhotoSha256` accepted by `build_design_options`. The 500 KB
  decoded limit keeps uploads within the transport's 1 MiB JSON boundary.
  Clients must resize/compress larger attachments locally. Read-only credentials
  cannot discover or call the upload tool; other owners cannot use its photo.
- **Connection discovery:** unauthenticated MCP errors and listener help identify
  `/#connect`. Existing OAuth work in this checkout is preserved. An outdated
  integration assertion now checks advertised OAuth resource metadata.

## Rehearsal path

1. In the actual demo browser, sign into the Google account that will own the
   projects. Use that same account when approving the agent connector. A guest
   session works on its original browser, but is unsuitable for device switching.
2. Upload a room photo in Your project. Wait for analysis; if unavailable, the
   uploaded photo remains usable and analysis has its own retry action.
3. Enter known room dimensions and ceiling height before comparing totals.
   Photo sizes and demo material prices keep their existing labels.
4. Pick finishes, create a design, and wait for the workspace save confirmation.
   Open My projects and reopen the saved design before presenting its link.
5. Create the optional paint-and-floor work plan and download it. If choices
   change, update the work plan before downloading again.
6. For the agent path: connect, verify with `list_projects`, then upload the chat
   photo, `start_project`, and `build_design_options` using the returned hash.
   Poll `get_design_options`; a queued preview is not a completed render. The
   website studio and project-based design options remain separate workflows.
7. Keep a previously saved, generated example available for presentation if the
   provider is unavailable. Identify it as a prepared example.

For transient connector 502 responses, preserve request IDs and retry after the
outage; do not create another guest account or project to troubleshoot transport.
No authentication bypass, public private-image link, invented dimensions or
simulated successful model response is introduced.

## Verification

- Production build, strict types and dependency boundaries passed.
- Focused integration checks: 20 passed, isolated local Mongo and fixture providers.
- Offline save/work-plan browser checks: 64 passed at 1440/1024/390/320 px,
  including full save-response metadata, strict work-plan input, pending-request
  replay, browser recovery and downstream stale-download protection.
- Regular suite: 15 legacy JavaScript + 334 TypeScript passed; 55 connected skips.
- Connected suite: 63 passed. Offline OAuth pairing UI: 32 assertions passed.
- Offline public-page checks: 202/202 passed in installed Chrome.
- No fresh paid inference, live account mutation or deployment is part of these checks.

Remaining issues from the source notes include photo-estimate variability across
fresh analysis, provider availability and render-mask edge quality. Browser/account
sessions cannot transfer merely by sharing a private URL. Actual consumer-client
attachment transfer and production inference still need a rehearsal in that client.
