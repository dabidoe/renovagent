// Real built-page guest -> key -> clipboard -> MCP check, using isolated local Mongo.
// No live data, provider calls, Google login, or credentials in test output.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MongoClient } from 'mongodb';
import { chromium } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { AccountService } from '../apps/api/src/accounts.js';
import { MongoWorkspaceRepository } from '../apps/api/src/repository.js';
import { createWorkspaceServer } from '../apps/api/src/server.js';
import { McpAccessStore } from '../apps/api/src/mcp-access.js';

const uri = process.env.TEST_WORKSPACE_MONGO_URI || 'mongodb://127.0.0.1:27018';
const mongoUrl = new URL(uri);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(mongoUrl.hostname), 'Local Mongo only');
const mongo = await new MongoClient(uri).connect();
const db = mongo.db(`renovagent_connect_ui_${randomUUID().replaceAll('-', '')}`);
const repo = MongoWorkspaceRepository.forDb(db);
await repo.ensure();
const accounts = new AccountService(db, {
  google: {
    clientId: 'test-only',
    clientSecret: 'test-only',
    redirectUri: 'http://localhost/unused',
  },
});
const access = new McpAccessStore(db);
await access.ensureIndexes();
const { server, recovery } = await createWorkspaceServer(
  repo,
  'test-only-server-token',
  false,
  accounts,
  undefined,
  undefined,
  undefined,
  { listenHost: '127.0.0.1', listenPort: 0, staticDir: resolve('dist') },
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  access,
);
await recovery;
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const bound = server.address();
assert.ok(bound && typeof bound !== 'string');
const base = `http://127.0.0.1:${bound.port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const clients: Client[] = [];
const out = '.local/connect-guest-check';
await mkdir(out, { recursive: true });
let passed = 0;
const pass = (name: string) => {
  passed++;
  console.log(`PASS ${name}`);
};
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const posts: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST') posts.push(new URL(req.url()).pathname);
    });
    await page.goto(base + '/#connect');
    const create = page.getByRole('button', { name: 'Create connection key', exact: true });
    await create.waitFor();
    await page.getByRole('link', { name: 'Continue with Google', exact: true }).waitFor();
    assert.ok(await create.isEnabled());
    assert.equal(
      await page.getByRole('button', { name: 'Continue as guest', exact: true }).count(),
      0,
    );
    assert.deepEqual(posts, [], 'Loading connect must not create a guest');
    assert.equal(
      await accounts.users.countDocuments({ guest: true }),
      width === 1440 ? 0 : width === 390 ? 1 : 2,
    );
    pass(
      `${width}px: create is available while signed out; Google optional; no separate guest button`,
    );

    await create.click();
    const key = page.locator('.ca-secret');
    await key.waitFor();
    const generated = await key.innerText();
    assert.match(generated, /^reno_[A-Za-z0-9_-]{43}$/);
    assert.deepEqual(posts, ['/api/workspace/auth/guest', '/api/workspace/agent-keys']);
    assert.equal(await page.getByRole('navigation', { name: 'Main navigation' }).count(), 1);
    assert.equal(await key.count(), 1);
    pass(`${width}px: one click starts one guest and issues a real key without leaving the page`);

    await page.getByRole('button', { name: 'Copy key', exact: true }).click();
    await page.getByRole('button', { name: 'Copied', exact: true }).waitFor();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(copied === generated, 'Clipboard matches generated key');
    pass(`${width}px: page Copy button copies the exact generated key`);

    const displayedEndpoint = await page.locator('.ca-step').nth(0).locator('code').innerText();
    assert.equal(displayedEndpoint, 'https://renovagent.app/mcp');
    // Backend checks stay on the isolated local server, never the displayed production URL.
    const endpoint = base + '/mcp';
    const agent = new Client({ name: 'guest-connect-ui-check', version: '1' });
    clients.push(agent);
    await agent.connect(
      new StreamableHTTPClientTransport(new URL(endpoint), {
        requestInit: { headers: { Authorization: `Bearer ${copied}` } },
      }),
    );
    assert.ok((await agent.listTools()).tools.some((t) => t.name === 'list_projects'));
    const projects = await agent.callTool({ name: 'list_projects', arguments: {} });
    assert.ok(!projects.isError);
    const briefing = await agent.callTool({ name: 'get_connection_context', arguments: {} });
    assert.ok(!briefing.isError);
    pass(
      `${width}px: copied key authenticates MCP; tools/list, list_projects and get_connection_context succeed`,
    );
    await agent.close();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `${out}/guest-${width}.png`, fullPage: true, mask: [key] });

    const cookieBefore = (await context.cookies()).find(
      (c) => c.name === 'renovagent_account',
    )?.value;
    await page.reload();
    await create.waitFor();
    assert.equal(await key.count(), 0, 'Key not restored after reload');
    await create.click();
    await key.waitFor();
    assert.equal(posts.filter((p) => p.endsWith('/auth/guest')).length, 1, 'Existing guest reused');
    assert.ok(
      (await context.cookies()).find((c) => c.name === 'renovagent_account')?.value ===
        cookieBefore,
      'Guest session unchanged',
    );
    assert.deepEqual(errors, []);
    pass(`${width}px: reload hides key and another key reuses the same guest workspace`);
    await context.close();
  }

  // Real backend is preserved; intercept only a deliberate failure under test.
  for (const failedStep of ['guest', 'key']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    let guestPosts = 0,
      keyPosts = 0;
    page.on('request', (req) => {
      if (req.method() !== 'POST') return;
      if (req.url().endsWith('/auth/guest')) guestPosts++;
      if (req.url().endsWith('/agent-keys')) keyPosts++;
    });
    const path = failedStep === 'guest' ? '/auth/guest' : '/agent-keys';
    await context.route(`**/api/workspace${path}`, async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      await route.fulfill({
        status: 503,
        json: { code: 'STORAGE', message: `Test ${failedStep} service unavailable` },
      });
    });
    await page.goto(base + '/#connect');
    const create = page.getByRole('button', { name: 'Create connection key', exact: true });
    await page.getByRole('link', { name: 'Continue with Google', exact: true }).waitFor();
    await create.click();
    await page
      .getByRole('alert')
      .filter({ hasText: `Test ${failedStep} service unavailable` })
      .waitFor();
    assert.equal(await page.locator('.ca-secret').count(), 0);
    assert.equal(guestPosts, 1);
    assert.equal(keyPosts, failedStep === 'guest' ? 0 : 1);
    assert.ok(await create.isEnabled());
    pass(`${failedStep} failure: exact error shown, no automatic retry or fake key`);
    if (failedStep === 'key') {
      await context.unroute(`**/api/workspace${path}`);
      await create.click();
      await page.locator('.ca-secret').waitFor();
      assert.equal(guestPosts, 1);
      assert.equal(keyPosts, 2);
      pass('Explicit retry after key failure reuses the guest session');
    }
    await context.close();
  }
  console.log(
    `${passed} guest connection checks passed against real local Mongo and MCP. Screenshots: ${out}`,
  );
} finally {
  await Promise.all(clients.map((c) => c.close().catch(() => {})));
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await db.dropDatabase();
  await mongo.close();
}
