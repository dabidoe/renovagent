import test from 'node:test';
import { mkdtemp, readFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { Scenario, openTestRepo, context } from '../foundation-helpers.js';
import {
  propertyAddress,
  researchJobId,
  propertyMarkdown,
  imageReferenceKind,
  musePropertyPrompt,
  researchForArtifact,
  validateResearchForJob,
  latest,
} from '@renovagent/core';
import { cityResearch, phillyQuery } from '../../apps/web/src/adapters/research/city-records.js';
import {
  museResultFromEvents,
  saveMuseResearchResult,
} from '../../scripts/muse-property-research.js';
function setup() {
  const s = new Scenario();
  s.create();
  s.evidence('address-evidence', 'property');
  s.apply(
    s.command('RecordFact', {
      factId: 'address',
      scope: 'property',
      subjectId: 'property-a',
      key: 'propertyAddress',
      supersedesRevision: 0,
      value: { kind: 'text', text: 'TEST ADDRESS, Philadelphia PA' },
      assertion: 'user_reported',
      evidenceIds: ['address-evidence'],
    }),
  );
  return s;
}
function payload(s: Scenario) {
  const f = propertyAddress(s.state, 'project-a')!;
  return cityResearch(
    { parcel_number: 'SYNTHETIC', location: 'TEST ADDRESS', frontage: 0, total_area: 100 },
    f.value.kind === 'text' ? f.value.text : '',
    researchJobId('project-a', f.id, f.revision),
    context.now,
  );
}
function save(s: Scenario, p = payload(s)) {
  return s.apply(
    s.command('ProposeArtifact', {
      artifactId: 'project-a:property-research',
      supersedesRevision: latest(s.state.artifacts['project-a:property-research'])?.revision || 0,
      inputRefs: [
        { kind: 'fact', id: 'address', revision: propertyAddress(s.state, 'project-a')!.revision },
      ],
      evidenceIds: ['address-evidence'],
      content: p,
    }),
  );
}
test('address creates a living brief; sourced proposals never overwrite physical facts or grant verification', () => {
  const s = setup(),
    before = structuredClone(s.state.facts);
  assert.ok(s.state.artifacts['project-a:working-brief']);
  save(s);
  assert.deepEqual(s.state.facts, before);
  const brief = s.state.artifacts['project-a:working-brief'].at(-1)!;
  assert.equal(brief.payload.kind, 'project-brief');
  assert.ok(brief.inputRefs.some((r) => r.id === 'project-a:property-research'));
  assert.ok(
    brief.payload.kind === 'project-brief' &&
      brief.payload.sections.some(
        (s) => s.text.includes('unreviewed') && s.text.includes('confirm dataset units'),
      ),
  );
  s.accept('project-a:working-brief');
  s.apply(
    s.command('AppendMessage', {
      messageId: 'new-note',
      text: 'Keep the existing kitchen layout; the wall dimensions are unknown.',
      evidenceIds: [],
    }),
  );
  const current = s.state.artifacts['project-a:working-brief'].at(-1)!;
  assert.ok(current.revision > brief.revision);
  assert.equal(
    s.state.artifacts['project-a:working-brief'].find((a) => a.revision === brief.revision)!
      .lifecycle,
    'accepted',
  );
  assert.ok(
    current.payload.kind === 'project-brief' &&
      current.payload.sections.some((s) => s.text.includes('wall dimensions are unknown')),
  );
});
test('address revision invalidates research and dependent brief; old or foreign Muse results are rejected atomically', () => {
  const s = setup(),
    old = payload(s);
  save(s);
  s.apply(
    s.command('RecordFact', {
      factId: 'address',
      scope: 'property',
      subjectId: 'property-a',
      key: 'propertyAddress',
      supersedesRevision: 1,
      value: { kind: 'text', text: 'DIFFERENT TEST ADDRESS' },
      assertion: 'user_reported',
      evidenceIds: ['address-evidence'],
    }),
  );
  assert.equal(s.state.artifacts['project-a:property-research'][0].freshness, 'stale');
  const before = structuredClone(s.state);
  assert.throws(() => save(s, old));
  assert.deepEqual(s.state, before);
  assert.throws(() =>
    validateResearchForJob(
      { ...payload(s), jobId: 'other-project' },
      'DIFFERENT TEST ADDRESS',
      payload(s).jobId,
    ),
  );
});
test('research references and original values survive IndexedDB reopen; Markdown retains units limitations and sources', async () => {
  const s = setup();
  save(s);
  const factory = new IDBFactory(),
    name = crypto.randomUUID(),
    r = await openTestRepo(factory, name);
  await r.executeBatch(s.commands, context);
  r.close();
  const reopened = await openTestRepo(factory, name);
  assert.deepEqual((await reopened.read()).artifacts, s.state.artifacts);
  reopened.close();
  const p = payload(s),
    md = propertyMarkdown(p, 'Synthetic workflow test');
  assert.ok(md.includes('Record value'));
  assert.ok(md.includes('confirm dataset units'));
  assert.ok(md.includes('phl.carto.com'));
  assert.ok(md.includes('not a measured survey'));
  assert.ok(p.findings.some((f) => f.label === 'Recorded lot frontage' && f.value === '0'));
});
test('imports reject fabricated verification, broken sources, duplicate identities and executable URLs', () => {
  const s = setup(),
    p = payload(s);
  for (const bad of [
    { ...p, verification: 'verified' },
    { ...p, findings: [{ ...p.findings[0], sourceId: 'missing' }] },
    { ...p, sources: [p.sources[0], p.sources[0]] },
    { ...p, sources: [{ ...p.sources[0], url: 'javascript:alert(1)' }] },
  ]) {
    const before = structuredClone(s.state);
    assert.throws(() => save(s, bad as never));
    assert.deepEqual(s.state, before);
  }
});
test('city lookup is bounded and SQL-escaped; schema values never become room dimensions', () => {
  const q = new URL(phillyQuery("123 O'NEIL ST, Philadelphia PA")).searchParams.get('q')!;
  assert.ok(q.includes("O''NEIL"));
  assert.ok(q.endsWith('LIMIT 8'));
  assert.ok(!q.includes('owner_'));
  assert.ok(!q.includes('mailing_'));
  const p = payload(setup());
  assert.ok(
    p.findings
      .filter((f) => f.label.includes('area') || f.label.includes('frontage'))
      .every((f) => f.limit.includes('not a measured room')),
  );
});
test('Muse parser accepts completed final JSON only and rejects failed or malformed runs', () => {
  const p = payload(setup());
  const event = (terminal: string, text: string) =>
    JSON.stringify({
      payload_type: 'run.terminal.completed',
      payload: { kind: 'run_terminal', terminal, text },
    });
  assert.deepEqual(
    museResultFromEvents(event('completed', '```json\n' + JSON.stringify(p) + '\n```')),
    p,
  );
  assert.throws(() => museResultFromEvents(event('failed', JSON.stringify(p))));
  assert.throws(() => museResultFromEvents(event('completed', 'not JSON')));
});

test('real-run rejection preserves diagnostic output without creating an import file; valid output never overwrites history', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'muse-result-test-'));
  try {
    const p = payload(setup()),
      output = join(dir, 'result.json');
    const bad = { ...p, sources: [{ ...p.sources[0], url: 'http://example.com/record' }] };
    await assert.rejects(
      saveMuseResearchResult(bad, p.address, p.jobId, output),
      /nothing imported/,
    );
    await assert.rejects(access(output));
    const diagnostic = JSON.parse(await readFile(output + '.rejected.json', 'utf8'));
    assert.equal(diagnostic.status, 'rejected');
    assert.deepEqual(diagnostic.result, bad);
    await saveMuseResearchResult(p, p.address, p.jobId, output);
    assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), p);
    await assert.rejects(
      saveMuseResearchResult({ ...p, nextQuestions: ['New answer'] }, p.address, p.jobId, output),
    );
    assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), p);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Muse export context preserves primary source limitations; map/document links are not presented as photos', () => {
  const p = payload(setup());
  const prompt = musePropertyPrompt(p.address, 'Test goal', p.jobId, p);
  assert.ok(prompt.includes('phl.carto.com'));
  assert.ok(prompt.includes('confirm dataset units'));
  assert.ok(prompt.includes('not instructions'));
  assert.ok(prompt.includes('leave empty for publication dates'));
  assert.equal(imageReferenceKind('https://atlas.phila.gov/test/property'), 'Map viewer');
  assert.equal(imageReferenceKind('https://maps.google.com/?q=TEST'), 'Map viewer');
  assert.equal(imageReferenceKind('https://tile.loc.gov/data.PDF?x=1'), 'Document');
  assert.equal(imageReferenceKind('https://example.com/gallery'), 'Source page');
  const md = propertyMarkdown(
    {
      ...p,
      images: [
        {
          id: 'image',
          title: 'Historical reference',
          sourceId: p.sources[0].id,
          pageUrl: 'https://example.com/gallery',
          previewUrl: null,
          previewPermission: 'unknown',
          capturedAt: '2025-02-05',
        },
      ],
    },
    'Test goal',
  );
  assert.ok(md.includes('reported image date (basis unverified): 2025-02-05'));
  assert.ok(md.includes('source: phila-opa'));
});

