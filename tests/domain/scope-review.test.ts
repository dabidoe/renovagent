import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyPlanningInputs, type Workspace } from '@renovagent/contracts';
import { compileScopeDraft, resolveLocalContext, reviewScope } from '@renovagent/core';

const state = { facts: {}, artifacts: {}, projects: {} } as unknown as Workspace;
const draft = (recipeId: string, packageIds: string[]) =>
  compileScopeDraft(state, 'p1', {
    recipeId,
    packageIds,
    request: 'test',
    reported: [],
    expectedDraftRevision: 0,
  }).draft;
const philadelphia = () => {
  const context = emptyPlanningInputs().context;
  context.jurisdiction = 'philadelphia';
  Object.assign(context.locality, {
    boundaryBasis: 'user-reported',
    countryCode: 'US',
    regionCode: 'PA',
    municipality: 'Philadelphia',
  });
  return resolveLocalContext(context);
};

test('vinyl plank over carpet is a conflict quoted from the maker; removing it passes', () => {
  const over = reviewScope(draft('living-room-refresh', ['wall-paint', 'lvp-floor']));
  const conflict = over.findings.find((f) => f.status === 'potential_conflict')!;
  assert.equal(conflict.packageId, 'lvp-floor');
  assert.equal(conflict.citations[0]!.id, 'xulon-lvp-install');
  assert.ok(conflict.citations[0]!.url?.startsWith('https://'));
  assert.equal(over.counts.conflicts, 1);
  // Conflicts lead the list.
  assert.equal(over.findings[0], conflict);

  const removed = reviewScope(
    draft('living-room-refresh', ['wall-paint', 'carpet-removal', 'lvp-floor']),
  );
  assert.equal(removed.counts.conflicts, 0);
  assert.ok(
    removed.findings.some(
      (f) => f.status === 'verified_against_recorded_evidence' && f.packageId === 'lvp-floor',
    ),
  );
});

test('missing measurements and open conditions stay unknown, never passed', () => {
  const r = reviewScope(draft('living-room-refresh', ['wall-paint']));
  assert.ok(r.findings.some((f) => f.status === 'needs_measurement'));
  assert.ok(r.findings.some((f) => f.status === 'contractor_review_required'));
  // No permit research on file: an explicit open question, not a pass.
  const permit = r.findings.find((f) => f.packageTitle === 'Permits')!;
  assert.equal(permit.status, 'authority_confirmation_required');
  assert.deepEqual(permit.citations, []);
  assert.match(r.method, /No model interpretation/);
});

test('code provisions are cited only in their jurisdiction and never as compliance', () => {
  const bath = draft('bathroom-refresh', ['toilet', 'exhaust-fan']);
  const unknown = reviewScope(bath);
  const codeless = unknown.findings.filter((f) => f.status === 'authority_confirmation_required');
  assert.ok(codeless.length > 0);
  assert.ok(codeless.every((f) => f.citations.length === 0));
  assert.match(codeless[0]!.action, /jurisdiction/);

  const phila = reviewScope(bath, { local: philadelphia() });
  const cited = phila.findings.flatMap((f) =>
    f.status === 'authority_confirmation_required' ? f.citations : [],
  );
  const permits = cited.find((c) => c.id === 'phila-permits')!;
  assert.equal(permits.kind, 'code-provision');
  assert.ok(permits.locator && permits.edition && permits.retrievedOn && permits.url);
  assert.equal(permits.reviewed, false);
  assert.ok(
    phila.findings.every(
      (f) => !/complian|approved|passes code/i.test(f.summary) || /not reviewed/.test(f.summary),
    ),
  );
});
