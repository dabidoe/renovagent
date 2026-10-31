import test from 'node:test';
import assert from 'node:assert/strict';
import {
  askJev,
  JevError,
  judgeProducts,
  photoChecks,
  rankReviewFindings,
  rankSections,
} from '../../apps/api/src/jev.js';

// A fake fetch that records the request and answers like the documented API.
function fake(
  answers: (q: Record<string, { type: string }>) => Record<string, unknown>,
  status = 200,
) {
  const calls: { url: string; headers: Record<string, string>; body: any }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push({ url, headers: init.headers as Record<string, string>, body });
    return new Response(
      status === 200
        ? JSON.stringify({
            model: 'jev-1.14',
            answers: answers(body.questions),
            usage: { input_tokens: 42 },
          })
        : JSON.stringify({ detail: 'nope test-key-123' }),
      { status },
    );
  }) as unknown as typeof fetch;
  return { f, calls };
}

test('sections are ranked by Jev yes-probability, one question each, key server-side', async () => {
  const { f, calls } = fake((q) =>
    Object.fromEntries(Object.keys(q).map((k, i) => [k, { type: 'noul', noul: [0.2, 0.9][i] }])),
  );
  const r = await rankSections(
    { request: 'Replace the toilet', packages: ['toilet'], facts: [] },
    [
      {
        key: 'a',
        code: 'IRC',
        id: 'R314.3',
        title: 'Location',
        excerpt: 'Smoke alarms shall be installed',
      },
      {
        key: 'b',
        code: 'IPC',
        id: '405.3.1',
        title: 'Water closets',
        excerpt: 'not closer than 15 inches',
      },
    ],
    { key: 'test-key-123', fetch: f },
  );
  assert.deepEqual(
    r.ranked.map((x) => x.key),
    ['b', 'a'],
  );
  assert.equal(calls[0]!.url, 'https://api.typesafe.ai/v1/systemone');
  assert.equal(calls[0]!.headers.Authorization, 'Bearer test-key-123');
  assert.equal(Object.keys(calls[0]!.body.questions).length, 2);
  assert.equal(calls[0]!.headers['TypeSafe-Danger-Zone-Images'], undefined);
});

test('photo checks send the image as an asset with the images header and return boxes', async () => {
  const { f, calls } = fake((q) =>
    Object.fromEntries(
      Object.entries(q).map(([k, v]) => [
        k,
        v.type === 'box'
          ? { type: 'box', box: { top: 0.1, bottom: 0.4, left: 0.6, right: 0.8 }, confidence: 0.7 }
          : { type: 'noul', noul: 0.85 },
      ]),
    ),
  );
  const r = await photoChecks(
    { format: 'jpg', bytes: new Uint8Array([1, 2, 3]) },
    [
      {
        key: 'fan',
        present: 'Is a ceiling exhaust fan visible?',
        locate: 'The ceiling exhaust fan',
      },
    ],
    { key: 'test-key-123', fetch: f },
  );
  assert.equal(calls[0]!.headers['TypeSafe-Danger-Zone-Images'], 'true');
  const [ref] = Object.keys(calls[0]!.body.assets);
  // Referenced once, in the state: each mention would send another copy.
  assert.equal(calls[0]!.body.state.photo, ref);
  assert.equal(JSON.stringify(calls[0]!.body.questions).includes(ref!), false);
  assert.equal(calls[0]!.body.assets[ref!].data_base64, 'AQID');
  assert.deepEqual(r.items[0], {
    key: 'fan',
    probability: 0.85,
    box: { top: 0.1, bottom: 0.4, left: 0.6, right: 0.8 },
  });
});

test('errors carry the status and never echo the key', async () => {
  const { f } = fake(() => ({}), 401);
  await assert.rejects(
    askJev('x', { q: { type: 'noul', instructions: 'y?' } }, { key: 'test-key-123', fetch: f }),
    (e: unknown) =>
      e instanceof JevError && e.status === 401 && !e.message.includes('test-key-123'),
  );
});

test('overload is retried with backoff, then answered', async () => {
  let n = 0;
  const f = (async () =>
    ++n < 3
      ? new Response('{"detail":"busy"}', { status: 529 })
      : new Response(
          JSON.stringify({
            model: 'jev-1.14',
            answers: { q: { type: 'noul', noul: 0.7 } },
            usage: { input_tokens: 1 },
          }),
        )) as unknown as typeof fetch;
  const r = await askJev(
    'x',
    { q: { type: 'noul', instructions: 'y?' } },
    { key: 'k', fetch: f, backoffMs: 1 },
  );
  assert.equal(n, 3);
  assert.equal((r.answers.q as { noul: number }).noul, 0.7);
});

test('review findings are only annotated and reordered by relevance', async () => {
  const { f } = fake((q) =>
    Object.fromEntries(Object.keys(q).map((k, i) => [k, { type: 'noul', noul: [0.1, 0.8][i] }])),
  );
  const cite = (title: string) => ({
    kind: 'code-provision',
    title,
    locator: 'Section X',
    excerpt: 'text',
  });
  const findings = [
    { id: 'f1', summary: 'toilet', citations: [cite('IPC 405.3.1')] },
    { id: 'f2', summary: 'permit', citations: [cite('CRC R105.2')] },
    { id: 'f3', summary: 'measure', citations: [] },
  ];
  const r = await rankReviewFindings(
    findings,
    { request: 'repaint', packages: ['Wall paint'], facts: [] },
    { key: 'k', fetch: f },
  );
  assert.deepEqual(
    r.findings.map((x) => [x.id, x.relevance]),
    [
      ['f3', null],
      ['f2', 0.8],
      ['f1', 0.1],
    ],
  );
  assert.deepEqual(r.findings.find((x) => x.id === 'f1')!.citations, findings[0]!.citations);
});

test('product judging batches 40 candidates per request and keeps every answer', async () => {
  const { f, calls } = fake((q) =>
    Object.fromEntries(
      Object.entries(q).map(([id, question]) => [
        id,
        question.type === 'noul' ? { noul: 0.9 } : { score: 1 },
      ]),
    ),
  );
  const candidates = Array.from({ length: 45 }, (_, i) => ({
    key: `c${i}`,
    requirement: 'Single-hole faucet',
    product: {
      name: `Faucet ${i}`,
      manufacturer: 'M',
      category: 'faucet',
      specs: {},
      certifications: [],
    },
  }));
  const { judged } = await judgeProducts({ request: 'r', design: null }, candidates, {
    key: 'test-key-123',
    fetch: f,
  });
  assert.deepEqual(
    calls.map((c) => c.body.state.candidates.length),
    [40, 5],
  );
  assert.equal(Object.keys(judged).length, 45);
  assert.deepEqual(judged.c44, { fit: 0.9, quality: 1 });
});
