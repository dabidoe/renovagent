import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DomainError, id, projectEntryContentSchema, type Workspace } from '@renovagent/contracts';
import { ProjectNotebook, notebookEntries, readNotebookEntry } from './project-notebook.js';
import type { MongoWorkspaceRepository } from './repository.js';
import { normalizeImage, type DesignImageStore } from './design-images.js';
import { studioImageHashes } from './studio-designs.js';
import type { StudioPlanStore } from './studio-plans.js';
export const NOTEBOOK_READ_TOOLS = [
  'list_project_entries',
  'get_project_entry',
  'get_project_image',
];
export const NOTEBOOK_WRITE_TOOLS = [
  'add_project_entry',
  'update_project_entry',
  'remove_project_entry',
  'attach_inspiration_to_project',
];
const text = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
});
export function projectImageHashes(workspace: Workspace, projectId: string) {
  const hashes = new Set(
    notebookEntries(workspace, projectId).flatMap((e) => e.content.images.map((i) => i.sha256)),
  );
  const studio = workspace.artifacts[`${projectId}:studio-design`]?.at(-1);
  if (studio?.payload.kind === 'studio-design')
    for (const sha of studioImageHashes(studio.payload)) hashes.add(sha);
  return hashes;
}
export function registerNotebookTools(
  server: McpServer,
  repo: MongoWorkspaceRepository,
  options: {
    access: 'read' | 'propose';
    images?: DesignImageStore;
    origin: string;
    agent: string;
    plans?: StudioPlanStore;
  },
) {
  const notebook = new ProjectNotebook(repo, options.images);
  const result = (value: { url: string }) =>
    text({
      ...value,
      url: new URL(value.url, options.origin).href,
      note: 'Saved in this project notebook. Recorded material is not a verified site fact or professional approval.',
    });
  const author = { kind: 'agent' as const, name: options.agent };
  server.tool(
    'list_project_entries',
    'Read/search the project notebook: notes, room photos, inspiration, product/source links, preferences, decisions and open questions. Always scope to the intended project. Returns actual saved text and image hashes; use get_project_image to see pixels. Paginate using nextOffset. Deleted entries are excluded unless requested.',
    {
      projectId: id,
      query: z.string().max(200).optional(),
      room: z.string().max(120).optional(),
      entryType: z
        .enum(['note', 'room-photo', 'inspiration', 'product', 'reference', 'decision', 'question'])
        .optional(),
      includeRemoved: z.boolean().default(false),
      offset: z.number().int().nonnegative().default(0),
      limit: z.number().int().min(1).max(100).default(50),
    },
    { readOnlyHint: true, openWorldHint: false },
    async ({ projectId, ...filters }) => text(await notebook.list(projectId, filters)),
  );
  server.tool(
    'get_project_entry',
    'Read one notebook entry in full with its revision, author and provenance; optional revision reads immutable history. Use the latest revision before editing.',
    { projectId: id, entryId: id, revision: z.number().int().positive().optional() },
    { readOnlyHint: true, openWorldHint: false },
    async ({ projectId, entryId, revision }) =>
      text(await notebook.get(projectId, entryId, revision)),
  );
  if (options.images)
    server.tool(
      'get_project_image',
      'Return actual image content from this project’s current notebook or saved studio. Use the exact saved image hash. Provides a bounded JPEG preview plus source metadata, not merely a private URL. It does not analyze the photo or verify measurements. Images belonging only to other projects are refused.',
      {
        projectId: id,
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        entryId: id.optional(),
        revision: z.number().int().positive().optional(),
      },
      { readOnlyHint: true, openWorldHint: false },
      async ({ projectId, sha256, entryId, revision }) => {
        const { workspace } = await repo.read();
        if (revision && !entryId)
          throw new DomainError('VALIDATION', 'A historical image needs its notebook entry ID');
        const allowed = entryId
          ? new Set(
              readNotebookEntry(workspace, projectId, entryId, revision).content.images.map(
                (i) => i.sha256,
              ),
            )
          : projectImageHashes(workspace, projectId);
        if (!allowed.has(sha256))
          throw new DomainError(
            'NOT_FOUND',
            'This image is not in the current project notebook or design',
          );
        const image = await options.images!.get(repo.ownerId, sha256);
        if (!image) throw new DomainError('NOT_FOUND', 'Project image is unavailable');
        const preview = await normalizeImage(image.bytes, 1024);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                projectId,
                sha256,
                sourceWidth: image.record.width,
                sourceHeight: image.record.height,
                previewWidth: preview.width,
                previewHeight: preview.height,
                note: 'Stored project image. Visual observations are proposals; dimensions are not established by this preview.',
              }),
            },
            {
              type: 'image' as const,
              data: Buffer.from(preview.bytes).toString('base64'),
              mimeType: preview.mediaType,
            },
          ],
        };
      },
    );
  if (options.access === 'read') return;
  server.tool(
    'add_project_entry',
    'Save notes, image references and links together in a specific project. No dimensions, address, product choice or image is required for a text note. Use room labels and tags for organization. Save the person’s words faithfully; distinguish reported inputs, your proposals and source references. Upload image bytes with upload_design_photo first, then include its hash and room/inspiration/product/reference role. Never fetch retailer images. Reuse requestId for an identical retry. Return the notebook URL.',
    {
      projectId: id,
      requestId: id,
      content: projectEntryContentSchema,
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async (input) => result(await notebook.save(input, author)),
  );
  server.tool(
    'update_project_entry',
    'Replace a notebook entry’s content after reading its latest revision. Send complete content so notes, links and images you intend to keep remain present. Revision conflicts never overwrite someone else’s edits. Historical versions remain readable.',
    {
      projectId: id,
      entryId: id,
      requestId: id,
      expectedRevision: z.number().int().positive(),
      content: projectEntryContentSchema,
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async (input) => result(await notebook.save(input, author)),
  );
  server.tool(
    'remove_project_entry',
    'Remove an entry from the current project notebook when the owner asks. Requires its latest revision. History is retained; previously published shared snapshots and independent copies are not erased.',
    {
      projectId: id,
      entryId: id,
      requestId: id,
      expectedRevision: z.number().int().positive(),
    },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    async (input) => result(await notebook.remove(input, author)),
  );
  if (options.plans)
    server.tool(
      'attach_inspiration_to_project',
      'Bring an existing workspace-board find into this project notebook with its original link, photo and note. Use a find ID from list_inspiration. The original board entry stays intact; this does not fetch any URL or rerun a model.',
      {
        projectId: id,
        findId: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
        requestId: id,
        room: z.string().min(1).max(120).optional(),
      },
      { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      async ({ projectId, findId, requestId, room }) => {
        const find = await options.plans!.finds.findOne({ _id: findId, ownerId: repo.ownerId });
        if (!find) throw new DomainError('NOT_FOUND', 'No such inspiration find in this workspace');
        return result(
          await notebook.save(
            {
              projectId,
              requestId,
              content: {
                entryType: find.kind,
                title: find.title,
                text: find.note || '',
                room,
                tags: ['from-workspace-board'],
                links: find.url ? [{ url: find.url }] : [],
                images: find.imageSha256
                  ? [
                      {
                        sha256: find.imageSha256,
                        label: find.title,
                        role: find.kind === 'product' ? 'product' : 'inspiration',
                      },
                    ]
                  : [],
                assertion: 'source-reference',
              },
            },
            author,
          ),
        );
      },
    );
}
