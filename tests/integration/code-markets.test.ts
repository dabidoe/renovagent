import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import {
  adoptedCodeDigest,
  codePlace,
  projectHandoff,
  projectScopeReview,
  reviewLocations,
} from '@renovagent/core';
import { WorkspaceController } from '../../apps/web/src/app/workspace-controller.js';
import { IndexedDbProjectRepository } from '../../apps/web/src/adapters/indexeddb/project-repository.js';

const at = (id: string) => reviewLocations.find((l) => l.id === id)!.locality;

async function example() {
  const repo = await IndexedDbProjectRepository.open({
    factory: new IDBFactory(),
    name: crypto.randomUUID(),
    ownerId: 'local-owner',
  });
  const c = new WorkspaceController(repo, await repo.read());
  const id = await c.sampleProject();
  return { state: await repo.read(), id };
}
const permit = (r: ReturnType<typeof projectScopeReview>) =>
  r!.findings.find((f) => f.packageTitle === 'Permits')!;

test('a reported location picks its adopted code text', () => {
  assert.deepEqual(codePlace(at('bay-area'))!.jurisdictions, ['California', 'San Francisco']);
  assert.deepEqual(codePlace({ ...at('bay-area'), municipality: 'Oakland' })!.jurisdictions, [
    'California',
  ]);
  assert.deepEqual(codePlace(at('nyc'))!.jurisdictions, ['New York City']);
  assert.deepEqual(codePlace({ ...at('nyc'), municipality: 'Albany' })!.jurisdictions, [
    'New York State',
  ]);
  assert.deepEqual(codePlace(at('austin'))!.jurisdictions, ['Austin']);
  assert.equal(codePlace({ ...at('austin'), municipality: 'Dallas' }), null);
  assert.equal(codePlace(null), null);
});

test('the same living-room plan cites each market’s own code', async () => {
  const { state, id } = await example();

  const none = projectScopeReview(state, id)!;
  assert.equal(none.codeBasis.adopted, false);
  assert.match(permit(none).citations[0]!.edition!, /model code/);

  const bay = projectScopeReview(state, id, at('bay-area'))!;
  assert.equal(bay.codeBasis.adopted, true);
  assert.equal(bay.codeBasis.assumed, true);
  assert.ok(
    permit(bay).citations.some(
      (c) =>
        /^CRC 2025 R105\.2/.test(c.title) &&
        c.url === 'https://archive.org/details/gov.ca.bsc.residential.2025',
    ),
  );

  const nyc = projectScopeReview(state, id, at('nyc'))!;
  assert.ok(
    permit(nyc).citations.some(
      (c) => /28-105\.4\.2/.test(c.title) && c.url!.startsWith('https://www.nyc.gov/'),
    ),
  );
  assert.ok(nyc.findings.every((f) => f.citations.every((c) => !/^CRC /.test(c.title))));

  const austin = projectScopeReview(state, id, at('austin'))!;
  assert.ok(
    permit(austin).citations.some((c) =>
      c.url!.startsWith('https://services.austintexas.gov/edims/'),
    ),
  );

  // The handoff names the code text and that the location was assumed.
  const md = projectHandoff(state, id, '2026-10-30T12:00:00.000Z', at('nyc'))!;
  assert.match(md, /Code text: New York City 2022 Construction Codes \(location assumed/);
});

test('every adopted provision is enacted text with a source and only stated numbers', () => {
  assert.ok(adoptedCodeDigest.length > 100);
  for (const e of adoptedCodeDigest) {
    assert.ok(e.source.startsWith('https://'), e.id);
    assert.ok(e.excerpt.length <= 300, e.id);
    if (e.check) assert.ok(e.excerpt.includes(String(e.check.value)), `${e.id} ${e.check.value}`);
  }
  for (const m of ['bay-area', 'nyc', 'austin'])
    assert.ok(
      adoptedCodeDigest.some((e) => e.market === m && e.kind === 'permit'),
      m,
    );
});
