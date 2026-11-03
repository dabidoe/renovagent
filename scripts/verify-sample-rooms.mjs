// Frontend only: every API request is intercepted; no provider/database calls.
// PLAYWRIGHT_MODULE must point at an existing Playwright installation.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { emptyWorkspace } = await import('@renovagent/contracts');
const base = process.env.SAMPLE_ROOMS_URL || 'http://127.0.0.1:8745';
assert.equal(new URL(base).hostname, '127.0.0.1', 'Only a local frontend may be used');
const output = new URL('../docs/previews/sample-rooms/', import.meta.url);
await mkdir(output, { recursive: true });
const manifest = JSON.parse(
  await readFile(new URL('../public/starter-rooms/manifest.json', import.meta.url), 'utf8'),
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});
let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};
async function setup(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  let signedIn = false,
    revision = 0;
  const events = [],
    uploads = [],
    calls = [];
  let image = await readFile(new URL('../public/starter-rooms/living-room.jpg', import.meta.url));
  const images = new Map();
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.replace('/api/workspace', '');
    calls.push(path);
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/session' || path === '/auth/me')
      return json({
        mode: 'account',
        signedIn,
        guests: true,
        providers: [],
        ...(signedIn ? { user: { email: 'fixture@example.test', guest: true } } : {}),
      });
    if (path === '/auth/guest') {
      events.push('mint');
      signedIn = true;
      return json({ ok: true });
    }
    if (path === '') return json(emptyWorkspace('sample-room-guest-fixture'));
    if (path === '/studio/photo') {
      check(signedIn, 'guest minted before photo upload');
      events.push('upload');
      image = request.postDataBuffer();
      const sha = createHash('sha256').update(image).digest('hex');
      images.set(sha, image);
      uploads.push({ request, bytes: image });
      return json({ sha256: sha });
    }
    if (path.startsWith('/design-images/'))
      return route.fulfill({
        contentType: 'image/jpeg',
        body: images.get(path.split('/').pop()) || image,
      });
    if (path === '/studio/read') {
      const body = request.postDataJSON();
      return json({
        photos: body.photos.map((sha256) => ({
          sha256,
          kind: 'other',
          title: 'Room photo',
          floor: 'other',
        })),
        plans: [],
        ceiling: { ft: null, note: 'UI fixture: dimensions unknown' },
      });
    }
    if (path === '/studio/walls') return json({ width: 1600, height: 1000, segments: [] });
    if (path === '/studio-designs')
      return json({ projectId: 'sample-room-guest-fixture', revision: ++revision });
    if (path === '/studio/imagine') return json({ color: null, floorStyle: null, extras: [] });
    if (path === '/studio/finds') return json({ finds: [] });
    if (path === '/paint/search') return json({ colors: [] });
    return json({ message: `Unimplemented UI fixture ${path}` }, 503);
  });
  return { page, context, events, uploads, calls };
}
async function openGallery(page, fromLanding) {
  await page.goto(base + (fromLanding ? '/' : '/#your-project'));
  await page.waitForTimeout(500);
  await page
    .getByRole('button', {
      name: fromLanding ? 'Add room photos' : /Room photos.*One per room/,
      exact: false,
    })
    .click();
  const sheet = page.getByRole('dialog', { name: 'Add photo', exact: true });
  await sheet.getByRole('button', { name: 'Sample rooms', exact: false }).click();
  await sheet.getByRole('button', { name: /Living room.*Sample room/ }).waitFor();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.sample-room-grid img')].every(
      (image) => image.complete && image.naturalWidth > 0,
    ),
  );
  check((await sheet.getByRole('button', { name: /Take photo/ }).count()) === 1, 'camera option');
  check(
    (await sheet.getByLabel('Take room photo').getAttribute('capture')) === 'environment',
    'mobile camera input',
  );
  check(
    (await sheet.getByLabel('Take room photo').getAttribute('accept')) === 'image/*',
    'camera accepts photos',
  );
  check((await sheet.getByLabel('Upload room photos').count()) === 1, 'normal upload input');
  check(
    !(await sheet.getByLabel('Upload room photos').isVisible()),
    'native upload input remains hidden',
  );
  check(
    !(await sheet.getByLabel('Take room photo').isVisible()),
    'native camera input remains hidden',
  );
  return sheet;
}
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const { page, context, events, uploads, calls } = await setup(viewport);
    const size = `${viewport.width}x${viewport.height}`;
    // The phone starts at intake, the desktop starts on the actual landing picker.
    const landing = viewport.width === 1440;
    const sheet = await openGallery(page, landing);
    await page.screenshot({ path: fileURLToPath(new URL(`add-photo-${size}.png`, output)) });
    check(
      await sheet.evaluate((el) => el.scrollWidth <= el.clientWidth),
      `${size} sheet has no horizontal overflow`,
    );
    check(uploads.length === 0 && !events.includes('mint'), 'choosing source does not mint/upload');
    await sheet.getByRole('button', { name: /Living room.*Sample room/ }).click();
    if (landing) await page.getByRole('button', { name: 'Start a project', exact: true }).click();
    else await page.getByRole('button', { name: 'Build my plan', exact: false }).click();
    await page.getByRole('button', { name: 'Continue as guest', exact: true }).click();
    await page.locator('.pf-studio').waitFor();
    await page.getByText('Sample room ⓘ', { exact: true }).waitFor();
    await page.waitForTimeout(1000);
    check(events.join(',') === 'mint,upload', 'guest mint precedes exactly one sample upload');
    check(uploads[0].request.method() === 'POST', 'raw sample POST');
    check(uploads[0].request.headers()['content-type'] === 'image/jpeg', 'JPEG upload header');
    check(
      uploads[0].request.headers()['x-file-name'] === 'living-room.jpg',
      'normal filename header',
    );
    check(
      uploads[0].bytes.equals(
        await readFile(new URL('../public/starter-rooms/living-room.jpg', import.meta.url)),
      ),
      'actual static file bytes reach upload',
    );
    check(
      (await page
        .getByRole('tab', { name: 'Paint & floor', exact: true })
        .getAttribute('aria-selected')) === 'true',
      'Paint & floor default',
    );
    const beforeCalls = calls.filter((path) =>
      ['/studio/imagine', '/studio/floor', '/studio/restyle'].includes(path),
    ).length;
    const chip = page.getByRole('button', { name: manifest[0].suggestions[0], exact: true });
    check(
      await chip.evaluate((el) => el.clientWidth >= 150 && el.scrollWidth <= el.clientWidth),
      'suggestion chip has readable full text',
    );
    await chip.click();
    check(
      (await page.locator('#pf-imagine-text').inputValue()) === manifest[0].suggestions[0],
      'chip fills editable prompt',
    );
    check(
      calls.filter((path) => ['/studio/imagine', '/studio/floor', '/studio/restyle'].includes(path))
        .length === beforeCalls,
      'chip does not run models',
    );
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/studio/imagine')),
      page.getByRole('button', { name: 'Apply', exact: true }).click(),
    ]);
    check(calls.includes('/studio/imagine'), 'normal Apply still invokes live-path endpoint');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: fileURLToPath(new URL(`sample-project-${size}.png`, output)) });
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `${size} project has no horizontal overflow`,
    );
    await page.getByText('Sample room ⓘ', { exact: true }).click();
    check(
      await page
        .locator('.sample-room-info')
        .innerText()
        .then((t) => t.includes(manifest[0].source) && t.includes(manifest[0].license)),
      'source/license disclosure',
    );
    await page.reload();
    await page.getByText('Sample room ⓘ', { exact: true }).waitFor();
    check(
      (await page
        .getByRole('button', { name: manifest[0].suggestions[0], exact: true })
        .count()) === 1,
      'sample attribution and suggestions survive reload',
    );
    await context.close();
  }
  // A sourced empty room can be furnished through the existing live request path.
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const { page, context, events, uploads, calls } = await setup(viewport);
    const sheet = await openGallery(page, false);
    check(
      (await sheet.locator('.sample-room-grid article').count()) === 8,
      'all eight room photos are available',
    );
    check(
      (await sheet.locator('.sample-room-credit a').count()) === 6,
      'all sourced photos link to photographer pages',
    );
    check(
      await sheet
        .locator('.sample-room-grid img')
        .evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)),
      'all thumbnails load',
    );
    await sheet
      .getByLabel('Filter sample rooms')
      .getByRole('button', { name: 'kitchen', exact: true })
      .click();
    check(
      (await sheet.locator('.sample-room-grid article').count()) === 1,
      'kitchen filter isolates kitchen',
    );
    await sheet
      .getByLabel('Filter sample rooms')
      .getByRole('button', { name: 'living room', exact: true })
      .click();
    check(
      (await sheet.locator('.sample-room-grid article').count()) === 2,
      'living room filter includes empty apartment',
    );
    await sheet.getByRole('button', { name: /Empty apartment.*Sample room/ }).click();
    await page.getByRole('button', { name: /Build my plan/ }).click();
    await page.getByRole('button', { name: 'Continue as guest', exact: true }).click();
    await page.locator('.pf-studio').waitFor();
    check(events.join(',') === 'mint,upload', 'sourced photo uses guest gate before upload');
    const room = manifest.find((entry) => entry.id === 'empty-apartment');
    check(
      uploads[0].bytes.equals(
        await readFile(new URL('../public/starter-rooms/' + room.file, import.meta.url)),
      ),
      'sourced photo uploads exact local asset bytes',
    );
    await page.getByText('Sample room ⓘ', { exact: true }).click();
    check(
      (await page.locator('.sample-room-info a').count()) === 2,
      'project links source and license',
    );
    check(
      (await page.locator('.sample-room-info a').first().getAttribute('href')) === room.sourceUrl,
      'project source is the actual photographer page',
    );
    await page.getByText('Sample room ⓘ', { exact: true }).click();
    await page.getByRole('button', { name: 'Try furniture ideas', exact: true }).click();
    check(
      (await page
        .getByRole('tab', { name: 'Restyle', exact: true })
        .getAttribute('aria-selected')) === 'true',
      'furniture shortcut opens Restyle',
    );
    await page
      .getByRole('button', { name: room.furnishingSuggestions[0].title, exact: true })
      .click();
    check(
      (await page.getByLabel('Your design brief', { exact: true }).inputValue()) ===
        room.furnishingSuggestions[0].brief,
      'furniture direction fills editable brief',
    );
    check(!calls.includes('/studio/restyle'), 'furniture prompt does not auto-run generation');
    await page
      .getByLabel('Your design brief', { exact: true })
      .fill(room.furnishingSuggestions[0].brief + ' Add one blue cushion.');
    await page.locator('.pf-inspo').scrollIntoViewIfNeeded();
    await page.screenshot({
      path: fileURLToPath(
        new URL(`sample-furniture-${viewport.width}x${viewport.height}.png`, output),
      ),
    });
    const [response] = await Promise.all([
      page.waitForResponse((response) => response.url().endsWith('/studio/restyle')),
      page.getByRole('button', { name: 'Create room design', exact: true }).click(),
    ]);
    const body = response.request().postDataJSON();
    check(
      body.mode === 'furnish' && body.brief.endsWith('Add one blue cushion.'),
      'normal Create sends editable furniture brief and furnish mode',
    );
    check(
      body.sha256 === createHash('sha256').update(uploads[0].bytes).digest('hex') &&
        body.preserveFloor === true,
      'normal Restyle uses uploaded image and existing floor-preservation flag',
    );
    await page.locator('.pf-inspo .pf-studio-error').waitFor();
    check(
      (await page.locator('.pf-inspo .pf-studio-error details[open]').count()) === 0,
      'unavailable fixture provider shows collapsed Details with no canned result',
    );
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'furniture inspector has no horizontal overflow',
    );
    await context.close();
  }
  // A normal user file goes through the same guest gate and raw upload in the UI.
  {
    const { page, context, events, uploads } = await setup({ width: 390, height: 844 });
    const sheet = await openGallery(page, false);
    const ownerBytes = await readFile(
      new URL('../public/starter-rooms/bedroom.jpg', import.meta.url),
    );
    await sheet
      .getByLabel('Upload room photos')
      .setInputFiles({ name: 'my-bedroom.jpg', mimeType: 'image/jpeg', buffer: ownerBytes });
    await page.getByRole('button', { name: /Build my plan/ }).click();
    await page.getByRole('button', { name: 'Continue as guest', exact: true }).click();
    await page.locator('.pf-studio').waitFor();
    check(events.join(',') === 'mint,upload', 'ordinary user file has identical guest ordering');
    check(
      uploads[0].request.headers()['content-type'] === 'image/jpeg' &&
        uploads[0].request.headers()['x-file-name'] === 'my-bedroom.jpg',
      'ordinary file uses same binary headers',
    );
    check(uploads[0].bytes.equals(ownerBytes), 'ordinary file uploads exact bytes');
    check(
      (await page.locator('.sample-room-info').count()) === 0,
      'ordinary upload is not labelled as sample',
    );
    await context.close();
  }
  // Invalid rights never render in the real sheet, and static failures use Details.
  const { page, context, uploads } = await setup({ width: 390, height: 844 });
  await page.route('**/starter-rooms/manifest.json', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        manifest[0],
        { ...manifest[1], title: 'No source', source: undefined },
        { ...manifest[1], id: 'no-license', title: 'No license', license: '' },
      ]),
    }),
  );
  const sheet = await openGallery(page, false);
  check(
    (await sheet.locator('.sample-room-grid button').count()) === 1,
    'invalid rights entries not rendered',
  );
  await page.route('**/starter-rooms/living-room.jpg', (route) =>
    route.fulfill({ status: 404, body: 'missing' }),
  );
  await sheet.getByRole('button', { name: /Living room.*Sample room/ }).click();
  await sheet.getByRole('alert').waitFor();
  check(
    (await sheet.getByRole('alert').locator('details[open]').count()) === 0,
    'friendly error starts collapsed',
  );
  await sheet.getByText('Details', { exact: true }).click();
  check((await sheet.getByRole('alert').innerText()).includes('HTTP 404'), 'full fetch diagnostic');
  check(uploads.length === 0, 'failed photo fetch cannot upload or open canned result');
  await context.close();
  console.log(
    `Sample-room browser QA: ${checks} assertions passed; six screenshots; intercepted APIs only.`,
  );
} finally {
  await browser.close();
}
