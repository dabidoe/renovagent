import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '@renovagent/contracts';
import { renderFailureMessage } from '../../apps/web/src/features/room3d/photoreal.js';

test('the render UI preserves safe API failure causes instead of suggesting a local server', () => {
  for (const reason of [
    'service unavailable',
    'service configuration',
    'provider busy',
    'provider timeout',
  ]) {
    const message = `3D rendering could not complete (${reason}). Please retry.`;
    assert.equal(renderFailureMessage(new DomainError('STORAGE', message)), message);
  }
  const capture = 'Some furniture has not loaded. Reopen 3D and try again.';
  assert.equal(renderFailureMessage(Error(capture)), capture);
});

test('the render UI distinguishes connection failure from an unavailable API response', () => {
  assert.match(renderFailureMessage(new TypeError('Failed to fetch')), /Check your connection/);
  assert.match(renderFailureMessage(Error('Load failed')), /Check your connection/);
  assert.equal(
    renderFailureMessage(Error('Workspace API is unavailable')),
    'The Renovagent service is unavailable. Please try again.',
  );
});
