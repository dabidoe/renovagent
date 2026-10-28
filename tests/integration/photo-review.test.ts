import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import {
  type PhotoReview,
  type PropertyResearch,
  validatePropertyResearch,
  validatePhotoReview,
} from '@unpermitted/contracts';
import {
  applyPhotoReview,
  validateInspectionBatch,
  photoInspectionPrompt,
  photoReviewJob,
  researchJobId,
  researchForArtifact,
  propertyMarkdown,
} from '@unpermitted/core';
import { photoOutputSchemaForIds, publicPhotoHost } from '../../scripts/muse-photo-review.js';
import { Scenario, openTestRepo, context } from '../foundation-helpers.js';
function receipt(count = 35): PhotoReview {
  const types = [
    'kitchen',
    'bathroom',
    'basement',
    'exterior',
    'living',
    'dining',
    'bedroom',
    'circulation',
    'utility',
    'other',
    'uncertain',
  ] as const;
  return {
    method: 'muse-attached-images',
    reviewedAt: context.now,
    manifestHash: 'a'.repeat(64),
    batches: Array.from({ length: Math.ceil(count / 7) }, (_, i) => ({
      runId: `synthetic-run-${i}`,
      model: 'synthetic-test-model',
      photoIds: Array.from({ length: Math.min(7, count - i * 7) }, (_, j) => `photo-${i * 7 + j}`),
    })),
    photos: Array.from({ length: count }, (_, i) => ({
      id: `photo-${i}`,
      sourceId: 'listing',
      pageUrl: 'https://example.com/listing',
      imageUrl: `https://example.com/image-${i}.jpg`,
      locator: `Photo ${i + 1}`,
      sha256: i.toString(16).padStart(64, '0'),
      status: 'reviewed',
      roomType: types[i % types.length],
      confidence: 'medium',
      observations: [`Synthetic visible feature ${i}`],
      uncertainties: ['Current condition and measurements unknown'],
      questions: [`Synthetic site question ${i}?`],
      nextSteps: [`Synthetic measurement check ${i}`],
    })),
  };
}
function base(jobId = 'synthetic-job'): PropertyResearch {
  return {
    kind: 'property-research',
    address: 'SYNTHETIC TEST HOME',
    jobId,
    method: 'user-import',
    verification: 'unreviewed',
    sources: [
      {
        id: 'listing',
        title: 'Synthetic listing',
        url: 'https://example.com/listing',
        retrievedAt: context.now,
      },
    ],
    findings: [
      {
        label: 'Blocked synthetic claim',
        value: 'Unsupported',
        sourceId: 'listing',
        limit: 'No evidence',
        blockedReason: 'Synthetic source gap',
      },
    ],
    images: [
      {
        id: 'manual-kitchen',
        title: 'DO NOT PASS THIS HUMAN ROOM LABEL',
        sourceId: 'listing',
        pageUrl: 'https://example.com/listing',
        imageUrl: 'https://example.com/image.jpg',
        previewUrl: null,
        previewPermission: 'unknown',
        capturedAt: '',
        observations: 'DO NOT PASS THESE HUMAN VISUAL NOTES',
      },
    ],
    nextQuestions: [],
  };
}
test('blind photo jobs use neutral IDs; model prompts receive scope and attachment order without earlier room labels', () => {
  const job = photoReviewJob(base(), 'Kitchen refresh and powder-room feasibility');
  assert.equal(job.photos[0].id, 'photo-01');
  assert.deepEqual(
    Object.keys(job.photos[0]).sort(),
    ['id', 'sourceId', 'pageUrl', 'imageUrl', 'locator'].sort(),
  );
  const prompt = photoInspectionPrompt(
    job.goal,
    job.photos.map((p) => p.id),
  );
  assert.ok(!prompt.includes('DO NOT PASS'));
  assert.ok(!prompt.includes('manual-kitchen'));
  assert.ok(prompt.includes('image pixels'));
  assert.ok(prompt.includes('EVERY attachment ID'));
});
test('photo batches and receipts reject omissions, duplicate IDs, contradictory unreadable claims and missing attachment provenance', () => {
  const r = receipt(7),
    photos = r.photos.map(
      ({ sourceId: _s, pageUrl: _p, imageUrl: _u, locator: _l, sha256: _h, ...photo }) => photo,
    ),
    ids = photos.map((p) => p.id);
  assert.equal(validateInspectionBatch({ photos }, ids).length, 7);
  assert.throws(() => validateInspectionBatch({ photos: photos.slice(0, 1) }, ids));
  assert.throws(() => validateInspectionBatch({ photos: [photos[0], ...photos.slice(0, 6)] }, ids));
  assert.throws(() =>
    validateInspectionBatch(
      { photos: [{ ...photos[0], status: 'unreadable' }, ...photos.slice(1)] },
      ids,
    ),
  );
  assert.throws(() => validatePhotoReview({ ...r, batches: [] }));
  assert.throws(() =>
    validatePhotoReview({ ...r, batches: [{ ...r.batches[0], photoIds: ['missing'] }] }),
  );
  const unreadable = {
    ...photos[0],
    status: 'unreadable',
    roomType: 'uncertain',
    observations: [],
  };
  assert.equal(validateInspectionBatch({ photos: [unreadable] }, [ids[0]])[0].status, 'unreadable');
});
test('all visual results persist while planning selects bounded references, preserves blocks and leaves embedding permission unknown', () => {
  const r = receipt(),
    p = applyPhotoReview(base(), r, 'Kitchen refresh and powder room');
  assert.equal(p.photoReview?.photos.length, 35);
  assert.ok(p.images.length <= 12);
  assert.equal(p.images[0].id, 'photo-0');
  assert.ok(p.images.every((i) => i.previewUrl === null && i.previewPermission === 'unknown'));
  assert.equal(p.findings[0].blockedReason, 'Synthetic source gap');
  assert.ok(p.nextQuestions.every((q) => q.startsWith('Synthetic site question')));
  assert.ok(!JSON.stringify(p.images).includes('HUMAN ROOM LABEL'));
  assert.ok(propertyMarkdown(p, 'Test').includes('35/35 photos reviewed'));
  assert.throws(() =>
    validatePropertyResearch({
      ...p,
      images: [{ ...p.images[0], imageUrl: 'https://example.com/foreign.jpg' }],
    }),
  );
  assert.throws(() =>
    validatePropertyResearch({
      ...p,
      photoReview: {
        ...r,
        photos: r.photos.map((v, i) => (i ? v : { ...v, sourceId: 'missing' })),
      },
    }),
  );
});
test('visual planning uses validated commands and exact historical receipts; goal/address changes invalidate current work without overwriting facts', async () => {
  const s = new Scenario();
  s.create();
  s.evidence('source', 'property');
  s.apply(
    s.command('RecordFact', {
      factId: 'address',
      scope: 'property',
      subjectId: 'property-a',
      key: 'propertyAddress',
      supersedesRevision: 0,
      value: { kind: 'text', text: 'SYNTHETIC TEST HOME' },
      assertion: 'user_reported',
      evidenceIds: ['source'],
    }),
  );
  s.apply(
    s.command('RecordFact', {
      factId: 'goal',
      scope: 'project',
      subjectId: 'project-a',
      key: 'goal',
      supersedesRevision: 0,
      value: { kind: 'text', text: 'Kitchen refresh' },
      assertion: 'user_reported',
      evidenceIds: ['source'],
    }),
  );
  const p = applyPhotoReview(
      base(researchJobId('project-a', 'address', 1)),
      receipt(),
      'Kitchen refresh',
    ),
    facts = structuredClone(s.state.facts);
  const propose = (withGoal: boolean) =>
    s.command('ProposeArtifact', {
      artifactId: 'project-a:property-research',
      supersedesRevision: 0,
      inputRefs: [
        { kind: 'fact', id: 'address', revision: 1 },
        ...(withGoal ? [{ kind: 'fact', id: 'goal', revision: 1 }] : []),
      ],
      evidenceIds: ['source'],
      content: p,
    });
  assert.throws(() => s.apply(propose(false)), /goal revision/);
  s.apply(propose(true));
  assert.deepEqual(s.state.facts, facts);
  const brief = s.state.artifacts['project-a:working-brief'].at(-1)!;
  assert.equal(researchForArtifact(s.state, brief)?.photoReview?.photos.length, 35);
  s.accept('project-a:working-brief');
  s.apply(
    s.command('RecordFact', {
      factId: 'goal',
      scope: 'project',
      subjectId: 'project-a',
      key: 'goal',
      supersedesRevision: 1,
      value: { kind: 'text', text: 'Exterior scope instead' },
      assertion: 'user_reported',
      evidenceIds: ['source'],
    }),
  );
  assert.equal(s.state.artifacts['project-a:property-research'].at(-1)!.freshness, 'stale');
  assert.equal(
    s.state.artifacts['project-a:working-brief'].find((v) => v.revision === brief.revision)!
      .lifecycle,
    'accepted',
  );
  assert.equal(
    researchForArtifact(s.state, brief)?.photoReview?.manifestHash,
    p.photoReview?.manifestHash,
  );
  const factory = new IDBFactory(),
    name = crypto.randomUUID(),
    repo = await openTestRepo(factory, name);
  await repo.executeBatch(s.commands, context);
  repo.close();
  const reopened = await openTestRepo(factory, name);
  assert.deepEqual((await reopened.read()).artifacts, s.state.artifacts);
  reopened.close();
});
test('provider schema constrains every photo ID and exact batch length; public download guards support the real CDN without accepting local addresses', () => {
  const schema = photoOutputSchemaForIds(['a', 'b']);
  assert.equal(schema.properties.photos.minItems, 2);
  assert.equal(schema.properties.photos.maxItems, 2);
  assert.deepEqual(schema.properties.photos.items.properties.id.enum, ['a', 'b']);
  assert.deepEqual(
    [...schema.properties.photos.items.required].sort(),
    Object.keys(schema.properties.photos.items.properties).sort(),
  );
  assert.throws(() => photoOutputSchemaForIds(['a', 'a']));
  assert.equal(publicPhotoHost('2600:9000:2026::1'), true);
  for (const host of [
    'localhost',
    '127.0.0.1',
    '10.2.3.4',
    '169.254.169.254',
    '192.168.1.1',
    '172.16.0.1',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ])
    assert.equal(publicPhotoHost(host), false, host);
});
test('Muse planning synthesis is linked to reviewed photos and drives complete goal questions without changing room classifications', () => {
  const r = receipt(7),
    initialTypes = r.photos.map((p) => p.roomType);
  const planning = {
    runId: 'synthetic-planning',
    model: 'synthetic-test-model',
    goal: 'Kitchen refresh',
    questions: [{ photoIds: ['photo-0'], text: 'Which existing kitchen elements should remain?' }],
    nextSteps: [
      {
        photoIds: ['photo-0'],
        kind: 'site-measurement' as const,
        text: 'Measure the room and openings on site.',
      },
    ],
  };
  const p = applyPhotoReview(base(), { ...r, planning }, planning.goal);
  assert.deepEqual(
    p.photoReview!.photos.map((photo) => photo.roomType),
    initialTypes,
  );
  assert.deepEqual(p.nextQuestions, ['Which existing kitchen elements should remain?']);
  assert.equal(p.images[0].planningUse, 'Measure the room and openings on site.');
  assert.ok(propertyMarkdown(p, 'Test').includes('Muse planning synthesis'));
  assert.throws(() =>
    validatePhotoReview({
      ...r,
      planning: { ...planning, questions: [{ photoIds: ['foreign'], text: 'Unknown source?' }] },
    }),
  );
});
