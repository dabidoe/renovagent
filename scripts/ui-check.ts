// UI guardrail: drives the public pages in Chromium and asserts what screenshots
// cannot show (budget wording, accessible names, disabled-state reasons, draft
// persistence, console errors), plus overflow at phone widths. Screenshots are
// written for human review; they are not diffed.
//
//   npm run ui:check                      # starts its own Vite dev server (no API)
//   npm run ui:check -- --base <url>      # checks a running site instead
//
// Without an API the workspace endpoints fail; the static examples must still work,
// and those failed requests are not counted as console errors.
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, type Browser, type Page } from 'playwright';
import { createLogger, createServer, type ViteDevServer } from 'vite';
import {
  parseSampleRooms,
  preparedSampleRoute,
} from '../apps/web/src/features/project-start/sample-rooms.js';

const args = process.argv.slice(2);
const baseArg = args.includes('--base') ? args[args.indexOf('--base') + 1] : undefined;
const outDir = `.local/ui-check/${new Date().toISOString().replace(/[:.]/g, '-')}`;

const viewports = [
  { tag: 'desktop', width: 1440, height: 900 },
  { tag: 'phone', width: 390, height: 844 },
  { tag: 'small', width: 320, height: 700 },
] as const;
const routes = [
  '/',
  '/#studio',
  '/#example/oakland',
  '/#example/brooklyn',
  '/#example/bedroom-refresh',
  '/#example-house',
  '/#new-project',
  '/#projects',
  '/#connect',
];

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];
const check = (name: string, ok: boolean, detail?: string) =>
  results.push({ name, ok, ...(detail && !ok ? { detail } : {}) });

// Failed network requests (no API in the self-started server) are expected.
const ignoredConsole = /Failed to load resource|ERR_TUNNEL|net::ERR_/;

async function open(browser: Browser, base: string, route: string, vp: (typeof viewports)[number]) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  // tsx keeps function names with a __name helper that page.evaluate callbacks reference.
  await context.addInitScript('window.__name = (fn) => fn');
  const page = await context.newPage();
  if (!baseArg) {
    // Keep the self-started check offline even when a connected API is running on 4000.
    await page.route('**/api/**', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: '{"error":"Offline UI check"}',
      }),
    );
  }
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !ignoredConsole.test(m.text())) errors.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  await page.goto(base + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  return { page, errors, close: () => context.close() };
}

// Visible interactive elements without an accessible name (a practical subset of accname).
function unnamedControls(page: Page) {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      if (el.closest('[aria-hidden="true"], [hidden], [inert]')) return false;
      // Only a closed details element's own summary is visible. Nested summaries
      // remain hidden by a collapsed outer details, even if they have layout boxes.
      for (let parent = el.parentElement; parent; parent = parent.parentElement) {
        if (
          parent instanceof HTMLDetailsElement &&
          !parent.open &&
          !parent.querySelector(':scope > summary')?.contains(el)
        )
          return false;
      }
      const s = getComputedStyle(el);
      return s.visibility !== 'hidden' && s.display !== 'none';
    };
    const text = (id: string) => document.getElementById(id)?.textContent?.trim() ?? '';
    const name = (el: Element) => {
      const aria = el.getAttribute('aria-label')?.trim();
      if (aria) return aria;
      const by = el.getAttribute('aria-labelledby');
      if (by) return by.split(/\s+/).map(text).join(' ').trim();
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      ) {
        const label = [...(el.labels ?? [])].map((l) => l.textContent?.trim()).join(' ');
        if (label) return label;
        return el.getAttribute('title')?.trim() ?? '';
      }
      const own = (el as HTMLElement).innerText?.trim();
      if (own) return own;
      const alt = [...el.querySelectorAll('img[alt], svg[aria-label]')]
        .map((i) => i.getAttribute('alt') || i.getAttribute('aria-label'))
        .join(' ')
        .trim();
      return alt || el.getAttribute('title')?.trim() || '';
    };
    return [
      ...document.querySelectorAll(
        'button, a[href], summary, input:not([type=hidden]):not([type=file]), textarea, select, [role=button], [role=tab]',
      ),
    ]
      .filter(visible)
      .filter((el) => !name(el))
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
  });
}

