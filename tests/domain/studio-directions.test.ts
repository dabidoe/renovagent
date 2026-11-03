import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { studioItemBudget, studioPlacementWarnings } from '@renovagent/core';
import { directionDesign } from '../../apps/web/src/features/house-example/direction-design.js';
import { STUDIO_DIRECTIONS } from '../../apps/web/src/features/house-example/studio-directions.js';
import { studioStylingSignature } from '../../apps/web/src/features/house-example/studio-signatures.js';
import {
  roomModel,
  type HouseProject,
} from '../../apps/web/src/features/house-example/paint-floor.js';

const source = JSON.parse(
  readFileSync('public/examples/oakland/project.json', 'utf8'),
) as HouseProject;
test('each carousel direction opens its own coherent studio proposal with explicit demo allowances', () => {
  assert.equal(new Set(STUDIO_DIRECTIONS.map((d) => d.id)).size, 3);
  for (const direction of STUDIO_DIRECTIONS) {
    const before = JSON.stringify(source);
    const design = directionDesign(source, direction);
    assert.equal(JSON.stringify(source), before, 'the original listing is unchanged');
    assert.notEqual(design.project.id, source.id, 'isolated browser draft namespace');
    assert.equal(design.project.idea, undefined, 'opening an example cannot run automatic Imagine');
    const room = design.project.rooms[0]!;
    const items = design.items![room.id]!;
    const placements = design.placements![room.id]!;
    assert.equal(design.inspired[room.id], direction.image);
    assert.equal(room.photo.src, source.rooms[0]!.photo.src);
    assert.ok(room.sizeNote && design.project.ceilingNote);
    assert.equal(
      placements.length,
      direction.pieces.reduce((n, p) => n + p.count, 0),
    );
    for (const item of items) {
      assert.equal(item.allowanceSource, 'demo');
      assert.ok(item.unitAllowanceMinor! > 0);
      assert.equal(placements.filter((p) => p.itemId === item.id).length, item.quantity);
    }
    const budget = studioItemBudget(items);
    assert.equal(budget.unpriced, 0);
    assert.equal(
      budget.allowanceMinor,
      { 'studio-lounge': 111500, 'studio-office': 52000, 'studio-dining': 86500 }[direction.id],
    );
    assert.ok(budget.lines.every((l) => l.totalMinor! > 0));
    const model = roomModel(room, design.project.ceilingFt)!;
    assert.deepEqual(studioPlacementWarnings(model, placements), [], direction.id);
    const draft = design.styling[room.id]!;
    const signature = studioStylingSignature({
      ...draft,
      brief: draft.brief!,
      items,
      finishSignature: design.renderSignatures[room.id],
    });
    assert.equal(draft.resultSignature, signature);
    assert.notEqual(
      studioStylingSignature({
        ...draft,
        brief: 'Change the design',
        items,
        finishSignature: design.renderSignatures[room.id],
      }),
      signature,
    );
    assert.notEqual(
      studioStylingSignature({
        ...draft,
        brief: draft.brief!,
        items: items.map((i, n) => (n ? i : { ...i, quantity: 2 })),
        finishSignature: design.renderSignatures[room.id],
      }),
      signature,
    );
  }
});

test('the prepared images retain source and output hashes, and wrong rooms cannot reuse the concepts', () => {
  const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
  const provenance = JSON.parse(
    readFileSync('public/examples/studio-story/directions-provenance.json', 'utf8'),
  );
  assert.equal(provenance.receipts.length, 2);
  for (const receipt of provenance.receipts) {
    assert.equal(receipt.model, 'muse-image-1.0');
    assert.equal(hash(`public${receipt.input}`), receipt.inputSha256);
    assert.equal(hash(receipt.output.replace('./', 'public/')), receipt.outputSha256);
  }
  for (const direction of STUDIO_DIRECTIONS)
    assert.ok(readFileSync(direction.image.replace('./', 'public/')).length > 10000);
  assert.throws(() => directionDesign({ ...source, id: 'another-room' }, STUDIO_DIRECTIONS[0]!));
});

test('shared styling signatures preserve saved-render freshness and do not invent missing geometry', () => {
  const data = {
    inspo: null,
    borrow: ['rug', 'chair'],
    paint: null,
    mode: 'furnish' as const,
    keep: '  original trim  ',
    finishSignature: 'finishes',
    brief: '  a lounge  ',
    items: [],
  };
  assert.equal(
    studioStylingSignature(data),
    JSON.stringify({
      borrow: ['chair', 'rug'],
      paint: null,
      mode: 'furnish',
      keep: 'original trim',
      finishes: 'finishes',
      brief: 'a lounge',
      roomItems: [],
    }),
  );
  assert.deepEqual(data.borrow, ['rug', 'chair']);
  const room = { ...source.rooms[0]! };
  delete room.size;
  const design = directionDesign(
    { ...source, ceilingFt: null, rooms: [room] },
    STUDIO_DIRECTIONS[0]!,
  );
  assert.equal(design.project.rooms[0]!.size, undefined);
  assert.equal(design.project.ceilingFt, null);
  assert.deepEqual(design.placements![room.id], []);
});
