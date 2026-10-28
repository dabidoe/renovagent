import { captureInputs } from '../../packages/core/src/domain/input-context.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';
import { validatePropertyResearch, type Command } from '@unpermitted/contracts';
import {
  homeInventory,
  inventoryDirections,
  inventoryDirectionId,
  referenceCurrent,
  researchJobId,
} from '@unpermitted/core';
import { Scenario, context, openTestRepo } from '../foundation-helpers.js';
import { WorkspaceController } from '../../apps/web/src/app/workspace-controller.js';
const receipt = JSON.parse(
  readFileSync(
    new URL('../../docs/evidence/muse-hutchinson/inventory.json', import.meta.url),
    'utf8',
  ),
);
function setup() {
  const s = new Scenario();
  s.create();
  s.evidence('source');
  const research = validatePropertyResearch(
    JSON.parse(
      readFileSync(
        new URL('../../docs/evidence/muse-hutchinson/photo-results-live.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  for (const [key, text] of [
    ['propertyAddress', research.address],
    ['goal', research.photoReview!.goal!],
  ])
    s.apply(
      s.command('RecordFact', {
        scope: key === 'goal' ? 'project' : 'property',
        factId: key,
        subjectId: key === 'goal' ? 'project-a' : 'property-a',
        key,
        supersedesRevision: 0,
        value: { kind: 'text', text },
        assertion: 'user_reported',
        evidenceIds: ['source'],
      }),
    );
  research.jobId = researchJobId('project-a', 'propertyAddress', 1);
  s.artifact(
    'project-a:property-research',
    [
      { kind: 'fact', id: 'propertyAddress', revision: 1 },
      { kind: 'fact', id: 'goal', revision: 1 },
    ],
    'project-a',
    research,
  );
  return s;
}
function importCommand(s: Scenario, inventory = receipt.inventory): Command {
  return s.command('ImportPhotoInventory', {
    researchRef: {
      kind: 'artifact',
      id: 'project-a:property-research',
      revision: s.state.artifacts['project-a:property-research'].at(-1)!.revision,
    },
    inventory,
    expectedInventoryRevision: homeInventory(s.state, 'project-a')?.revision || 0,
  });
}
function direction(
  s: Scenario,
  disposition: 'retain' | 'replace' | 'investigate' | 'exclude' = 'replace',
) {
  const inv = homeInventory(s.state, 'project-a')!;
  if (inv.payload.kind !== 'photo-inventory') throw Error('Missing inventory');
  const item = inv.payload.items[0],
    id = inventoryDirectionId('project-a', inv.revision, item.id),
    old = s.state.artifacts[id]?.at(-1);
  return s.command('SetInventoryDirection', {
    inventoryRef: { kind: 'artifact', id: inv.id, revision: inv.revision },
    itemId: item.id,
    expectedDirectionRevision: old?.revision || 0,
    disposition,
    identification: disposition === 'exclude' ? 'rejected' : 'confirmed',
    correctedLabel: 'QA floor observation',
    note: 'Synthetic test preference; original model observation must remain intact.',
    messageId: `note-${++s.seq}`,
  });
}
test('real Muse regions preserve provenance and source facts while corrections update the brief and stale dependent accepted work', () => {
  const s = setup(),
    facts = structuredClone(s.state.facts);
  s.apply(importCommand(s));
  const original = structuredClone(homeInventory(s.state, 'project-a')!);
  s.apply(direction(s, 'retain'));
  const decisions = inventoryDirections(s.state, 'project-a', original);
  assert.equal(decisions.length, 1);
  assert.ok(captureInputs(s.state, 'project-a').some((r) => r.id === decisions[0].id));
  assert.deepEqual(s.state.facts, facts);
  assert.deepEqual(homeInventory(s.state, 'project-a')!.payload, original.payload);
  s.artifact('dependent-study', [{ kind: 'artifact', id: decisions[0].id, revision: 1 }]);
  s.accept('dependent-study');
  s.apply(direction(s, 'replace'));
  assert.equal(s.state.artifacts['dependent-study'].at(-1)!.freshness, 'stale');
  assert.equal(s.state.artifacts['dependent-study'].at(-1)!.lifecycle, 'accepted');
  assert.ok(s.state.artifacts[`${decisions[0].id}`][0].payload.kind === 'inventory-direction');
  const brief = s.state.artifacts['project-a:working-brief'].at(-1)!;
  assert.equal(brief.payload.kind, 'project-brief');
  if (brief.payload.kind === 'project-brief')
    assert.match(
      brief.payload.sections.map((s) => s.text).join('\n'),
      /QA floor observation: replace/,
    );
  assert.equal(
    referenceCurrent(s.state, 'project-a', { kind: 'artifact', id: original.id, revision: 1 }),
    true,
  );
});
test('out-of-frame regions, repeated identities, wrong image hashes and generic forgeries reject without partial writes', () => {
  const s = setup(),
    before = structuredClone(s.state);
  for (const mutate of [
    (v: any) => (v.items[0].polygon[0].x = 1001),
    (v: any) => v.items.push(v.items[0]),
    (v: any) => (v.photos[0].sha256 = 'f'.repeat(64)),
    (v: any) => (v.items[0].photoId = 'unknown-photo'),
  ]) {
    const invalid = structuredClone(receipt.inventory);
    mutate(invalid);
    assert.throws(() => s.apply(importCommand(s, invalid)));
    assert.deepEqual(s.state, before);
  }
  assert.throws(() => s.artifact('forged', [], 'project-a', receipt.inventory), /validated/);
  s.apply(importCommand(s));
  s.apply(direction(s));
  const current = homeInventory(s.state, 'project-a')!,
    d = inventoryDirections(s.state, 'project-a', current)[0];
  assert.throws(() => s.accept(d.id), /input/);
  assert.throws(() => s.accept(current.id), /input/);
  const late = direction(s);
  s.apply(direction(s, 'investigate'));
  assert.throws(() => s.apply(late), /revision|changed/i);
});
test('replacement photo research invalidates inventory and direction; a refreshed inventory does not inherit prior confirmations', () => {
  const s = setup();
  s.apply(importCommand(s));
  s.apply(direction(s));
  const inventory = homeInventory(s.state, 'project-a')!;
  const research = s.state.artifacts['project-a:property-research'].at(-1)!;
  s.artifact(research.id, research.inputRefs, 'project-a', research.payload);
  assert.equal(
    referenceCurrent(s.state, 'project-a', { kind: 'artifact', id: inventory.id, revision: 1 }),
    false,
  );
  assert.throws(() => s.apply(direction(s)), /changed|current/i);
  s.apply(importCommand(s));
  const fresh = homeInventory(s.state, 'project-a')!;
  assert.equal(fresh.revision, 2);
  assert.equal(inventoryDirections(s.state, 'project-a', fresh).length, 0);
  const bad = direction(s, 'exclude');
  if (bad.type === 'SetInventoryDirection') bad.payload.identification = 'confirmed';
  assert.throws(() => s.apply(bad), /Reject/);
});
test('direction and source hashes survive IndexedDB reopen without marking observations or construction verified', async () => {
  const s = setup();
  s.apply(importCommand(s));
  const factory = new IDBFactory(),
    name = crypto.randomUUID(),
    repo = await openTestRepo(factory, name);
  await repo.executeBatch(s.commands, context);
  const c = new WorkspaceController(repo, await repo.read());
  const command = direction(s);
  if (command.type !== 'SetInventoryDirection') throw Error('Expected direction');
  const { messageId: ignored, ...payload } = command.payload;
  void ignored;
  await c.setInventoryDirection('project-a', payload);
  const before = await repo.read();
  repo.close();
  const reopened = await openTestRepo(factory, name);
  assert.deepEqual(await reopened.read(), before);
  const inventory = homeInventory(before, 'project-a')!;
  assert.equal(
    inventory.payload.kind === 'photo-inventory' && inventory.payload.verification,
    'unreviewed',
  );
  assert.equal(inventory.lifecycle, 'proposed');
  reopened.close();
});

test('a new living-room bathroom goal blocks old inventory and cannot silently rebind the old Muse planning goal', () => {
  const s = setup();
  s.apply(importCommand(s));
  const inventory = homeInventory(s.state, 'project-a')!,
    research = s.state.artifacts['project-a:property-research'].at(-1)!;
  s.apply(
    s.command('RecordFact', {
      scope: 'project',
      factId: 'goal',
      subjectId: 'project-a',
      key: 'goal',
      supersedesRevision: 1,
      value: {
        kind: 'text',
        text: 'Add an additional half bath in the living room; existing basement half bath is owner-reported.',
      },
      assertion: 'user_reported',
      evidenceIds: ['source'],
    }),
  );
  assert.equal(
    referenceCurrent(s.state, 'project-a', { kind: 'artifact', id: inventory.id, revision: 1 }),
    false,
  );
  assert.throws(() => s.apply(direction(s)), /changed|current/);
  const updatedRefs = research.inputRefs.map((r) => (r.id === 'goal' ? { ...r, revision: 2 } : r));
  assert.throws(
    () => s.artifact(research.id, updatedRefs, 'project-a', research.payload),
    /earlier goal/,
  );
});
