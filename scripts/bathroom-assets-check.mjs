// Offline WebGL and UI check. No accounts, database, or provider calls.
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
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/**', (r) =>
    r.fulfill({ status: 503, json: { message: 'Offline fixture' } }),
  );
  await page.goto('http://127.0.0.1:8832/#example/brooklyn', { waitUntil: 'networkidle' });
  await page
    .getByRole('tablist', { name: 'View', exact: true })
    .getByRole('tab', { name: 'Furnishings', exact: true })
    .click();
  await page.locator('.pf-3d-host canvas').waitFor();
  await page.getByRole('button', { name: 'Add Bathroom starter', exact: true }).click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem('renovagent.studio.brooklyn.placements.v1'))?.['image-03']
        ?.length === 4,
  );
  assert.ok(
    await page.getByRole('button', { name: 'Add Bathroom starter', exact: true }).isDisabled(),
  );
  await page.getByRole('button', { name: 'Add Bathtub to 3D', exact: true }).click();
  await page.getByRole('button', { name: 'Add Pedestal sink to 3D', exact: true }).click();
  // Verify the real browser loader normalizes every fixture and preserves elevation/rotation.
  const result = await page.evaluate(async () => {
    const { STUDIO_ASSETS } = await import('/packages/core/src/geometry/studio-furniture.ts');
    const { furnitureObject, positionFurniture, furnitureThumbnail } = await import(
      '/apps/web/src/features/room3d/furniture-assets.ts'
    );
    const { Box3, Vector3 } = await import('/node_modules/three/build/three.module.js');
    const rows = [];
    for (const a of STUDIO_ASSETS.filter((a) => a.url)) {
      const p = {
        id: a.id,
        itemId: a.id,
        assetId: a.id,
        xM: 2,
        zM: 3,
        yM: a.defaultElevationM,
        rotationDeg: 90,
        widthM: a.size[0],
        depthM: a.size[1],
        heightM: a.size[2],
        color: a.color,
      };
      const ob = await furnitureObject(p);
      positionFurniture(ob, p);
      ob.updateMatrixWorld(true);
      const box = new Box3().setFromObject(ob),
        size = box.getSize(new Vector3());
      rows.push({
        id: a.id,
        actual: size.toArray(),
        expected: [a.size[1], a.size[2], a.size[0]],
        base: box.min.y,
        y: p.yM,
        thumb: (await furnitureThumbnail(a.id)).startsWith('data:image/png'),
      });
    }
    return rows;
  });
  assert.equal(result.length, 6);
  for (const row of result) {
    row.actual.forEach((n, i) => assert.ok(Math.abs(n - row.expected[i]) < 0.00001, row.id));
    assert.ok(Math.abs(row.base - row.y) < 0.00001);
    assert.ok(row.thumb);
  }
  await page.getByRole('spinbutton', { name: 'Elevation above floor', exact: true }).fill('0.25');
  await page.getByRole('slider', { name: 'Rotate selected furniture', exact: true }).fill('90');
  await page
    .getByRole('combobox', { name: 'Place fixture against wall', exact: true })
    .selectOption('wall-2');
  await page.reload({ waitUntil: 'networkidle' });
  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem('renovagent.studio.brooklyn.placements.v1'))['image-03'],
  );
  assert.equal(stored.length, 6);
  assert.equal(stored.at(-1).wallId, 'wall-2');
  assert.equal(stored.at(-1).rotationDeg, -90);
  assert.deepEqual(errors, []);
  await mkdir('.local/bathroom-concept', { recursive: true });
  await page
    .getByRole('tablist', { name: 'View', exact: true })
    .getByRole('tab', { name: 'Furnishings', exact: true })
    .click();
  await page.locator('.pf-3d-host canvas').waitFor();
  await page.locator('.pf-3d-host').screenshot({ path: '.local/bathroom-concept/webgl.png' });
  console.log(
    'Bathroom browser checks passed: 6 GLBs, normalized bounds, rotations/elevation, thumbnails, starter, edits and reload.',
  );
} finally {
  await browser.close();
  await server.close();
}
