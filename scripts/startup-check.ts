// Production-build regression check for public startup with saved local/remote
// projects and a slow private API. No production data or providers are used.
// npm run build && node --import tsx scripts/startup-check.ts
// Add --before <built-site-directory> to record the previous startup behavior.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import { emptyWorkspace } from '../packages/contracts/src/index.js';
import { handleCommand } from '../packages/core/src/index.js';
import { serveStatic } from '../apps/api/src/hosting.js';

const out = '.local/startup-check';
const ownerId = 'local-homeowner';
const saved = handleCommand(
  emptyWorkspace(ownerId),
  {
    commandId: 'startup-project',
    projectId: 'startup-project',
    baseRevision: 0,
    basePropertyRevision: 0,
    type: 'CreateProject',
    payload: {
      name: 'Saved Brooklyn project',
      propertyId: 'startup-home',
      newProperty: { name: 'Saved home' },
      spaces: [{ id: 'startup-room', name: 'Room' }],
    },
  },
  { ownerId, now: '2026-11-03T00:00:00.000Z' },
).state;
const report: unknown[] = [];

async function site(directory: string) {
  const server = createServer((req, res) => {
    void serveStatic(resolve(directory), req, res)
      .then((served) => {
        if (!served) {
          res.writeHead(404);
          res.end();
        }
      })
      .catch(() => {
        res.writeHead(500);
        res.end();
      });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address() as { port: number };
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((done) => server.close(() => done())),
  };
}

async function context(browser: Browser, mode: 'mongo' | 'local', slow = false) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  await ctx.addInitScript('window.__name = (fn) => fn');
  await ctx.addInitScript(
    (storageMode) => localStorage.setItem('renovagent-storage-mode', storageMode),
    mode,
  );
  const api: string[] = [];
  const mutations: string[] = [];
  await ctx.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    api.push(path);
    if (route.request().method() !== 'GET') mutations.push(path);
    if (slow && path === '/api/workspace') await new Promise((done) => setTimeout(done, 4000));
    const body =
      path === '/api/workspace'
        ? saved
        : path === '/api/workspace/session'
          ? {
              mode: 'account',
              signedIn: true,
              user: { email: 'fixture@example.test', guest: true },
              providers: [],
            }
          : {};
    await route
      .fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
      .catch(() => {});
  });
  return { ctx, api, mutations };
}

async function seedLocal(ctx: BrowserContext, url: string) {
  const page = await ctx.newPage();
  // A same-origin static page lets us seed IndexedDB before the product entry runs.
  await page.goto(`${url}/404.html`);
  await page.evaluate(
    (workspace) =>
      new Promise<void>((done, reject) => {
        const request = indexedDB.open('unpermitted-workspace', 2);
        request.onupgradeneeded = () => {
          for (const name of ['snapshots', 'blobs', 'meta']) request.result.createObjectStore(name);
        };
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('snapshots', 'readwrite');
          tx.objectStore('snapshots').put(workspace, 'workspace');
          tx.oncomplete = () => {
            db.close();
            done();
          };
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      }),
    saved,
  );
  await page.close();
}

