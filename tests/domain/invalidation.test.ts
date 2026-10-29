import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DomainError } from '@renovagent/contracts';
import { taskViews } from '@renovagent/core';
import { Scenario } from '../foundation-helpers.js';
const ref = (kind: 'fact' | 'artifact' | 'evidence', id: string, revision = 1) => ({
  kind,
  id,
  revision,
});

test('room-width correction invalidates the reference graph and preserves accepted content/history', () => {
  const expected = JSON.parse(
    readFileSync(
      new URL('../../docs/architecture/examples/half-bath-change.json', import.meta.url),
      'utf8',
    ),
  ).expected;
  const s = new Scenario();
  s.create();
  s.evidence();
  s.apply(s.width());
  s.artifact('artifact-layout-check', [ref('fact', 'fact-width')]);
  s.accept('artifact-layout-check');
  s.artifact('artifact-material-plan', [ref('artifact', 'artifact-layout-check')]);
  s.accept('artifact-material-plan');
  s.artifact('artifact-estimate', [ref('artifact', 'artifact-material-plan')]);
  s.artifact(
    'artifact-task-plan',
    [ref('artifact', 'artifact-layout-check'), ref('artifact', 'artifact-material-plan')],
    'project-a',
    {
      kind: 'task-plan',
      tasks: [
        {
          id: 'task-prepare-material-package',
          title: 'Prepare material package',
          deps: [],
          progress: 'not_started',
          readiness: 'needs_review',
        },
      ],
    },
  );
  s.accept('artifact-task-plan');
  s.artifact('artifact-site-photo-index', [ref('evidence', 'evidence-width')]);
  const prior = structuredClone(s.state.artifacts['artifact-layout-check'][0]);
  const result = s.apply(s.width(1100));
  assert.deepEqual(result.staleArtifactIds, [...expected.staleArtifactIds].sort());
  assert.equal(s.state.artifacts['artifact-site-photo-index'][0].freshness, 'current');
  assert.equal(s.state.artifacts['artifact-layout-check'][0].lifecycle, 'accepted');
  assert.deepEqual(s.state.artifacts['artifact-layout-check'][0].payload, prior.payload);
  assert.equal(s.state.artifacts['artifact-layout-check'][0].acceptedAt, prior.acceptedAt);
  assert.equal(s.state.facts['fact-width'].length, 2);
  assert.deepEqual(
    taskViews(s.state, 'project-a')
      .filter((t) => t.readiness === 'blocked')
      .map((t) => t.id),
    expected.blockedTaskIds,
  );
  assert.throws(
    () => s.accept('artifact-task-plan'),
    (e: unknown) => e instanceof DomainError && e.code === 'STALE',
  );
});
test('shared property facts invalidate both dependent projects atomically, not unrelated work', () => {
  const s = new Scenario();
  s.create();
  s.create('project-b', false);
  s.evidence();
  s.apply(s.width());
  s.artifact('a', [ref('fact', 'fact-width')]);
  s.artifact('b', [ref('fact', 'fact-width')], 'project-b');
  s.artifact('unrelated', [], 'project-b');
  const revision = s.state.projects['project-b'].revision;
  s.apply(s.width(1100));
  assert.equal(s.state.artifacts.b[0].freshness, 'stale');
  assert.equal(s.state.artifacts.unrelated[0].freshness, 'current');
  assert.equal(s.state.projects['project-b'].revision, revision + 1);
  assert.ok(
    s.state.events.some((e) => e.type === 'ArtifactInvalidated' && e.projectId === 'project-b'),
  );
});
test('late outputs remain stale; a current replacement does not rewrite accepted older revisions', () => {
  const s = new Scenario();
  s.create();
  s.evidence();
  s.apply(s.width());
  s.artifact('a', [ref('fact', 'fact-width')]);
  s.accept('a');
  s.apply(s.width(1000));
  s.artifact('late', [ref('fact', 'fact-width')]);
  assert.equal(s.state.artifacts.late[0].freshness, 'stale');
  s.artifact('a', [ref('fact', 'fact-width', 2)]);
  assert.equal(s.state.artifacts.a.length, 2);
  assert.equal(s.state.artifacts.a[0].lifecycle, 'accepted');
  assert.equal(s.state.artifacts.a[1].freshness, 'current');
});
test('missing refs, cross-project refs, artifact cycles, and invalid task graphs cannot be published', () => {
  const s = new Scenario();
  s.create();
  s.create('project-b', false);
  assert.throws(() => s.artifact('bad', [ref('fact', 'absent')]), /Missing/);
  s.artifact('a', []);
  s.artifact('b', [ref('artifact', 'a')]);
  assert.throws(() => s.artifact('a', [ref('artifact', 'b')]), /Cyclic/);
  assert.throws(
    () => s.artifact('foreign', [ref('artifact', 'a')], 'project-b'),
    /another project/,
  );
  assert.throws(
    () =>
      s.artifact('bad-tasks', [], 'project-a', {
        kind: 'task-plan',
        tasks: [
          {
            id: 't',
            title: 'Bad dependency',
            deps: ['absent'],
            progress: 'not_started',
            readiness: 'ready',
          },
        ],
      }),
    /Missing task/,
  );
  assert.throws(
    () =>
      s.artifact('cycle-tasks', [], 'project-a', {
        kind: 'task-plan',
        tasks: [
          { id: 't', title: 'Cycle', deps: ['t'], progress: 'not_started', readiness: 'ready' },
        ],
      }),
    /Cyclic task/,
  );
  assert.equal(s.state.artifacts.a.length, 1);
});
