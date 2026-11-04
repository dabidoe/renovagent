import test from 'node:test';
import assert from 'node:assert/strict';
import { openExampleCopy } from '../../apps/web/src/features/house-example/example-copy.js';
import {
  HUTCHINSON,
  HUTCHINSON_DESIGN,
} from '../../apps/web/src/features/house-example/hutchinson-project.js';

const uuid = '11111111-1111-4111-8111-111111111111';
test('public template opens an isolated namespace without reading legacy edits or save pointers', () => {
  const reads: string[] = [];
  const copy = openExampleCopy(
    HUTCHINSON,
    HUTCHINSON_DESIGN,
    null,
    (key) => {
      reads.push(key);
      return null;
    },
    () => uuid,
  );
  assert.equal(copy.scope, `example-copy-${uuid}`);
  assert.deepEqual(reads, []);
  copy.project.rooms[0]!.size!.xFt = 99;
  assert.notEqual(HUTCHINSON.rooms[0]!.size!.xFt, 99);
  assert.equal(copy.resumed, false);
});
test('only the current matching history entry resumes its copy and dimensions', () => {
  const scope = `example-copy-${uuid}`;
  const draft = structuredClone(HUTCHINSON_DESIGN);
  draft.project.id = scope;
  draft.project.ceilingFt = 11;
  const state = { renovagentExampleCopy: { sourceId: HUTCHINSON.id, scope } };
  const copy = openExampleCopy(
    HUTCHINSON,
    HUTCHINSON_DESIGN,
    state,
    () => JSON.stringify(draft),
    () => {
      throw Error('Must resume');
    },
  );
  assert.equal(copy.scope, scope);
  assert.equal(copy.project.ceilingFt, 11);
  assert.equal(copy.resumed, true);
  const fresh = openExampleCopy(
    { ...HUTCHINSON, id: 'different' },
    undefined,
    state,
    () => {
      throw Error('Must not read');
    },
    () => uuid,
  );
  assert.equal(fresh.resumed, false);
});
