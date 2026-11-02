import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { register } from 'node:module';
// The viewer's camera controls import CSS; Node's render test needs only the component tree.
register(
  'data:text/javascript,' +
    encodeURIComponent(
      `export async function load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context); }`,
    ),
  import.meta.url,
);
const { PaintFloorStudio } = await import(
  '../../apps/web/src/features/house-example/paint-floor-studio.js'
);
import { HUTCHINSON } from '../../apps/web/src/features/house-example/hutchinson-project.js';
import { StudioError } from '../../apps/web/src/features/house-example/studio-error.js';

// Render the real editor, including its initial React state, without a browser or provider.
test('the studio opens Paint & floor and renders no sheen or tier controls in its paint picker', () => {
  const html = renderToStaticMarkup(
    createElement(PaintFloorStudio, { project: HUTCHINSON, kicker: 'UI fixture' }),
  );
  const tabs = html.match(/aria-label="Studio tools"[\s\S]*?<\/div>/)![0];
  assert.match(tabs, /aria-selected="true"[^>]*>Paint &amp; floor<\/button>/);
  assert.deepEqual(
    [...tabs.matchAll(/>(Paint &amp; floor|Furniture|Restyle|Plan &amp; budget)<\/button>/g)].map(
      (m) => m[1],
    ),
    ['Paint &amp; floor', 'Furniture', 'Restyle', 'Plan &amp; budget'],
  );
  const picker = html.match(
    /<div class="pf-group">[\s\S]*?aria-label="Wall colour"[\s\S]*?<\/div><\/div>/,
  )![0];
  assert.doesNotMatch(
    picker,
    /aria-label="(?:Finish|Paint sheen|Paint line|Price tier)"|Satin|Matte|Premium|Contractor/,
  );
  assert.match(html, /aria-label="Paint sheen"/);
  assert.match(html, /aria-label="Paint line"/);
});

test('studio errors keep complete diagnostics behind a closed Details disclosure', () => {
  const diagnostic = `Model or endpoint unavailable /images/edits muse-image-1.0 model_not_found ${'detail '.repeat(80)}END`;
  const html = renderToStaticMarkup(createElement(StudioError, { message: diagnostic }));
  assert.match(html, /The preview service is unavailable right now\./);
  assert.match(html, /<details><summary>Details<\/summary>/);
  assert.ok(html.includes(diagnostic));
  assert.doesNotMatch(html, /<details open/);
});
