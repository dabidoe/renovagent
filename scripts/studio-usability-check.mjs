// Offline checks for the preview-attached finish toolbar. No live catalog/model calls.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({
  server: { host: '127.0.0.1', port: 8828, strictPort: true },
  logLevel: 'silent',
});
await server.listen();
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const out = '.local/studio-usability-qa';
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
    await page.goto('http://127.0.0.1:8828/#example/brooklyn', { waitUntil: 'networkidle' });
    const views = page.getByRole('tablist', { name: 'View', exact: true });
    await views.getByRole('tab', { name: 'Compare', exact: true }).click();
    const right = page.getByRole('combobox', { name: 'Compare preview', exact: true });
    const left = page.getByRole('combobox', { name: 'Compare against', exact: true });
    check((await right.inputValue()) === 'finishes', 'Compare defaults to live finishes');
    await page.locator('.pf-name-look summary').click();
    await page.getByRole('textbox', { name: 'Look name', exact: true }).fill('Sage starter');
    await page.getByRole('button', { name: 'Save as style', exact: true }).click();
    const savedKey = await right.inputValue();
    check(savedKey.startsWith('saved:'), 'Named finishes saved as a separate comparison');
    const originalPicks = await page.evaluate(() =>
      localStorage.getItem('renovagent.studio.brooklyn.picks.v1'),
    );
    await right.selectOption('rendered');
    await page.getByRole('textbox', { name: 'Look name', exact: true }).fill('Photo concept');
    await page.getByRole('button', { name: 'Save as style', exact: true }).click();
    const photoKey = await right.inputValue();
    await left.selectOption(savedKey);
    check(
      (await page.locator('.pf-comparison-choice').count()) === 2,
      'Both comparison sides selectable',
    );
    check(
      await page.getByAltText('Photo concept', { exact: true }).isVisible(),
      'Saved photo shown on right',
    );
    check(
      (await page.evaluate(() => localStorage.getItem('renovagent.studio.brooklyn.picks.v1'))) ===
        originalPicks,
      'Comparing does not apply historical picks',
    );
    await page.getByRole('textbox', { name: 'Look name', exact: true }).fill('Evening style');
    await page.getByRole('button', { name: 'Rename look', exact: true }).click();
    check(
      (await right.locator('option:checked').textContent()) === 'Evening style',
      'Saved style can be renamed',
    );
    await page.reload({ waitUntil: 'networkidle' });
    await views.getByRole('tab', { name: 'Compare', exact: true }).click();
    await right.selectOption(photoKey);
    await left.selectOption(savedKey);
    check(
      await page.getByAltText('Evening style', { exact: true }).isVisible(),
      'Named looks survive reload',
    );
    check(
      (await page
        .getByRole('button', { name: 'Fill missing demo allowances', exact: true })
        .count()) === 0,
      'Empty room list omits disabled filler',
    );
    check(
      !(await page
        .getByRole('button', { name: 'Create paint & floor work plan', exact: true })
        .isVisible()),
      'Work plan optional and collapsed',
    );
    await page.locator('.pf-comparison-choice .pf-after.is-ready').waitFor();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/compare-${width}.png`, fullPage: true });
    await views.getByRole('tab', { name: 'Furnishings', exact: true }).click();
    await page.getByRole('button', { name: 'Add Double vanity to 3D', exact: true }).click();
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem('renovagent.studio.brooklyn.placements.v1'))?.['image-03']
          ?.length === 1,
    );
    await page
      .getByRole('button', { name: 'Rotate selected object right 15 degrees', exact: true })
      .waitFor();
    const getVanity = () =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('renovagent.studio.brooklyn.placements.v1'))[
            'image-03'
          ][0],
      );
    const before = await getVanity();
    await page
      .getByRole('button', { name: 'Rotate selected object right 15 degrees', exact: true })
      .click();
    const after = await getVanity();
    check(after.rotationDeg === before.rotationDeg + 15, 'Canvas buttons rotate selected vanity');
    check(
      after.id === before.id && after.xM === before.xM && after.zM === before.zM,
      'Object rotation preserves identity and position',
    );
    await page
      .getByRole('button', { name: 'Rotate selected object left 15 degrees', exact: true })
      .click();
    check((await getVanity()).rotationDeg === before.rotationDeg, 'Object rotation reversible');
    await page.locator('.pf-3d-host canvas').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const canvas = await page.locator('.pf-3d-host canvas').boundingBox();
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + Math.min(canvas.height / 2, 250));
    const scrollBefore = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 240);
    await page.waitForFunction((previous) => scrollY > previous, scrollBefore);
    check(true, 'Wheel over canvas scrolls the page');
    const pinchHandled = await page.locator('.pf-3d-host canvas').evaluate((canvas) => {
      const event = new WheelEvent('wheel', {
        deltaY: -40,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      canvas.dispatchEvent(event);
      return event.defaultPrevented;
    });
    check(pinchHandled, 'Trackpad pinch remains handled by 3D zoom');
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
    check(
      JSON.stringify(await getVanity()) === JSON.stringify(before),
      'Zoom buttons do not change furniture',
    );
    await page.locator('.room3d-render-style summary').click();
    check(
      (await page
        .getByRole('combobox', { name: 'Rendering style', exact: true })
        .locator('option:checked')
        .textContent()) === 'Use current colors & finishes',
      'Render default describes what it does',
    );
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'No overflow',
    );
    await page.screenshot({ path: `${out}/controls-${width}.png`, fullPage: true });
    check(writes.length === 0, 'No live model/account/database mutations');
    check(errors.length === 0, `No page errors: ${errors.join('; ')}`);
    await context.close();
  }
  console.log(`${checks} offline comparison/control checks passed. Screenshots: ${out}`);
} finally {
  await browser.close();
  await server.close();
}