async function run(browser: Browser, directory: string, before = false) {
  const server = await site(directory);
  try {
    for (const mode of ['mongo', 'local'] as const) {
      const { ctx, api, mutations } = await context(browser, mode, true);
      try {
        if (mode === 'local') await seedLocal(ctx, server.url);
        const page = await ctx.newPage();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const session = await ctx.newCDPSession(page);
        await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        const began = performance.now();
        await page.goto(server.url, { waitUntil: 'domcontentloaded' });
        await page.locator('#landing-title, .project-room').first().waitFor();
        const firstPageMs = Math.round(performance.now() - began);
        const landing = await page.locator('#landing-title').isVisible();
        report.push({
          build: before ? 'before' : 'after',
          mode,
          firstPageMs,
          landing,
          api: [...api],
        });
        if (before) continue;
        assert.ok(landing, `${mode}: / opens the landing with saved projects`);
        assert.equal(
          api.filter((path) => path !== '/api/workspace/session').length,
          0,
          `${mode}: / never requests the private API`,
        );
        const scripts = await page.evaluate(() =>
          performance.getEntriesByType('resource').map((r) => r.name),
        );
        assert.ok(
          !scripts.some((url) => /workspace-entry-/.test(url)),
          'private workspace code is deferred',
        );
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.locator('#landing-title').waitFor();
        assert.equal(
          api.filter((path) => path !== '/api/workspace/session').length,
          0,
          'refresh remains independent of the private API',
        );
        await page.screenshot({ path: `${out}/landing-${mode}.png` });

        await page
          .locator('.landing-hero')
          .getByRole('button', { name: 'Try studio', exact: true })
          .click();
        await page.locator('.pf-gallery').waitFor();
        assert.equal(
          api.filter((path) => path !== '/api/workspace/session').length,
          0,
          'gallery also avoids private workspace reads',
        );
        await page.getByRole('button', { name: 'Renovagent home', exact: true }).click();
        await page.locator('#landing-title').waitFor();
        await page.goBack();
        await page.locator('.pf-gallery').waitFor();
        await page.goForward();
        await page.locator('#landing-title').waitFor();

        // Private records remain accessible only after an explicit request.
        await page.goto(`${server.url}/#workspace/projects`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'Homes & projects' }).waitFor();
        await page
          .getByRole('dialog', { name: 'Homes & projects' })
          .getByRole('button', { name: /Saved Brooklyn project/ })
          .click();
        await page.locator('.project-room').waitFor();
        assert.equal(new URL(page.url()).hash, '#workspace');
        await page.getByRole('button', { name: 'Renovagent home', exact: true }).click();
        await page.locator('#landing-title').waitFor();
        // Keep the owner's existing explicit-start behavior, but stop at sign-in
        // so this fixture tests File handoff without uploading or using a model.
        await page.route('**/api/workspace/session', (route) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              mode: 'account',
              signedIn: false,
              providers: [],
              guests: false,
            }),
          }),
        );
        await page.locator('#start-prompt').fill('Keep the tile. Brighten the walls.');
        await page.locator('input[type=file]').setInputFiles('public/favicon-32.png');
        await page.getByRole('button', { name: 'Start a project', exact: true }).click();
        await page.locator('.pf-intake').waitFor();
        assert.equal(
          await page.locator('.pf-intake-idea').inputValue(),
          'Keep the tile. Brighten the walls.',
        );
        assert.ok(
          await page.locator('.pf-intake').getByText('favicon-32.png', { exact: true }).isVisible(),
          'selected File survives the lazy route transition',
        );
        assert.ok(
          mutations.every((path) => path === '/api/workspace/commands'),
          `intake handoff never uploads or runs a model: ${mutations.join(', ')}`,
        );
        if (mode === 'local') {
          const snapshot = await page.evaluate(
            () =>
              new Promise((done) => {
                const request = indexedDB.open('unpermitted-workspace', 2);
                request.onsuccess = () => {
                  const db = request.result;
                  const read = db
                    .transaction('snapshots')
                    .objectStore('snapshots')
                    .get('workspace');
                  read.onsuccess = () => {
                    done(read.result);
                    db.close();
                  };
                };
              }),
          );
          assert.deepEqual(
            (snapshot as typeof saved).projects,
            saved.projects,
            'local projects are preserved',
          );
        }
        assert.deepEqual(errors, [], 'no browser exceptions');
      } finally {
        await ctx.close();
      }
      const offline = await browser.newContext();
      try {
        await offline.addInitScript('window.__name = (fn) => fn');
        await offline.addInitScript(() => {
          indexedDB.open = () => {
            throw Error('Blocked browser storage');
          };
        });
        await offline.route('**/api/**', (route) => route.fulfill({ status: 503, body: '{}' }));
        const page = await offline.newPage();
        await page.goto(`${server.url}/?auth=error`, { waitUntil: 'domcontentloaded' });
        await page.locator('#landing-title').waitFor();
        await page
          .getByRole('alert')
          .getByText(/Google sign-in failed/)
          .waitFor();
        assert.ok(
          !new URL(page.url()).searchParams.has('auth'),
          'sign-in failure is shown and consumed',
        );
        await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
        await page
          .locator('.landing-hero')
          .getByRole('button', { name: 'Try studio', exact: true })
          .click();
        await page.locator('.pf-gallery').waitFor();
        assert.ok(
          await page.locator('.pf-gallery').isVisible(),
          'public browsing works with unavailable API and blocked IndexedDB',
        );
      } finally {
        await offline.close();
      }
    }
    if (!before) {
      const { ctx, api } = await context(browser, 'mongo', true);
      try {
        // OAuth returns to /; restore even an encoded studio design URL before routing.
        await ctx.addInitScript(() =>
          sessionStorage.setItem('renovagent.return-to', '#design/project%3Afixture/2'),
        );
        const page = await ctx.newPage();
        await page.goto(server.url, { waitUntil: 'domcontentloaded' });
        await page.waitForURL('**/#design/project%3Afixture/2');
        assert.ok(
          !api.includes('/api/workspace'),
          'OAuth studio return skips the workspace aggregate',
        );
        const pending = page.waitForRequest(
          (request) => new URL(request.url()).pathname === '/api/workspace',
        );
        await page.goto(`${server.url}/#workspace`, { waitUntil: 'domcontentloaded' });
        await pending;
        await page.getByRole('link', { name: 'Return home' }).click();
        await page.locator('#landing-title').waitFor();
        await page.waitForTimeout(4200);
        assert.ok(
          await page.locator('#landing-title').isVisible(),
          'a late workspace response cannot replace the landing',
        );
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await server.close();
  }
}

await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
});
try {
  const before = process.argv.indexOf('--before');
  if (before >= 0) await run(browser, process.argv[before + 1]!, true);
  await run(browser, 'dist');
} finally {
  await browser.close();
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
