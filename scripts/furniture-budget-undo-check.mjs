// Offline UI check: demo budgets, reversible edits, room reset and persistence.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const out = '.local/furniture-budget-undo';
await mkdir(out, { recursive: true });
const server = await createServer({
  server: { host: '127.0.0.1', port: 8822, strictPort: true },
  logLevel: 'silent',
});
await server.listen();
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    const mutations = [];
    await page.route('**/api/**', (route) => {
      if (route.request().method() !== 'GET') mutations.push(route.request().url());
      return route.fulfill({ status: 503, json: { message: 'Offline UI fixture' } });
    });
    await page.goto('http://127.0.0.1:8822/#examples', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Furnished concepts' }).waitFor();
    await page.screenshot({ path: `${out}/gallery-${width}.png` });
    await page.getByRole('button', { name: /Slow Sunday.*1,115/ }).click();
    const plan = page.getByRole('region', { name: 'Plan and budget', exact: true });
    const sofa = plan
      .locator('.pf-room-item')
      .filter({ has: page.locator('input[aria-label="Item name: Cream sofa"]') });
    const allowance = sofa.getByRole('textbox', { name: 'Allowance each · $', exact: true });
    await sofa.locator('summary').first().click();
    await allowance.waitFor();
    assert.equal(await allowance.inputValue(), '600');
    await allowance.fill('777');
    await sofa.getByText('Your allowance', { exact: true }).waitFor();
    await page.locator('.pf-project-details > summary').click();
    await page
      .getByRole('group', { name: 'Design edit history' })
      .getByRole('button', { name: 'Undo', exact: true })
      .click();
    await sofa.getByText('Demo allowance', { exact: true }).waitFor();
    assert.equal(await allowance.inputValue(), '600');
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await sofa.getByText('Your allowance', { exact: true }).waitFor();
    assert.equal(await allowance.inputValue(), '777');
    const photo = await page.locator('.pf-views').count();
    await page.getByRole('button', { name: 'Reset room design', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Reset this room', exact: true })
      .click();
    await sofa.getByText('Demo allowance', { exact: true }).waitFor();
    assert.equal(await allowance.inputValue(), '600');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await sofa.getByText('Your allowance', { exact: true }).waitFor();
    assert.equal(await allowance.inputValue(), '777');
    assert.equal(await page.locator('.pf-views').count(), photo);
    const before = await plan.locator('.pf-room-item').count();
    await sofa.getByRole('button', { name: 'Remove Cream sofa', exact: true }).click();
    assert.equal(await plan.locator('.pf-room-item').count(), before - 1);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.equal(await plan.locator('.pf-room-item').count(), before);
    await page.getByRole('button', { name: 'Shopping list', exact: true }).click();
    await page.getByText(/Demo and owner allowances, not retailer quotes/).waitFor();
    await page.getByRole('button', { name: 'Close', exact: true }).first().click();
    await page.reload({ waitUntil: 'networkidle' });
    await sofa.locator('summary').first().click();
    await allowance.waitFor();
    await sofa.getByText('Your allowance', { exact: true }).waitFor();
    assert.equal(await allowance.inputValue(), '777');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `${out}/studio-${width}.png` });
    await page
      .getByRole('tablist', { name: 'View', exact: true })
      .getByRole('tab', { name: 'Furnishings', exact: true })
      .click();
    await page.getByRole('button', { name: 'Add / edit furniture', exact: true }).click();
    const sofaTile = page.getByRole('button', { name: 'Add Lounge sofa to 3D', exact: true });
    await sofaTile.scrollIntoViewIfNeeded();
    await sofaTile.getByText('$600 · demo', { exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `${out}/library-${width}.png` });
    assert.equal(mutations.length, 0, 'No generation, account or database writes');
    await context.close();
  }
  console.log(
    'Demo budgets, owner edits, undo/redo, reversible reset, item/layout restoration and reload pass at desktop/390/320 px.',
  );
} finally {
  await browser.close();
  await server.close();
}