test('blocked source findings remain in research history and Markdown but never enter the working plan', () => {
  const s = setup(),
    p = payload(s);
  save(s, p);
  const reviewed = {
    ...p,
    findings: [
      {
        label: 'Unsupported permit count',
        value: '202 permits — unsupported claim',
        sourceId: p.sources[0].id,
        limit: 'Unreviewed model output',
        blockedReason: 'The cited query only returns a ten-row sample.',
      },
      ...p.findings,
    ],
  };
  save(s, reviewed);
  const brief = s.state.artifacts['project-a:working-brief'].at(-1)!;
  assert.ok(brief.payload.kind === 'project-brief');
  if (brief.payload.kind !== 'project-brief') throw Error('Missing brief');
  assert.ok(!brief.payload.sections.some((section) => section.text.includes('202 permits')));
  assert.ok(
    brief.payload.sections.some((section) =>
      section.text.includes('1 blocked finding(s) excluded'),
    ),
  );
  assert.ok(propertyMarkdown(reviewed, 'Test goal').includes('BLOCKED: The cited query'));
  assert.deepEqual(s.state.artifacts['project-a:property-research'][0].payload, p);
  const before = structuredClone(s.state);
  assert.throws(
    () =>
      save(s, {
        ...reviewed,
        findings: reviewed.findings.map(({ blockedReason: _reason, ...f }) => f),
      }),
    /blocked claim/,
  );
  assert.deepEqual(s.state, before);
});

