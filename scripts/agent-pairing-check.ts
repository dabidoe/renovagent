// Offline browser checks for the owner approval UI. Intercepts every API call;
// no accounts, keys, model calls or production data are created.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { serveStatic } from '../apps/api/src/hosting.js';
const out = '.local/agent-pairing-check';
await mkdir(out, { recursive: true });
const server = createServer((req, res) => {
  void serveStatic(resolve('dist'), req, res).then((ok) => {
    if (!ok) {
      res.writeHead(404);
      res.end();
    }
  });
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const address = server.address();
if (!address || typeof address === 'string') throw Error('No address');
const base = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
let assertions = 0;
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript('window.__name = (fn) => fn');
    // An unfinished intake must not hijack an authorization link.
    await context.addInitScript(() =>
      sessionStorage.setItem('renovagent.project-brief', 'Pending room brief'),
    );
    let signedIn = false;
    let approvals = 0;
    let allow: boolean | undefined;
    await context.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      let value: unknown;
      if (path.endsWith('/session'))
        value = {
          mode: 'account',
          signedIn,
          user: signedIn ? { email: 'owner@example.test' } : undefined,
          guests: true,
          providers: ['google'],
        };
      else if (path.endsWith('/auth/guest')) {
        signedIn = true;
        value = { ok: true };
      } else if (path.includes('/agent-pairing/')) {
        if (route.request().method() === 'POST') {
          approvals++;
          allow = route.request().postDataJSON().approve;
          value = { redirect: base + '/#returned-to-agent' };
        } else
          value = {
            name: 'Muse test agent',
            callback: 'https://agent.example.test/callback',
            access: 'propose',
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
          };
      } else {
        await route.fulfill({ status: 503, json: { message: 'Offline fixture' } });
        return;
      }
      await route.fulfill({ json: value });
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base + '/#connect/approve/' + 'a'.repeat(43));
    await page.getByRole('heading', { name: 'Choose your Renovagent workspace.' }).waitFor();
    assert.equal(approvals, 0);
    assertions++;
    assert.equal(
      await page.getByRole('button', { name: 'Approve connection', exact: true }).count(),
      0,
    );
    assertions++;
    assert.ok(page.url().includes('#connect/approve/'));
    assertions++;
    await page.getByRole('button', { name: 'Continue as guest', exact: true }).click();
    await page
      .getByRole('heading', { name: 'Allow Muse test agent to access your workspace?' })
      .waitFor();
    assert.equal(approvals, 0);
    assertions++;
    assert.equal(await page.getByText('owner@example.test', { exact: true }).count(), 1);
    assertions++;
    assert.ok(
      await page.getByText('https://agent.example.test/callback', { exact: true }).isVisible(),
    );
    assertions++;
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    assertions++;
    await page.screenshot({ path: `${out}/approval-${width}.png`, fullPage: true });
    if (width === 320) {
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.waitForURL('**/#returned-to-agent');
      assert.equal(allow, false);
      assertions++;
    } else {
      await page.getByRole('button', { name: 'Approve connection', exact: true }).click();
      await page.waitForURL('**/#returned-to-agent');
      assert.equal(allow, true);
      assertions++;
    }
    assert.equal(approvals, 1);
    assert.deepEqual(errors, []);
    assertions += 2;
    await context.close();
  }
  // Expired request has no approval button and shows recovery.
  const context = await browser.newContext();
  await context.addInitScript('window.__name = (fn) => fn');
  await context.route('**/api/**', (route) =>
    route.fulfill(
      route.request().url().endsWith('/session')
        ? { json: { mode: 'account', signedIn: true, user: { email: 'owner@example.test' } } }
        : {
            status: 404,
            json: {
              code: 'NOT_FOUND',
              message: 'Pairing request expired. Start connecting again in your agent.',
            },
          },
    ),
  );
  const page = await context.newPage();
  await page.goto(base + '/#connect/approve/' + 'b'.repeat(43));
  await page.getByRole('alert').waitFor();
  assert.match(await page.getByRole('alert').innerText(), /expired/);
  assertions++;
  assert.equal(
    await page.getByRole('button', { name: 'Approve connection', exact: true }).count(),
    0,
  );
  assertions++;
  await context.close();
  console.log(`${assertions} pairing browser assertions passed. Screenshots: ${out}`);
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
}
