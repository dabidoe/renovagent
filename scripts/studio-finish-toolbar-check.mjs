// Offline checks for the preview-attached finish toolbar. No live catalog/model calls.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({
  server: { host: '127.0.0.1', port: 8826, strictPort: true },
  logLevel: 'silent',
});
await server.listen();
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const out = '.local/finish-toolbar-qa';
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
    await page.goto('http://127.0.0.1:8826/#example/brooklyn', { waitUntil: 'networkidle' });
    const toolbar = page.getByRole('group', { name: 'Preview tools', exact: true });
    const views = page.getByRole('tablist', { name: 'View', exact: true });
    check(await toolbar.isVisible(), 'Toolbar visible with collapsed large controls');
    check(
      await toolbar.evaluate((el) => !!el.closest('.pf-stage')),
      'Toolbar attached to room preview',
    );
    check((await page.locator('.pf-finish-popover').count()) === 0, 'Panels initially collapsed');
    await toolbar.getByRole('button', { name: /^Paint(?: |$)/ }).click();
    const paint = page.getByRole('region', { name: 'Preview paint selector', exact: true });
    await paint
      .getByRole('button', { name: 'Fixture Paint Sage fixture F1', exact: true })
      .waitFor();
    check(
      await paint.getByRole('textbox', { name: 'Search paint colors' }).isVisible(),
      'Full catalog opens directly',
    );
    check(
      await paint.getByRole('combobox', { name: 'Paint brand' }).isVisible(),
      'Brand filters available',
    );
    check(
      (await views
        .getByRole('tab', { name: 'Compare', exact: true })
        .getAttribute('aria-selected')) === 'true',
      'Paint opens live Compare',
    );
    await paint.getByRole('button', { name: 'Fixture Paint Sage fixture F1', exact: true }).click();
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem('renovagent.studio.brooklyn.picks.v1'))?.['image-03']?.color
          ?.code === 'F1',
    );
    check(
      await page.locator('.pf-compare canvas').isVisible(),
      'Live finish canvas remains visible despite existing generated image',
    );
    check(
      (await page.getByRole('combobox', { name: 'Compare preview' }).inputValue()) === 'finishes',
      'Finish edits use live preview',
    );
    check(
      (await toolbar.getByRole('button', { name: /^Paint(?: |$)/ }).textContent()).includes(
        'Sage fixture',
      ),
      'Toolbar displays selected paint',
    );
    await paint.getByRole('textbox', { name: 'Search paint colors' }).fill('sage');
    await toolbar.getByRole('button', { name: /^Floor(?: |$)/ }).click();
    check(!(await paint.isVisible()), 'Opening Floor closes Paint');
    const floor = page.getByRole('region', { name: 'Preview floor selector', exact: true });
    await floor.getByRole('button', { name: 'Dark walnut', exact: true }).click();
    check(
      (await floor
        .getByRole('button', { name: 'Dark walnut', exact: true })
        .getAttribute('aria-pressed')) === 'true',
      'Floor selection updates',
    );
    check(
      (await views
        .getByRole('tab', { name: 'Compare', exact: true })
        .getAttribute('aria-selected')) === 'true',
      'Floor edits keep Compare',
    );
    await page.getByRole('combobox', { name: 'Compare preview' }).selectOption('rendered');
    check(
      await page.locator('.pf-compare-pair').isVisible(),
      'Generated comparison remains available explicitly',
    );
    await toolbar.getByRole('button', { name: /^Paint(?: |$)/ }).click();
    check(
      await page.locator('.pf-compare canvas').isVisible(),
      'Returning to Paint restores live finishes',
    );
    await paint.press('Escape');
    check((await page.locator('.pf-finish-popover').count()) === 0, 'Escape collapses panel');
    await toolbar.getByRole('button', { name: /^Paint(?: |$)/ }).click();
    check(
      await page.getByRole('region', { name: 'Preview paint selector' }).isVisible(),
      'Panel reopens',
    );
    const overflow = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      elements: [...document.querySelectorAll('.pf-studio *')]
        .filter(
          (el) =>
            el.getBoundingClientRect().right > innerWidth + 1 &&
            el.getBoundingClientRect().width > 0,
        )
        .slice(0, 10)
        .map((el) => ({
          tag: el.tagName,
          cls: el.className,
          right: el.getBoundingClientRect().right,
          width: el.getBoundingClientRect().width,
        })),
    }));
    check(overflow.scroll <= width, `No horizontal overflow: ${JSON.stringify(overflow)}`);
    await page.screenshot({ path: `${out}/paint-${width}.png`, fullPage: true });
    await toolbar.getByRole('button', { name: 'Furnishings', exact: true }).click();
    await page.locator('.pf-3d-host canvas').waitFor();
    check(
      (await views
        .getByRole('tab', { name: 'Furnishings', exact: true })
        .getAttribute('aria-selected')) === 'true',
      'Furnishings opens the 3D placement view',
    );
    check(
      await page.getByRole('button', { name: 'Add Lounge sofa to 3D', exact: true }).isVisible(),
      'Furniture library opens directly',
    );
    check(
      !(await page.getByRole('region', { name: 'Ideas for your room', exact: true }).isVisible()),
      'Photo ideas are secondary, not the furnishing entry',
    );
    check(writes.length === 0, 'No generation, account or database mutations');
    check(errors.length === 0, `No runtime errors: ${errors.join('; ')}`);
    await context.close();
  }
  console.log(`${checks} offline finish toolbar checks passed. Screenshots: ${out}`);
} finally {
  await browser.close();
  await server.close();
}
