import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyPlanningInputs, type PlanningInputs } from '@renovagent/contracts';
import {
  assessDrainage,
  determineCodeBasis,
  sourceCaptureDate,
  sourceSetVersion,
  technicalSources,
} from '@renovagent/core';
import { measured } from '../../fixtures/projects/technical-reference.js';
import { LocalCodeCard } from '../../apps/web/src/features/house-example/local-code-card.js';

const forbidden = /compliant|approved|passed|no permit needed/i;
const escape = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function philadelphia() {
  const inputs = emptyPlanningInputs();
  inputs.context.jurisdiction = 'philadelphia';
  inputs.context.locality = {
    countryCode: 'US',
    regionCode: 'PA',
    municipality: 'Philadelphia',
    postalCode: null,
    propertyReference: 'Reported example address',
    boundaryBasis: 'user-reported',
  };
  return inputs;
}
const render = (inputs?: PlanningInputs, address = 'Reported example address') =>
  renderToStaticMarkup(createElement(LocalCodeCard, { address, inputs }));

test('Philadelphia card shows the exact captured adoption chain, permit sources and real package version', () => {
  const inputs = philadelphia();
  const html = render(inputs);
  assert.match(html, /Local code — Philadelphia, PA/);
  assert.match(html, /Reported address: Reported example address/);
  assert.match(html, /not geocoded/);
  for (const id of [
    'pa-ucc',
    'phila-adoption',
    'phila-transition',
    'phila-plumbing-scope',
    'phila-permits',
    'phila-permit-exceptions',
  ]) {
    const source = technicalSources.find((record) => record.id === id)!;
    assert.ok(
      html.includes(`href="${escape(source.url)}" target="_blank" rel="noopener noreferrer"`),
    );
    assert.ok(html.includes(escape(source.title)));
    assert.ok(html.includes(escape(source.locator)));
  }
  assert.ok(html.includes(determineCodeBasis(inputs.context).decision));
  assert.match(html, /Check whether this work needs a permit/);
  assert.match(html, /needs_input/);
  assert.doesNotMatch(html, /P-919/);
  assert.doesNotMatch(html, /<details open/);
  assert.ok(html.includes(sourceSetVersion));
  assert.equal(sourceCaptureDate, '2026-10-27');
  assert.match(html, /Sources captured Oct 27, 2026 · Not yet reviewed by a licensed professional/);
  assert.doesNotMatch(html, forbidden);
});

test('other jurisdictions and unknown or conflicting locality show only the coverage notice', () => {
  const other = philadelphia();
  other.context.jurisdiction = 'other';
  other.context.locality.regionCode = 'CA';
  other.context.locality.municipality = 'Oakland';
  const conflict = philadelphia();
  conflict.context.locality.regionCode = 'NY';
  const boundaryUnknown = philadelphia();
  boundaryUnknown.context.locality.boundaryBasis = 'unknown';
  for (const inputs of [undefined, other, conflict, boundaryUnknown]) {
    // A free-text Philadelphia address cannot select an enforcing authority.
    const html = render(inputs, '123 Example St, Philadelphia, PA 19148');
    assert.match(
      html,
      /Local code coverage is available for Philadelphia, PA in this preview\. Add your property address to check\./,
    );
    assert.doesNotMatch(html, /href=|P-103|P-919|Bill 250645|Sources captured/);
    assert.doesNotMatch(html, forbidden);
  }
});

test('an explicit half-bath scope retains actual core drainage statuses and existing review limits', () => {
  const inputs = measured();
  inputs.site.drainFall = { amount: 1, unit: 'in' };
  const html = render(inputs);
  const drainage = assessDrainage(inputs);
  assert.equal(drainage.checks[0]!.status, 'not_supported');
  assert.ok(html.includes(drainage.checks[0]!.status));
  assert.match(html, /needs_review/);
  assert.match(html, /unavailable/);
  for (const id of ['phila-single-stack', 'phila-drainage-table', 'phila-aav']) {
    const source = technicalSources.find((s) => s.id === id)!;
    assert.ok(html.includes(escape(source.locator)));
    assert.ok(html.includes(escape(source.url)));
    for (const need of source.reviewNeeded ?? []) assert.ok(html.includes(escape(need)));
  }
  assert.doesNotMatch(html, /Check whether this work needs a permit/);
  assert.doesNotMatch(html, forbidden);
});

test('withheld sources keep unavailable labels and missing filing facts never select an edition', () => {
  const inputs = philadelphia();
  inputs.context.unavailableSourceIds = ['phila-permits'];
  const html = render(inputs);
  assert.match(html, /unavailable/);
  assert.match(html, /No code edition selected/);
  assert.doesNotMatch(html, /Candidate general edition:/);
  assert.doesNotMatch(html, forbidden);
});