async function generalChecks(browser: Browser, base: string) {
  for (const vp of viewports)
    for (const route of routes) {
      const label = `${vp.tag} ${route}`;
      const { page, errors, close } = await open(browser, base, route, vp);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      check(
        `${label}: no horizontal overflow`,
        overflow <= 0,
        `${overflow}px wider than the viewport`,
      );
      const unnamed = await unnamedControls(page);
      check(`${label}: controls have accessible names`, !unnamed.length, unnamed.join(', '));
      check(`${label}: no console errors`, !errors.length, errors.join(' | '));
      const file = `${vp.tag}${route.replace(/[^a-z0-9]+/gi, '-')}.png`;
      await page.screenshot({ path: `${outDir}/${file}`, fullPage: true });
      await close();
    }
}

// A rolling total shows intermediate numbers; its .sr-only twin holds the final value.
async function finalText(page: Page, selector: string) {
  const el = page.locator(selector).first();
  const final = el.locator('.sr-only');
  return ((await final.count()) ? await final.textContent() : await el.innerText())?.trim() ?? '';
}

async function budgetChecks(browser: Browser, base: string) {
  const vp = viewports[0];
  // Brooklyn uses editable photo-based planning estimates for its missing sizes.
  {
    const { page, close } = await open(browser, base, '/#example/brooklyn', vp);
    const total = await finalText(page, '.pf-total strong');
    check(
      'brooklyn: estimated materials have a non-zero total',
      /^\$[1-9][\d,]*(?:\.\d\d)?$/.test(total),
      total,
    );
    const metas = await page.locator('.pf-rooms .pf-room-meta').allInnerTexts();
    check(
      'brooklyn: every room has an estimated materials price',
      metas.length > 0 && metas.every((m) => /^\$[1-9][\d,]*(?:\.\d\d)?$/.test(m.trim())),
      metas.join(' / '),
    );
    check(
      'brooklyn: photo estimate is visibly disclosed',
      (await page.locator('.pf-size-note').innerText()).includes('not measured'),
    );
    await page.getByRole('button', { name: 'Edit room measurements', exact: true }).click();
    check(
      'brooklyn: editor prefills estimated width',
      (await page.getByRole('textbox', { name: 'Width in feet', exact: true }).inputValue()) ===
        '12',
    );
    check(
      'brooklyn: editor prefills estimated length',
      (await page.getByRole('textbox', { name: 'Length in feet', exact: true }).inputValue()) ===
        '18',
    );
    await page.getByRole('textbox', { name: 'Width in feet', exact: true }).fill('16');
    await page.locator('.pf-size button[type="submit"]').click();
    const changed = await finalText(page, '.pf-total strong');
    check(
      'brooklyn: size edit recalculates materials',
      changed !== total && changed.startsWith('$'),
      changed,
    );
    await waitForStudioDraft(page);
    await page.reload();
    await page.locator('.pf-stage-bar').waitFor();
    await page.getByRole('button', { name: 'Edit room measurements', exact: true }).click();
    check(
      'brooklyn: edited size survives reload',
      (await page.getByRole('textbox', { name: 'Width in feet', exact: true }).inputValue()) ===
        '16',
    );
    check(
      'brooklyn: user size replaces the photo estimate',
      !(await page.locator('.pf-size-note').innerText()).includes('not measured'),
    );
    await page.locator('.pf-stage-bar button').filter({ hasText: 'ceilings' }).click();
    check(
      'brooklyn: ceiling editor prefills existing height',
      (await page
        .getByRole('textbox', { name: 'Ceiling height in feet', exact: true })
        .inputValue()) === '8',
    );
    await page.getByRole('textbox', { name: 'Ceiling height in feet', exact: true }).fill('9');
    await page.locator('.pf-size button[type="submit"]').click();
    check(
      'brooklyn: confirming ceiling clears its estimate label',
      (await page.locator('.pf-size-note').count()) === 0,
    );
    await close();
  }
  // Oakland is sized: a real total, and every room priced.
  {
    const { page, close } = await open(browser, base, '/#example/oakland', vp);
    const total = await finalText(page, '.pf-total strong');
    check('oakland: header shows a non-zero total', /^\$[1-9][\d,]*\.\d\d$/.test(total), total);
    const metas = await page.locator('.pf-rooms .pf-room-meta').allInnerTexts();
    check(
      'oakland: room tabs are priced',
      metas.length > 0 && metas.every((m) => /^\$[\d,]+\.\d\d$/.test(m.trim())),
      metas.join(' / '),
    );
    await close();
  }
}

