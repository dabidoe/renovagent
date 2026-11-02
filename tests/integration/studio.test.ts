import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { MongoClient } from 'mongodb';
import { imageSize } from 'image-size';
import { emptyWorkspace } from '@renovagent/contracts';
import { MongoWorkspaceRepository, OWNER } from '../../apps/api/src/repository.js';
import { createWorkspaceServer } from '../../apps/api/src/server.js';
import { DesignImageStore, normalizeImage } from '../../apps/api/src/design-images.js';
import { CatalogStore } from '../../apps/api/src/catalog.js';
import {
  saveStudioDesign,
  readStudioDesign,
  prepareStudioHandoff,
} from '../../apps/api/src/studio-designs.js';
import { createWorkspaceMcpServer } from '../../apps/api/src/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { StudioDesign } from '@renovagent/contracts';
import {
  ceilingSchema,
  imagineSchema,
  inspoSchema,
  restyleMapSchema,
  roomIdeasSchema,
  type StudioProviders,
} from '../../apps/api/src/studio.js';

const uri = process.env.TEST_WORKSPACE_MONGO_URI;
const photo = readFileSync(
  new URL('../../public/examples/hutchinson/photo-04.jpg', import.meta.url),
);
const samText = readFileSync(new URL('../fixtures/sam/before-pillow.txt', import.meta.url), 'utf8');

