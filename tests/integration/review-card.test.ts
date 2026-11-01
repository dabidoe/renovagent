import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IDBFactory } from 'fake-indexeddb';
import { projectScopeReview, reviewLocations } from '@renovagent/core';
import { WorkspaceController } from '../../apps/web/src/app/workspace-controller.js';
import { IndexedDbProjectRepository } from '../../apps/web/src/adapters/indexeddb/project-repository.js';
import {
  HandoffPopup,
  ReviewPopup,
  type JevRanking,
} from '../../apps/web/src/features/room3d/review-handoff.js';

async function bayAreaReview() {
  const repo = await IndexedDbProjectRepository.open({
    factory: new IDBFactory(),
    name: crypto.randomUUID(),
    ownerId: 'local-owner',
  });
  const c = new WorkspaceController(repo, await repo.read());
  const id = await c.sampleProject();
  return projectScopeReview(
    await repo.read(),
    id,
    reviewLocations.find((l) => l.id === 'bay-area')!.locality,
  )!;
}
const render = (review: Awaited<ReturnType<typeof bayAreaReview>>, ranking: JevRanking | null) =>
  renderToStaticMarkup(
    createElement(ReviewPopup, {
      review,
      draftNote: null,
      location: 'bay-area',
      onLocation: () => {},
      ranking,
      onRank: () => {},
      onClose: () => {},
    }),
  );

test('the handoff presents a readable brief while retaining folded context and escaping project text', () => {
  const html = renderToStaticMarkup(
    createElement(HandoffPopup, {
      markdown:
        '# Contractor handoff: <img src=x onerror=alert(1)>\n\n> Proposed scope\n\n## Overview\n- Request: Repaint\n- Recipe: living-room-refresh v2\n\n## Material allowances\n| Step | Materials |\n| --- | --- |\n| Paint | $100 |\n\n## Requirements register\nKeep the source record. [Source](https://example.com/source)\n',
      fileName: 'brief.md',
      onClose: () => {},
    }),
  );
  assert.match(html, /<table>/);
  assert.doesNotMatch(html, /<pre|<img/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /<summary>Location &amp; technical context<\/summary>/);
  assert.match(html, /living-room-refresh v2/);
  assert.match(html, /Keep the source record/);
  assert.match(html, /href="https:\/\/example.com\/source"/);
});

test('the review card offers Jev and shows its relevance as interpretation', async () => {
  const review = await bayAreaReview();
  const before = render(review, null);
  assert.match(before, /Rank by relevance with Jev/);
  assert.doesNotMatch(before, /less likely for this work/);

  // One code finding judged relevant, every other code finding not.
  const coded = review.findings.filter((f) => f.citations.some((c) => c.kind === 'code-provision'));
  const top = coded.at(-1)!;
  const relevance = Object.fromEntries(
    review.findings.map((f) => [f.id, f === top ? 0.92 : coded.includes(f) ? 0.04 : null]),
  );
  const after = render(review, { status: 'done', model: 'jev-1.14.0', relevance });
  assert.match(after, /92%/);
  assert.match(after, /Ranked by Jev/);
  assert.match(after, /an interpretation, not a code\s+determination/);
  assert.match(after, new RegExp(`${coded.length - 1} less likely for this work`));
  // Nothing is dropped: every finding is still rendered, folded or not.
  for (const f of review.findings)
    assert.ok(after.includes(f.summary.slice(0, 30).replace(/&/g, '&amp;')));
  // The relevant finding leads its group, ahead of the folded ones.
  assert.ok(after.indexOf('92%') < after.indexOf('less likely for this work'));

  const failed = render(review, {
    status: 'error',
    message: 'Sign in to the connected app to rank with Jev.',
  });
  assert.match(failed, /role="alert"[^>]*>Sign in to the connected app/);
});
