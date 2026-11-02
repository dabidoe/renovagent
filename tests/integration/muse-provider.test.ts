import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assessMuseAvailability,
  checkMuseModels,
  museJson,
  museModelAvailability,
  runMuse,
  withMuseBudget,
} from '../../scripts/muse-provider.js';
test('Muse credentials use stdin, never argv, and are redacted from provider output and failures', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'muse-auth-test-'));
  const previousPath = process.env.PATH,
    previousKey = process.env.MUSE_API_KEY;
  const fakeKey = 'synthetic-key-for-stdin-test-only';
  try {
    const script = join(directory, 'muse');
    await writeFile(
      script,
      `#!${process.execPath}\nlet input='';process.stdin.on('data',d=>input+=d);process.stdin.on('end',()=>{if(process.argv.includes('--hang')){setInterval(()=>{},1000);return;}if(process.argv.includes('--fail')){process.stderr.write('rejected credential '+input.trim());process.exitCode=2;}else process.stdout.write(JSON.stringify({args:process.argv.slice(2),received:input.trim()}));});\n`,
    );
    await chmod(script, 0o755);
    process.env.PATH = directory + ':' + previousPath;
    process.env.MUSE_API_KEY = fakeKey;
    const cancelled = new AbortController();
    const pending = withMuseBudget(cancelled.signal, 1, () => runMuse(['exec', '--hang'], 5000));
    setTimeout(() => cancelled.abort(), 100);
    await assert.rejects(pending, /cancelled/);
    await assert.rejects(
      withMuseBudget(new AbortController().signal, 0, () => runMuse(['exec'], 5000)),
      /budget exhausted/,
    );
    const result = JSON.parse(await runMuse(['exec', '--json'], 5000));
    assert.deepEqual(result.args, ['exec', '--json', '--api-key-stdin']);
    assert.equal(result.received, '[REDACTED]');
    await assert.rejects(
      runMuse(['exec', '--fail'], 5000),
      (error: Error) => !error.message.includes(fakeKey) && error.message.includes('[REDACTED]'),
    );
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    if (previousKey === undefined) delete process.env.MUSE_API_KEY;
    else process.env.MUSE_API_KEY = previousKey;
    await rm(directory, { recursive: true, force: true });
  }
});
test('model availability marks proof of misconfiguration blocking, transient failures warn', () => {
  assert.deepEqual(assessMuseAvailability({ configured: false, models: [] }), {
    blocking: null,
    warnings: [],
  });
  const ok = [
    { model: 'muse-spark-1.3', status: 200, available: true },
    { model: 'muse-image-1.0', status: 200, available: true },
    { model: 'sam-3.1', status: 200, available: true },
  ];
  assert.deepEqual(assessMuseAvailability({ configured: true, models: ok }), {
    blocking: null,
    warnings: [],
  });
  const missingVision = assessMuseAvailability({
    configured: true,
    models: [
      { model: 'muse-spark-1.3', status: 404, available: false },
      { model: 'muse-image-1.0', status: 200, available: true },
      { model: 'sam-3.1', status: 200, available: true },
    ],
  });
  assert.match(missingVision.blocking ?? '', /muse-spark-1\.3.*catalog 404/);
  assert.deepEqual(missingVision.warnings, []);
  // SAM alone is never blocking: restyle does not need outlines.
  const missingSam = assessMuseAvailability({
    configured: true,
    models: [
      { model: 'muse-spark-1.3', status: 200, available: true },
      { model: 'muse-image-1.0', status: 200, available: true },
      { model: 'sam-3.1', status: 404, available: false },
    ],
  });
  assert.equal(missingSam.blocking, null);
  assert.equal(missingSam.warnings.length, 1);
  // Outages and network failures warn but keep the site up.
  const outage = assessMuseAvailability({
    configured: true,
    models: [
      { model: 'muse-spark-1.3', status: 503, available: false },
      { model: 'muse-image-1.0', status: null, available: false },
      { model: 'sam-3.1', status: 200, available: true },
    ],
  });
  assert.equal(outage.blocking, null);
  assert.equal(outage.warnings.length, 2);
});
test('startup check logs redacted config, warns by default, fails only when required', async () => {
  const previousKey = process.env.MUSE_API_KEY;
  const previousSha = process.env.RAILWAY_GIT_COMMIT_SHA;
  const previousRequire = process.env.REQUIRE_MUSE_MODELS;
  const previousFetch = globalThis.fetch;
  const previousLog = console.log;
  const previousWarn = console.warn;
  const previousError = console.error;
  const lines: string[] = [];
  const fakeKey = 'synthetic-startup-key-12345678';
  const stubFetch = (status: number) => {
    globalThis.fetch = (async () => ({
      status,
      ok: status >= 200 && status < 300,
      body: { cancel: async () => {} },
    })) as unknown as typeof fetch;
  };
  try {
    process.env.MUSE_API_KEY = fakeKey;
    process.env.RAILWAY_GIT_COMMIT_SHA = 'testsha1234';
    delete process.env.REQUIRE_MUSE_MODELS;
    console.log = (...args: unknown[]) => void lines.push(args.map(String).join(' '));
    console.warn = (...args: unknown[]) => void lines.push(args.map(String).join(' '));
    console.error = (...args: unknown[]) => void lines.push(args.map(String).join(' '));
    stubFetch(404);
    await checkMuseModels();
    process.env.REQUIRE_MUSE_MODELS = '1';
    await assert.rejects(checkMuseModels(), /provider misconfigured: muse-spark-1\.3/);
    delete process.env.REQUIRE_MUSE_MODELS;
    stubFetch(500);
    await checkMuseModels();
    const output = lines.join('\n');
    assert.match(output, /POST https:\/\/api\.meta\.ai\/v1\/responses model=muse-spark-1\.3/);
    assert.match(output, /key=synt…5678 \(environment\); commit=testsha1234/);
    assert.match(output, /provider misconfigured: muse-spark-1\.3/);
    assert.doesNotMatch(output, new RegExp(fakeKey));
  } finally {
    if (previousKey === undefined) delete process.env.MUSE_API_KEY;
    else process.env.MUSE_API_KEY = previousKey;
    if (previousSha === undefined) delete process.env.RAILWAY_GIT_COMMIT_SHA;
    else process.env.RAILWAY_GIT_COMMIT_SHA = previousSha;
    if (previousRequire === undefined) delete process.env.REQUIRE_MUSE_MODELS;
    else process.env.REQUIRE_MUSE_MODELS = previousRequire;
    globalThis.fetch = previousFetch;
    console.log = previousLog;
    console.warn = previousWarn;
    console.error = previousError;
  }
});
const RELAY_BASE = 'https://relay.test';
const RELAY_TOKEN = 'synthetic-relay-token-rrr';
const META_KEY = 'synthetic-meta-key-bbb';

