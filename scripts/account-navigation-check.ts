// Offline navigation, sign-in, and saved-design discovery checks. No live API.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { emptyWorkspace, studioDesignSchema } from '../packages/contracts/src/index.js';
import { handleCommand } from '../packages/core/src/index.js';
import { uploadedOwnStudio } from '../apps/web/src/features/house-example/own-analysis.js';
const now = '2026-11-03T12:00:00.000Z';
let workspace = handleCommand(
  emptyWorkspace('local-homeowner'),
  {
    commandId: 'create',
    projectId: 'saved-room',
    baseRevision: 0,
    basePropertyRevision: 0,
    type: 'CreateProject',
    payload: {
      name: 'My saved living room',
      propertyId: 'home',
      newProperty: { name: 'My home' },
      spaces: [{ id: 'room', name: 'Living room' }],
    },
  },
  { ownerId: 'local-homeowner', now },
).state;
const snapshot = studioDesignSchema.parse({
  kind: 'studio-design',
  basis: 'owner-studio',
  project: uploadedOwnStudio({
    photos: ['a'.repeat(64)],
    plans: [],
    where: 'My saved living room',
    ceilingFt: null,
    idea: '',
  }).project,
  picks: {},
  tier: 'mid',
  inspired: {},
  styling: {},
  renderSignatures: {},
});
workspace = handleCommand(
  workspace,
  {
    commandId: 'design',
    projectId: 'saved-room',
    baseRevision: workspace.projects['saved-room']!.revision,
    type: 'ProposeArtifact',
    payload: {
      artifactId: 'saved-room:studio-design',
      supersedesRevision: 0,
      inputRefs: [],
      evidenceIds: [],
      content: snapshot,
    },
  },
  { ownerId: 'local-homeowner', now },
).state;
const server = await createServer({
  server: { host: '127.0.0.1', port: 8818, strictPort: true },
  logLevel: 'silent',
});
await server.listen();
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const out = '.local/account-navigation-check';
await mkdir(out, { recursive: true });
try {
  for (const width of [1440, 1024, 768, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript('window.__name = fn => fn');
    let signedIn = false;
    const page = await context.newPage();
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth/guest')) {
        signedIn = true;
        return route.fulfill({ json: { ok: true } });
      }
      if (path.endsWith('/session'))
        return route.fulfill({
          json: {
            mode: 'account',
            signedIn,
            user: signedIn ? { email: 'fixture@example.test', guest: true } : undefined,
            providers: ['google'],
            guests: true,
          },
        });
      if (path === '/api/workspace') return route.fulfill({ json: workspace });
      return route.fulfill({ status: 503, json: { message: 'Offline fixture' } });
    });
    await page.goto('http://127.0.0.1:8818', { waitUntil: 'networkidle' });
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    assert.deepEqual(await nav.getByRole('link').allTextContents(), [
      'Connect',
      'Studio',
      '+ New Project',
    ]);
    assert.equal(await nav.getByRole('button', { name: 'Account', exact: true }).count(), 1);
    for (const item of await nav.locator(':scope > a, :scope > button').all()) {
      assert.equal(await item.evaluate((el) => getComputedStyle(el).color), 'rgb(255, 255, 255)');
    }
    await page.screenshot({ path: `${out}/header-${width}.png` });
    for (const link of await nav.getByRole('link').all()) {
      assert.ok(
        await link.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.x >= 0 &&
            r.right <= innerWidth &&
            el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
          );
        }),
        `navigation visible and unobscured at ${width}`,
      );
    }
    await nav.getByRole('link', { name: 'Studio', exact: true }).click();
    await page.locator('.pf-gallery').waitFor();
    assert.equal(new URL(page.url()).hash, '#studio');
    assert.equal(
      await nav.getByRole('link', { name: 'Studio', exact: true }).getAttribute('aria-current'),
      'page',
    );
    await page.reload();
    await page.locator('.pf-gallery').waitFor();
    await nav.getByRole('link', { name: '+ New Project', exact: true }).click();
    await page.locator('.pf-intake').waitFor();
    assert.equal(new URL(page.url()).hash, '#new-project');
    for (const [oldHash, hash, selector] of [
      ['#examples', '#studio', '.pf-gallery'],
      ['#your-project', '#new-project', '.pf-intake'],
    ]) {
      await page.goto(`http://127.0.0.1:8818/${oldHash}`);
      await page.locator(selector).waitFor();
      assert.equal(new URL(page.url()).hash, hash);
    }
    await page.goto('http://127.0.0.1:8818');
    await page.locator('.studio-preview-open').click();
    await page.locator('.pf-gallery').waitFor();
    assert.equal(new URL(page.url()).hash, '#studio');
    await page.goBack();
    await page.locator('.studio-preview-open').waitFor();
    assert.equal(await page.locator('.studio-preview-open').innerText(), 'Try studio');
    await page.getByRole('button', { name: 'Account', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('link', { name: 'Continue with Google' }).waitFor();
    assert.equal(await dialog.locator('a[href*="auth/google"] svg').count(), 1);
    assert.ok(
      await dialog.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.x >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
      }),
    );
    await page.screenshot({ path: `${out}/sign-in-${width}.png` });
    await dialog.getByRole('button', { name: 'Continue as guest' }).click();
    await dialog.waitFor({ state: 'hidden' });
    await nav.getByRole('button', { name: 'Account', exact: true }).click();
    await dialog.getByRole('link', { name: 'Keep my projects with Google' }).waitFor();
    assert.equal(await dialog.locator('a[href*="auth/google"] svg').count(), 1);
    await dialog.getByRole('link', { name: 'Open my projects' }).click();
    await page.getByRole('heading', { name: 'My saved living room' }).waitFor();
    assert.equal(
      await page.getByRole('link', { name: 'Open design', exact: true }).getAttribute('href'),
      '#design/saved-room/1',
    );
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'My saved living room' }).waitFor();
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      `no overflow at ${width}`,
    );
    await page.screenshot({ path: `${out}/projects-${width}.png` });
    await page.evaluate(
      (project) =>
        localStorage.setItem('renovagent.own-project.v1', JSON.stringify({ project, plans: [] })),
      snapshot.project,
    );
    await page.goto('http://127.0.0.1:8818', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Start a project', exact: true }).click();
    await page.locator('.pf-studio').waitFor();
    assert.equal(
      await page.locator('.pf-intake').count(),
      0,
      'Empty start resumes the built browser studio',
    );
    assert.ok(
      await page.evaluate(() => !!localStorage.getItem('renovagent.own-project.v1')),
      'Starting does not delete the recovered studio',
    );
    await context.close();
  }
  console.log(
    'Account dialog, unobscured navigation, guest session, saved-design discovery, reload and empty-start recovery passed at 1440/1024/768/390/320 px.',
  );
} finally {
  await browser.close();
  await server.close();
}
