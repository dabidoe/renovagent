import { z } from 'zod';
import { id } from './common.js';
export const notebookUrl = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((value) => {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  }, 'Use an http or https link without embedded credentials');
export const projectEntryContentSchema = z
  .object({
    entryType: z
      .enum(['note', 'room-photo', 'inspiration', 'product', 'reference', 'decision', 'question'])
      .default('note'),
    title: z.string().trim().min(1).max(200),
    text: z.string().max(20000).default(''),
    room: z.string().trim().min(1).max(120).optional(),
    tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
    links: z
      .array(z.object({ url: notebookUrl, label: z.string().max(200).optional() }).strict())
      .max(20)
      .default([]),
    images: z
      .array(
        z
          .object({
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            label: z.string().trim().min(1).max(200),
            role: z.enum(['room', 'inspiration', 'product', 'reference']).default('reference'),
          })
          .strict(),
      )
      .max(12)
      .default([]),
    assertion: z
      .enum(['user-reported', 'agent-proposed', 'source-reference'])
      .default('agent-proposed'),
  })
  .strict()
  .refine(
    (c) => !!(c.text.trim() || c.links.length || c.images.length),
    'Add note text, a link, or an image',
  );
export const projectEntrySchema = z
  .object({
    kind: z.literal('project-entry'),
    content: projectEntryContentSchema,
    author: z
      .object({ kind: z.enum(['owner', 'agent']), name: z.string().trim().min(1).max(120) })
      .strict(),
    deleted: z.boolean().default(false),
  })
  .strict();
export type ProjectEntryContent = z.infer<typeof projectEntryContentSchema>;
export type ProjectEntry = z.infer<typeof projectEntrySchema>;
export const saveProjectEntrySchema = z
  .object({
    projectId: id,
    requestId: id,
    entryId: id.optional(),
    expectedRevision: z.number().int().nonnegative().default(0),
    content: projectEntryContentSchema,
  })
  .strict();
export type ProjectNotebookRecord = {
  id: string;
  projectId: string;
  revision: number;
  updatedAt: string;
  content: ProjectEntryContent;
  author: ProjectEntry['author'];
  deleted: boolean;
};
