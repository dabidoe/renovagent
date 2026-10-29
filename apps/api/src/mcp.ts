import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  DomainError,
  commandSchema,
  id,
  type Artifact,
  type Command,
  type Fact,
  type Workspace,
} from '@renovagent/contracts';
import { MongoWorkspaceRepository, OWNER } from './repository.js';
import { CatalogStore } from './catalog.js';
import {
  buildCheckoutReview,
  buildTierPlans,
  fingerprint,
  referenceCurrent,
} from '@renovagent/core';
import { startAgentProject } from './agent-projects.js';
import { draftProjectScope } from './scope-drafts.js';
import type { McpAccess } from './mcp-access.js';
import { workspaceMongoConfig } from './database-config.js';

export const MCP_SERVER_NAME = 'renovagent-workspace';
export const MCP_SERVER_VERSION = '0.2.0';

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
    'list_project_files',
    'get_artifact',
    'start_project',
    'draft_scope',
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

// Core checks commerce arithmetic against the referenced artifacts; only the
// catalog can confirm that offers, prices and product fit are real. Agent
// commerce proposals are rebuilt from the catalog and must match exactly.
async function verifyCommerceProposal(
  catalog: CatalogStore | undefined,
  workspace: Workspace,
  command: Command,
): Promise<void> {
  if (command.type !== 'ProposeArtifact') return;
  const content = command.payload.content;
  if (content.kind === 'bom') {
    // Candidates must be catalog products of the item's own category, so a
    // proposal cannot route an item to an unrelated (or nonexistent) product.
    if (!catalog) return;
    const ids = [...new Set(content.items.flatMap((item) => item.candidateProductIds))];
    const categories = new Map(
      (await catalog.productsByIds(ids)).map((product) => [product.id, product.category]),
    );
    for (const item of content.items)
      for (const productId of item.candidateProductIds)
        if (categories.get(productId) !== item.category)
          throw new DomainError(
            'VALIDATION',
            `BOM item ${item.id}: candidate ${productId} is not a catalog ${item.category} product`,
          );
    return;
  }
  if (content.kind !== 'purchase-plan' && content.kind !== 'checkout-review') return;
  if (!catalog)
    throw new DomainError('VALIDATION', 'Catalog is unavailable to verify this commerce proposal');
  const mismatch = (what: string) =>
    new DomainError(
      'VALIDATION',
      `${what} does not match the current catalog; rebuild it from catalog data before proposing`,
    );
  if (content.kind === 'purchase-plan') {
    const bom = workspace.artifacts[content.bomRef.id]?.find(
      (artifact) => artifact.revision === content.bomRef.revision,
    );
    if (bom?.payload.kind !== 'bom')
      throw new DomainError('VALIDATION', 'Purchase plan must name an existing BOM artifact');
    const priced = await catalog.pricedOffers([
      ...new Set(bom.payload.items.flatMap((item) => item.candidateProductIds)),
    ]);
    const rebuilt = buildTierPlans(bom.payload, priced).find((plan) => plan.tier === content.tier);
    // Whole-payload comparison: notes and rejections are displayed too, so an
    // agent cannot add unverified claims to them. Only the build time may differ.
    if (
      !rebuilt ||
      fingerprint({
        kind: 'purchase-plan',
        ...rebuilt,
        bomRef: content.bomRef,
        builtAt: content.builtAt,
      }) !== fingerprint(content)
    )
      throw mismatch('Purchase plan');
    return;
  }
  const ref = content.purchasePlanRef;
  const plan = workspace.artifacts[ref.id]?.find((artifact) => artifact.revision === ref.revision);
  if (plan?.payload.kind !== 'purchase-plan')
    throw new DomainError('VALIDATION', 'Checkout review must reference a purchase plan');
  const found = await catalog.offersFor([
    ...new Set(plan.payload.lines.map((line) => line.productId)),
  ]);
  const tags = content.groups.flatMap((group) =>
    group.cartUrl ? [new URL(group.cartUrl).searchParams.get('AssociateTag')] : [],
  );
  const associateTag = tags.find((tag): tag is string => !!tag);
  const rebuilt = buildCheckoutReview(
    plan.payload,
    { id: plan.id, revision: plan.revision },
    new Map(found.offers.map((offer) => [offer.id, offer])),
    { ...(associateTag ? { associateTag } : {}), builtAt: content.builtAt },
  );
  if (fingerprint(rebuilt) !== fingerprint(content)) throw mismatch('Checkout review');
}

