import test from 'node:test';
import assert from 'node:assert/strict';
import { technicalWorkup, technicalMarkdown } from '../src/technical.js';

test('a Philadelphia bath has a linked adoption reference and unresolved system investigations', () => {
  const result = technicalWorkup({ goal: 'Add a half bathroom', location: 'Philadelphia' });
  assert.match(result.source.url, /^https:\/\/www.phila.gov\//);
  assert.equal(result.checks.length, 3);
  assert.match(result.checks[1].need, /connection elevation/);
  assert.match(result.basis, /unit count/);
});
test('an unknown jurisdiction does not inherit Philadelphia requirements', () => {
  const result = technicalWorkup({ goal: 'Renovate the kitchen', location: 'Chicago' });
  assert.equal(result.source, null);
  assert.match(result.checks[0].evidence, /Appliance cut sheets/);
});
test('export preserves evidence needs and unresolved applicability', () => {
  const result = technicalMarkdown({ goal: 'Add a half bathroom', location: 'Philadelphia' });
  assert.match(result, /Status: unresolved/);
  assert.match(result, /No section-level requirement has been verified/);
  assert.match(result, /inspection/);
});
