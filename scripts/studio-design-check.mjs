// Offline photo-design → furnished 3D regression check. All API requests use fixtures.
// Run: node scripts/studio-design-check.mjs (CHROME_PATH selects an installed browser).
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const out = '.local/room-design-qa';
await mkdir(out, { recursive: true });
const server = await createServer({
  server: { host: '127.0.0.1', port: 8812, strictPort: true },
  logLevel: 'silent',
});
await server.listen();
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const photo = await readFile('public/examples/brooklyn/image-03-lvp.jpg');
const sourceSha = 'a'.repeat(64),
  designSha = 'b'.repeat(64),
  renderSha = 'c'.repeat(64);
let checks = 0;
function check(ok, message) {
  assert.ok(ok, message);
  checks++;
}
try {
  for (const width of [1440, 1024, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    const errors = [],
      models = [];
    let restyles = 0,
      renderInput;
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      if (r.url().endsWith('.glb')) models.push(r.status());
    });
    await page.addInitScript(() => {
      window.__name = (fn) => fn;
    });
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.includes('/design-images/'))
        return route.fulfill({ contentType: 'image/jpeg', body: photo });
      if (path.endsWith('/studio/photo')) return route.fulfill({ json: { sha256: sourceSha } });
      if (path.endsWith('/studio/ideas'))
        return route.fulfill({
          json: {
            observations: ['Fixture photo observation; not a measured fact.'],
            directions: ['Warm lounge', 'Reading room', 'Gather together'].map((title, i) => ({
              id: `fixture-${i}`,
              title,
              description: 'A local fixture direction for checking the wide card layout.',
              why: 'Uses the same room photo without inventing dimensions or products.',
              brief: `Fixture direction ${i}: cream sofa, coffee table, striped rug and floor lamp.`,
              palette: ['#e4d6c2', '#b6c1b3', '#805b43'],
              assets: ['sofa', 'coffee-table', 'rug'],
            })),
          },
        });
      if (path.endsWith('/studio/restyle')) {
        restyles++;
        return route.fulfill({
          json: {
            sha256: designSha,
            changes: [
              { target: 'Empty seating area', becomes: 'Cream linen sofa' },
              { target: 'Bare floor', becomes: 'Striped area rug' },
              { target: 'No table', becomes: 'Walnut coffee table' },
              { target: 'No lamp', becomes: 'Brass floor lamp' },
              { target: 'No wall art', becomes: 'Framed artwork' },
            ],
          },
        });
      }
      if (path.endsWith('/studio/model-render')) {
        renderInput = route.request().postDataJSON();
        return route.fulfill({
          json: { sha256: renderSha, model: 'fixture', note: 'Local UI fixture' },
        });
      }
      return route.fulfill({ status: 503, json: { message: 'Offline UI verification' } });
    });
    await page.goto('http://127.0.0.1:8812/#example/brooklyn', { waitUntil: 'networkidle' });
    const views = page.getByRole('tablist', { name: 'View', exact: true });
    const tools = page.getByRole('tablist', {
      name: 'Studio tools',
      exact: true,
      includeHidden: true,
    });
    await views.waitFor();
    const initialViewCount = await views.getByRole('tab').count();
    check(
      initialViewCount >= 3 &&
        (await views.getByRole('tab', { name: 'Compare', exact: true }).count()) === 1 &&
        (await views.getByRole('tab', { name: 'Furnishings', exact: true }).count()) === 1,
      'Required studio views exist before generation',
    );
    check(
      (await views
        .getByRole('tab', { name: 'Design', exact: true })
        .getAttribute('aria-selected')) === 'true',
      'Design is the initial canvas',
    );
    const workspace = page.getByRole('region', { name: 'Room editing workspace', exact: true });
    check(!(await workspace.isVisible()), 'Controls start collapsed');
    check(
      (await page.locator('.pf-project-details').getAttribute('open')) === null,
      'Project metadata starts collapsed',
    );
    check((await page.locator('.pf-body > aside').count()) === 0, 'Duplicate sidebar removed');
    await page.getByRole('button', { name: 'Room settings', exact: true }).click();
    check(
      await workspace.evaluate((el) => document.activeElement === el),
      'Style shortcut focuses the wide workspace',
    );
    check((await workspace.count()) === 1, 'One editing workspace');
    check(
      await workspace.evaluate((el) => !el.closest('.pf-body')),
      'Large tools are outside the room sidebar',
    );
    check(
      await workspace.evaluate((el) => el.scrollHeight <= el.clientHeight + 2),
      'Editing workspace has no nested vertical scroll',
    );
    await tools.getByRole('tab', { name: 'Photo ideas', exact: true }).click();
    await page.getByRole('button', { name: 'What would look good here?', exact: true }).click();
    await page.getByRole('button', { name: 'Use this idea', exact: true }).nth(2).waitFor();
    const styleLayout = await workspace.evaluate((el) => ({
      width: el.getBoundingClientRect().width,
      body: document.querySelector('.pf-studio').getBoundingClientRect().width,
      cards: [...el.querySelectorAll('.pf-direction-card')].map((card) => {
        const r = card.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width };
      }),
      compose: [...el.querySelectorAll('.pf-design-compose > section')].map((card) => {
        const r = card.getBoundingClientRect();
        return { x: r.x, y: r.y };
      }),
    }));
    check(
      Math.abs(styleLayout.width - styleLayout.body) < 2,
      'Styles use the full workspace width',
    );
    check(styleLayout.cards.length === 3, 'Three styles populate the workspace');
    if (width >= 761)
      check(
        styleLayout.cards.every((card) => Math.abs(card.y - styleLayout.cards[0].y) < 2),
        'All three styles share one row',
      );
    if (width >= 1100)
      check(
        styleLayout.compose.every((card) => Math.abs(card.y - styleLayout.compose[0].y) < 2),
        'Brief, inspiration and rendering share one wide row',
      );
    await workspace.getByRole('button', { name: 'Use this idea', exact: true }).nth(1).click();
    check(
      (
        await page.getByRole('textbox', { name: 'Your design brief', exact: true }).inputValue()
      ).startsWith('Fixture direction 1:'),
      'Choosing a style fills the brief',
    );
    await page.getByRole('button', { name: 'Close controls', exact: true }).click();
    check(!(await workspace.isVisible()), 'Close hides large controls');
    await page.getByRole('button', { name: 'Room settings', exact: true }).click();
    await tools.getByRole('tab', { name: 'Photo ideas', exact: true }).click();
    check(
      (
        await page.getByRole('textbox', { name: 'Your design brief', exact: true }).inputValue()
      ).startsWith('Fixture direction 1:'),
      'Collapsing controls retains the brief',
    );
    await tools.getByRole('tab', { name: 'Room settings', exact: true }).click();
    await tools.getByRole('tab', { name: 'Photo ideas', exact: true }).click();
    check(
      (
        await page.getByRole('textbox', { name: 'Your design brief', exact: true }).inputValue()
      ).startsWith('Fixture direction 1:'),
      'Tool switching preserves style and brief',
    );
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'Expanded styles fit the viewport',
    );
    await workspace.screenshot({ path: `${out}/styles-${width}.png` });
    await page
      .getByRole('textbox', { name: 'Your design brief', exact: true })
      .fill('Add a cream sofa, coffee table, striped rug and floor lamp.');
    await page.getByRole('button', { name: 'Create room design', exact: false }).click();
    await page.getByRole('button', { name: 'Arrange in 3D', exact: true }).waitFor();
    await page.waitForFunction(
      () => document.activeElement?.getAttribute('aria-label') === 'Room preview',
    );
    check(true, 'Completed photo render returns focus to the room preview');
    check(restyles === 1, 'One fixture generation');
    check(!(await workspace.isVisible()), 'Completed design collapses controls');
    check(
      (await page.locator('.pf-room-item[open]').count()) === 0,
      'Furniture cards start compact',
    );
    check(
      (await page.locator('.pf-rooms img').first().getAttribute('src')).includes(designSha),
      'Photo restyle updates room thumbnail',
    );
    if (width >= 1100) {
      const positions = await page
        .locator('.pf-stage-bar')
        .evaluate((el) => [...el.children].map((child) => child.getBoundingClientRect().x));
      check(
        positions[0] < positions[1] && positions[1] < positions[2],
        'Modes sit between room title and estimate',
      );
    }
    await page.screenshot({ path: `${out}/canvas-collapsed-${width}.png`, fullPage: true });

    check(
      (await views.getByRole('tab').count()) === initialViewCount,
      'Generation adds no view tabs',
    );
    check(
      (await views
        .getByRole('tab', { name: 'Design', exact: true })
        .getAttribute('aria-selected')) === 'true',
      'Result stays in Photo design',
    );
    const items = await page.evaluate(
      () => JSON.parse(localStorage.getItem('renovagent.studio.brooklyn.items.v1'))['image-03'],
    );
    check(items.length === 5, 'Generated item proposals reach room list');
    const plan = page.getByRole('region', { name: 'Plan and budget', exact: true });
    check((await plan.count()) === 1, 'One live plan on every screen size');
    check(
      (await plan.locator('.pf-room-item').count()) === 5,
      'Generated items populate the bottom plan',
    );
    const geometry = await page.evaluate(() => {
      const rect = (selector) => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, bottom: r.bottom };
      };
      return {
        studio: rect('.pf-studio'),
        plan: rect('.pf-plan-section'),
        editor: rect('.pf-body'),
        cards: [...document.querySelectorAll('.pf-room-item')].slice(0, 2).map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y };
        }),
      };
    });
    check(
      Math.abs(geometry.plan.width - geometry.studio.width) < 2,
      'Plan uses the full workspace width',
    );
    check(geometry.plan.y >= geometry.editor.bottom, 'Plan is below both room view and tools');
    check(
      await plan.evaluate((el) => !el.closest('.pf-panel, .pf-stage')),
      'Plan is outside narrow editor columns',
    );
    if (width >= 761)
      check(
        Math.abs(geometry.cards[0].y - geometry.cards[1].y) < 2,
        'Room items share a row on desktop and tablet',
      );
    await page.getByRole('button', { name: 'Room list & budget', exact: true }).click();
    check(
      await plan.evaluate((el) => document.activeElement === el),
      'Plan shortcut moves keyboard focus',
    );
    await page.screenshot({ path: `${out}/plan-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Arrange in 3D', exact: true }).click();
    check(
      (await tools
        .getByRole('tab', { name: 'Furnishings', exact: true, includeHidden: true })
        .getAttribute('aria-selected')) === 'true',
      'Photo handoff opens layout tools',
    );
    check(
      (await views
        .getByRole('tab', { name: 'Furnishings', exact: true })
        .getAttribute('aria-selected')) === 'true',
      'Photo handoff opens layout view',
    );
    check(
      await page.getByText('No furniture placed yet.', { exact: false }).isVisible(),
      'Empty layout has explanation',
    );
    check(
      await page
        .getByText('No matching library model: Framed artwork.', { exact: false })
        .isVisible(),
      'Unsupported artwork is disclosed',
    );
    await page.getByRole('button', { name: 'Add 4 starter pieces to 3D', exact: true }).click();
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem('renovagent.studio.brooklyn.placements.v1'))?.['image-03']
          ?.length === 4,
    );
    const placed = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('renovagent.studio.brooklyn.placements.v1'))['image-03'],
    );
    check(
      placed.every((p) => items.some((i) => i.id === p.itemId)),
      'Models link to existing items',
    );
    check(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem('renovagent.studio.brooklyn.items.v1'))['image-03'].every(
          (i) => i.quantity === null && i.unitAllowanceMinor === null,
        ),
      ),
      'Unknown prices/quantities remain unknown',
    );
    check(
      (await page
        .getByRole('button', { name: 'Add 4 starter pieces to 3D', exact: true })
        .count()) === 0,
      'Repeated bulk addition unavailable after placement',
    );
    await page.waitForFunction(() => document.querySelector('.pf-3d-host canvas')?.width > 0);
    await page.locator('.room3d-render-style summary').click();
    await page
      .getByRole('combobox', { name: 'Rendering style', exact: true })
      .selectOption({ label: 'Minimal & bright' });
    await page.getByRole('button', { name: 'Render with Muse', exact: true }).click();
    await page.getByAltText('Your generated room design').waitFor();
    check(!(await workspace.isVisible()), 'Render collapses tools');
    check(
      (await page.locator('.pf-rooms img').first().getAttribute('src')).includes(renderSha),
      '3D render updates room thumbnail',
    );
    await views.getByRole('tab', { name: 'Compare', exact: true }).click();
    await page
      .getByRole('combobox', { name: 'Compare preview', exact: true })
      .selectOption('rendered');
    check(
      await page.locator('.pf-compare-pair .pf-inspired-before').isVisible(),
      'Compare shows source photo',
    );
    check(
      await page.getByAltText('Your generated room design').isVisible(),
      'Compare shows generated design',
    );
    await views.getByRole('tab', { name: 'Furnishings', exact: true }).click();
    await page.getByRole('button', { name: 'Add / edit furniture', exact: true }).click();
    check(renderInput?.placements?.length === 4, 'Render request uses furnished scene');
    check(
      renderInput?.style?.startsWith('Minimal and bright'),
      'Rendering style reaches the model request',
    );
    check(
      (await page
        .getByText('Previous design — choices have changed.', { exact: false })
        .count()) === 0,
      'Fresh styled render matches its saved signature',
    );
    check(renderInput?.image?.length > 10000, 'Render includes captured WebGL image');
    check(models.length >= 4 && models.every((s) => s === 200), 'Furniture meshes load locally');
    const sceneView = page.getByRole('button', { name: '3D', exact: true });
    if ((await sceneView.getAttribute('aria-pressed')) !== 'true') await sceneView.click();
    check(
      (await page.getByText('Previous render', { exact: false }).count()) === 0,
      'Current layout render is fresh',
    );
    const across = page.getByRole('spinbutton', { name: 'Across room · m', exact: true });
    await across.fill('1.2');
    await page
      .getByText('Previous render · layout or finishes changed.', { exact: false })
      .waitFor();
    check(true, 'Moving piece marks rendered image stale');
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'Layout fits viewport',
    );
    await page.screenshot({ path: `${out}/layout-${width}.png`, fullPage: true });
    await views.getByRole('tab', { name: 'Design', exact: true }).click();
    check(
      (await tools
        .getByRole('tab', { name: 'Furnishings', exact: true, includeHidden: true })
        .getAttribute('aria-selected')) === 'true',
      'Changing canvas view preserves selected editing tool',
    );
    await page.screenshot({ path: `${out}/photo-${width}.png`, fullPage: true });
    const sofa = plan.locator('.pf-room-item').filter({
      has: page.locator('input[aria-label="Item name: Cream linen sofa"]'),
    });
    await sofa.locator('summary').first().click();
    await sofa
      .getByRole('spinbutton', { name: 'Quantity for Cream linen sofa', exact: true })
      .fill('2');
    await sofa.getByRole('textbox', { name: 'Allowance each · $', exact: true }).fill('125.50');
    await page.waitForFunction(() =>
      document.querySelector('.pf-plan-section .pf-budget-card dl').textContent.includes('$251'),
    );
    check(
      (await plan.locator('.pf-budget-card dl').innerText()).includes('$251'),
      'Bottom plan allowance updates from item edits',
    );
    if (width === 1440) {
      const draft = plan.getByRole('textbox', {
        name: 'Add a furniture or decor item',
        exact: true,
      });
      await draft.fill('Keep this draft while resizing');
      await page.setViewportSize({ width: 640, height: 1000 });
      check(
        (await draft.inputValue()) === 'Keep this draft while resizing',
        'Resizing retains the mounted plan draft',
      );
      check((await plan.count()) === 1, 'Resizing keeps one plan instance');
      await page.setViewportSize({ width, height: 1000 });
      await draft.fill('');
    }
    await page.reload({ waitUntil: 'networkidle' });
    await views.getByRole('tab', { name: 'Furnishings', exact: true }).click();
    await page.getByRole('button', { name: 'Add / edit furniture', exact: true }).click();
    check(
      (await page
        .getByRole('button', { name: 'Add 4 starter pieces to 3D', exact: true })
        .count()) === 0,
      'Reload does not duplicate starters',
    );
    check(
      (
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('renovagent.studio.brooklyn.placements.v1'))[
              'image-03'
            ],
        )
      ).length === 4,
      'Reload keeps placements',
    );
    await page.locator('.pf-rooms button').nth(1).click();
    check(
      await page.getByText('No furniture placed yet.', { exact: false }).isVisible(),
      'Next room starts empty',
    );
    check(
      (await page.locator('.pf-placement-list button').count()) === 0,
      'Room layouts stay isolated',
    );
    check(
      (await plan.locator('.pf-room-item').count()) === 0,
      'Bottom plan follows the selected room',
    );
    await page.locator('.pf-rooms button').first().click();
    check(
      (await plan.locator('.pf-budget-card dl').innerText()).includes('$251'),
      'Room allowances survive reload and switching',
    );
    check(!errors.length, `No page errors: ${errors.join('; ')}`);
    await context.close();
  }
  console.log(`${checks} offline studio design checks passed. Screenshots: ${out}`);
} finally {
  await browser.close();
  await server.close();
}
