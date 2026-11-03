// Offline checks for the preview-attached finish toolbar. No live catalog/model calls.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({
  server: { host: '127.0.0.1', port: 8827, strictPort: true },
  logLevel: 'silent',
});
await server.listen();
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const out = '.local/furnishings-qa';
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
    await page.goto('http://127.0.0.1:8827/#example/brooklyn', { waitUntil: 'networkidle' });
    const views = page.getByRole('tablist', { name: 'View', exact: true });
    await views.getByRole('tab', { name: 'Furnishings', exact: true }).click();
    await page.locator('.pf-3d-host canvas').waitFor();
    check(
      (await page.getByRole('button', { name: 'Move furniture', exact: true }).count()) === 0,
      'No Move mode toggle',
    );
    check(
      (await page.getByRole('button', { name: 'Rotate view', exact: true }).count()) === 0,
      'No Rotate mode toggle',
    );
    const camera = page.getByRole('group', { name: 'Room camera', exact: true });
    check(
      await camera.evaluate(
        (el) => el.getBoundingClientRect().height > el.getBoundingClientRect().width * 2,
      ),
      'Compact vertical camera toolbar',
    );
    const details = page.locator('.pf-3d-basis');
    check((await details.getAttribute('open')) === null, 'Room caveat collapsed below canvas');
    const placements = () =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('renovagent.studio.brooklyn.placements.v1'))?.[
            'image-03'
          ] ?? [],
      );
    await page.getByRole('button', { name: 'Add Living room starter', exact: true }).click();
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem('renovagent.studio.brooklyn.placements.v1'))?.['image-03']
          ?.length === 5,
    );
    const first = await placements();
    check(
      first.some((p) => p.assetId === 'sofa') && first.some((p) => p.assetId === 'coffee-table'),
      'Living room set placed',
    );
    check(
      await page.getByRole('button', { name: 'Add Living room starter', exact: true }).isDisabled(),
      'Repeated preset does not duplicate pieces',
    );
    await page.getByRole('button', { name: 'Add Study starter', exact: true }).click();
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem('renovagent.studio.brooklyn.placements.v1'))?.['image-03']
          ?.length === 8,
    );
    const afterStudy = await placements();
    check(
      first.every(
        (p) => JSON.stringify(p) === JSON.stringify(afterStudy.find((other) => other.id === p.id)),
      ),
      'Presets preserve existing positions, sizes and IDs',
    );
    await page.getByRole('button', { name: 'Add Bedroom starter', exact: true }).click();
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem('renovagent.studio.brooklyn.placements.v1'))?.['image-03']
          ?.length === 9,
    );
    check(
      (await placements()).some((p) => p.assetId === 'bed'),
      'Bedroom set placed without removing other pieces',
    );
    await page.locator('.pf-project-details > summary').click();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    check((await placements()).length === 8, 'Preset is one undoable edit');
    await page.locator('.pf-project-details > summary').click();
    await page.locator('.room3d-render-style summary').click();
    const style = page.getByRole('combobox', { name: 'Rendering style', exact: true });
    await style.selectOption({ label: 'Warm & cozy' });
    const arranged = await placements();
    check(arranged.length === 8, 'Render style preserves furniture');
    check(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem('renovagent.studio.brooklyn.model-renders.v1.styles'))?.[
          'image-03'
        ]?.startsWith('Warm and cozy'),
      ),
      'Render style persists with the room',
    );
    if (width === 1440) {
      await page.getByRole('button', { name: 'Top view', exact: true }).click();
      await page.waitForTimeout(300);
      const sofa = arranged.find((p) => p.assetId === 'sofa');
      const box = await page.locator('.pf-3d-host canvas').boundingBox();
      const barWidth = await camera.evaluate((el) => el.getBoundingClientRect().width);
      const widthM = 12 * 0.3048,
        depthM = 18 * 0.3048,
        heightM = 8 * 0.3048;
      const reserved = Math.min((barWidth + 24) / box.width, 0.35);
      const halfFov = Math.tan((20 * Math.PI) / 180);
      const distance =
        (Math.max(depthM, widthM / ((1 - reserved) * (box.width / box.height))) / (2 * halfFov)) *
          1.1 +
        heightM;
      const pixelsPerM = box.height / (2 * (distance - sofa.heightM) * halfFov);
      const x = box.x + box.width / 2 + (sofa.xM - widthM / 2) * pixelsPerM;
      const y = box.y + box.height / 2 + (sofa.zM - depthM / 2) * pixelsPerM;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 35, y + 20, { steps: 10 });
      await page.mouse.up();
      await page.waitForFunction(
        ({ id, xM, zM }) =>
          JSON.parse(localStorage.getItem('renovagent.studio.brooklyn.placements.v1'))[
            'image-03'
          ].some((p) => p.id === id && (p.xM !== xM || p.zM !== zM)),
        sofa,
      );
      check(true, 'Dragging furniture works immediately without a mode toggle');
    }
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'No overflow',
    );
    await page.screenshot({ path: `${out}/furnishings-${width}.png`, fullPage: true });
    check(writes.length === 0, 'No model or database calls while furnishing');
    check(errors.length === 0, `No runtime errors: ${errors.join('; ')}`);
    await context.close();
  }
  console.log(`${checks} offline furnishings checks passed. Screenshots: ${out}`);
} finally {
  await browser.close();
  await server.close();
}