test(
  'a photo-studio design saves exact revisions, remains owner-scoped and is discoverable through MCP',
  { skip: !uri },
  async () => {
    const mongo = new MongoClient(uri!);
    await mongo.connect();
    const db = mongo.db(`renovagent_design_test_${randomUUID().replaceAll('-', '')}`);
    const repo = MongoWorkspaceRepository.forDb(db);
    const images = new DesignImageStore(db);
    await repo.collection.insertOne({
      _id: OWNER,
      version: 0,
      workspace: emptyWorkspace(OWNER),
      blobs: [],
      jobs: [],
    });
    try {
      const photoRecord = await images.put(OWNER, await normalizeImage(new Uint8Array(photo)));
      const src = `/api/workspace/design-images/${photoRecord.sha256}`;
      const snapshot: StudioDesign = {
        kind: 'studio-design',
        basis: 'listing-example',
        tier: 'builder',
        project: {
          id: 'fixture-photo-studio',
          address: 'Fixture living room',
          ceilingFt: 8,
          ceilingNote: 'Fixture estimate, not measured',
          rooms: [
            {
              id: 'living',
              title: 'Living room',
              existingFloor: 'carpet',
              size: { xFt: 14, yFt: 20 },
              sizeNote: 'Fixture estimate, not measured',
              photo: { src, walls: null },
              floors: {},
            },
          ],
        },
        picks: {
          living: {
            color: { name: 'Black', code: '', brand: '', hex: '#000000' },
            floor: 'lvp',
            floorStyle: 'white-oak',
            included: true,
            ideas: ['striped rug', 'coffee table'],
          },
        },
        inspired: { living: src },
        placements: {
          living: [
            {
              id: 'chair-model',
              itemId: 'chair',
              assetId: 'chair',
              xM: 2,
              zM: 2,
              rotationDeg: 25,
              widthM: 0.8,
              depthM: 0.8,
              heightM: 0.9,
              color: '#cabbaa',
            },
          ],
        },
        modelRenders: { living: { image: src, signature: 'fixture-layout-one' } },
        items: {
          living: [
            {
              id: 'chair',
              name: 'Reading chair',
              category: 'furniture',
              action: 'add',
              quantity: 2,
              unitAllowanceMinor: 12550,
              url: 'https://example.com/chair',
            },
            {
              id: 'rug',
              name: 'Striped rug',
              category: 'decor',
              action: 'replace',
              quantity: null,
              unitAllowanceMinor: null,
            },
          ],
        },
        renderSignatures: { living: 'older-white-wall-proposal' },
        styling: {
          living: {
            source: src,
            inspo: {
              sha256: photoRecord.sha256,
              width: photoRecord.width,
              height: photoRecord.height,
              items: [],
            },
            colours: [],
            paint: null,
            borrow: [],
            changes: [{ target: 'rug', becomes: 'striped rug' }],
            mode: 'furnish',
            keep: 'stairs',
            resultSignature: 'prior-request',
            brief: 'A warm living room',
            versions: [
              {
                id: 'design-one',
                image: src,
                title: 'Warm living room',
                createdAt: '2026-11-02T12:00:00.000Z',
                signature: 'prior-request',
                finishSignature: 'prior-finish',
                changes: [{ target: 'rug', becomes: 'striped rug' }],
              },
            ],
            selectedVersionId: 'design-one',
          },
        },
      };
      const request = { requestId: 'fixture-design-save-one', expectedRevision: 0, snapshot };
      const saved = await saveStudioDesign(repo, images, request);
      const retry = await saveStudioDesign(repo, images, request);
      assert.deepEqual(retry, saved, 'a retry returns the same saved revision');
      assert.equal(saved.revision, 1);
      assert.equal(saved.snapshot.tier, 'builder');
      assert.deepEqual(saved.snapshot.picks.living.ideas, ['striped rug', 'coffee table']);
      assert.equal(saved.snapshot.project.rooms[0].sizeNote, 'Fixture estimate, not measured');
      const black = structuredClone(snapshot);
      black.tier = 'mid';
      const revised = await saveStudioDesign(repo, images, {
        requestId: 'fixture-design-save-two',
        projectId: saved.projectId,
        expectedRevision: 1,
        snapshot: black,
      });
      assert.equal(revised.revision, 2);
      const handoffFromStudio = await prepareStudioHandoff(repo, undefined, {
        projectId: saved.projectId,
        revision: 2,
        roomId: 'living',
        requestId: 'fixture-web-handoff',
      });
      assert.equal(handoffFromStudio.sourceRevision, 2);
      assert.ok(handoffFromStudio.markdown.length > 100);
      assert.match(handoffFromStudio.markdown, /Reading chair.*quantity 2.*total \$251\.00/);
      assert.match(handoffFromStudio.markdown, /Striped rug.*quantity unknown.*not priced/);
      assert.deepEqual(revised.snapshot.items, snapshot.items);
      assert.deepEqual(revised.snapshot.placements, snapshot.placements);
      assert.deepEqual(revised.snapshot.modelRenders, snapshot.modelRenders);
      assert.deepEqual(revised.snapshot.styling.living.versions, snapshot.styling.living.versions);
      const studioScope = (await repo.read()).workspace.artifacts[
        `${saved.projectId}:scope-draft`
      ].at(-1)!.payload;
      assert.ok(studioScope.kind === 'scope-draft');
      if (studioScope.kind === 'scope-draft')
        assert.ok(
          studioScope.inputs.every((i) => i.amount === null),
          'photo estimates are not relayed as measured facts',
        );
      assert.equal(
        (await readStudioDesign(repo, saved.projectId, 1)).snapshot.tier,
        'builder',
        'historical revisions never change',
      );
      assert.equal((await readStudioDesign(repo, saved.projectId)).snapshot.tier, 'mid');
      await assert.rejects(
        () =>
          saveStudioDesign(repo, images, {
            requestId: 'fixture-stale-save',
            projectId: saved.projectId,
            expectedRevision: 1,
            snapshot,
          }),
        /revision|changed|conflict/i,
      );
      await assert.rejects(
        () =>
          saveStudioDesign(repo, images, { ...request, snapshot: { ...snapshot, tier: 'high' } }),
        /reuse|different|command/i,
      );
      const other = repo.forUser('fixture-other-owner');
      await repo.collection.insertOne({
        _id: other.ownerId,
        version: 0,
        workspace: emptyWorkspace(other.ownerId),
        blobs: [],
        jobs: [],
      });
      await assert.rejects(() => readStudioDesign(other, saved.projectId), /No studio design/);
      await assert.rejects(() => saveStudioDesign(other, images, request), /image is missing/);
      const server = createWorkspaceMcpServer(repo);
      const mcp = new Client({ name: 'fixture-design-reader', version: '0' });
      const [ct, st] = InMemoryTransport.createLinkedPair();
      await Promise.all([server.connect(st), mcp.connect(ct)]);
      try {
        const read = async (name: string, args: Record<string, unknown>) => {
          const result = await mcp.callTool({ name, arguments: args });
          assert.ok(!result.isError);
          return JSON.parse((result.content as { text: string }[])[0].text);
        };
        const projects = await read('list_projects', {});
        assert.ok(JSON.stringify(projects).includes(saved.projectId));
        const files = await read('list_project_files', { projectId: saved.projectId });
        assert.ok(JSON.stringify(files).includes('studio-design'));
        const artifact = await read('get_artifact', {
          artifactId: saved.artifactRef.id,
          revision: 1,
        });
        assert.ok(JSON.stringify(artifact).includes('striped rug'));
        assert.ok(JSON.stringify(artifact).includes('builder'));
        const scope = await read('draft_scope', {
          requestId: 'fixture-living-room-scope',
          projectId: saved.projectId,
          recipeId: 'living-room-refresh',
          sourceDesignRef: revised.artifactRef,
          packageIds: ['wall-paint', 'carpet-removal', 'lvp-floor'],
          request: 'Refresh the living room paint and floor; furniture remains unpriced.',
          reported: [],
        });
        const scopeArtifact = await read('get_artifact', {
          artifactId: scope.draftRef.id,
          revision: scope.draftRef.revision,
        });
        assert.ok(JSON.stringify(scopeArtifact).includes('living-room-refresh'));
        const review = await read('review_scope', { projectId: saved.projectId });
        assert.ok(review);
        const handoff = await mcp.callTool({
          name: 'export_contractor_handoff',
          arguments: { projectId: saved.projectId },
        });
        assert.ok(!handoff.isError);
        assert.match((handoff.content as { text: string }[])[0].text, /living|floor|paint/i);
        const next = await saveStudioDesign(repo, images, {
          requestId: 'fixture-design-save-three',
          projectId: saved.projectId,
          expectedRevision: 2,
          snapshot,
        });
        assert.equal(next.revision, 3);
        const staleScope = (await repo.read()).workspace.artifacts[scope.draftRef.id].at(-1)!;
        assert.equal(
          staleScope.freshness,
          'stale',
          'a newer studio revision invalidates the scope based on the prior design',
        );
      } finally {
        await mcp.close();
        await server.close();
      }
    } finally {
      await db.dropDatabase();
      await mongo.close();
    }
  },
);

