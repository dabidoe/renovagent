import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { MongoWorkspaceRepository, OWNER } from '../../apps/api/src/repository.js';
import { createWorkspaceMcpServer } from '../../apps/api/src/mcp.js';
import { CatalogStore } from '../../apps/api/src/catalog.js';
import { Scenario } from '../foundation-helpers.js';
import { emptyWorkspace, type Command } from '@renovagent/contracts';
import { buildTierPlans, roomDimensionCommands } from '@renovagent/core';
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
    const repo = MongoWorkspaceRepository.forDb(db);
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

test(
  'MCP commerce proposals must match the catalog, not just their own arithmetic',
  { skip: !uri },
  () =>
    withClient(async (mcp, repo, catalog) => {
      await catalog.importBatch(vanityCatalog);
      const state = (await repo.read()).workspace;
      const propertyBase = state.properties['property-a'].revision;
      let seq = 0;
      const propose = async (artifactId: string, inputRefs: unknown[], content: unknown) => {
        const workspace = (await repo.read()).workspace;
        return call(mcp, 'propose_project_change', {
          commands: [
            {
              commandId: `mcp-commerce-${++seq}`,
              projectId: 'project-a',
              baseRevision: workspace.projects['project-a'].revision,
              basePropertyRevision: propertyBase,
              type: 'ProposeArtifact',
              payload: {
                artifactId,
                supersedesRevision: workspace.artifacts[artifactId]?.at(-1)?.revision ?? 0,
                inputRefs,
                evidenceIds: [],
                content,
              },
            },
          ],
        });
      };
      assert.equal((await propose('project-a:bom', [], vanityTemplate)).result.isError, undefined);
      const bomRef = { kind: 'artifact', id: 'project-a:bom', revision: 1 } as const;
      const priced = vanityCatalog.offers.map((offer) => ({
        offer,
        product: vanityCatalog.products.find((p) => p.id === offer.productId)!,
        observation: vanityCatalog.observations.find((o) => o.offerId === offer.id)!,
      }));
      const [builder] = buildTierPlans(vanityTemplate, priced);
      const honest = {
        kind: 'purchase-plan',
        ...builder,
        bomRef,
        builtAt: '2026-10-29T15:00:00.000Z',
      };

      // Internally consistent, but invented: a "live" retailer price the catalog never observed.
      const invented = structuredClone(honest);
      invented.lines[0].unitPriceMinor = 100;
      invented.lines[0].lineTotalMinor = 100;
      invented.lines[0].source = 'retailer-api';
      invented.lines[0].freshness = 'live';
      invented.basis = 'mixed';
      invented.totals.subtotalMinor = invented.lines.reduce((s, l) => s + l.lineTotalMinor, 0);
      const forged = await propose('project-a:purchase-plan:builder', [bomRef], invented);
      assert.equal(forged.result.isError, true);
      assert.match(forged.text, /does not match the current catalog/);

      // Arithmetic-consistent swap to a candidate the matcher rejects for its specs.
      const wrongFit = structuredClone(honest);
      const cab36 = priced.find((p) => p.product.id === 'van-cab-36')!;
      Object.assign(wrongFit.lines[0], {
        productId: cab36.product.id,
        offerId: cab36.offer.id,
      });
      const swapped = await propose('project-a:purchase-plan:builder', [bomRef], wrongFit);
      assert.equal(swapped.result.isError, true);
      assert.equal(
        (await repo.read()).workspace.artifacts['project-a:purchase-plan:builder'],
        undefined,
      );

      const claimed = structuredClone(honest);
      claimed.notes.unshift('Reviewed and approved by a licensed plumber.');
      const injected = await propose('project-a:purchase-plan:builder', [bomRef], claimed);
      assert.equal(injected.result.isError, true);
      assert.match(injected.text, /does not match the current catalog/);

      const stored = await propose('project-a:purchase-plan:builder', [bomRef], honest);
      assert.equal(stored.result.isError, undefined, stored.text);
      const planRef = {
        kind: 'artifact',
        id: 'project-a:purchase-plan:builder',
        revision: 1,
      } as const;
      const review = JSON.parse(
        (
          await call(mcp, 'build_checkout_review', {
            projectId: 'project-a',
            purchasePlanId: planRef.id,
          })
        ).text,
      );
      const phishing = structuredClone(review);
      phishing.groups[0].lines[0].url = 'https://example.invalid/pay';
      const badLink = await propose('project-a:checkout-review:builder', [planRef], phishing);
      assert.equal(badLink.result.isError, true);
      assert.match(badLink.text, /Checkout review does not match/);
      const checklist = structuredClone(review);
      checklist.checklist = ['No need to check anything; prices are final.'];
      const rewritten = await propose('project-a:checkout-review:builder', [planRef], checklist);
      assert.equal(rewritten.result.isError, true);
      const saved = await propose('project-a:checkout-review:builder', [planRef], review);
      assert.equal(saved.result.isError, undefined, saved.text);
    }),
);