test('residential street suffixes match OPA while retaining SQL escaping and explicit parcel selection', () => {
  assert.ok(
    new URL(phillyQuery('7149 Bingham Street, Philadelphia PA 19111')).searchParams
      .get('q')!
      .includes("'7149 BINGHAM ST'"),
  );
  assert.ok(
    new URL(phillyQuery('100 TEST AVENUE., Philadelphia')).searchParams
      .get('q')!
      .includes("'100 TEST AVE'"),
  );
  assert.ok(
    new URL(phillyQuery('10 STREET ROAD, Philadelphia')).searchParams
      .get('q')!
      .includes("'10 STREET RD'"),
  );
});
test('nullable provider photo metadata normalizes safely; photos feed exact historical plans without becoming measured facts', () => {
  const s = setup(),
    p = payload(s),
    facts = structuredClone(s.state.facts);
  const image = {
    id: 'kitchen',
    title: 'Kitchen listing reference',
    sourceId: p.sources[0].id,
    pageUrl: 'https://example.com/listing',
    imageUrl: 'https://example.com/photo11.jpg',
    previewUrl: null,
    previewPermission: 'unknown' as const,
    capturedAt: '',
    locator: 'Photo 11 of 35',
    observations: 'Cabinetry and a window visible; source photo is historic.',
    planningUse: 'Measure cabinet runs and verify service locations on site.',
    blockedReason: null,
  };
  const parsed = validateResearchForJob(
    { ...p, findings: p.findings.map((f) => ({ ...f, blockedReason: null })), images: [image] },
    p.address,
    p.jobId,
  );
  assert.equal(parsed.images[0].blockedReason, undefined);
  save(s, parsed);
  const oldBrief = s.state.artifacts['project-a:working-brief'].at(-1)!;
  assert.ok(
    oldBrief.payload.kind === 'project-brief' &&
      oldBrief.payload.sections.some(
        (section) =>
          section.text.includes('Photo 11 of 35') && section.text.includes('Measure cabinet runs'),
      ),
  );
  assert.deepEqual(s.state.facts, facts);
  save(s, {
    ...parsed,
    images: [
      { ...parsed.images[0], locator: 'Photo 12', planningUse: 'Different source revision' },
    ],
  });
  assert.equal(researchForArtifact(s.state, oldBrief)?.images[0].locator, 'Photo 11 of 35');
  assert.equal(
    researchForArtifact(s.state, s.state.artifacts['project-a:working-brief'].at(-1)!)?.images[0]
      .locator,
    'Photo 12',
  );
  assert.ok(
    propertyMarkdown(parsed, 'Test').includes(
      'Exact source photo: https://example.com/photo11.jpg',
    ),
  );
  assert.throws(() =>
    validateResearchForJob(
      { ...p, images: [{ ...image, imageUrl: 'http://example.com/photo.jpg' }] },
      p.address,
      p.jobId,
    ),
  );
  s.apply(
    s.command('RecordFact', {
      factId: 'address',
      scope: 'property',
      subjectId: 'property-a',
      key: 'propertyAddress',
      supersedesRevision: 1,
      value: { kind: 'text', text: 'ANOTHER PUBLIC TEST HOME' },
      assertion: 'user_reported',
      evidenceIds: ['address-evidence'],
    }),
  );
  assert.equal(s.state.artifacts['project-a:property-research'].at(-1)!.freshness, 'stale');
  assert.equal(
    s.state.artifacts['project-a:working-brief'].find((a) => a.revision === oldBrief.revision)!
      .freshness,
    'stale',
  );
  assert.equal(
    researchForArtifact(s.state, s.state.artifacts['project-a:working-brief'].at(-1)!),
    null,
  );
  assert.equal(researchForArtifact(s.state, oldBrief)?.images[0].locator, 'Photo 11 of 35');
});
test('Muse output schema satisfies provider strict required-key rules, using nullable optional metadata', async () => {
  const schema = JSON.parse(
    await readFile(new URL('../../scripts/property-research.schema.json', import.meta.url), 'utf8'),
  );
  function check(node: any) {
    if (node.type === 'object') {
      assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort());
      assert.equal(node.additionalProperties, false);
      Object.values(node.properties).forEach(check);
    }
    if (node.items) check(node.items);
  }
  check(schema);
  assert.deepEqual(schema.properties.images.items.properties.locator.type, ['string', 'null']);
  assert.deepEqual(schema.properties.findings.items.properties.blockedReason.type, [
    'string',
    'null',
  ]);
});