function saveRelayEnv() {
  return {
    key: process.env.MUSE_API_KEY,
    base: process.env.RENOVAGENT_META_BASE_URL,
    token: process.env.RENOVAGENT_META_TOKEN,
  };
}

function restoreRelayEnv(saved: ReturnType<typeof saveRelayEnv>) {
  if (saved.key === undefined) delete process.env.MUSE_API_KEY;
  else process.env.MUSE_API_KEY = saved.key;
  if (saved.base === undefined) delete process.env.RENOVAGENT_META_BASE_URL;
  else process.env.RENOVAGENT_META_BASE_URL = saved.base;
  if (saved.token === undefined) delete process.env.RENOVAGENT_META_TOKEN;
  else process.env.RENOVAGENT_META_TOKEN = saved.token;
}

type RecordedCall = { url: string; init: { headers?: unknown; body?: unknown } };
function stubFetch(responses: { status: number; body: unknown }[]) {
  const calls: RecordedCall[] = [];
  let index = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async (url: unknown, init: unknown) => {
    const next = responses[Math.min(index, responses.length - 1)]!;
    index += 1;
    calls.push({ url: String(url), init: (init ?? {}) as RecordedCall['init'] });
    const text = JSON.stringify(next.body);
    return {
      status: next.status,
      ok: next.status >= 200 && next.status < 300,
      body: { cancel: async () => {} },
      text: async () => text,
      clone: () => ({ text: async () => text }),
    };
  }) as unknown as typeof fetch;
  return { calls, restore: () => void (globalThis.fetch = previousFetch) };
}

const jsonSuccess = {
  id: 'run-1',
  model: 'muse-spark-1.3',
  status: 'completed',
  output: [{ content: [{ type: 'output_text', text: '{"ok":true}' }] }],
};

test('relay mode sends the relay token, never the Meta key', async () => {
  const saved = saveRelayEnv();
  const fetch = stubFetch([{ status: 200, body: jsonSuccess }]);
  try {
    process.env.MUSE_API_KEY = META_KEY;
    process.env.RENOVAGENT_META_BASE_URL = RELAY_BASE;
    process.env.RENOVAGENT_META_TOKEN = RELAY_TOKEN;
    const out = await museJson({ prompt: 'x', schema: { type: 'object' } });
    assert.deepEqual(out.result, { ok: true });
    assert.equal(fetch.calls.length, 1);
    const call = fetch.calls[0]!;
    assert.equal(call.url, `${RELAY_BASE}/relay/responses`);
    const headers = call.init.headers as Record<string, string>;
    assert.equal(headers['X-Renovagent-Token'], RELAY_TOKEN);
    assert.ok(!('Authorization' in headers));
    assert.doesNotMatch(JSON.stringify(call), new RegExp(META_KEY));
  } finally {
    fetch.restore();
    restoreRelayEnv(saved);
  }
});