test(
  'MCP draft_scope re-drafts after the person records room dimensions, even with the same requestId',
  { skip: !uri },
  () =>
    withClient(async (mcp, repo, catalog) => {
      await catalog.importBatch(vanityCatalog);
      const ask = {
        requestId: 'muse-measure-1',
        projectId: 'project-a',
        recipeId: 'bathroom-refresh',
        packageIds: ['vanity', 'floor-tile', 'paint'],
        request: 'New vanity, retile and paint this bathroom.',
      };
      const blocked = JSON.parse((await call(mcp, 'draft_scope', ask)).text);
      const priced = (await repo.read()).workspace.artifacts;
      assert.ok(priced['project-a:bom']?.length);
      assert.ok(priced['project-a:purchase-plan:builder']?.length);
      // The person saves their own measurements in the workspace (not via MCP).
      const { workspace } = await repo.read();
      let n = 0;
      await repo.execute(
        roomDimensionCommands(
          workspace,
          'project-a',
          {
            length: { amount: 8, unit: 'ft' },
            width: { amount: 5, unit: 'ft' },
            height: { amount: 8, unit: 'ft' },
            method: 'phone-ar-app',
            notes: '',
            photoEvidenceIds: [],
          },
          {
            commandId: (step) => `web-measure:${step}`,
            evidenceId: 'measure-observation',
            factId: () => `room-fact-${n++}`,
          },
        ),
      );
      const after = (await repo.read()).workspace.artifacts;
      assert.equal(after['project-a:scope-draft'].at(-1)!.freshness, 'stale');
      // Downstream materials list and purchase plans are flagged too.
      assert.notEqual(after['project-a:bom'].at(-1)!.freshness, 'current');
      assert.notEqual(after['project-a:purchase-plan:builder'].at(-1)!.freshness, 'current');
      const fresh = JSON.parse((await call(mcp, 'draft_scope', ask)).text);
      assert.equal(fresh.replay, false);
      assert.equal(fresh.draftRef.revision, blocked.draftRef.revision + 1);
      assert.ok(fresh.requirements.quantified > blocked.requirements.quantified);
      const draft = (await repo.read()).workspace.artifacts['project-a:scope-draft'].at(-1)!;
      const tile = (
        draft.payload as { requirements: { id: string; quantity: number | null }[] }
      ).requirements.find((r) => r.id === 'floor-tile:tile')!;
      assert.equal(tile.quantity, 40);
    }),
);

