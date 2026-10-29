import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  DomainError,
  commandSchema,
  type Artifact,
  type Fact,
  type Workspace,
} from '@renovagent/contracts';
import { MongoWorkspaceRepository, OWNER } from './repository.js';
import { CatalogStore } from './catalog.js';
import { buildCheckoutReview } from '@renovagent/core';

export const MCP_SERVER_NAME = 'renovagent-workspace';
export const MCP_SERVER_VERSION = '0.1.0';

// Agent proposals may suggest new work, drafts, and conversation notes. They must
// not record source facts, accept decisions, or release work; those stay
// owner-driven through the web workspace.
const PROPOSAL_ALLOWLIST = ['ProposeArtifact', 'SaveDraft', 'AppendMessage'] as const;

const CAPABILITIES = {
  transports: ['stdio'],
  tools: [
    'list_homes',
    'list_projects',
    'get_project_context',
    'get_artifact',
    'propose_project_change',
    'search_catalog',
    'get_offer_history',
    'build_checkout_review',
  ],
  proposalCommands: [...PROPOSAL_ALLOWLIST],
  limits: [
    'Local single-owner workspace only; no cross-owner discovery.',
    'Proposals cannot approve themselves, record source facts, or release work.',
    'Photo jobs are not exposed over MCP in this increment.',
    'Catalog prices are dated observations; the agent must surface freshness and never present them as live checkout totals.',
  ],
} as const;

function latest<T extends { revision: number }>(records: T[]): T {
  return records.reduce((a, b) => (b.revision > a.revision ? b : a));
}

