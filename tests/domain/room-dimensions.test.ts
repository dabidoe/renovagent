import test from 'node:test';
import assert from 'node:assert/strict';
import { roomDimensionCommands, scopeDraftId } from '@renovagent/core';
import type { ScopeDraft } from '@renovagent/contracts';
import { Scenario } from '../foundation-helpers.js';

const PID = 'project-a';
const ft = (amount: number) => ({ amount, unit: 'ft' as const });
const room = {
  length: ft(12),
  width: ft(10),
  height: { amount: 96, unit: 'in' as const },
  method: 'tape-measure' as const,
  notes: '',
  photoEvidenceIds: [],
};

function save(s: Scenario, input: unknown, tag: string) {
  let n = 0;
  const commands = roomDimensionCommands(s.state, PID, input, {
    commandId: (step) => `cmd-${tag}-${step}`,
    evidenceId: `evidence-${tag}`,
    factId: () => `fact-${tag}-${n++}`,
  });
  for (const command of commands) s.apply(command);
  return commands;
}
function draft(s: Scenario) {
  s.apply(
    s.command('DraftScope', {
      recipeId: 'bathroom-refresh',
      packageIds: ['floor-tile', 'paint'],
      request: 'Retile and paint',
      reported: [],
      expectedDraftRevision: s.state.artifacts[scopeDraftId(PID)]?.at(-1)?.revision ?? 0,
    }),
  );
  return s.state.artifacts[scopeDraftId(PID)].at(-1)!;
}
const tile = (a: { payload: unknown }) =>
  (a.payload as ScopeDraft).requirements.find((r) => r.id === 'floor-tile:tile')!;

test('saved room dimensions become canonical project facts with evidence', () => {
  const s = new Scenario();
  s.create();
  save(s, room, 'a');
  const facts = Object.values(s.state.facts).map((v) => v.at(-1)!);
  const byKey = Object.fromEntries(facts.map((f) => [f.key, f]));
  const mm = (key: string) => {
    const v = byKey[key].value;
    assert.ok(v.kind === 'quantity' && v.unit === 'mm');
    return Math.round(v.amount * 10) / 10;
  };
  assert.equal(mm('finishedLength'), 3657.6);
  assert.equal(mm('ceilingHeight'), 2438.4);
  assert.deepEqual(byKey.finishedWidth.originalValue, {
    kind: 'quantity',
    dimension: 'length',
    amount: 10,
    unit: 'ft',
  });
  for (const f of facts) {
    assert.equal(f.assertion, 'user_reported');
    assert.equal(f.verification, null);
    assert.equal(f.projectId, PID);
    assert.deepEqual(f.evidenceIds, ['evidence-a']);
  }
  const evidence = s.state.evidence['evidence-a'].source;
  assert.match(evidence.description, /Tape measure; not verified/);
  assert.match(evidence.description, /Floor length 12 ft/);
});

test('a later save supersedes the same facts instead of adding new ones', () => {
  const s = new Scenario();
  s.create();
  save(s, room, 'a');
  save(s, { ...room, length: ft(13), width: null, height: null, method: 'phone-ar-app' }, 'b');
  const lengths = Object.values(s.state.facts).filter((v) => v.at(-1)!.key === 'finishedLength');
  assert.equal(lengths.length, 1);
  assert.equal(lengths[0].at(-1)!.revision, 2);
  assert.deepEqual(lengths[0].at(-1)!.evidenceIds, ['evidence-b']);
  assert.equal(Object.keys(s.state.facts).length, 3);
});

test('a first-time measurement stales an existing draft; re-drafting quantifies it', () => {
  const s = new Scenario();
  s.create();
  const blocked = draft(s);
  assert.equal(tile(blocked).quantity, null);
  save(s, room, 'a');
  assert.equal(s.state.artifacts[scopeDraftId(PID)].at(-1)!.freshness, 'stale');
  const fresh = draft(s);
  assert.equal(fresh.freshness, 'current');
  assert.equal(tile(fresh).quantity, 120);
  assert.equal(
    (fresh.payload as ScopeDraft).inputs.find((i) => i.key === 'ceilingHeightFt')!.source,
    'workspace-fact',
  );
});

test('invalid room dimensions are rejected before any command is built', () => {
  const s = new Scenario();
  s.create();
  const ids = { commandId: (x: string) => x, evidenceId: 'e', factId: () => 'f' };
  assert.throws(
    () => roomDimensionCommands(s.state, PID, { ...room, length: ft(0) }, ids),
    /greater than zero/,
  );
  assert.throws(
    () =>
      roomDimensionCommands(
        s.state,
        PID,
        { ...room, length: null, width: null, height: null },
        ids,
      ),
    /at least one dimension/,
  );
  assert.throws(() => roomDimensionCommands(s.state, PID, { ...room, method: 'guess' }, ids));
  // Photo evidence must already exist in the project.
  assert.throws(() => save(s, { ...room, photoEvidenceIds: ['missing-photo'] }, 'c'));
});