test(
  'the studio stores photos, outlines walls once, lays floors in the source frame and reads plans',
  { skip: !uri },
  async () => {
    const client = new MongoClient(uri!);
    await client.connect();
    const db = client.db(`renovagent_test_${randomUUID().replaceAll('-', '')}`);
    const repo = MongoWorkspaceRepository.forDb(db);
    await repo.collection.insertOne({
      _id: OWNER,
      version: 0,
      workspace: emptyWorkspace(OWNER),
      blobs: [],
      jobs: [],
    });
    const calls = { segment: 0, repaint: 0, read: 0 };
    const prompts: string[] = [];
    const swatches: number[] = [];
    const providers: StudioProviders = {
      async segment() {
        calls.segment++;
        return { text: samText, runId: 'sam-run', model: 'sam-3.1' };
      },
      async repaint({ prompt, references }) {
        calls.repaint++;
        prompts.push(prompt);
        swatches.push(references?.length ?? 0);
        // Muse answers at its own size; the route must fit it back.
        const smaller = await normalizeImage(new Uint8Array(photo), 900);
        return { bytes: smaller.bytes, model: 'muse-image-1.0' };
      },
      async read({ schema, prompt }) {
        calls.read++;
        if (schema === roomIdeasSchema) {
          prompts.push(prompt);
          return {
            result: {
              observations: ['A window is visible; check this reading.'],
              directions: [0, 1, 2].map((i) => ({
                id: `direction-${i}`,
                title: `Room idea ${i + 1}`,
                description: 'Warm textures and simple forms.',
                why: 'Works with the window light visible in the photo.',
                brief: 'Add a cream sofa and coffee table; preserve the windows.',
                palette: ['#ede6d8', '#80634b', '#536854'],
                assets: ['sofa', 'coffee-table', 'rug'],
              })),
            },
            model: 'fixture',
            runId: 'fixture-ideas',
          };
        }
        if (schema === imagineSchema) {
          prompts.push(prompt);
          return {
            result: {
              walls: true,
              colorName: 'Evergreen Mist',
              hex: '#2B4A36',
              sheen: 'satin',
              floor: 'honey-oak',
              material: 'vinyl',
              extras: ['built-in bookshelf', ' ', 'brass sconces'],
            },
            runId: 'spark-imagine',
            model: 'muse-spark-1.3',
          };
        }
        if (schema === inspoSchema)
          return {
            result: {
              items: [
                { phrase: 'wall', name: 'warm greige walls', kind: 'walls' },
                { phrase: 'pillow', name: 'rust velvet pillow', kind: 'textile' },
              ],
            },
            runId: 'spark-inspo',
            model: 'muse-spark-1.3',
          };
        if (schema === restyleMapSchema) {
          prompts.push(prompt);
          return {
            result: {
              changes: prompt.includes('Furniture and lighting may be replaced')
                ? [{ target: 'coffee table', becomes: 'walnut coffee table' }]
                : [{ target: 'blue pillow', becomes: 'rust velvet pillow' }],
            },
            runId: 'spark-map',
            model: 'muse-spark-1.3',
          };
        }
        if (schema === ceilingSchema)
          return {
            result: { estimateFt: 8.6, basis: 'door' },
            runId: 'spark-ceiling',
            model: 'muse-spark-1.3',
          };
        return {
          result: {
            photos: [
              {
                index: 0,
                kind: 'living room',
                title: 'Living room',
                floor: 'carpet',
                approxWidthFt: 12.8,
                approxLengthFt: 22.1,
              },
              {
                index: 0,
                kind: 'living room',
                title: 'Living room again',
                floor: 'carpet',
                approxWidthFt: 0,
                approxLengthFt: 0,
              },
              {
                index: 7,
                kind: 'bedroom',
                title: 'Ghost',
                floor: 'carpet',
                approxWidthFt: 10,
                approxLengthFt: 12,
              },
            ],
            plans: [
              { name: 'LIVING ROOM', widthFt: 13.083, lengthFt: 23.167 },
              { name: 'NOISE', widthFt: 0, lengthFt: 400 },
            ],
          },
          runId: 'spark-run',
          model: 'muse-spark-1.3',
        };
      },
    };
    // A few colours standing in for a loaded brand palette.
    const catalog = new CatalogStore(db);
    await catalog.importPaint(
      [
        ['Alabaster', 'SW 7008', '#EDEAE0', 'white'],
        ['Rainforest', 'SW 9999', '#2F4B3C', 'green'],
        ['Naval', 'SW 6244', '#2F3D4C', 'blue'],
      ].map(([name, code, hex, family]) => ({
        id: `test:${code}`,
        brand: 'Test Paints',
        collection: 'Test',
        code: code!,
        name: name!,
        hex: hex!,
        family: family as 'green',
        lightness: 0.5,
      })),
    );
    const { server } = await createWorkspaceServer(
      repo,
      'synthetic-studio-token',
      true,
      undefined,
      catalog,
      undefined,
      { images: new DesignImageStore(db) },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      providers,
    );
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw Error('No address');
    const base = `http://127.0.0.1:${address.port}/api/workspace`;
    const headers = { Host: '127.0.0.1:4000', 'X-Renovagent-Client': 'workspace' };
    try {
      const session = await fetch(base + '/session', { headers });
      const auth = { ...headers, Cookie: session.headers.get('set-cookie')!.split(';')[0]! };
      const post = (path: string, body: unknown) =>
        fetch(base + path, {
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

      const uploaded = await (
        await post('/studio/photo', { data: photo.toString('base64'), name: 'living.jpg' })
      ).json();
      assert.match(uploaded.sha256, /^[a-f0-9]{64}$/);
      // A 16 MB phone image fits the advertised 20 MB file limit but its
      // base64 JSON previously exceeded the server's 20 MB request limit.
      const largePhoto = Buffer.alloc(16 * 1024 * 1024);
      photo.copy(largePhoto);
      const binaryUpload = await fetch(base + '/studio/photo', {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'image/jpeg', 'X-File-Name': 'large-room.jpg' },
        body: largePhoto,
      });
      assert.equal(binaryUpload.status, 200, await binaryUpload.clone().text());
      assert.match((await binaryUpload.json()).sha256, /^[a-f0-9]{64}$/);
      const served = await fetch(`${base}/design-images/${uploaded.sha256}`, { headers: auth });
      assert.equal(served.headers.get('content-type'), 'image/jpeg');

      const walls = await (await post('/studio/walls', { sha256: uploaded.sha256 })).json();
      assert.ok(walls.segments.length > 0);
      await post('/studio/walls', { sha256: uploaded.sha256 });
      assert.equal(calls.segment, 1, 'masks are cached by image');

      const floor = await (
        await post('/studio/floor', { sha256: uploaded.sha256, style: 'honey-oak' })
      ).json();
      assert.deepEqual([floor.width, floor.height], [uploaded.width, uploaded.height]);
      const laid = new Uint8Array(
        await (
          await fetch(`${base}/design-images/${floor.sha256}`, { headers: auth })
        ).arrayBuffer(),
      );
      assert.equal(imageSize(laid).width, uploaded.width);
      assert.match(prompts[0]!, /flooring shown in the second image, warm honey-toned oak/);
      assert.deepEqual(swatches, [1], 'the style swatch goes with the photo');
      assert.equal(
        (await post('/studio/floor', { sha256: uploaded.sha256, style: 'carpet' })).status,
        400,
        'only the fixed floors are offered',
      );
      assert.equal(
        (await post('/studio/walls', { sha256: 'f'.repeat(64) })).status,
        404,
        'only this workspace’s photos',
      );

      const read = await (
        await post('/studio/read', { photos: [uploaded.sha256], plans: [floor.sha256] })
      ).json();
      assert.deepEqual(
        read.photos.map((p: { title: string; sha256: string }) => [p.title, p.sha256]),
        [['Living room', uploaded.sha256]],
        'each photo once, and only photos that were sent',
      );
      assert.deepEqual(read.photos[0].approxSize, { xFt: 13, yFt: 22 });
      assert.deepEqual(read.plans, [{ name: 'LIVING ROOM', widthFt: 13.083, lengthFt: 23.167 }]);
      assert.deepEqual(
        [read.ceiling.ft, read.ceiling.note],
        [8.5, 'Ceiling estimated from the door height in the photos'],
      );
      assert.equal(calls.read, 2, 'rooms and ceiling are read side by side');

      const idea = await (
        await post('/studio/imagine', {
          text: 'dark green walls, light oak floors and a built-in bookshelf',
          room: 'Living room',
        })
      ).json();
      assert.deepEqual(idea.color, {
        name: 'Rainforest',
        code: 'SW 9999',
        hex: '#2f4b3c',
        brand: 'Test Paints',
      });
      assert.equal(idea.hex, null, 'snapped to a loaded colour, not a made-up name');
      assert.deepEqual([idea.floorStyle, idea.material], ['honey-oak', 'lvp']);
      assert.equal(idea.sheen, 'satin');
      assert.deepEqual(idea.extras, ['built-in bookshelf', 'brass sconces']);
      assert.match(prompts.at(-1)!, /"dark green walls, light oak floors/);
      assert.match(
        prompts.at(-1)!,
        /well-known Test Paints colour/,
        'names come from the loaded brand',
      );
      assert.equal(
        (await post('/studio/imagine', { text: 'x'.repeat(301) })).status,
        400,
        'the owner’s words are bounded',
      );

      // An inspiration photo: named by Muse, each item outlined by SAM, once.
      const example = await (
        await post('/studio/photo', {
          data: photo.toString('base64'),
          name: 'photo-04.jpg',
          origin: 'listing-example',
        })
      ).json();
      assert.equal(example.sha256, uploaded.sha256, 'the same bytes are the same image');
      const before = { ...calls };
      const inspo = await (await post('/studio/inspo', { sha256: uploaded.sha256 })).json();
      assert.deepEqual(
        inspo.items.map((i: { phrase: string; name: string }) => [i.phrase, i.name]),
        [
          ['wall', 'warm greige walls'],
          ['pillow', 'rust velvet pillow'],
        ],
      );
      assert.ok(inspo.items.every((i: { segments: unknown[] }) => i.segments.length > 0));
      assert.deepEqual([inspo.width, inspo.height], [uploaded.width, uploaded.height]);
      assert.deepEqual(
        [calls.read - before.read, calls.segment - before.segment],
        [1, 2],
        'one read, one outline per item',
      );
      await post('/studio/inspo', { sha256: uploaded.sha256 });
      assert.equal(calls.read - before.read, 1, 'an analysed photo is cached');

      const restyled = await (
        await post('/studio/restyle', {
          sha256: uploaded.sha256,
          inspo: uploaded.sha256,
          items: ['rust velvet pillow'],
          paint: { name: 'Alabaster', code: 'SW 7008', hex: '#EDEAE0' },
        })
      ).json();
      assert.deepEqual([restyled.width, restyled.height], [uploaded.width, uploaded.height]);
      assert.equal(swatches.at(-1), 1, 'the inspiration photo goes with the room');
      assert.match(
        prompts.at(-1)!,
        /exactly as framed[\s\S]*the blue pillow becomes rust velvet pillow[\s\S]*"Alabaster SW 7008" \(#edeae0\)/,
      );
      assert.deepEqual(restyled.changes, [
        { target: 'blue pillow', becomes: 'rust velvet pillow' },
      ]);
      assert.equal(restyled.mode, 'refresh', 'existing clients keep the furniture by default');
      const furnished = await (
        await post('/studio/restyle', {
          sha256: uploaded.sha256,
          inspo: uploaded.sha256,
          items: ['walnut coffee table'],
          mode: 'furnish',
          keep: 'the sofa and piano',
          preserveFloor: true,
        })
      ).json();
      assert.equal(furnished.mode, 'furnish');
      assert.equal(furnished.keep, 'the sofa and piano');
      assert.deepEqual(furnished.changes, [
        { target: 'coffee table', becomes: 'walnut coffee table' },
      ]);
      assert.match(prompts.at(-2)!, /the sofa and piano[\s\S]*This takes priority/);
      assert.match(
        prompts.at(-1)!,
        /Furniture and lighting may be replaced[\s\S]*the sofa and piano/,
      );
      assert.match(prompts.at(-1)!, /flooring unchanged; only selected rugs may overlay it/);
      const direct = await (
        await post('/studio/restyle', {
          sha256: uploaded.sha256,
          mode: 'furnish',
          brief: 'Add a walnut coffee table. Preserve the stairs.',
          keep: 'stairs',
          preserveFloor: true,
        })
      ).json();
      assert.equal(direct.mode, 'furnish');
      assert.equal(
        swatches.at(-1),
        0,
        'a text brief can design the room without a reference photo',
      );
      assert.match(prompts.at(-2)!, /There is no reference photo/);
      assert.match(prompts.at(-2)!, /Add a walnut coffee table/);
      const beforeEmpty = { ...calls };
      assert.equal(
        (await post('/studio/restyle', { sha256: uploaded.sha256, mode: 'furnish' })).status,
        400,
      );
      assert.deepEqual(calls, beforeEmpty, 'empty design requests do not call providers');
      const callsBeforeInvalid = { ...calls };
      assert.equal(
        (
          await post('/studio/restyle', {
            sha256: uploaded.sha256,
            inspo: uploaded.sha256,
            items: ['table'],
            mode: 'anything',
            keep: '',
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await post('/studio/restyle', {
            sha256: uploaded.sha256,
            inspo: uploaded.sha256,
            items: ['table'],
            mode: 'furnish',
            keep: 'x'.repeat(301),
          })
        ).status,
        400,
      );
      assert.deepEqual(calls, callsBeforeInvalid, 'invalid requests never reach paid providers');
      assert.equal(
        (
          await post('/studio/restyle', {
            sha256: uploaded.sha256,
            inspo: 'f'.repeat(64),
            items: ['rug'],
          })
        ).status,
        404,
        'only this workspace’s inspiration',
      );

      const ideas = await (
        await post('/studio/ideas', {
          sha256: uploaded.sha256,
          brief: 'Warm and simple',
          keep: 'the piano',
        })
      ).json();
      assert.equal(ideas.directions.length, 3);
      assert.match(prompts.at(-1)!, /the piano/);
      assert.match(prompts.at(-1)!, /never measurements/);
      const beforeForeign = { ...calls };
      assert.equal((await post('/studio/ideas', { sha256: 'f'.repeat(64) })).status, 404);
      assert.deepEqual(calls, beforeForeign, 'foreign images do not reach the provider');
      const near = await (
        await fetch(`${base}/paint/nearest?hex=%23e9e6dc`, { headers: auth })
      ).json();
      assert.equal(near.close, true);
      assert.equal(near.matches[0].name, 'Alabaster');
      assert.equal(near.matches.length, 3, 'three options, nearest first');
      const far = await (
        await fetch(`${base}/paint/nearest?hex=%23e8590c`, { headers: auth })
      ).json();
      assert.equal(far.close, false, 'nothing loaded is close to orange');
      const modelInput = {
        image: photo.toString('base64'),
        wall: '#ede6d8',
        floor: 'existing wood',
        placements: [
          {
            id: 'sofa-one',
            itemId: 'sofa-item',
            assetId: 'sofa',
            xM: 2,
            zM: 1,
            rotationDeg: 90,
            widthM: 2.1,
            depthM: 0.9,
            heightM: 0.85,
            color: '#ede6d8',
          },
        ],
      };
      const rendered = await (await post('/studio/model-render', modelInput)).json();
      assert.match(rendered.sha256, /^[a-f0-9]{64}$/);
      assert.match(prompts.at(-1)!, /Lounge sofa/);
      assert.match(prompts.at(-1)!, /every furniture object's location/);
      assert.equal(
        (await fetch(`${base}/design-images/${rendered.sha256}`, { headers: auth })).status,
        200,
      );
      const beforeInvalidRender = { ...calls };
      assert.equal(
        (
          await post('/studio/model-render', {
            ...modelInput,
            placements: [{ ...modelInput.placements[0], widthM: -1 }],
          })
        ).status,
        400,
      );
      assert.equal(
        (await post('/studio/model-render', { ...modelInput, image: 'not an image' })).status,
        400,
      );
      assert.deepEqual(
        calls,
        beforeInvalidRender,
        'invalid render inputs do not spend model calls',
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.dropDatabase();
      await client.close();
    }
  },
);
