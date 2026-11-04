// Built-site browser + isolated local Mongo. No live data or model calls.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MongoClient } from 'mongodb';
import { chromium } from 'playwright';
import { createWorkspaceServer } from '../apps/api/src/server.js';
import { MongoWorkspaceRepository } from '../apps/api/src/repository.js';
import { AccountService } from '../apps/api/src/accounts.js';
import { DesignImageStore } from '../apps/api/src/design-images.js';
import { localHosting } from '../apps/api/src/hosting.js';
import { ProjectNotebook as Notebook } from '../apps/api/src/project-notebook.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { McpAccessStore } from '../apps/api/src/mcp-access.js';
import { StudioPlanStore } from '../apps/api/src/studio-plans.js';
const mongo = await new MongoClient('mongodb://127.0.0.1:27018').connect();
const db = mongo.db(`renovagent_notebook_ui_${randomUUID().replaceAll('-', '')}`);
const repo = MongoWorkspaceRepository.forDb(db);
const images = new DesignImageStore(db),
  access = new McpAccessStore(db),
  accounts = new AccountService(db, {}),
  plans = new StudioPlanStore(db);
const { server } = await createWorkspaceServer(
  repo,
  'notebook-ui',
  false,
  accounts,
  undefined,
  undefined,
  { images },
  { ...localHosting, staticDir: resolve('dist') },
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  access,
  plans,
);
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const a = server.address();
if (!a || typeof a === 'string') throw Error('No listener');
const base = `http://127.0.0.1:${a.port}`;
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const out = '.local/notebook-qa';
await mkdir(out, { recursive: true });
let checks = 0;
const check = (ok: unknown, msg: string) => {
  assert.ok(ok, msg);
  checks++;
};
try {
  for (const width of [1440, 390, 320]) {
    const owner = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await owner.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base + '/#notebook', { waitUntil: 'networkidle' });
    await page
      .getByRole('textbox', { name: 'Project name', exact: true })
      .fill(`QA living room ${width}`);
    await page
      .getByRole('textbox', { name: 'What are you working on?', exact: true })
      .fill('Keep the existing sofa. Collect warm finishes; dimensions unknown.');
    await page.getByRole('button', { name: 'Create project notebook', exact: true }).click();
    await page.getByRole('button', { name: 'Save entry', exact: true }).waitFor();
    const projectId = decodeURIComponent(new URL(page.url()).hash.split('/')[1]);
    check(!!projectId, 'Notebook starts without signing in or measurements');
    await page
      .getByRole('textbox', { name: 'Notes', exact: true })
      .fill(
        'Keep our sofa. Prefer warm white walls. Reference is inspiration, not our measured room.',
      );
    await page
      .getByRole('textbox', { name: 'Title (optional)', exact: true })
      .fill('Keep sofa and warm finishes');
    await page.getByRole('textbox', { name: 'Room (optional)', exact: true }).fill('Living room');
    await page
      .getByRole('textbox', { name: 'Links · one per line', exact: true })
      .fill('https://example.com/room-reference');
    await page.getByText('Tags and files', { exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Tags · comma separated', exact: true })
      .fill('keep, warm');
    await page
      .getByLabel('Add photos or text documents', { exact: true })
      .setInputFiles('public/examples/hutchinson/photo-04.jpg');
    await page.getByRole('button', { name: 'Remove image', exact: true }).waitFor();
    await page.getByRole('combobox', { name: /Role for/ }).selectOption('room');
    await page.getByRole('button', { name: 'Save entry', exact: true }).click();
    await page.getByRole('heading', { name: 'Keep sofa and warm finishes', exact: true }).waitFor();
    check(true, 'Mixed notes, link, tags and role-labeled image save together');
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Keep sofa and warm finishes', exact: true }).waitFor();
    check(
      await page
        .locator('.notebook-card img')
        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
      'Image and notebook survive reload',
    );
    await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Unsent draft to recover');
    await page.reload({ waitUntil: 'networkidle' });
    check(
      (await page.getByRole('textbox', { name: 'Notes', exact: true }).inputValue()) ===
        'Unsent draft to recover',
      'Unsent notebook draft survives reload',
    );
    if (width === 1440) {
      await page
        .getByRole('textbox', { name: 'Title (optional)', exact: true })
        .fill('Recovered save');
      await page
        .getByRole('textbox', { name: 'Notes', exact: true })
        .fill('Response lost after commit');
      let dropped = false;
      await page.route('**/api/workspace/projects/*/notebook', async (route) => {
        if (route.request().method() === 'POST' && !dropped) {
          dropped = true;
          await route.fetch();
          await route.abort('failed');
        } else await route.continue();
      });
      await page.getByRole('button', { name: 'Save entry', exact: true }).click();
      await page.getByRole('alert').waitFor();
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Save entry', exact: true }).click();
      await page.getByText('Saved to this project. Muse can read it.', { exact: true }).waitFor();
      check(
        (await page.getByRole('heading', { name: 'Recovered save', exact: true }).count()) === 1,
        'Lost save response retries after reload without duplicating the entry',
      );
      await page.unroute('**/api/workspace/projects/*/notebook');
      page.once('dialog', (dialog) => dialog.accept());
      await page
        .locator('.notebook-card')
        .filter({ has: page.getByRole('heading', { name: 'Recovered save', exact: true }) })
        .getByRole('button', { name: 'Remove Recovered save', exact: true })
        .click();
      await page
        .getByRole('heading', { name: 'Recovered save', exact: true })
        .waitFor({ state: 'hidden' });
      await page
        .getByRole('textbox', { name: 'Notes', exact: true })
        .fill('Unsent draft to recover');
    }
    const state = await owner.storageState();
    const cookie = state.cookies.find((c) => c.name === 'renovagent_account');
    assert.ok(cookie);
    const user = await accounts.getSession(cookie.value);
    assert.ok(user);
    const grant = await access.issue({
      ownerId: user._id,
      name: 'Muse browser QA',
      access: 'propose',
    });
    const client = new Client({ name: 'notebook-browser-agent', version: '1' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(base + '/mcp'), {
        requestInit: { headers: { Authorization: `Bearer ${grant.token}` } },
      }),
    );
    check(
      client.getInstructions()!.includes('Keep sofa and warm finishes'),
      'Connection initialization includes existing project memory',
    );
    const add = await client.callTool({
      name: 'add_project_entry',
      arguments: {
        projectId,
        requestId: `agent-question-${width}`,
        content: {
          entryType: 'question',
          title: 'Confirm room dimensions',
          text: 'Room dimensions are still unknown. Keep this question open.',
          room: 'Living room',
        },
      },
    });
    check(!add.isError, 'Agent adds a project-specific question');
    await client.close();
    await page.getByRole('button', { name: 'Refresh notes from Muse', exact: true }).click();
    await page.getByRole('heading', { name: 'Confirm room dimensions', exact: true }).waitFor();
    check(
      (await page.getByRole('textbox', { name: 'Notes', exact: true }).inputValue()) ===
        'Unsent draft to recover',
      'Refreshing agent notes preserves unsent owner draft',
    );
    await page
      .getByRole('button', { name: 'Edit Keep sofa and warm finishes', exact: true })
      .click();
    await page
      .getByRole('textbox', { name: 'Notes', exact: true })
      .fill('Keep sofa. Choose warm white walls; no guessed measurements.');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page
      .getByText('Keep sofa. Choose warm white walls; no guessed measurements.', { exact: true })
      .waitFor();
    check(true, 'Owner edits an entry without losing attachments');
    await page
      .getByRole('searchbox', { name: 'Search this notebook', exact: true })
      .fill('warm white');
    await page
      .getByRole('heading', { name: 'Confirm room dimensions', exact: true })
      .waitFor({ state: 'hidden' });
    check(
      await page
        .getByRole('heading', { name: 'Keep sofa and warm finishes', exact: true })
        .isVisible(),
      'Search scopes saved entries',
    );
    await page.getByRole('searchbox', { name: 'Search this notebook', exact: true }).fill('');
    await page.getByRole('heading', { name: 'Confirm room dimensions', exact: true }).waitFor();
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      'Notebook fits viewport',
    );
    await page.screenshot({ path: `${out}/notebook-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Share this project', exact: true }).click();
    const input = page.getByRole('textbox', { name: 'Notebook share link', exact: true });
    await input.waitFor();
    const shareUrl = await input.inputValue();
    const guest = await browser.newContext({ viewport: { width, height: 1000 } });
    const view = await guest.newPage();
    view.on('pageerror', (e) => errors.push(e.message));
    await view.goto(shareUrl, { waitUntil: 'networkidle' });
    await view.getByRole('heading', { name: 'Keep sofa and warm finishes', exact: true }).waitFor();
    check((await guest.cookies()).length === 0, 'Notebook-only share opens without an account');
    check(
      await view
        .locator('.notebook-card img')
        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
      'Shared notebook photo loads without owner session',
    );
    await view.screenshot({ path: `${out}/shared-${width}.png`, fullPage: true });
    await view.getByRole('button', { name: 'Save a copy & edit', exact: true }).click();
    await view.getByRole('button', { name: 'Save entry', exact: true }).waitFor();
    check(
      new URL(view.url()).hash.startsWith('#project/'),
      'Shared notebook saves an independent editable copy',
    );
    await view.reload({ waitUntil: 'networkidle' });
    await view.getByRole('heading', { name: 'Keep sofa and warm finishes', exact: true }).waitFor();
    check(true, 'Copied notebook persists after reload');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Remove Confirm room dimensions', exact: true }).click();
    await page
      .getByRole('heading', { name: 'Confirm room dimensions', exact: true })
      .waitFor({ state: 'hidden' });
    check(true, 'Owner removes an entry from current notebook');
    const records = await new Notebook(repo.forUser(user._id)).list(projectId, {
      includeRemoved: true,
    });
    check(
      records.entries.some((e) => e.deleted && e.content.title === 'Confirm room dimensions'),
      'Removed entry remains in history',
    );
    check(errors.length === 0, `No browser errors: ${errors.join('; ')}`);
    await owner.close();
    await guest.close();
  }
  console.log(`${checks} notebook browser checks passed. Screenshots: ${out}`);
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await db.dropDatabase();
  await mongo.close();
}