async function waitForStudioDraft(page: Page) {
  // Copy drafts are debounced. Reload only after these edits are confirmed saved.
  await page
    .locator('.pf-autosave-status', {
      hasText:
        /^(Autosaved (?:in this browser|to workspace)|Workspace sync failed · browser copy saved)$/,
    })
    .waitFor();
}

async function preparedSampleChecks(browser: Browser, base: string) {
  const manifest = await fetch(`${base}/starter-rooms/manifest.json`).then((r) => r.json());
  const samples = parseSampleRooms(manifest);
  for (const vp of [viewports[0], viewports[2]]) {
    const { page, close } = await open(browser, base, '/', vp);
    const writes: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/'))
        writes.push(request.url());
    });
    for (const sample of samples) {
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Add room photos', exact: true }).click();
      await page.getByRole('button', { name: 'Sample rooms No photo needed', exact: true }).click();
      await page
        .locator('.sample-room-grid button')
        .filter({ has: page.getByText(sample.title, { exact: true }) })
        .click();
      await page
        .locator('.pf-project-details > summary')
        .filter({ hasText: sample.title })
        .waitFor();
      check(
        `${vp.tag} ${sample.id}: opens prepared sample directly`,
        page.url().endsWith(preparedSampleRoute(sample)),
      );
      check(
        `${vp.tag} ${sample.id}: material budget is priced`,
        /^\$[1-9]/.test(await finalText(page, '.pf-total strong')),
      );
      await page
        .getByRole('group', { name: 'Preview tools', exact: true })
        .getByRole('button', { name: /^Floor(?: |$)/ })
        .click();
      await page.getByRole('button', { name: 'Dark walnut', exact: true }).click();
      await page
        .getByRole('group', { name: 'Preview tools', exact: true })
        .getByRole('button', { name: /^Paint(?: |$)/ })
        .click();
      await page.getByRole('button', { name: 'Naval SW 6244', exact: true }).click();
      await page.getByRole('button', { name: 'Edit room measurements', exact: true }).click();
      await page.getByRole('textbox', { name: 'Width in feet', exact: true }).fill('15');
      await page.locator('.pf-size button[type="submit"]').click();
      await waitForStudioDraft(page);
      await page.reload({ waitUntil: 'networkidle' });
      await page
        .getByRole('group', { name: 'Preview tools', exact: true })
        .getByRole('button', { name: /^Floor(?: |$)/ })
        .click();
      const floorRetained =
        (await page
          .getByRole('button', { name: 'Dark walnut', exact: true })
          .getAttribute('aria-pressed')) === 'true';
      await page
        .getByRole('group', { name: 'Preview tools', exact: true })
        .getByRole('button', { name: /^Paint(?: |$)/ })
        .click();
      check(
        `${vp.tag} ${sample.id}: floor and paint edits survive reload`,
        floorRetained &&
          (await page
            .getByRole('button', { name: 'Naval SW 6244', exact: true })
            .getAttribute('aria-pressed')) === 'true',
      );
      await page.getByRole('button', { name: 'Edit room measurements', exact: true }).click();
      check(
        `${vp.tag} ${sample.id}: size edit survives reload`,
        (await page.getByRole('textbox', { name: 'Width in feet', exact: true }).inputValue()) ===
          '15',
      );
      const editorLayout = await page.evaluate(() => {
        const describe = (element: Element) => {
          const rect = element.getBoundingClientRect();
          const css = getComputedStyle(element);
          return {
            element:
              element.tagName.toLowerCase() +
              (element.className
                ? '.' + String(element.className).trim().replace(/\s+/g, '.')
                : ''),
            rect: rect.toJSON(),
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            minWidth: css.minWidth,
            gridTemplateColumns: css.gridTemplateColumns,
          };
        };
        const editor = document.querySelector('.pf-size');
        const prompt = document.querySelector('.pf-imagine');
        const promptRow = document.querySelector('.pf-imagine > div');
        return {
          viewport: { width: innerWidth, height: innerHeight },
          document: describe(document.documentElement),
          editor: editor ? describe(editor) : null,
          prompt: prompt ? describe(prompt) : null,
          promptRow: promptRow ? describe(promptRow) : null,
          overflowing: [...document.querySelectorAll('body *')]
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.right > innerWidth + 1;
            })
            .map(describe),
          actual: document.documentElement.scrollWidth,
          maximum: innerWidth + 1,
        };
      });
      console.log(`LAYOUT ${vp.tag} ${sample.id}: ${JSON.stringify(editorLayout)}`);
      await writeFile(
        `${outDir}/${vp.tag}-sample-${sample.id}-editor.json`,
        JSON.stringify(editorLayout, null, 2),
      );
      const editorFits = editorLayout.actual <= editorLayout.maximum;
      check(
        `${vp.tag} ${sample.id}: editor fits viewport`,
        editorFits,
        `document.scrollWidth=${editorLayout.actual} > innerWidth+1=${editorLayout.maximum}`,
      );
      if (!editorFits)
        await page.screenshot({
          path: `${outDir}/${vp.tag}-sample-${sample.id}-editor.png`,
          fullPage: true,
        });
      await page.locator('.pf-project-details > summary').click();
      await page.locator('.sample-room-info > summary').click();
      check(
        `${vp.tag} ${sample.id}: source credit retained`,
        (await page.locator('.sample-room-info p').innerText()).includes(sample.source),
      );
      await page.locator('.pf-project-details > summary').click();
      await page.screenshot({
        path: `${outDir}/${vp.tag}-sample-${sample.id}.png`,
        fullPage: true,
      });
    }
    check(
      `${vp.tag}: sample edits only sync private copies, without uploads, account creation or model calls`,
      writes.every((url) => new URL(url).pathname === '/api/workspace/studio-designs'),
      writes.join(', '),
    );
    if (!baseArg) {
      let payload:
        | {
            snapshot: {
              project: { id: string; rooms: { id: string; size?: { xFt: number } }[] };
              picks: Record<string, { floorStyle?: string; color?: { code: string } }>;
            };
          }
        | undefined;
      await page.route('**/api/workspace/studio-designs', (route) => {
        payload = route.request().postDataJSON();
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ projectId: 'sample-fixture', revision: 1 }),
        });
      });
      // Editing a public template now autosaves its private copy. The offline API
      // makes that sync fail; retry the pending save once the fixture is installed.
      await page.getByRole('button', { name: 'Retry workspace sync', exact: true }).click();
      // A pending command is replayed before newer edits; wait for the whole sync.
      await page.locator('.pf-autosave-status', { hasText: 'Autosaved to workspace' }).waitFor();
      await page.waitForFunction(() => location.hash === '#design/sample-fixture/1');
      check(
        `${vp.tag}: account save carries prepared project and edits`,
        /^example-copy-[a-f0-9-]{36}$/.test(payload?.snapshot.project.id ?? '') &&
          payload?.snapshot.project.rooms[0]?.id === samples.at(-1)!.id &&
          payload.snapshot.project.rooms[0]?.size?.xFt === 15 &&
          payload.snapshot.picks[samples.at(-1)!.id]?.floorStyle === 'walnut' &&
          payload.snapshot.picks[samples.at(-1)!.id]?.color?.code === 'SW 6244',
      );
    }
    await close();
  }
}

