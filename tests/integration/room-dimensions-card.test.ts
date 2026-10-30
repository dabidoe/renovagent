import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { roomDimensionCommands, scopeDraftId } from '@renovagent/core';
import { RoomDimensionsCard } from '../../apps/web/src/features/scope/room-dimensions-card.js';
import type { WorkspaceController } from '../../apps/web/src/app/workspace-controller.js';
import { Scenario } from '../foundation-helpers.js';

const controller = {} as WorkspaceController;
const render = (s: Scenario) =>
  renderToStaticMarkup(
    createElement(RoomDimensionsCard, {
      state: s.state,
      projectId: 'project-a',
      controller,
      busy: false,
    }),
  );

test('the room card starts empty and open, with no invented dimensions', () => {
  const s = new Scenario();
  s.create();
  const html = render(s);
  assert.match(html, /Measure this room · 0\/3 recorded/);
  assert.match(html, /<details[^>]*open/);
  assert.doesNotMatch(html, /value="\d/);
  assert.match(html, /Phone AR measuring app/);
  assert.match(html, /nothing here is verified/);
});

test('saved dimensions show in their original units and a stale draft asks for a re-draft', () => {
  const s = new Scenario();
  s.create();
  s.apply(
    s.command('DraftScope', {
      recipeId: 'bathroom-refresh',
      packageIds: ['paint'],
      request: 'Paint it',
      reported: [],
      expectedDraftRevision: 0,
    }),
  );
  let n = 0;
  const commands = roomDimensionCommands(
    s.state,
    'project-a',
    {
      length: { amount: 12, unit: 'ft' },
      width: null,
      height: { amount: 96, unit: 'in' },
      method: 'lidar-scan',
      notes: '',
      photoEvidenceIds: [],
    },
    { commandId: (x) => `c-${x}`, evidenceId: 'e-1', factId: () => `f-${n++}` },
  );
  for (const c of commands) s.apply(c);
  assert.equal(s.state.artifacts[scopeDraftId('project-a')].at(-1)!.freshness, 'stale');
  const html = render(s);
  assert.match(html, /2\/3 recorded/);
  assert.match(html, /value="12"/);
  assert.match(html, /value="96"/);
  assert.match(html, /Ask Muse to re-draft/);
});
