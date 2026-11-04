// Offline browser check: no account writes or model calls.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({
  server: { host: '127.0.0.1', port: 8832, strictPort: true },
  logLevel: 'silent',
});
await server.listen();
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const out = '.local/hutchinson-furniture-qa';
await mkdir(out, { recursive: true });
let checks = 0;
const check = (value, message) => {
  assert.ok(value, message);
  checks++;
};
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 503, json: { message: 'Offline fixture' } }),
    );
    await page.goto('http://127.0.0.1:8832/#example-house', { waitUntil: 'networkidle' });
    const scope = await page.evaluate(
      () =>
        Object.keys(localStorage)
          .find((key) => /^renovagent.studio.example-copy-.*\.placements.v1$/.test(key))
          .split('.')[2],
    );
    const read = () =>
      page.evaluate(
        (scope) => ({
          items: JSON.parse(localStorage.getItem(`renovagent.studio.${scope}.items.v1`)),
          placements: JSON.parse(localStorage.getItem(`renovagent.studio.${scope}.placements.v1`)),
        }),
        scope,
      );
    const initial = await read();
    check(initial.placements.living.length === 9, 'Nine photo furniture models seeded');
    check(
      initial.items.living.every((i) => i.action === 'keep' && i.unitAllowanceMinor === null),
      'Existing furniture has no invented purchase price',
    );
    check(
      initial.placements.living.every((p) => initial.items.living.some((i) => i.id === p.itemId)),
      'Every model linked to a room-list item',
    );
    await page
      .getByRole('tablist', { name: 'View', exact: true })
      .getByRole('tab', { name: 'Furnishings', exact: true })
      .click();
    await page.getByRole('button', { name: 'Rotate view right 45 degrees', exact: true }).waitFor();
    await page.waitForLoadState('networkidle');
    await page.locator('.pf-placement-list button').first().click();
    const right = page.getByRole('button', {
      name: 'Rotate selected object right 15 degrees',
      exact: true,
    });
    await right.click();
    await page.waitForFunction(
      (scope) =>
        JSON.parse(localStorage.getItem(`renovagent.studio.${scope}.placements.v1`)).living[0]
          .rotationDeg === -75,
      scope,
    );
    const edited = await read();
    const tools = page.getByRole('group', { name: 'Selected object rotation', exact: true });
    const beforeView = await tools.boundingBox();
    check(
      edited.placements.living[0].xM === initial.placements.living[0].xM,
      'Rotation preserves position',
    );
    await page.getByRole('button', { name: 'Top view', exact: true }).click();
    await page.locator('.pf-3d-host').screenshot({ path: `${out}/top-${width}.png` });
    const afterView = await tools.boundingBox();
    const host = await page.locator('.pf-3d-host').boundingBox();
    check(
      Math.abs(afterView.x - beforeView.x) + Math.abs(afterView.y - beforeView.y) > 5,
      'Object buttons follow camera changes',
    );
    check(
      afterView.x >= host.x &&
        afterView.y >= host.y &&
        afterView.x + afterView.width <= host.x + host.width &&
        afterView.y + afterView.height <= host.y + host.height,
      'Object buttons stay inside desktop/phone canvas',
    );
    // A click in the canvas margin clears selection and hides object buttons.
    await page
      .locator('.pf-3d-host canvas')
      .click({ position: { x: width > 500 ? 150 : 330, y: 300 } });
    check(await tools.isHidden(), 'Object buttons disappear on deselection');
    await page.getByRole('button', { name: 'Rotate view right 45 degrees', exact: true }).click();
    check(
      JSON.stringify((await read()).placements) === JSON.stringify(edited.placements),
      'Camera turn leaves furniture unchanged',
    );
    await page.getByRole('button', { name: 'Reset room view', exact: true }).click();
    await page.locator('.pf-3d-host').screenshot({ path: `${out}/room-${width}.png` });
    await page.reload({ waitUntil: 'networkidle' });
    check((await read()).placements.living[0].rotationDeg === -75, 'Edited yaw survives reload');
    // An intentionally empty prior draft stays empty until an explicit reset.
    await page.evaluate((scope) => {
      localStorage.setItem(`renovagent.studio.${scope}.items.v1`, JSON.stringify({ living: [] }));
      localStorage.setItem(
        `renovagent.studio.${scope}.placements.v1`,
        JSON.stringify({ living: [] }),
      );
    }, scope);
    await page.reload({ waitUntil: 'networkidle' });
    check((await read()).placements.living.length === 0, 'Prior empty draft retained');
    await page.locator('.pf-project-details > summary').click();
    await page.getByRole('button', { name: 'Reset room design', exact: true }).click();
    await page.getByRole('button', { name: 'Reset this room', exact: true }).click();
    await page.waitForFunction(
      (scope) =>
        JSON.parse(localStorage.getItem(`renovagent.studio.${scope}.placements.v1`)).living
          .length === 9,
      scope,
    );
    check(
      (await read()).placements.living[0].rotationDeg === -75,
      'Reset restores the private copy opening orientation',
    );
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'No horizontal overflow',
    );
    check(errors.length === 0, errors.join('\n'));
    await context.close();
  }
  console.log(`${checks} Hutchinson furniture checks passed. Screenshots: ${out}`);
} finally {
  await browser.close();
  await server.close();
}
