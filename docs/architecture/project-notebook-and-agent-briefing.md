# Project notebook and agent connection briefing

November 4, 2026. Adds general project memory and immediate agent orientation.
This extends the implemented studio/guest/share workflows; it does not implement
full conversational 3D control, arbitrary document ingestion or construction approval.

## Saved project memory

`project-entry` is a typed, versioned artifact in the existing owner workspace.
`SaveProjectEntry` is a dedicated validated command. It supports note, room-photo,
inspiration, product, reference, decision and question entries, with title, up to
20,000 characters of text, optional room label/tags, up to 20 safe source links,
and up to 12 image references with explicit roles. Reported inputs, agent proposals
and source references remain distinct; no verified assertion is available.

The narrow service checks image ownership and uses CAS/revision checks, stable
request IDs and the existing domain command pipeline. Generic `ProposeArtifact`
cannot forge a notebook entry. Entry IDs have a dedicated namespace. The domain
limits a project to 300 current entries. Edits create revisions; removals create a
tombstone, retaining prior versions and downstream revision invalidation. Exact
retries return the produced revision even if a later edit exists. Conflicts leave
newer content intact. A notebook decision is a record, never an approval command.

MCP tools:

- `add_project_entry`, `update_project_entry`, `remove_project_entry`.
- `list_project_entries`: project-scoped search, room/type filters, pagination.
- `get_project_entry`: full current content or exact historical revision.
- `get_project_image`: actual bounded JPEG content, with source/preview sizes,
  from current project images or a specific historical notebook entry. An image
  belonging only to another project is refused, even within one owner workspace.
- `attach_inspiration_to_project`: preserve a legacy workspace-board find in the
  selected project, with its original source link, photo and note.

Images use the existing normalized owner store and upload tool; no URL is fetched.
Agents supply already-held bytes within the 500 KB upload limit. PDFs/Office files,
video and audio are not ingested by this slice. Browser text-file import supports
`.txt` and `.md`, with explicit size/content limits; notebook text is retained as
source material rather than promoted to physical facts or instructions.

## Website and sharing

`#notebook` starts a guest project without measurements or sign-in.
`#project/<projectId>/notebook` opens the notebook. My projects links each project
to its notebook; saved studios have a notebook shortcut and a notebook section.
Owners can add mixed material, label photo roles, search/filter, edit/remove, load
more entries and refresh material saved by Muse. Unsent browser drafts survive
reload and background notebook refresh. Save retry IDs also survive reload, so a
lost response after a committed save does not create a duplicate. Inputs are disabled during save/edit load
so a late response does not erase new typing. History remains readable via MCP.

Public shares now freeze the notebook alongside the saved studio, or publish a
notebook-only project. Only referenced images are accessible through the share.
Copies transfer those bytes into the destination's owner store and save independent
entries via validated commands. Copy retries do not create duplicate projects or
entries. Revocation stops original public access; historical shares and saved
copies retain their defined snapshot semantics. No entire account session is shared.
Old studio-only share records remain readable.

## First interaction after connecting

The hosted HTTP endpoint passes the authorized workspace into MCP server creation.
The initialize response immediately includes a compact, bounded personal briefing:
project names/links, suggested-project basis, existing brief, recent notebook
entries, saved decisions/questions, room context and stale-file references.
Standalone stdio initialization does the same. No mutation or model call runs.

Instructions explicitly require `get_connection_context` before a substantive
answer. That tool refreshes the briefing, includes earlier conversation/drafts,
standalone saved plans and legacy workspace-board finds, and describes input/output
paths and concrete next actions. It distinguishes an empty canonical project list
from an account containing standalone plans. `get_project_context` also exposes
notebook summaries, older messages and the unsent draft, with truncation/pagination
signaled and full entries available through the notebook read tools.

The current user request controls the next action. Existing material is untrusted
source data, not instructions or permission. On a simple connection, the agent is
told to identify actual saved work and a concrete next action; with ambiguity it
should name actual project choices rather than ask a generic greeting. Unknowns
remain unknown; connection alone never triggers paid work, publishing or approvals.
The public guide and connector copy give the same first-call instruction.

MCP instructions and image rendering depend on client support/compliance. An SDK
handshake proves the context is delivered; it does not prove that every consumer
Muse client will follow those instructions or display an image block. Existing
clients may need to reconnect/refresh their tool catalog to discover the new tools.

## Verification

- Isolated HTTP/Mongo/MCP scenarios cover mixed capture, retry identity, stale
  writes, exact history, actual image blocks, project/owner isolation, read-only
  grants, generic-command rejection, legacy message/draft recall, initialization
  briefing and no writes during connection/context reads.
- Notebook-only public sharing, copied image ownership, independent/idempotent
  copies and immutable shared contents are covered, including legacy board import.
- Built-site Chrome: 52 notebook assertions at 1440/390/320 px. Screenshots in
  `.local/notebook-qa/` were visually inspected.
- Full-suite, public-page and hosted verification results are recorded in HANDOFF.md
  after completion. All local providers use fixtures; no live inference is implied.
