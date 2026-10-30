import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import {
  hostingConfigFromEnv,
  isPublic,
  oauthRedirect,
  secureCookies,
  serveStatic,
  trustedHost,
  trustedOrigins,
} from '../../apps/api/src/hosting.js';

test('with nothing set, hosting stays the loopback dev server', () => {
  const h = hostingConfigFromEnv({});
  assert.deepEqual(h, { listenHost: '127.0.0.1', listenPort: 4000 });
  assert.equal(isPublic(h), false);
  assert.equal(secureCookies(h), false);
  assert.equal(oauthRedirect(h, 'google'), undefined);
  assert.ok(trustedHost(h, 4000, '127.0.0.1:8741'));
  assert.ok(!trustedHost(h, 4000, 'renovagent.example'));
});

test('a public origin is trusted alongside loopback, with secure cookies and hosted callbacks', () => {
  const h = hostingConfigFromEnv({
    RENOVAGENT_HOST: '0.0.0.0',
    PORT: '8080',
    RENOVAGENT_PUBLIC_URL: 'https://renovagent.example',
    RENOVAGENT_STATIC_DIR: 'dist',
  });
  assert.equal(h.listenPort, 8080);
  assert.ok(isPublic(h) && secureCookies(h));
  assert.ok(trustedOrigins(h, 8080).has('https://renovagent.example'));
  assert.ok(!trustedOrigins(h, 8080).has('https://evil.example'));
  assert.ok(trustedHost(h, 8080, 'renovagent.example'));
  assert.ok(!trustedHost(h, 8080, 'evil.example'));
  assert.equal(
    oauthRedirect(h, 'meta'),
    'https://renovagent.example/api/workspace/auth/meta/callback',
  );
});

test('unsafe hosting settings refuse to start', () => {
  assert.throws(() => hostingConfigFromEnv({ RENOVAGENT_HOST: '0.0.0.0' }), /PUBLIC_URL/);
  assert.throws(
    () => hostingConfigFromEnv({ RENOVAGENT_PUBLIC_URL: 'http://renovagent.example' }),
    /https/,
  );
  assert.throws(
    () => hostingConfigFromEnv({ RENOVAGENT_PUBLIC_URL: 'https://renovagent.example/app' }),
    /origin/,
  );
  assert.throws(() => hostingConfigFromEnv({ PORT: 'eighty' }), /port/);
});

test('the packaged site is served with cache rules, and never outside its folder', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'renovagent-site-'));
  await mkdir(join(dir, 'assets'));
  await writeFile(join(dir, 'index.html'), '<h1>Landing</h1>');
  await writeFile(join(dir, 'assets', 'app-abc.js'), 'export {}');
  await writeFile(join(dir, '404.html'), '<h1>Missing</h1>');
  await writeFile(join(dir, '..', 'renovagent-secret.txt'), 'secret').catch(() => {});
  const server = createServer(async (req, res) => {
    if (!(await serveStatic(dir, req, res))) {
      res.writeHead(418);
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const home = await fetch(`${base}/`);
    assert.equal(home.status, 200);
    assert.equal(home.headers.get('cache-control'), 'no-cache');
    assert.equal(await home.text(), '<h1>Landing</h1>');
    const asset = await fetch(`${base}/assets/app-abc.js`);
    assert.match(asset.headers.get('content-type')!, /javascript/);
    assert.match(asset.headers.get('cache-control')!, /immutable/);
    const missing = await fetch(`${base}/nope.html`);
    assert.equal(missing.status, 404);
    assert.equal(await missing.text(), '<h1>Missing</h1>');
    // API routes and writes fall through to the API (418 here), never to files.
    assert.equal((await fetch(`${base}/api/workspace/session`)).status, 418);
    // fetch normalises dot segments, so send the raw path over node:http.
    for (const path of ['/../renovagent-secret.txt', '/%2e%2e/renovagent-secret.txt']) {
      const raw = await new Promise<{ status: number; body: string }>((done, fail) =>
        request(`${base}${path}`, { path }, (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => done({ status: res.statusCode!, body }));
        })
          .on('error', fail)
          .end(),
      );
      assert.notEqual(raw.status, 200, path);
      assert.notEqual(raw.body, 'secret');
    }
    assert.equal((await fetch(`${base}/assets/app-abc.js`, { method: 'POST' })).status, 418);
  } finally {
    await new Promise((r) => server.close(r));
    await rm(dir, { recursive: true, force: true });
    await rm(join(dir, '..', 'renovagent-secret.txt'), { force: true });
  }
});
