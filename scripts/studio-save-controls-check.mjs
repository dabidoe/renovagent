// Offline checks for the preview-attached finish toolbar. No live catalog/model calls.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({
  server: { host: '127.0.0.1', port: 8829, strictPort: true },
  logLevel: 'silent',
});
await server.listen();
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const out = '.local/studio-save-qa';
await mkdir(out, { recursive: true });
let checks = 0;
const check = (value, message) => {
  assert.ok(value, message);
  checks++;
};
try {
  for (const width of [1440, 1024, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    const errors = [],
      writes = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      window.__name = (fn) => fn;
      localStorage.setItem(
        'renovagent.studio.brooklyn.inspired.v1',
        JSON.stringify({ 'image-03': '/examples/brooklyn/image-03-lvp.jpg' }),
      );
    });
    await page.route('**/api/**', (route) => {
      if (route.request().method() !== 'GET') writes.push(route.request().url());
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/paint/colors'))
        return route.fulfill({
          json: {
            total: 2,
            brands: [{ brand: 'Fixture Paint', count: 2 }],
            colors: [
              {
                id: 'fixture-1',
                name: 'Sage fixture',
                brand: 'Fixture Paint',
                code: 'F1',
                collection: 'Offline',
                family: 'green',
                hex: '#899b80',
              },
              {
                id: 'fixture-2',
                name: 'White fixture',
                brand: 'Fixture Paint',
                code: 'F2',
                collection: 'Offline',
                family: 'white',
                hex: '#eee9df',
              },
            ],
          },
        });
      return route.fulfill({ status: 503, json: { message: 'Offline UI fixture' } });
    });
    await page.goto('http://127.0.0.1:8829/#example/brooklyn', { waitUntil: 'networkidle' });
    const views = page.getByRole('tablist', { name: 'View', exact: true });
    const saveControls = page.getByRole('group', { name: 'Save and compare', exact: true });
    await page.getByText('Autosaved in this browser', { exact: true }).waitFor();
    check(writes.length === 0, 'Browsing does not create a workspace project');
    const positions = await page.evaluate(() => ({
      menu: document.querySelector('.pf-top-save-controls').getBoundingClientRect(),
      canvas: document.querySelector('.pf-inspired-stage, .pf-compare').getBoundingClientRect(),
      estimate: document.querySelector('.pf-total').getBoundingClientRect(),
    }));
    check(
      positions.menu.bottom <= positions.canvas.top + 2,
      'Save/compare controls appear above the image',
    );
    check(positions.menu.top >= positions.estimate.top, 'Save controls grouped near estimate');
    await saveControls.getByRole('button', { name: 'Save look', exact: true }).click();
    check(
      (await views
        .getByRole('tab', { name: 'Compare', exact: true })
        .getAttribute('aria-selected')) === 'true',
      'Top Save look opens Compare',
    );
    const name = page.getByRole('textbox', { name: 'Look name', exact: true });
    check(await name.isVisible(), 'Naming controls open directly');
    await name.fill('Top menu look');
    await page.getByRole('button', { name: 'Save as style', exact: true }).click();
    await page.getByText('Autosaved in this browser', { exact: true }).waitFor();
    check(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('renovagent.studio.brooklyn.saved.v1.draft'))
            .comparisonStyles['image-03'][0].name === 'Top menu look',
      ),
      'Named look captured in browser autosave',
    );
    await page.reload({ waitUntil: 'networkidle' });
    await views.getByRole('tab', { name: 'Compare', exact: true }).click();
    check(
      (await page
        .getByRole('combobox', { name: 'Compare preview', exact: true })
        .locator('option')
        .filter({ hasText: 'Top menu look' })
        .count()) === 1,
      'Browser-saved look survives reload',
    );
    const sent = [];
    let failSync = false;
    await page.route('**/api/workspace/studio-designs', async (route) => {
      const input = route.request().postDataJSON();
      sent.push(input);
      if (failSync)
        return route.fulfill({ status: 503, json: { message: 'Fixture sync unavailable' } });
      return route.fulfill({
        json: {
          projectId: 'fixture-project',
          revision: input.expectedRevision + 1,
          artifactRef: {
            kind: 'artifact',
            id: 'fixture-project:studio-design',
            revision: input.expectedRevision + 1,
          },
          snapshot: input.snapshot,
        },
      });
    });
    await saveControls.getByRole('button', { name: 'Save to workspace', exact: true }).click();
    await page.getByText('Autosaved to workspace', { exact: true }).waitFor();
    check(
      sent.length === 1 && sent[0].expectedRevision === 0,
      'Initial workspace save is explicit',
    );
    check(
      (await saveControls
        .getByRole('button', { name: 'Save to workspace', exact: true })
        .count()) === 0,
      'Repeated manual Save button unnecessary after linking',
    );
    await page
      .getByRole('group', { name: 'Preview tools', exact: true })
      .getByRole('button', { name: /^Floor(?: |$)/ })
      .click();
    await page.getByRole('button', { name: 'Dark walnut', exact: true }).click();
    await page.waitForFunction(
      () => JSON.parse(localStorage.getItem('renovagent.studio.brooklyn.saved.v1'))?.revision === 2,
    );
    check(
      sent.length === 2 && sent[1].expectedRevision === 1,
      'Following edits autosave a revision without another click',
    );
    let scopeRequest;
    await page.route('**/api/workspace/studio-designs/prepare-scope', async (route) => {
      scopeRequest = route.request().postDataJSON();
      const valid =
        Object.keys(scopeRequest).sort().join(',') === 'projectId,requestId,revision,roomId';
      return route.fulfill({
        status: valid ? 200 : 400,
        json: valid
          ? {
              markdown: '# Fixture proposed handoff\nNot for construction.',
              coverage: 'Fixture coverage',
              sourceRevision: scopeRequest.revision,
              roomId: scopeRequest.roomId,
              questions: [],
              checks: [],
            }
          : { message: 'Request failed schema validation' },
      });
    });
    await page.getByText('Optional paint & floor work plan', { exact: true }).click();
    await page.getByRole('button', { name: 'Create paint & floor work plan', exact: true }).click();
    await page.getByRole('button', { name: 'Download work plan', exact: true }).waitFor();
    check(
      scopeRequest.projectId === 'fixture-project' && scopeRequest.revision === 2,
      'Work plan uses saved project/revision after a full API save response',
    );
    check(
      Object.keys(scopeRequest).length === 4,
      'Strict work-plan request excludes snapshot/artifact metadata',
    );
    failSync = true;
    await page.getByRole('button', { name: 'Keep', exact: true }).click();
    await page.getByText('Workspace sync failed · browser copy saved', { exact: true }).waitFor();
    check(
      await saveControls
        .getByRole('button', { name: 'Retry workspace sync', exact: true })
        .isVisible(),
      'Sync failure exposes retry beside estimate',
    );
    const failedRequest = sent.at(-1);
    failSync = false;
    await saveControls.getByRole('button', { name: 'Retry workspace sync', exact: true }).click();
    await page.getByText('Autosaved to workspace', { exact: true }).waitFor();
    check(
      sent.at(-1).requestId === failedRequest.requestId,
      'Retry replays the pending validated request',
    );
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'Top menu fits viewport',
    );
    await page.screenshot({ path: `${out}/top-save-${width}.png`, fullPage: true });
    check(errors.length === 0, `No page errors: ${errors.join('; ')}`);
    await context.close();
  }
  console.log(`${checks} offline top-save/autosave checks passed. Screenshots: ${out}`);
} finally {
  await browser.close();
  await server.close();
}
