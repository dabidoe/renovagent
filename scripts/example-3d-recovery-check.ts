// Built-site stale-chunk regression. All API requests are offline fixtures.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { serveStatic } from '../apps/api/src/hosting.js';

const out = '.local/example-3d-recovery';
await mkdir(out, { recursive: true });
const server = createServer((req, res) => {
  void serveStatic(resolve('dist'), req, res).then((served) => {
    if (!served) {
      res.writeHead(404);
      res.end();
    }
  });
});
await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
const address = server.address();
assert.ok(address && typeof address !== 'string');
const base = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
let checks = 0;
try {
  for (const width of [1440, 390]) {
    for (const [index, id] of ['studio-lounge', 'studio-office', 'studio-dining'].entries()) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript('window.__name = fn => fn');
      await page.route('**/api/**', (route) =>
        route.fulfill({ status: 503, json: { message: 'Offline fixture' } }),
      );
      const broken = index % 2 ? '**/assets/furniture-assets-*.js' : '**/assets/room-scene-*.js';
      await page.route(broken, (route) =>
        route.fulfill({ status: 404, contentType: 'text/plain', body: 'Removed deployment chunk' }),
      );
      const hash = `#example/${id}`;
      await page.goto(base + '/' + hash, { waitUntil: 'networkidle' });
      // Make a real browser draft edit before the failure; a failed workspace
      // sync must not lose it when the user reloads to get the latest assets.
      await page.getByRole('button', { name: 'Edit room measurements', exact: true }).click();
      await page.getByRole('textbox', { name: 'Width in feet', exact: true }).fill('17');
      await page.locator('form.pf-size').getByRole('button', { name: 'Set', exact: true }).click();
      await page.getByRole('button', { name: 'Retry workspace sync', exact: true }).waitFor();
      const draft = await page.evaluate(() => {
        const scope = history.state.renovagentExampleCopy.scope;
        const key = `renovagent.studio.${scope}.saved.v1.draft`;
        return { key, value: localStorage.getItem(key) };
      });
      assert.ok(draft.value?.includes('17'));
      const furnishings = () =>
        page
          .getByRole('tablist', { name: 'View', exact: true })
          .getByRole('tab', { name: 'Furnishings', exact: true });
      await furnishings().click();
      const alert = page.locator('.pf-3d-host').getByRole('alert');
      await alert.waitFor();
      assert.match(await alert.innerText(), /3D viewer couldn’t load/);
      const reload = alert.getByRole('button', { name: 'Reload viewer', exact: true });
      await reload.scrollIntoViewIfNeeded();
      assert.ok(
        await reload.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }),
      );
      await page.screenshot({ path: `${out}/${id}-${width}-failed.png` });
      await page.unroute(broken);
      await Promise.all([page.waitForEvent('load'), reload.click()]);
      assert.equal(new URL(page.url()).hash, hash);
      assert.equal(await page.evaluate((key) => localStorage.getItem(key), draft.key), draft.value);
      await furnishings().click();
      const canvas = page.locator('.pf-3d-host canvas');
      await canvas.waitFor();
      await page.getByRole('button', { name: 'Top view', exact: true }).waitFor();
      await page.waitForFunction(() => {
        const source = document.querySelector<HTMLCanvasElement>('.pf-3d-host canvas');
        if (!source?.width || !source.height) return false;
        const sample = document.createElement('canvas');
        sample.width = sample.height = 32;
        const ctx = sample.getContext('2d')!;
        ctx.drawImage(source, 0, 0, 32, 32);
        const pixels = ctx.getImageData(0, 0, 32, 32).data;
        const colors = new Set<string>();
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i + 3]) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
        return colors.size > 20;
      });
      assert.equal(await page.locator('.pf-3d-host [role="alert"]').count(), 0);
      assert.deepEqual(errors, []);
      await canvas.screenshot({ path: `${out}/${id}-${width}-recovered.png` });
      console.log(`PASS ${id} at ${width}px: 404 shown, reload keeps draft, room renders`);
      checks++;
      await page.close();
    }
  }
  console.log(`${checks} built-site 3D failure/recovery scenarios passed. Captures: ${out}`);
} finally {
  await browser.close();
  await new Promise<void>((done) => server.close(() => done()));
}