async function intakeChecks(browser: Browser, base: string) {
  const { page, close } = await open(browser, base, '/#new-project', viewports[1]);
  const idea = page.locator('.pf-intake input.pf-intake-idea');
  // Start from an empty draft.
  await idea.fill('');
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const labels = await page.evaluate(() =>
    [...document.querySelectorAll('.pf-intake input:not([type=file])')].map((input) => {
      const label = (input as HTMLInputElement).labels?.[0];
      return label && label.getBoundingClientRect().height > 0 ? label.innerText.trim() : '';
    }),
  );
  check(
    'intake: every field has a visible label',
    labels.length > 0 && labels.every(Boolean),
    labels.join(' / '),
  );

  const status = page.locator('.pf-intake [role=status]').first();
  check('intake: empty form shows no saved-draft message', !(await status.innerText()).trim());

  const build = page.getByRole('button', { name: /Build my plan/ });
  const describedBy = await build.getAttribute('aria-describedby');
  const reason = describedBy ? await page.locator(`#${describedBy}`).innerText() : '';
  check(
    'intake: disabled "Build my plan" explains what it needs',
    (await build.isDisabled()) && /photo/i.test(reason),
    reason || 'no aria-describedby',
  );

  await idea.fill('Warm white walls');
  await page.waitForTimeout(600);
  check('intake: typing saves a draft and says so', /saved/i.test(await status.innerText()));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  check('intake: the brief survives a reload', (await idea.inputValue()) === 'Warm white walls');
  await idea.fill('');
  await page.waitForTimeout(300);
  await close();
}

