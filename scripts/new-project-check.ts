// Built-site project identity regression. API replies are fixtures; no live
// accounts, database, uploads or provider calls are used.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import type { StudioDesignSaveRequest } from '@renovagent/contracts';
import { serveStatic } from '../apps/api/src/hosting.js';
import { uploadedOwnStudio } from '../apps/web/src/features/house-example/own-analysis.js';
import {
  ownStudioDraftId,
  ownStudioStore,
} from '../apps/web/src/features/house-example/own-studio-route.js';

const out = '.local/new-project-check';
await mkdir(out, { recursive: true });
const photo = await readFile('public/favicon-32.png');
const sha = 'a'.repeat(64);
const legacy = uploadedOwnStudio({
  photos: [sha],
  plans: [],
  where: 'Previous browser studio',
  ceilingFt: null,
  idea: '',
});
const server = createServer((req, res) => {
  void serveStatic(resolve('dist'), req, res).then((ok) => {
    if (!ok) {
      res.writeHead(404);
      res.end();
    }
  });
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const bound = server.address();
assert.ok(bound && typeof bound !== 'string');
const base = `http://127.0.0.1:${bound.port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
let checks = 0;
const pass = (message: string) => {
  checks++;
  console.log(`PASS ${message}`);
};
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    await context.addInitScript('window.__name = fn => fn');
    await context.addInitScript((value) => {
      if (!localStorage.getItem('new-project-check-seeded')) {
        localStorage.setItem('renovagent.own-project.v1', JSON.stringify(value));
        localStorage.setItem('new-project-check-seeded', 'true');
      }
    }, legacy);
    const saved = new Map<
      string,
      { projectId: string; revision: number; snapshot: StudioDesignSaveRequest['snapshot'] }
    >();
    const responses = new Map<string, { projectId: string; revision: number }>();
    const requests: StudioDesignSaveRequest[] = [];
    let firstDraft = '',
      failed = false;
    await context.route('**/api/**', async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      if (path.endsWith('/session'))
        return route.fulfill({
          json: {
            mode: 'account',
            signedIn: true,
            providers: [],
            guests: true,
            user: { email: 'fixture@example.test' },
          },
        });
      if (path.endsWith('/studio/photo')) return route.fulfill({ json: { sha256: sha } });
      if (path.includes('/design-images/'))
        return route.fulfill({ contentType: 'image/png', body: photo });
      if (path.endsWith('/studio-designs') && req.method() === 'POST') {
        const body = req.postDataJSON() as StudioDesignSaveRequest;
        requests.push(body);
        if (body.snapshot.project.id === firstDraft && !failed) {
          failed = true;
          return route.fulfill({
            status: 503,
            json: { code: 'STORAGE', message: 'Fixture save unavailable' },
          });
        }
        const replay = responses.get(body.requestId);
        if (replay) return route.fulfill({ json: replay });
        const projectId = body.projectId ?? `saved-${body.snapshot.project.id}`;
        const record = { projectId, revision: body.expectedRevision + 1, snapshot: body.snapshot };
        saved.set(projectId, record);
        responses.set(body.requestId, { projectId, revision: record.revision });
        return route.fulfill({
          json: {
            ...record,
            artifactRef: {
              kind: 'artifact',
              id: `${projectId}:studio-design`,
              revision: record.revision,
            },
          },
        });
      }
      const match = path.match(/\/studio-designs\/([^/]+)\/(\d+)$/);
      if (match && req.method() === 'GET') {
        const record = saved.get(decodeURIComponent(match[1]));
        return record
          ? route.fulfill({ json: record })
          : route.fulfill({
              status: 404,
              json: { code: 'NOT_FOUND', message: 'Fixture not found' },
            });
      }
      return route.fulfill({
        status: 503,
        json: { code: 'STORAGE', message: 'Offline fixture: no models or other services' },
      });
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const oldStorage = JSON.stringify(legacy);
    const galleryNew = async () => {
      await page
        .getByRole('navigation', { name: 'Main navigation' })
        .getByRole('link', { name: 'Studio', exact: true })
        .click();
      await page.locator('.pf-gallery').waitFor();
      await page
        .getByRole('button', { name: 'New project Your photos and floor plan', exact: true })
        .click();
      await page.locator('.pf-intake').waitFor();
      const hash = new URL(page.url()).hash;
      assert.ok(ownStudioDraftId(hash));
      assert.equal(await page.locator('.pf-intake-idea').inputValue(), '');
      assert.equal(
        await page
          .getByRole('textbox', { name: 'Address or listing link', exact: true })
          .inputValue(),
        '',
      );
      assert.equal(await page.locator('.pf-photo-thumbs li').count(), 0);
      return hash;
    };
    const addPhoto = async (name: string) => {
      await page.getByRole('button', { name: /^Room photos/ }).click();
      await page
        .getByRole('dialog', { name: 'Add photo', exact: true })
        .getByLabel('Upload room photos', { exact: true })
        .setInputFiles({ name, mimeType: 'image/png', buffer: photo });
      await page
        .getByRole('dialog', { name: 'Add photo', exact: true })
        .waitFor({ state: 'hidden' });
    };
    await page.goto(base + '/#studio');
    const firstHash = await galleryNew();
    firstDraft = ownStudioDraftId(firstHash)!;
    assert.equal(
      await page.evaluate(() => localStorage.getItem('renovagent.own-project.v1')),
      oldStorage,
    );
    pass(
      `${width}: gallery New project opens a fresh ID and preserves the previous browser studio`,
    );
    await page
      .getByRole('textbox', { name: 'Address or listing link', exact: true })
      .fill('First independent room');
    await addPhoto('first-room.png');
    await page
      .locator('.pf-intake [role=status]', { hasText: 'Photo files and brief saved' })
      .waitFor();
    await page.reload();
    await page.locator('.pf-intake').waitFor();
    assert.equal(new URL(page.url()).hash, firstHash);
    assert.equal(
      await page
        .getByRole('textbox', { name: 'Address or listing link', exact: true })
        .inputValue(),
      'First independent room',
    );
    assert.equal(await page.locator('.pf-photo-thumbs li').innerText(), 'first-room.png');
    pass(`${width}: refresh restores this draft's actual file and address under the same ID`);
    await page.getByRole('button', { name: 'Build my plan', exact: true }).click();
    await page.locator('.pf-studio').waitFor();
    await page.getByRole('button', { name: 'Retry workspace sync', exact: true }).waitFor();
    const pending = requests.find((r) => r.snapshot.project.id === firstDraft)!;
    assert.equal(pending.projectId, undefined);
    assert.equal(pending.expectedRevision, 0);
    const secondHash = await galleryNew();
    const secondDraft = ownStudioDraftId(secondHash)!;
    assert.notEqual(firstHash, secondHash);
    pass(
      `${width}: a failed save does not leak its photo, brief or pending command into the next project`,
    );
    await page
      .getByRole('textbox', { name: 'Address or listing link', exact: true })
      .fill('Second independent room');
    await addPhoto('second-room.png');
    await page.getByRole('button', { name: 'Build my plan', exact: true }).click();
    await page.locator('.pf-autosave-status', { hasText: 'Autosaved to workspace' }).waitFor();
    const second = requests.find((r) => r.snapshot.project.id === secondDraft)!;
    assert.equal(second.projectId, undefined);
    assert.equal(second.expectedRevision, 0);
    assert.equal(second.snapshot.project.address, 'Second independent room');
    pass(
      `${width}: the same uploaded photo creates a different studio ID and a separate first account save`,
    );
    await page.goto(base + '/' + firstHash);
    await page.locator('.pf-autosave-status', { hasText: 'Autosaved to workspace' }).waitFor();
    const replay = requests.filter((r) => r.snapshot.project.id === firstDraft);
    assert.ok(replay.length >= 2);
    assert.deepEqual(replay[1], pending);
    assert.equal(
      saved.get(`saved-${firstDraft}`)?.snapshot.project.address,
      'First independent room',
    );
    assert.equal(
      saved.get(`saved-${secondDraft}`)?.snapshot.project.address,
      'Second independent room',
    );
    pass(
      `${width}: reopening the first draft retries its exact pending save and preserves the second project`,
    );
    const originalSecond = JSON.stringify(saved.get(`saved-${secondDraft}`));
    await page.goto(base + `/#design/saved-${secondDraft}/1`);
    await page.locator('.pf-studio').waitFor();
    await page.locator('.pf-project-details > summary').click();
    await page.getByRole('heading', { name: 'Second independent room', exact: true }).waitFor();
    await page.getByRole('button', { name: 'New project', exact: true }).click();
    await page.locator('.pf-intake').waitFor();
    const thirdHash = new URL(page.url()).hash;
    assert.ok(ownStudioDraftId(thirdHash));
    assert.notEqual(thirdHash, firstHash);
    assert.notEqual(thirdHash, secondHash);
    assert.equal(
      await page
        .getByRole('textbox', { name: 'Address or listing link', exact: true })
        .inputValue(),
      '',
    );
    assert.equal(await page.locator('.pf-photo-thumbs li').count(), 0);
    assert.equal(JSON.stringify(saved.get(`saved-${secondDraft}`)), originalSecond);
    assert.equal(
      await page.evaluate((key) => !!localStorage.getItem(key), ownStudioStore(firstDraft)),
      true,
    );
    pass(
      `${width}: New project from a saved design opens a third blank draft without replacing saved work`,
    );
    await page.goto(base + '/#projects');
    const resume = page.getByRole('link', { name: 'Resume current studio', exact: true });
    await resume.waitFor();
    assert.equal(await resume.getAttribute('href'), secondHash);
    await resume.click();
    await page.locator('.pf-studio').waitFor();
    assert.equal(new URL(page.url()).hash, secondHash);
    pass(`${width}: Resume current studio explicitly reopens the previous identified draft`);
    await page.goto(base + '/#new-project');
    await page.locator('.pf-intake').waitFor();
    assert.notEqual(new URL(page.url()).hash, thirdHash);
    await page.goto(base + '/');
    await page.getByRole('button', { name: 'Start a project', exact: true }).click();
    await page.locator('.pf-intake').waitFor();
    assert.equal(await page.locator('.pf-intake-idea').inputValue(), '');
    assert.equal(
      await page.evaluate(() => localStorage.getItem('renovagent.own-project.v1')),
      oldStorage,
    );
    assert.deepEqual(errors, []);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `${out}/fresh-${width}.png`, fullPage: true });
    pass(
      `${width}: bare new-project and empty home-page starts are fresh; legacy storage remains intact`,
    );
    await page.goto(base + '/');
    await page.locator('#start-prompt').fill('A separate room from the home page');
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'home-room.png', mimeType: 'image/png', buffer: photo });
    await page.getByRole('button', { name: 'Start a project', exact: true }).click();
    await page.locator('.pf-autosave-status', { hasText: 'Autosaved to workspace' }).waitFor();
    const homeHash = new URL(page.url()).hash;
    await page.locator('.pf-project-details > summary').click();
    await page.getByRole('button', { name: 'New project', exact: true }).click();
    await page.locator('.pf-intake').waitFor();
    assert.notEqual(new URL(page.url()).hash, homeHash);
    assert.equal(await page.locator('.pf-intake-idea').inputValue(), '');
    assert.equal(await page.locator('.pf-photo-thumbs li').count(), 0);
    pass(`${width}: New project does not reuse the previous home-page photo or brief`);
    await context.close();
  }
  console.log(`${checks} new-project browser scenarios passed. Fixtures only. Screenshots: ${out}`);
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
}
