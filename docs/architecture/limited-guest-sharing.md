# Limited guest saving and sharing

November 3, 2026. A demo-focused follow-up to the live workflow rehearsal.

## User flow

- **Build my plan** and a studio's first save create a limited guest workspace
  automatically when signed out and guests are enabled. Uploads and design saves
  use the existing owner-scoped image store and validated proposal commands.
- Projects persist on the server. New account/guest cookies last one year;
  unexpired sessions renew to one year on use, including older guest sessions.
  Clearing cookies or signing out loses access to the original guest editing
  workspace unless Google was linked. This does not delete its projects.
- New OAuth connections and manually created website keys last one year. Existing
  shorter grants retain their original expiry. OAuth remains the primary connector
  setup; manual keys remain an advanced option. Model rate limits still apply.
- **Share project** saves the design and publishes a fixed revision. The share
  URL opens without login on another device. Its saved design and referenced
  photos are visible to anyone with that link. Later original edits do not change
  that shared revision. A new share is needed to publish the newer design.
- **Save a copy & edit** starts a guest if needed, copies the referenced image
  bytes into that viewer's owner-scoped store, and creates a separate studio
  proposal through the existing save service. The copy persists and edits do not
  change the original. A retry reuses the same new project and saved revision.
- **Stop sharing this link** revokes public view/image/copy access. Independent
  copies saved beforehand survive. Share records have no automatic expiry.

## Boundaries

`StudioShares` stores one validated snapshot per share in `studio_shares`.
The unguessable share identifier is a viewing capability, not an account session.
Public reads return the snapshot without owner IDs, and replace private image
paths with share-scoped paths. Image access checks membership in that snapshot;
an unrelated image hash cannot be used to fetch other photos from that owner.
The public routes do not expose workspace reads, private revisions, acceptance,
site facts, inspections, purchases, or arbitrary owner writes.

API:

- POST `/api/workspace/studio-designs/share`: authenticated save revision → link.
- GET `/api/workspace/shared-designs/<token>`: anonymous shared snapshot.
- GET `/api/workspace/shared-designs/<token>/images/<sha>`: referenced image only.
- POST `.../<token>/copy`: authenticated destination workspace; UI creates guest.
- POST `.../<token>/revoke`: original owner only.

MCP `share_project` publishes a saved studio or converts a saved agent plan into
an owner-scoped studio proposal and shares it. It is a proposal-access tool,
available when the image store is configured. Its instructions require an owner
request to share. `save_plan` now returns `planId` explicitly for this workflow.
Private editing links remain private; sharing is explicit. Google is optional.

## Verification

- Local HTTP/Mongo scenario verifies one-year guest cookie/session, anonymous
  photo reads, exclusion of unrelated images/private revisions, immutable shares,
  durable idempotent copies, ownership checks, share revocation, and surviving copies.
- MCP scenario covers studio sharing and saved-plan sharing with anonymous reads.
- Local built-site Chrome checks: 36 passed at 1440/390/320 px for automatic
  guest creation, no-cookie viewing, loaded photos, responsive layout, editable
  copy creation, reload persistence, recovered owner share controls and revocation. Screenshots in
  `.local/guest-sharing-qa/` were inspected.
- Existing offline save/work-plan checks: 64 passed. Final full-suite/build and
  production rehearsal results are recorded in HANDOFF.md after completion.

Limits: shared views summarize saved photos, finishes, allowances and room items;
they are not a collaborative editor. Viewers edit independent copies. Removing a
share cannot remove copies already saved. No recovery email, billing, verified
live pricing, construction authorization or new model capability is introduced.