async function connectChecks(browser: Browser, base: string) {
  const { page, close } = await open(browser, base, '/#connect', viewports[0]);
  await page.getByText('Manual key setup for clients without OAuth', { exact: true }).click();
  const create = page.getByRole('button', { name: /Create connection key/ });
  if ((await create.count()) && (await create.isDisabled())) {
    const id = await create.getAttribute('aria-describedby');
    const reason = id ? await page.locator(`#${id}`).innerText() : '';
    check(
      'connect: disabled "Create connection key" explains why',
      !!reason.trim(),
      'no visible reason',
    );
  }
  await close();
}

async function landingChecks(browser: Browser, base: string) {
  for (const vp of viewports) {
    const { page, close } = await open(browser, base, '/', vp);
    const heights = await page.$$eval('.hero-ar-tabs button', (bs) =>
      bs.map((b) => Math.round(b.getBoundingClientRect().height)),
    );
    check(
      `${vp.tag} landing: hero card tabs stay on one line`,
      heights.length === 4 && new Set(heights).size === 1,
      heights.join(','),
    );
    await close();
  }
}

let server: ViteDevServer | undefined;
let browser: Browser | undefined;
try {
  let base = baseArg?.replace(/\/$/, '');
  if (!base) {
    // The API is deliberately absent; drop the dev proxy's per-request connection errors.
    const logger = createLogger('error');
    const logError = logger.error;
    logger.error = (msg, options) => {
      if (!/http proxy error/.test(msg)) logError(msg, options);
    };
    server = await createServer({
      server: { port: 8799, strictPort: false },
      customLogger: logger,
    });
    await server.listen();
    base = (server.resolvedUrls?.local[0] ?? 'http://127.0.0.1:8799/').replace(/\/$/, '');
  }
  await mkdir(outDir, { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  await generalChecks(browser, base);
  await budgetChecks(browser, base);
  await preparedSampleChecks(browser, base);
  await intakeChecks(browser, base);
  await connectChecks(browser, base);
  await landingChecks(browser, base);
} finally {
  await browser?.close();
  await server?.close();
}

const failed = results.filter((r) => !r.ok);
for (const r of results)
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${outDir}/`,
);
process.exit(failed.length ? 1 : 0);
