// Local Mongo + real HTTP/browser workflow; fixture photos, no inference or live data.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { MongoClient } from 'mongodb';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { localHosting } from '../apps/api/src/hosting.js';
import { MongoWorkspaceRepository } from '../apps/api/src/repository.js';
import { AccountService } from '../apps/api/src/accounts.js';
import { DesignImageStore } from '../apps/api/src/design-images.js';
import { createWorkspaceServer } from '../apps/api/src/server.js';
const mongo = await new MongoClient('mongodb://127.0.0.1:27018').connect();
const db = mongo.db(`renovagent_guest_browser_${randomUUID().replaceAll('-', '')}`);
const repository = MongoWorkspaceRepository.forDb(db);
const { server } = await createWorkspaceServer(
  repository,
  'guest-browser-test',
  false,
  new AccountService(db, {}),
  undefined,
  undefined,
  { images: new DesignImageStore(db) },
  { ...localHosting, staticDir: resolve('dist') },
);
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const address = server.address();
if (!address || typeof address === 'string') throw Error('No API listener');
const base = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const out = '.local/guest-sharing-qa';
await mkdir(out, { recursive: true });
let checks = 0;
const check = (ok: unknown, message: string) => {
  assert.ok(ok, message);
  checks++;
};
try {
  for (const width of [1440, 390, 320]) {
    const owner = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await owner.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base + '/#example/brooklyn', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Share project', exact: true }).click();
    const input = page.getByRole('textbox', { name: 'Shareable project link' });
    await input.waitFor();
    const hash = new URL(await input.inputValue()).hash;
    check(/^#share\/[A-Za-z0-9_-]{43}$/.test(hash), 'Sharing creates a durable link');
    check(
      await page.getByRole('button', { name: 'Limited guest', exact: true }).isVisible(),
      'Saving creates a guest automatically',
    );
    await page.screenshot({ path: `${out}/owner-${width}.png`, fullPage: true });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('textbox', { name: 'Shareable project link' }).waitFor();
    check(
      new URL(await page.getByRole('textbox', { name: 'Shareable project link' }).inputValue())
        .hash === hash,
      'Owner recovers the share link and revocation control after reload',
    );
    const viewer = await browser.newContext({ viewport: { width, height: 1000 } });
    const view = await viewer.newPage();
    view.on('pageerror', (e) => errors.push(e.message));
    await view.goto(base + '/' + hash, { waitUntil: 'networkidle' });
    await view.getByRole('heading', { name: '621 E 43rd St', exact: true }).waitFor();
    check((await viewer.cookies()).length === 0, 'Viewing needs no account cookie');
    check(
      await view.getByRole('button', { name: 'Save a copy & edit', exact: true }).isVisible(),
      'Viewer can make an editable copy',
    );
    check(
      await view
        .locator('.shared-room img')
        .first()
        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
      'Shared photo loads',
    );
    check(
      await view.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      'Shared page fits viewport',
    );
    await view.screenshot({ path: `${out}/viewer-${width}.png`, fullPage: true });
    await view.getByRole('button', { name: 'Save a copy & edit', exact: true }).click();
    await view.locator('.pf-studio').waitFor();
    check(
      new URL(view.url()).hash.startsWith('#design/'),
      'Copy opens a persisted editable design',
    );
    await view.reload({ waitUntil: 'networkidle' });
    await view.locator('.pf-studio').waitFor();
    check(
      await view.getByRole('button', { name: 'Limited guest', exact: true }).isVisible(),
      'Guest copy survives reload',
    );
    await page.getByRole('button', { name: 'Stop sharing this link', exact: true }).click();
    await input.waitFor({ state: 'hidden' });
    const anonymous = await viewer.newPage();
    await anonymous.goto(base + '/' + hash, { waitUntil: 'networkidle' });
    check(await anonymous.getByRole('alert').isVisible(), 'Revoked link stops opening');
    await view.reload({ waitUntil: 'networkidle' });
    await view.locator('.pf-studio').waitFor();
    check(true, 'Saved copy survives original share revocation');
    check(errors.length === 0, `No browser errors: ${errors.join('; ')}`);
    await owner.close();
    await viewer.close();
  }
  console.log(`${checks} local guest sharing browser checks passed. Screenshots: ${out}`);
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await db.dropDatabase();
  await mongo.close();
}