test('relay retries model_not_found once; direct never retries a 404', async () => {
  const saved = saveRelayEnv();
  const notFound = { status: 404, body: { error: { code: 'model_not_found', message: 'nf' } } };
  const previousWarn = console.warn;
  const warnings: string[] = [];
  try {
    process.env.MUSE_API_KEY = META_KEY;
    process.env.RENOVAGENT_META_BASE_URL = RELAY_BASE;
    process.env.RENOVAGENT_META_TOKEN = RELAY_TOKEN;
    console.warn = (...args: unknown[]) => void warnings.push(args.map(String).join(' '));
    const relayed = stubFetch([notFound, { status: 200, body: jsonSuccess }]);
    try {
      const out = await museJson({ prompt: 'x', schema: { type: 'object' } });
      assert.deepEqual(out.result, { ok: true });
      assert.equal(relayed.calls.length, 2);
    } finally {
      relayed.restore();
    }
    assert.match(warnings.join('\n'), /relay model_not_found, retrying once/);
    delete process.env.RENOVAGENT_META_BASE_URL;
    delete process.env.RENOVAGENT_META_TOKEN;
    const direct = stubFetch([notFound, { status: 200, body: jsonSuccess }]);
    try {
      await assert.rejects(museJson({ prompt: 'x', schema: { type: 'object' } }), /404/);
      assert.equal(direct.calls.length, 1);
    } finally {
      direct.restore();
    }
  } finally {
    console.warn = previousWarn;
    restoreRelayEnv(saved);
  }
});

test('model availability follows the relay with the relay token', async () => {
  const saved = saveRelayEnv();
  const fetch = stubFetch([{ status: 200, body: {} }]);
  try {
    process.env.MUSE_API_KEY = META_KEY;
    process.env.RENOVAGENT_META_BASE_URL = RELAY_BASE;
    process.env.RENOVAGENT_META_TOKEN = RELAY_TOKEN;
    const result = await museModelAvailability();
    assert.equal(result.configured, true);
    assert.ok(result.models.every((m) => m.available));
    assert.equal(fetch.calls.length, 3);
    for (const call of fetch.calls) {
      assert.match(call.url, new RegExp(`^${RELAY_BASE}/relay/models/`));
      const headers = call.init.headers as Record<string, string>;
      assert.equal(headers['X-Renovagent-Token'], RELAY_TOKEN);
      assert.ok(!('Authorization' in headers));
    }
    assert.doesNotMatch(JSON.stringify(fetch.calls), new RegExp(META_KEY));
  } finally {
    fetch.restore();
    restoreRelayEnv(saved);
  }
});

test('startup check works relay-only and logs the relay path', async () => {
  const saved = saveRelayEnv();
  const previousSha = process.env.RAILWAY_GIT_COMMIT_SHA;
  const previousLog = console.log;
  const previousWarn = console.warn;
  const previousError = console.error;
  const lines: string[] = [];
  const fetch = stubFetch([{ status: 200, body: {} }]);
  try {
    delete process.env.MUSE_API_KEY;
    process.env.RENOVAGENT_META_BASE_URL = RELAY_BASE;
    process.env.RENOVAGENT_META_TOKEN = RELAY_TOKEN;
    process.env.RAILWAY_GIT_COMMIT_SHA = 'testsha1234';
    console.log = (...args: unknown[]) => void lines.push(args.map(String).join(' '));
    console.warn = (...args: unknown[]) => void lines.push(args.map(String).join(' '));
    console.error = (...args: unknown[]) => void lines.push(args.map(String).join(' '));
    await checkMuseModels();
    const output = lines.join('\n');
    assert.match(output, new RegExp(`via relay POST ${RELAY_BASE}/relay/responses`));
    assert.match(output, /relay-token=synt…-rrr \(environment\); commit=testsha1234/);
  } finally {
    fetch.restore();
    restoreRelayEnv(saved);
    if (previousSha === undefined) delete process.env.RAILWAY_GIT_COMMIT_SHA;
    else process.env.RAILWAY_GIT_COMMIT_SHA = previousSha;
    console.log = previousLog;
    console.warn = previousWarn;
    console.error = previousError;
  }
});