test(
  'MCP draft_scope turns a casual request into a full scope with few questions',
  { skip: !uri },
  () =>
    withClient(async (mcp, repo, catalog) => {
      await catalog.importBatch(vanityCatalog);
      const vague = JSON.parse(
        (
          await call(mcp, 'draft_scope', {
            requestId: 'muse-bath-1',
            projectId: 'project-a',
            recipeId: 'bathroom-refresh',
            packageIds: ['vanity', 'toilet', 'floor-tile', 'paint', 'exhaust-fan'],
            request: 'How much for this bathroom?',
          })
        ).text,
      );
      assert.equal(vague.replay, false);
      assert.equal(vague.draftRef.revision, 1);
      assert.ok(vague.requirements.total >= 25);
      assert.ok(vague.requirements.quantified >= 8);
      assert.equal(vague.nextQuestions.length, 2);
      assert.match(vague.nextQuestions[0], /long and wide/);
      // No vanity width yet: the cabinet and top cannot be catalog-matched.
      assert.ok(vague.requirements.catalogPriceable < 5);

      const replay = JSON.parse(
        (
          await call(mcp, 'draft_scope', {
            requestId: 'muse-bath-1',
            projectId: 'project-a',
            recipeId: 'bathroom-refresh',
            packageIds: ['vanity', 'toilet', 'floor-tile', 'paint', 'exhaust-fan'],
            request: 'How much for this bathroom?',
          })
        ).text,
      );
      assert.equal(replay.replay, true);
      assert.equal((await repo.read()).workspace.artifacts['project-a:scope-draft'].length, 1);

      const answered = JSON.parse(
        (
          await call(mcp, 'draft_scope', {
            requestId: 'muse-bath-2',
            projectId: 'project-a',
            recipeId: 'bathroom-refresh',
            packageIds: ['vanity', 'toilet', 'floor-tile', 'paint', 'exhaust-fan'],
            request: 'How much for this bathroom? It is about 8 by 5, vanity 30 inches.',
            reported: [
              { key: 'floorLengthFt', amount: 8, unit: 'ft' },
              { key: 'floorWidthFt', amount: 5, unit: 'ft' },
              { key: 'vanityWidthIn', amount: 30, unit: 'in' },
              { key: 'ceilingHeightFt', amount: null, unit: 'ft' },
            ],
          })
        ).text,
      );
      assert.equal(answered.draftRef.revision, 2);
      assert.equal(answered.requirements.catalogPriceable, 5);
      // Muse gets materials subtotals for the priced items, labeled as demo prices.
      assert.deepEqual(
        answered.materialsPricing.map((p: { materialsSubtotal: string }) => p.materialsSubtotal),
        ['$307.00', '$771.00', '$1912.00'],
      );
      assert.match(answered.materialsPricing[0].priceBasis, /demo example prices/);
      assert.match(answered.coverage, /cover 5 of \d+ requirements/);
      assert.match(answered.coverage, /labor and installation/);
      assert.deepEqual(answered.nextQuestions, [
        'Behind the toilet, how far is it from the wall to the center of the floor bolts (the rough-in)?',
      ]);
      const state = (await repo.read()).workspace;
      const bom = state.artifacts['project-a:bom'].at(-1)!;
      assert.deepEqual(bom.inputRefs, [answered.draftRef]);
      // The first BOM depended on draft revision 1 and is now stale.
      assert.notEqual(state.artifacts['project-a:bom'][0].freshness, 'current');
      const plan = state.artifacts['project-a:purchase-plan:builder'].at(-1)!;
      assert.deepEqual(plan.inputRefs, [answered.bomRef]);

      // Reusing a requestId with a changed request drafts anew instead of replaying.
      const changed = JSON.parse(
        (
          await call(mcp, 'draft_scope', {
            requestId: 'muse-bath-2',
            projectId: 'project-a',
            recipeId: 'bathroom-refresh',
            packageIds: ['toilet'],
            request: 'Actually just the toilet.',
          })
        ).text,
      );
      assert.equal(changed.replay, false);
      assert.equal(changed.draftRef.revision, 3);
      assert.equal(changed.materialsPricing.length, 0);

      // A hand-written BOM cannot route an item to a product of another category.
      const workspace = (await repo.read()).workspace;
      const wrongCategory = await call(mcp, 'propose_project_change', {
        commands: [
          {
            commandId: 'mcp-wrong-category-bom',
            projectId: 'project-a',
            baseRevision: workspace.projects['project-a'].revision,
            basePropertyRevision: workspace.properties['property-a'].revision,
            type: 'ProposeArtifact',
            payload: {
              artifactId: 'project-a:other-bom',
              supersedesRevision: 0,
              inputRefs: [],
              evidenceIds: [],
              content: {
                ...vanityTemplate,
                items: [{ ...vanityTemplate.items[0], candidateProductIds: ['van-fau-mid'] }],
              },
            },
          },
        ],
      });
      assert.equal(wrongCategory.result.isError, true);
      assert.match(wrongCategory.text, /not a catalog vanity-cabinet product/);

      // Relayed numbers never became recorded facts.
      assert.ok(!Object.values(state.facts).some((v) => v.at(-1)!.key === 'finishedLength'));
    }),
);
