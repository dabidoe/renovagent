import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { MongoClient } from 'mongodb';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { MongoWorkspaceRepository, OWNER } from '../../apps/api/src/repository.js';
import { createWorkspaceMcpServer } from '../../apps/api/src/mcp.js';
import { CatalogStore } from '../../apps/api/src/catalog.js';
import { DesignImageStore } from '../../apps/api/src/design-images.js';
import { DesignPreviewWorker, type PreviewProvider } from '../../apps/api/src/design-previews.js';
import { uploadDesignPhoto } from '../../apps/api/src/design-service.js';
import { emptyWorkspace, type DesignOptions, type ScopeDraft } from '@renovagent/contracts';
import { livingRoomCatalog } from '../../fixtures/catalog/living-room-philadelphia.js';
import { Scenario } from '../foundation-helpers.js';

const uri = process.env.TEST_WORKSPACE_MONGO_URI;

// A tiny valid PNG of one solid color: test input only, never a real room.
function png(rgb: [number, number, number], size = 16) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'ascii');
    data.copy(out, 8);
    out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(size).fill(rgb).flat())]);
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(Buffer.concat(Array(size).fill(row)))),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}

async function withSetup(
  fn: (ctx: {
    mcp: Client;
    repo: MongoWorkspaceRepository;
    images: DesignImageStore;
    photoSha: string;
  }) => Promise<void>,
) {
  const client = new MongoClient(uri!);
  await client.connect();
  const db = client.db(`renovagent_design_test_${randomUUID().replaceAll('-', '')}`);
  try {
    const repo = MongoWorkspaceRepository.forDb(db);
    await repo.collection.insertOne({
      _id: OWNER,
      version: 0,
      workspace: emptyWorkspace(OWNER),
      blobs: [],
      jobs: [],
    });
    const s = new Scenario();
    s.create();
    await repo.importWorkspace(
      JSON.parse(JSON.stringify(s.state).replaceAll('owner-test', OWNER)),
      [],
    );
    const catalog = new CatalogStore(db);
    await catalog.ensureIndexes();
    await catalog.importBatch(livingRoomCatalog);
    const images = new DesignImageStore(db);
    const uploaded = await uploadDesignPhoto(images, OWNER, {
      bytes: png([180, 40, 60]),
      originalName: 'room.png',
      label: 'Test room photo (synthetic)',
      permission: 'Synthetic test image.',
    });
    const server = createWorkspaceMcpServer(repo, catalog, { images });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const mcp = new Client({ name: 'design-test-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), mcp.connect(clientTransport)]);
    try {
      await fn({ mcp, repo, images, photoSha: uploaded.image.sha256 });
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
  const text = (result.content as Array<{ text: string }>)[0].text;
  return { result, text, json: () => JSON.parse(text) };
}

class FakeProvider implements PreviewProvider {
  prompts: string[] = [];
  onGenerate?: () => Promise<void>;
  async generate({ prompt }: { image: Uint8Array; prompt: string }) {
    this.prompts.push(prompt);
    await this.onGenerate?.();
    return {
      bytes: png([40, 90, 200 - this.prompts.length]),
      provider: 'test provider',
      model: 'test-model',
    };
  }
}

const options = async (repo: MongoWorkspaceRepository) =>
  (await repo.read()).workspace.artifacts['project-a:design-options'].at(-1)!
    .payload as DesignOptions;

test(
  'a photo and a vague request become three priced options with generated previews',
  { skip: !uri },
  () =>
    withSetup(async ({ mcp, repo, images, photoSha }) => {
      const built = (
        await call(mcp, 'build_design_options', {
          requestId: 'living-1',
          projectId: 'project-a',
          request: 'I want to renovate my living room',
          sourcePhotoSha256: photoSha,
          reported: [
            { key: 'floorLengthFt', amount: 23.17, unit: 'ft' },
            { key: 'floorWidthFt', amount: 13.08, unit: 'ft' },
            { key: 'ceilingHeightFt', amount: 8, unit: 'ft' },
          ],
        })
      ).json();
      assert.equal(built.options.length, 3);
      assert.ok(
        built.options.every((o: { preview: { status: string } }) => o.preview.status === 'pending'),
      );
      const hardwood = built.options.find((o: { id: string }) => o.id === 'hardwood');
      assert.match(hardwood.materials.range, /^\$[\d,]+–\$[\d,]+$/);
      assert.match(hardwood.materials.basis, /demo example prices/);
      assert.match(hardwood.coverage, /Priced 4 of \d+ requirements/);

      const provider = new FakeProvider();
      const worker = new DesignPreviewWorker(repo, images, provider);
      await worker.tick();
      assert.equal(provider.prompts.length, 3);
      const generated = await options(repo);
      assert.ok(generated.options.every((o) => o.preview.status === 'generated'));
      const preview = generated.options[1].preview;
      assert.equal(preview.provenance?.kind, 'generated-concept');
      assert.equal(preview.provenance?.sourcePhotoSha256, photoSha);
      assert.ok(await images.get(OWNER, preview.image!.sha256));
      const summary = (await call(mcp, 'get_design_options', { projectId: 'project-a' })).json();
      assert.match(summary.options[1].preview.label, /Generated concept/);

      // "Make it blue" re-queues only that option, then selection drafts its scope.
      const blue = (
        await call(mcp, 'revise_design_option', {
          requestId: 'blue-1',
          projectId: 'project-a',
          optionId: 'hardwood',
          direction: { wallColor: 'soft blue' },
          select: true,
        })
      ).json();
      assert.equal(blue.selectedOptionId, 'hardwood');
      assert.deepEqual(
        blue.options.map((o: { preview: { status: string } }) => o.preview.status),
        ['generated', 'pending', 'generated'],
      );
      const draft = (await repo.read()).workspace.artifacts['project-a:scope-draft'].at(-1)!
        .payload as ScopeDraft;
      assert.equal(draft.direction?.wallColor, 'soft blue');
      // The preference reaches Materials: a BOM citing the new draft and tier plans.
      const state = (await repo.read()).workspace;
      const draftRef = {
        kind: 'artifact',
        id: 'project-a:scope-draft',
        revision: state.artifacts['project-a:scope-draft'].at(-1)!.revision,
      };
      const bom = state.artifacts['project-a:bom'].at(-1)!;
      assert.deepEqual(bom.inputRefs, [draftRef]);
      for (const tier of ['builder', 'mid', 'high'])
        assert.deepEqual(state.artifacts[`project-a:purchase-plan:${tier}`].at(-1)!.inputRefs, [
          { kind: 'artifact', id: bom.id, revision: bom.revision },
        ]);
      await worker.tick();
      assert.match(provider.prompts.at(-1)!, /soft blue/);
      assert.equal((await options(repo)).options[1].preview.status, 'generated');
    }),
);

test(
  'a preview finished after the option changed is discarded and regenerated',
  { skip: !uri },
  () =>
    withSetup(async ({ mcp, repo, images, photoSha }) => {
      await call(mcp, 'build_design_options', {
        requestId: 'living-2',
        projectId: 'project-a',
        request: 'Living room ideas',
        sourcePhotoSha256: photoSha,
      });
      const provider = new FakeProvider();
      let revised = false;
      provider.onGenerate = async () => {
        if (revised) return;
        revised = true;
        await call(mcp, 'revise_design_option', {
          requestId: 'mid-flight',
          projectId: 'project-a',
          optionId: 'paint-refresh',
          direction: { wallColor: 'sage green' },
        });
      };
      await new DesignPreviewWorker(repo, images, provider).tick();
      const paint = (await options(repo)).options[0];
      assert.equal(paint.direction.wallColor, 'sage green');
      assert.equal(paint.preview.status, 'generated');
      assert.equal(paint.preview.forDirection.wallColor, 'sage green');
      assert.match(paint.preview.provenance!.prompt, /sage green/);
      // Replays do not rebuild; a photo the owner never uploaded is refused.
      const replay = (
        await call(mcp, 'build_design_options', {
          requestId: 'living-2',
          projectId: 'project-a',
          request: 'Living room ideas',
          sourcePhotoSha256: photoSha,
        })
      ).json();
      assert.equal(replay.replay, true);
      const unknown = await call(mcp, 'build_design_options', {
        requestId: 'living-3',
        projectId: 'project-a',
        request: 'x',
        sourcePhotoSha256: 'f'.repeat(64),
      });
      assert.equal(unknown.result.isError, true);
    }),
);

test('commit failures never loop paid preview generation', { skip: !uri }, () =>
  withSetup(async ({ mcp, repo, images, photoSha }) => {
    await call(mcp, 'build_design_options', {
      requestId: 'living-4',
      projectId: 'project-a',
      request: 'Living room ideas',
      sourcePhotoSha256: photoSha,
    });
    class BrokenStorage extends MongoWorkspaceRepository {
      failing = Infinity;
      override async update<T>(apply: Parameters<MongoWorkspaceRepository['update']>[0]) {
        if (this.failing-- > 0) throw new Error('simulated storage fault');
        return super.update(apply) as Promise<T>;
      }
    }
    const broken = new BrokenStorage(repo.collection, repo.blobStore);
    const provider = new FakeProvider();
    const worker = new DesignPreviewWorker(broken, images, provider);
    await worker.tick();
    await worker.tick();
    // One paid call per option; nothing could be saved and nothing is retried.
    assert.equal(provider.prompts.length, 3);
    assert.ok((await options(repo)).options.every((o) => o.preview.status === 'pending'));

    // If only the result commit fails, the failure itself is recorded.
    const once = new BrokenStorage(repo.collection, repo.blobStore);
    once.failing = 1;
    const second = new FakeProvider();
    await new DesignPreviewWorker(once, images, second).tick();
    const statuses = (await options(repo)).options.map((o) => o.preview.status);
    assert.equal(statuses[0], 'failed');
    assert.equal(second.prompts.length, 3);
  }),
);
