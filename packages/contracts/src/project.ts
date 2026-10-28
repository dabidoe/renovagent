import { z } from 'zod';
import { runSchema, messageSchema, draftSchema, viewSchema } from './workflow.js';
import { id, revision, stamp } from './common.js';
import { factSchema, evidenceSchema } from './facts.js';
import { artifactSchema, decisionSchema } from './artifacts.js';
export const propertySchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    ownerId: id,
    name: z.string().min(1).max(300),
    revision,
  })
  .strict();
export const spaceSchema = z
  .object({ schemaVersion: z.literal(1), id, propertyId: id, name: z.string().min(1).max(300) })
  .strict();
export const projectSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    propertyId: id,
    name: z.string().min(1).max(300),
    spaceIds: z.array(id),
    revision,
    createdAt: stamp,
  })
  .strict();
export const resultSchema = z
  .object({
    commandId: id,
    projectId: id,
    projectRevision: revision,
    propertyRevision: revision,
    eventIds: z.array(id),
    staleArtifactIds: z.array(id),
  })
  .strict();
export const workspaceSchema = z
  .object({
    schemaVersion: z.literal(2),
    ownerId: id,
    runs: z.record(runSchema),
    messages: z.array(messageSchema),
    drafts: z.record(draftSchema),
    views: z.record(viewSchema),
    activeProjectId: id.nullable(),
    properties: z.record(propertySchema),
    spaces: z.record(spaceSchema),
    projects: z.record(projectSchema),
    facts: z.record(z.array(factSchema).min(1)),
    evidence: z.record(evidenceSchema),
    artifacts: z.record(z.array(artifactSchema).min(1)),
    decisions: z.record(decisionSchema),
    events: z.array(
      z
        .object({
          id,
          projectId: id,
          projectRevision: revision,
          commandId: id,
          type: z.enum([
            'ProjectCreated',
            'EvidenceAttached',
            'FactRecorded',
            'ArtifactProposed',
            'DecisionAccepted',
            'ArtifactInvalidated',
            'MessageAppended',
            'WorkRequested',
            'RunChanged',
            'ProposalRejected',
            'PlanningInputsSaved',
            'PlanningCalculated',
          ]),
          at: stamp,
          entityIds: z.array(id),
        })
        .strict(),
    ),
    commands: z.record(z.object({ fingerprint: z.string(), result: resultSchema }).strict()),
  })
  .strict();
export type Workspace = z.infer<typeof workspaceSchema>;
export type CommandResult = z.infer<typeof resultSchema>;
export const emptyWorkspace = (ownerId: string): Workspace =>
  workspaceSchema.parse({
    schemaVersion: 2,
    ownerId,
    runs: {},
    messages: [],
    drafts: {},
    views: {},
    activeProjectId: null,
    properties: {},
    spaces: {},
    projects: {},
    facts: {},
    evidence: {},
    artifacts: {},
    decisions: {},
    events: [],
    commands: {},
  });

export function migrateWorkspace(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && 'schemaVersion' in raw && raw.schemaVersion === 1) {
    return {
      ...raw,
      schemaVersion: 2,
      runs: {},
      messages: [],
      drafts: {},
      views: {},
      activeProjectId: null,
    };
  }
  return raw;
}
