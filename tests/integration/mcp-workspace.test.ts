import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { MongoWorkspaceRepository, OWNER, type Aggregate } from '../../apps/api/src/repository.js';
import { createWorkspaceMcpServer } from '../../apps/api/src/mcp.js';
import { CatalogStore } from '../../apps/api/src/catalog.js';
import { Scenario } from '../foundation-helpers.js';
import { emptyWorkspace, type Command } from '@renovagent/contracts';
import { buildTierPlans } from '@renovagent/core';
import { vanityCatalog, vanityTemplate } from '../../fixtures/catalog/vanity-philadelphia.js';

const uri = process.env.TEST_WORKSPACE_MONGO_URI;

function setup() {
  const s = new Scenario();
  s.create();
  s.evidence('source');
  s.apply(
    s.command('RecordFact', {
      scope: 'project',
      factId: 'goal',
      subjectId: 'project-a',
      key: 'goal',
      supersedesRevision: 0,
      value: { kind: 'text', text: 'Add a living-room half bath' },
      assertion: 'user_reported',
      evidenceIds: ['source'],
    }),
  );
  s.artifact('project-a:brief', [{ kind: 'fact', id: 'goal', revision: 1 }]);
  s.artifact('project-a:brief', [{ kind: 'fact', id: 'goal', revision: 1 }]);
  return s;
}

const mongoState = (state: Scenario['state']) =>
  JSON.parse(JSON.stringify(state).replaceAll('owner-test', OWNER));