export function createWorkspaceMcpServer(
  repository: MongoWorkspaceRepository,
  catalog?: CatalogStore,
  options: { access?: McpAccess; transport?: 'stdio' | 'streamable-http' } = {},
) {
  const canPropose = options.access !== 'read';
  const capabilities = {
    ...CAPABILITIES,
    transports: [options.transport ?? 'stdio'],
    access: canPropose ? 'propose' : 'read',
    tools: CAPABILITIES.tools.filter(
      (name) =>
        canPropose || !['start_project', 'draft_scope', 'propose_project_change'].includes(name),
    ),
    proposalCommands: canPropose ? CAPABILITIES.proposalCommands : [],
    limits: [
      options.transport === 'streamable-http'
        ? 'One authenticated owner workspace per connector credential; no cross-owner discovery.'
        : CAPABILITIES.limits[0],
      ...CAPABILITIES.limits.slice(1),
    ],
  };
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    {
      instructions:
        'Renovagent keeps durable home-improvement projects. Start with list_homes/list_projects or start_project for a new user request. Use list_project_files to discover saved work, then get_artifact to inspect exact revisions. Develop useful proposed work from project evidence. Keep unknown facts and prices explicit. Project creation stores intent only; it does not analyze photos or produce an estimate. Never claim a proposal is professional approval or a passed inspection.',
    },
  );

  server.tool(
    'list_homes',
    'List the homes (properties) in the authorized workspace.',
    {},
    { readOnlyHint: true, openWorldHint: false },
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
    'List projects in the authorized workspace, optionally filtered to one home.',
    { propertyId: id.optional() },
    { readOnlyHint: true, openWorldHint: false },
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
    { projectId: id },
    { readOnlyHint: true, openWorldHint: false },
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
          files: artifacts.map(({ id, revision, lifecycle, freshness, payload }) => ({
            id,
            revision,
            kind: payload.kind,
            lifecycle,
            freshness,
          })),
          capabilities,
        });
      } catch (error) {
        failure(error);
      }
    },
  );

  server.tool(
    'list_project_files',
    'Discover the saved files of one project: IDs, exact revisions, kinds, freshness and decision status. Read a file with get_artifact. Does not generate work.',
    { projectId: id },
    { readOnlyHint: true, openWorldHint: false },
    async ({ projectId }) => {
      try {
        const { workspace } = await repository.read();
        if (!workspace.projects[projectId]) throw new DomainError('NOT_FOUND', 'Unknown project');
        return text(
          projectArtifacts(workspace, projectId).map((artifact) => ({
            artifactRef: { kind: 'artifact', id: artifact.id, revision: artifact.revision },
            kind: artifact.payload.kind,
            lifecycle: artifact.lifecycle,
            freshness: artifact.freshness,
            createdAt: artifact.createdAt,
            inputRefs: artifact.inputRefs,
          })),
        );
      } catch (error) {
        failure(error);
      }
    },
  );

  if (canPropose)
    server.tool(
      'start_project',
      'Start a durable project from a user request, without requiring an address, measurements or chosen products. Saves a proposed brief only. Reuse requestId for retries; omit propertyId for a new home or use a home returned by list_homes. Does not produce a renovation plan or estimate.',
      {
        requestId: id.describe(
          'Stable unique request identifier, reused only for identical retries',
        ),
        name: z.string().trim().min(1).max(300),
        brief: z
          .string()
          .trim()
          .min(1)
          .max(4000)
          .describe('The user request relayed by the agent; saved as an unverified proposal'),
        propertyId: id.optional(),
      },
      { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      async (input) => {
        try {
          return text(await startAgentProject(repository, input));
        } catch (error) {
          failure(error);
        }
      },
    );

  if (canPropose)
    server.tool(
      'draft_scope',
      'Draft a project\'s scope and complete materials list from a versioned recipe: work packages, every supporting part, quantity basis, conditional items and sources. Works with nothing measured; pass only values the person actually gave, and amount null for "I don\'t know". Returns at most two next questions. Also proposes a bill of materials for the catalog-priceable items. Reuse requestId for retries.',
      {
        requestId: id.describe(
          'Stable unique request identifier, reused only for identical retries',
        ),
        projectId: id,
        recipeId: z.enum(['bathroom-refresh']),
        packageIds: z
          .array(
            z.enum([
              'vanity',
              'toilet',
              'floor-tile',
              'paint',
              'exhaust-fan',
              'service-work',
              'removal-protection',
            ]),
          )
          .min(1)
          .max(7)
          .describe('Work the person asked for; removal and protection are added automatically'),
        request: z.string().trim().min(1).max(2000).describe('The request, relayed verbatim'),
        reported: z
          .array(
            z
              .object({
                key: z.enum([
                  'floorLengthFt',
                  'floorWidthFt',
                  'ceilingHeightFt',
                  'vanityWidthIn',
                  'toiletRoughInIn',
                ]),
                amount: z.number().positive().max(10000).nullable(),
                unit: z.enum(['ft', 'in', 'm', 'cm']),
              })
              .strict(),
          )
          .max(10)
          .default([]),
      },
      { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      async (input) => {
        try {
          return text(await draftProjectScope(repository, catalog, input));
        } catch (error) {
          failure(error);
        }
      },
    );

  server.tool(
    'get_artifact',
    'Read one artifact revision with its freshness, evidence, and limitations. Defaults to the latest revision; historical views stay pinned.',
    {
      artifactId: id,
      revision: z.number().int().positive().optional(),
    },
    { readOnlyHint: true, openWorldHint: false },
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

  if (canPropose)
    server.tool(
      'propose_project_change',
      'Propose bounded changes as validated workspace commands. Only ProposeArtifact, SaveDraft, and AppendMessage are accepted; repeated commandIds do not duplicate effects.',
      {
        commands: z.array(z.unknown()).min(1).max(20),
      },
      { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
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
          if (parsed.some((command) => command.type === 'ProposeArtifact')) {
            const { workspace } = await repository.read();
            for (const command of parsed) await verifyCommerceProposal(catalog, workspace, command);
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
    { readOnlyHint: true, openWorldHint: false },
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
      offerId: id,
      limit: z.number().int().min(1).max(200).optional(),
    },
    { readOnlyHint: true, openWorldHint: false },
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
      projectId: id,
      purchasePlanId: id,
      associateTag: z.string().min(1).max(60).optional(),
    },
    { readOnlyHint: true, openWorldHint: false },
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
        if (
          plan.lifecycle === 'rejected' ||
          !referenceCurrent(workspace, projectId, {
            kind: 'artifact',
            id: plan.id,
            revision: plan.revision,
          })
        )
          throw new DomainError(
            'STALE',
            'Rebuild and review the current purchase plan before preparing checkout',
          );
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

async function mongoUri() {
  const flag = process.argv.findIndex((arg) => arg === '--uri');
  const value =
    process.argv.find((arg) => arg.startsWith('--uri='))?.slice('--uri='.length) ??
    (flag >= 0 ? process.argv[flag + 1] : undefined) ??
    (await workspaceMongoConfig()).uri;
  return value;
}

async function main() {
  const { repository, client } = await MongoWorkspaceRepository.connect(await mongoUri());
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