function text(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

function failure(error: unknown): never {
  if (error instanceof DomainError) throw new Error(`(${error.code}) ${error.message}`);
  throw error instanceof Error ? error : new Error('Unexpected MCP adapter failure');
}

function projectFacts(state: Workspace, projectId: string, propertyId: string) {
  return Object.values(state.facts)
    .map(latest)
    .filter(
      (fact) =>
        fact.projectId === projectId || (fact.projectId === null && fact.propertyId === propertyId),
    );
}

function projectArtifacts(state: Workspace, projectId: string) {
  return Object.values(state.artifacts)
    .map(latest)
    .filter((artifact) => artifact.projectId === projectId);
}

function evidenceMetadata(state: Workspace, propertyId: string, projectId: string) {
  return Object.values(state.evidence)
    .filter(
      (item) =>
        item.propertyId === propertyId && (item.projectId === null || item.projectId === projectId),
    )
    .map((item) => ({
      id: item.id,
      kind: item.source.kind,
      description: item.source.description,
      recordedAt: item.recordedAt,
      attachment: item.source.attachment
        ? {
            name: item.source.attachment.name,
            mediaType: item.source.attachment.mediaType,
            sha256: item.source.attachment.sha256,
            role: item.source.attachment.role,
          }
        : null,
    }));
}

function uncertainties(state: Workspace, facts: Fact[], artifacts: Artifact[], projectId: string) {
  return {
    unconfirmedFacts: facts
      .filter((fact) => fact.assertion === 'unknown' || fact.assertion === 'assumed')
      .map((fact) => ({
        id: fact.id,
        key: fact.key,
        revision: fact.revision,
        assertion: fact.assertion,
      })),
    pendingDecisions: Object.values(state.decisions)
      .filter((decision) => decision.projectId === projectId && decision.acceptedAt === null)
      .map((decision) => ({ id: decision.id, question: decision.question })),
    staleArtifacts: artifacts
      .filter((artifact) => artifact.freshness !== 'current')
      .map((artifact) => ({
        id: artifact.id,
        revision: artifact.revision,
        freshness: artifact.freshness,
      })),
  };
}

export function createWorkspaceMcpServer(
  repository: MongoWorkspaceRepository,
  catalog?: CatalogStore,
) {
  const server = new McpServer({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION });

  server.tool(
    'list_homes',
    'List the homes (properties) in this local workspace.',
    {},
    async () => {
      try {
        const { workspace } = await repository.read();
        return text(
          Object.values(workspace.properties).map((property) => ({
            id: property.id,
            name: property.name,
            revision: property.revision,
            projectIds: Object.values(workspace.projects)
              .filter((project) => project.propertyId === property.id)
              .map((project) => project.id),
          })),
        );
      } catch (error) {
        failure(error);
      }
    },
  );

  server.tool(
    'list_projects',
    'List projects in this local workspace, optionally filtered to one home.',
    { propertyId: z.string().min(1).max(160).optional() },
    async ({ propertyId }) => {
      try {
        const { workspace } = await repository.read();
        return text(
          Object.values(workspace.projects)
            .filter((project) => !propertyId || project.propertyId === propertyId)
            .map((project) => ({
              id: project.id,
              propertyId: project.propertyId,
              name: project.name,
              spaceIds: project.spaceIds,
              revision: project.revision,
              createdAt: project.createdAt,
            })),
        );
      } catch (error) {
        failure(error);
      }
    },
  );

  server.tool(
    'get_project_context',
    'Read a project goal, current facts, uncertainties, evidence metadata, input revisions, and capabilities.',
    { projectId: z.string().min(1).max(160) },
    async ({ projectId }) => {
      try {
        const { workspace } = await repository.read();
        const project = workspace.projects[projectId];
        if (!project) throw new DomainError('NOT_FOUND', `Unknown project ${projectId}`);
        const property = workspace.properties[project.propertyId];
        if (!property) throw new DomainError('NOT_FOUND', `Unknown home ${project.propertyId}`);
        const facts = projectFacts(workspace, projectId, property.id);
        const artifacts = projectArtifacts(workspace, projectId);
        return text({
          project: {
            id: project.id,
            name: project.name,
            revision: project.revision,
            property: { id: property.id, name: property.name, revision: property.revision },
          },
          goal: facts.find((fact) => fact.key === 'goal' && fact.subjectId === projectId) ?? null,
          facts,
          uncertainties: uncertainties(workspace, facts, artifacts, projectId),
          evidence: evidenceMetadata(workspace, property.id, projectId),
          revisions: { project: project.revision, property: property.revision },
          capabilities: CAPABILITIES,
        });
      } catch (error) {
        failure(error);
      }
    },
  );

  server.tool(
    'get_artifact',
    'Read one artifact revision with its freshness, evidence, and limitations. Defaults to the latest revision; historical views stay pinned.',
    {
      artifactId: z.string().min(1).max(160),
      revision: z.number().int().positive().optional(),
    },
    async ({ artifactId, revision }) => {
      try {
        const { workspace } = await repository.read();
        const records = workspace.artifacts[artifactId];
        if (!records?.length) throw new DomainError('NOT_FOUND', `Unknown artifact ${artifactId}`);
        const current = latest(records);
        const selected = revision
          ? records.find((record) => record.revision === revision)
          : current;
        if (!selected)
          throw new DomainError('NOT_FOUND', `Unknown revision ${revision} of ${artifactId}`);
        return text({
          artifact: selected,
          currentRevision: current.revision,
          pinned: selected.revision !== current.revision,
          evidence: selected.evidenceIds.map((id) => workspace.evidence[id]?.source ?? null),
          limitations: [
            'A stored artifact is a proposal or record, not professional approval.',
            'Stale or invalid freshness means inputs changed; do not act on it without review.',
          ],
        });
      } catch (error) {
        failure(error);
      }
    },
  );

  server.tool(
    'propose_project_change',
    'Propose bounded changes as validated workspace commands. Only ProposeArtifact, SaveDraft, and AppendMessage are accepted; repeated commandIds do not duplicate effects.',
    {
      commands: z.array(z.unknown()).min(1).max(20),
    },
    async ({ commands }) => {
      try {
        const parsed = commands.map((command) => commandSchema.parse(command));
        for (const command of parsed) {
          if (!(PROPOSAL_ALLOWLIST as readonly string[]).includes(command.type))
            throw new DomainError(
              'FORBIDDEN',
              `Capability limit: ${command.type} is not proposal-grade. The agent cannot record facts, accept decisions, or release work.`,
            );
        }
        const results = await repository.execute(parsed);
        return text({
          accepted: true,
          results,
          note: 'Stored proposal only. Customer approval and qualified review remain distinct.',
        });
      } catch (error) {
        failure(error);
      }
    },
  );

  server.tool(
    'search_catalog',
    'Search shared catalog products with their offers and latest dated prices. Every price carries retailer, observed time, source, and freshness; never present one as a live checkout total.',
    {
      query: z.string().min(1).max(200),
      category: z.string().min(1).max(120).optional(),
    },
    async ({ query, category }) => {
      try {
        if (!catalog) throw new DomainError('VALIDATION', 'Catalog is unavailable');
        return text(await catalog.search(query, category));
      } catch (error) {
        failure(error);
      }
    },
  );

  server.tool(
    'get_offer_history',
    'Read the dated price history of one catalog offer, newest first.',
    {
      offerId: z.string().min(1).max(160),
      limit: z.number().int().min(1).max(200).optional(),
    },
    async ({ offerId, limit }) => {
      try {
        if (!catalog) throw new DomainError('VALIDATION', 'Catalog is unavailable');
        return text(await catalog.history(offerId, limit ?? 50));
      } catch (error) {
        failure(error);
      }
    },
  );

  server.tool(
    'build_checkout_review',
    'Assemble a checkout review (retailer carts plus a customer double-check list) from a stored purchase plan. Computation only; nothing is stored or purchased. Propose it with propose_project_change to save it.',
    {
      projectId: z.string().min(1).max(160),
      purchasePlanId: z.string().min(1).max(160),
      associateTag: z.string().min(1).max(60).optional(),
    },
    async ({ projectId, purchasePlanId, associateTag }) => {
      try {
        if (!catalog) throw new DomainError('VALIDATION', 'Catalog is unavailable');
        const { workspace } = await repository.read();
        if (!workspace.projects[projectId])
          throw new DomainError('NOT_FOUND', `Unknown project ${projectId}`);
        const records = workspace.artifacts[purchasePlanId] ?? [];
        const plan = [...records]
          .sort((a, b) => b.revision - a.revision)
          .find((record) => record.projectId === projectId);
        if (!plan || plan.payload.kind !== 'purchase-plan')
          throw new DomainError('NOT_FOUND', `Unknown purchase plan ${purchasePlanId}`);
        const productIds = [...new Set(plan.payload.lines.map((line) => line.productId))];
        const found = await catalog.offersFor(productIds);
        const offers = new Map(found.offers.map((offer) => [offer.id, offer]));
        return text(
          buildCheckoutReview(
            plan.payload,
            { id: plan.id, revision: plan.revision },
            offers,
            associateTag ? { associateTag } : {},
          ),
        );
      } catch (error) {
        failure(error);
      }
    },
  );

  return server;
}

function mongoUri() {
  const flag = process.argv.findIndex((arg) => arg === '--uri');
  const value =
    process.argv.find((arg) => arg.startsWith('--uri='))?.slice('--uri='.length) ??
    (flag >= 0 ? process.argv[flag + 1] : undefined) ??
    process.env.RENOVAGENT_MONGO_URI;
  if (!value) throw new Error('Set RENOVAGENT_MONGO_URI or pass --uri <mongodb-uri>');
  return value;
}

async function main() {
  const { repository, client } = await MongoWorkspaceRepository.connect(mongoUri());
  await repository.read();
  const catalog = new CatalogStore(client.db());
  await catalog.ensureIndexes();
  const server = createWorkspaceMcpServer(repository, catalog);
  const transport = new StdioServerTransport();
  const shutdown = async () => {
    await transport.close().catch(() => {});
    await client.close().catch(() => {});
  };
  process.on('SIGINT', () => void shutdown().then(() => process.exit(0)));
  process.on('SIGTERM', () => void shutdown().then(() => process.exit(0)));
  console.error(`[${MCP_SERVER_NAME}] serving local workspace for owner ${OWNER} over stdio`);
  await server.connect(transport);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      `[${MCP_SERVER_NAME}] startup failed:`,
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  });
}