async function withClient(
  fn: (client: Client, repo: MongoWorkspaceRepository, catalog: CatalogStore) => Promise<void>,
) {
  const client = new MongoClient(uri!);
  await client.connect();
  const db = client.db(`renovagent_mcp_test_${randomUUID().replaceAll('-', '')}`);
  try {
    const repo = new MongoWorkspaceRepository(db.collection<Aggregate>('workspace_aggregates'));
    await repo.collection.insertOne({
      _id: OWNER,
      version: 0,
      workspace: emptyWorkspace(OWNER),
      blobs: [],
      jobs: [],
    });
    await repo.importWorkspace(mongoState(setup().state), []);
    const catalog = new CatalogStore(db);
    await catalog.ensureIndexes();
    const server = createWorkspaceMcpServer(repo, catalog);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const mcp = new Client({ name: 'mcp-test-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), mcp.connect(clientTransport)]);
    try {
      await fn(mcp, repo, catalog);
    } finally {
      await mcp.close();
      await server.close();
    }
  } finally {
    await db.dropDatabase();
    await client.close();
  }
}

async function call(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as Array<{ type: string; text: string }>;
  const first = content[0];
  assert.equal(first?.type, 'text');
  return { result, text: first.text };
}

test(
  'MCP reads expose the same authorized homes, projects, context, and artifacts',
  { skip: !uri },
  () =>
    withClient(async (mcp) => {
      const homes = JSON.parse((await call(mcp, 'list_homes', {})).text);
      assert.equal(homes.length, 1);
      assert.equal(homes[0].name, 'Test property');
      assert.deepEqual(homes[0].projectIds, ['project-a']);

      const projects = JSON.parse((await call(mcp, 'list_projects', {})).text);
      assert.equal(projects.length, 1);
      assert.equal(projects[0].propertyId, 'property-a');
      const filtered = JSON.parse(
        (await call(mcp, 'list_projects', { propertyId: 'property-a' })).text,
      );
      assert.equal(filtered.length, 1);
      const empty = JSON.parse((await call(mcp, 'list_projects', { propertyId: 'nope' })).text);
      assert.deepEqual(empty, []);

      const context = JSON.parse(
        (await call(mcp, 'get_project_context', { projectId: 'project-a' })).text,
      );
      assert.equal(context.project.name, 'project-a');
      assert.equal(context.goal.value.text, 'Add a living-room half bath');
      assert.ok(context.facts.length >= 1);
      assert.ok(Array.isArray(context.capabilities.tools));
      assert.ok(context.capabilities.tools.includes('propose_project_change'));
      assert.match(JSON.stringify(context.capabilities.limits), /single-owner/);

      const latest = JSON.parse(
        (await call(mcp, 'get_artifact', { artifactId: 'project-a:brief' })).text,
      );
      assert.equal(latest.artifact.revision, 2);
      assert.equal(latest.pinned, false);
      const pinned = JSON.parse(
        (await call(mcp, 'get_artifact', { artifactId: 'project-a:brief', revision: 1 })).text,
      );
      assert.equal(pinned.artifact.revision, 1);
      assert.equal(pinned.pinned, true);
      assert.equal(pinned.currentRevision, 2);

      const missing = await call(mcp, 'get_project_context', { projectId: 'missing' });
      assert.equal(missing.result.isError, true);
      assert.match(missing.text, /NOT_FOUND/);
    }),
);

test(
  'MCP proposal persists a visible artifact and replays without duplicating',
  { skip: !uri },
  () =>
    withClient(async (mcp, repo) => {
      const before = await repo.read();
      const command: Command = {
        commandId: 'mcp-propose-1',
        projectId: 'project-a',
        baseRevision: before.workspace.projects['project-a']!.revision,
        basePropertyRevision: before.workspace.properties['property-a']!.revision,
        type: 'ProposeArtifact',
        payload: {
          artifactId: 'project-a:mcp-note',
          supersedesRevision: 0,
          inputRefs: [{ kind: 'fact', id: 'goal', revision: 1 }],
          evidenceIds: [],
          content: { kind: 'project-brief', sections: [{ title: 'MCP', text: 'Agent proposal' }] },
        },
      } as Command;
      const first = JSON.parse(
        (await call(mcp, 'propose_project_change', { commands: [command] })).text,
      );
      assert.equal(first.accepted, true);
      const stored = await repo.read();
      assert.equal(stored.workspace.artifacts['project-a:mcp-note']!.length, 1);
      const events = stored.workspace.events.length;

      const replay = JSON.parse(
        (await call(mcp, 'propose_project_change', { commands: [command] })).text,
      );
      assert.deepEqual(replay.results, first.results);
      assert.equal((await repo.read()).workspace.events.length, events);
    }),
);

test(
  'MCP rejects non-proposal commands, stale revisions, and unknown artifacts',
  { skip: !uri },
  () =>
    withClient(async (mcp, repo) => {
      const state = (await repo.read()).workspace;
      const base = {
        projectId: 'project-a',
        baseRevision: state.projects['project-a']!.revision,
        basePropertyRevision: state.properties['property-a']!.revision,
      };
      const fact = await call(mcp, 'propose_project_change', {
        commands: [
          {
            commandId: 'mcp-fact-1',
            ...base,
            type: 'RecordFact',
            payload: {
              scope: 'project',
              factId: 'goal',
              subjectId: 'project-a',
              key: 'goal',
              supersedesRevision: 1,
              value: { kind: 'text', text: 'Agent-forged goal' },
              assertion: 'user_reported',
              evidenceIds: ['source'],
            },
          },
        ],
      });
      assert.equal(fact.result.isError, true);
      assert.match(fact.text, /Capability limit/);

      const stale = await call(mcp, 'propose_project_change', {
        commands: [
          {
            commandId: 'mcp-stale-1',
            projectId: 'project-a',
            baseRevision: 0,
            basePropertyRevision: 0,
            type: 'ProposeArtifact',
            payload: {
              artifactId: 'project-a:stale',
              supersedesRevision: 0,
              inputRefs: [],
              evidenceIds: [],
              content: { kind: 'project-brief', sections: [{ title: 'x', text: 'y' }] },
            },
          },
        ],
      });
      assert.equal(stale.result.isError, true);
      assert.match(stale.text, /CONFLICT/);

      const missing = await call(mcp, 'get_artifact', { artifactId: 'missing' });
      assert.equal(missing.result.isError, true);
      assert.match(missing.text, /NOT_FOUND/);
    }),
);

test('MCP catalog tools search products and read price history', { skip: !uri }, () =>
  withClient(async (mcp, _repo, catalog) => {
    await catalog.importBatch(vanityCatalog);
    const found = JSON.parse((await call(mcp, 'search_catalog', { query: 'faucet' })).text);
    assert.ok(found.products.some((p: { id: string }) => p.id === 'van-fau-mid'));
    assert.ok(found.offers.every((o: { productId: string }) => o.productId.startsWith('van-fau')));
    assert.ok(
      found.observations.every(
        (o: { freshness: string; source: string }) => o.freshness && o.source,
      ),
    );
    const history = JSON.parse(
      (await call(mcp, 'get_offer_history', { offerId: 'offer-van-fau-builder' })).text,
    );
    assert.equal(history.length, 1);
    assert.equal(history[0].unitPrice.amountMinor, 3900);
  }),
);

test(
  'MCP builds a checkout review from a stored purchase plan without storing it',
  { skip: !uri },
  () =>
    withClient(async (mcp, repo, catalog) => {
      await catalog.importBatch(vanityCatalog);
      const state = (await repo.read()).workspace;
      const base = state.projects['project-a'].revision;
      const propertyBase = state.properties['property-a'].revision;
      await repo.execute([
        {
          commandId: 'mcp-test-bom',
          projectId: 'project-a',
          baseRevision: base,
          basePropertyRevision: propertyBase,
          type: 'ProposeArtifact',
          payload: {
            artifactId: 'project-a:bom',
            supersedesRevision: 0,
            inputRefs: [],
            evidenceIds: [],
            content: vanityTemplate,
          },
        },
      ]);
      const priced = vanityCatalog.offers.map((offer) => ({
        offer,
        product: vanityCatalog.products.find((p) => p.id === offer.productId)!,
        observation: vanityCatalog.observations.find((o) => o.offerId === offer.id)!,
      }));
      const [builder] = buildTierPlans(vanityTemplate, priced);
      await repo.execute([
        {
          commandId: 'mcp-test-plan',
          projectId: 'project-a',
          baseRevision: base + 1,
          basePropertyRevision: propertyBase,
          type: 'ProposeArtifact',
          payload: {
            artifactId: 'project-a:purchase-plan:builder',
            supersedesRevision: 0,
            inputRefs: [{ kind: 'artifact', id: 'project-a:bom', revision: 1 }],
            evidenceIds: [],
            content: {
              kind: 'purchase-plan',
              ...builder,
              bomRef: { kind: 'artifact', id: 'project-a:bom', revision: 1 },
              builtAt: '2026-10-29T15:00:00.000Z',
            },
          },
        },
      ]);
      const review = JSON.parse(
        (
          await call(mcp, 'build_checkout_review', {
            projectId: 'project-a',
            purchasePlanId: 'project-a:purchase-plan:builder',
          })
        ).text,
      );
      assert.equal(review.kind, 'checkout-review');
      assert.equal(review.groups.length, 1);
      assert.equal(review.totals.subtotalMinor, 30700);
      assert.equal(review.authorizationRequired, true);
      assert.ok(review.checklist.length >= 5);
      // Computation only: nothing new was stored.
      assert.equal(
        (await repo.read()).workspace.artifacts['project-a:checkout-review:builder'],
        undefined,
      );
      const missing = await call(mcp, 'build_checkout_review', {
        projectId: 'project-a',
        purchasePlanId: 'project-a:purchase-plan:mid',
      });
      assert.equal(missing.result.isError, true);
      assert.match(missing.text, /NOT_FOUND/);
    }),
);
