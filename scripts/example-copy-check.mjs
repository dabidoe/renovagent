// Offline public-template isolation and copy-on-edit checks. No real API/model calls.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({
  server: { host: '127.0.0.1', port: 8833, strictPort: true },
  logLevel: 'silent',
});
await server.listen();
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
let checks = 0;
const check = (value, message) => {
  assert.ok(value, message);
  checks++;
};
try {
  for (const source of [
    'hutchinson',
    'oakland',
    'brooklyn',
    'studio-lounge',
    'starter-living-room',
  ]) {
    const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
    const page = await context.newPage();
    const errors = [],
      writes = [],
      projects = new Map(),
      commands = new Map();
    let failReply = false;
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((source) => {
      localStorage.setItem(
        `renovagent.studio.${source}.items.v1`,
        JSON.stringify({
          living: [
            {
              id: 'old',
              name: 'OLD SOURCE EDIT',
              category: 'furniture',
              action: 'add',
              quantity: 1,
              unitAllowanceMinor: null,
            },
          ],
        }),
      );
      localStorage.setItem(
        `renovagent.studio.${source}.saved.v1`,
        JSON.stringify({ projectId: 'shared-example-do-not-write', revision: 42 }),
      );
      localStorage.setItem(
        `renovagent.example.${source}.edits.v1`,
        JSON.stringify({ ceilingFt: 77 }),
      );
    }, source);
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/session'))
        return route.fulfill({
          json: {
            mode: 'account',
            signedIn: true,
            user: { guest: true },
            providers: [],
            guests: true,
          },
        });
      if (path.endsWith('/studio-designs') && route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        writes.push(body);
        let saved = commands.get(body.requestId);
        if (!saved) {
          const projectId = body.projectId || `private-copy-${projects.size + 1}`;
          saved = {
            projectId,
            revision: (projects.get(projectId)?.revision || 0) + 1,
            snapshot: body.snapshot,
          };
          projects.set(projectId, saved);
          commands.set(body.requestId, saved);
        }
        if (failReply) {
          failReply = false;
          return route.abort('failed');
        }
        return route.fulfill({ json: saved });
      }
      if (path.includes('/studio-designs/shares/')) return route.fulfill({ json: [] });
      return route.fulfill({ status: 503, json: { message: 'Offline fixture' } });
    });
    const url = `http://127.0.0.1:8833/${source === 'hutchinson' ? '#example-house' : `#example/${source}`}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('.pf-studio').waitFor();
    await page.waitForTimeout(1000);
    check(writes.length === 0, `${source}: browsing creates no account project`);
    const drafts = await page.evaluate(() =>
      Object.keys(localStorage)
        .filter((key) => /^renovagent.studio.example-copy-.*\.saved.v1.draft$/.test(key))
        .map((key) => JSON.parse(localStorage.getItem(key))),
    );
    const initial = drafts.at(-1);
    check(
      initial && initial.project.ceilingFt !== 77,
      `${source}: ignores old source dimension edits`,
    );
    check(
      !JSON.stringify(initial).includes('OLD SOURCE EDIT'),
      `${source}: ignores source draft edits`,
    );
    const before = JSON.stringify(initial);
    await page
      .getByRole('tablist', { name: 'View', exact: true })
      .getByRole('tab', { name: 'Furnishings', exact: true })
      .click();
    await page.waitForTimeout(1000);
    check(writes.length === 0, `${source}: changing views does not fork`);
    // The first edit creates a copy. Simulate a committed save whose response is lost.
    failReply = true;
    if (source === 'brooklyn') {
      await page.getByRole('button', { name: 'Edit room measurements', exact: true }).click();
      await page.getByRole('textbox', { name: 'Width in feet', exact: true }).fill('17');
      await page.locator('form.pf-size').getByRole('button', { name: 'Set', exact: true }).click();
    } else {
      await page.getByRole('button', { name: 'Add Lounge chair to 3D', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Retry workspace sync', exact: true }).waitFor();
    check(
      writes.length === 1 && !writes[0].projectId && writes[0].expectedRevision === 0,
      `${source}: first save creates new canonical project`,
    );
    check(
      writes[0].snapshot.project.id.startsWith('example-copy-'),
      `${source}: copy has independent snapshot identity`,
    );
    const first = writes[0];
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => location.hash.startsWith('#design/'));
    check(
      JSON.stringify(writes[1]) === JSON.stringify(first),
      `${source}: lost response replays exact command`,
    );
    check(projects.size === 1, `${source}: retry creates no duplicate`);
    if (source === 'brooklyn') {
      check(
        writes[1].snapshot.project.rooms[0].size.xFt === 17,
        'Dimension edit belongs to the recovered copy',
      );
    }
    check(
      writes.every((w) => w.projectId !== 'shared-example-do-not-write'),
      `${source}: never writes source saved pointer`,
    );
    // A subsequent edit updates only the private copy.
    await page
      .getByRole('tablist', { name: 'View', exact: true })
      .getByRole('tab', { name: 'Furnishings', exact: true })
      .click();
    await page.getByRole('button', { name: 'Add Lounge chair to 3D', exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('.pf-autosave-status')?.textContent === 'Autosaved to workspace',
    );
    check(
      writes.at(-1).projectId === 'private-copy-1',
      `${source}: subsequent edits target own copy`,
    );
    // New navigation to the public URL starts from the same template, independently.
    await page.goto('http://127.0.0.1:8833/#examples');
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const fresh = await page.evaluate(
      (initialId) =>
        Object.keys(localStorage)
          .filter((key) => /^renovagent.studio.example-copy-.*\.saved.v1.draft$/.test(key))
          .map((key) => JSON.parse(localStorage.getItem(key)))
          .find((draft) => draft.project.id !== initialId),
      initial.project.id,
    );
    check(
      fresh && fresh.project.id !== initial.project.id,
      `${source}: reopened template gets fresh copy identity`,
    );
    fresh.project.id = initial.project.id;
    check(JSON.stringify(fresh) === before, `${source}: reopened template remains pristine`);
    check(errors.length === 0, errors.join('\n'));
    await context.close();
  }
  console.log(`${checks} example template/copy checks passed.`);
} finally {
  await browser.close();
  await server.close();
}
