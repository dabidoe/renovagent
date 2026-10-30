import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { projectHandoff, projectScopeReview } from '@renovagent/core';
import { WorkspaceController } from '../../apps/web/src/app/workspace-controller.js';
import { IndexedDbProjectRepository } from '../../apps/web/src/adapters/indexeddb/project-repository.js';

test('the example project hands off its work, evidence, sources and open questions', async () => {
  const repo = await IndexedDbProjectRepository.open({
    factory: new IDBFactory(),
    name: crypto.randomUUID(),
    ownerId: 'local-owner',
  });
  const c = new WorkspaceController(repo, await repo.read());
  const id = await c.sampleProject();
  const state = await repo.read();

  const review = projectScopeReview(state, id)!;
  assert.equal(review.counts.conflicts, 0);
  assert.ok(review.counts.passes >= 1);

  const md = projectHandoff(state, id, '2026-10-30T12:00:00.000Z')!;
  // Labelled, dated and never presented as approval.
  assert.match(md, /Example project/);
  assert.match(md, /Proposed, not approved/);
  // Work in order of operations, with quantities from the recorded room.
  assert.ok(md.indexOf('1. Carpet removal') < md.indexOf('2. Wall paint'));
  assert.ok(md.indexOf('2. Wall paint') < md.indexOf('3. Wood-look vinyl plank floor'));
  assert.match(md, /Paintable wall area: 416 sq ft/);
  assert.match(md, /Floor length: 14 ft \(recorded in the project\)/);
  assert.doesNotMatch(md, /Toilet rough-in/);
  // Sources carry their URL and retrieval date; gaps say so.
  assert.match(md, /\(https:\/\/cdn\.shopify\.com\/[^)]+\), retrieved 2026-10-29/);
  assert.match(md, /Whether this work needs a permit was not researched/);
  assert.match(md, /## Contractor response/);
  // Prep is a note before the steps, not a numbered step.
  assert.doesNotMatch(md, /\d\. Protection and furniture/);
});
