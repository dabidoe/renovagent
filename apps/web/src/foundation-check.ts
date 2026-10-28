import { IndexedDbProjectRepository } from './adapters/indexeddb/project-repository.js';
import {
  previewLegacyImport,
  prepareLegacyImport,
  LEGACY_STORAGE_KEY,
  blobDigest,
  type LegacyImportPreview,
} from './adapters/fixtures/import-legacy.js';
import { foundationScenario } from '../../../fixtures/projects/foundation-scenario.js';
import { DomainError, type Command } from '@unpermitted/contracts';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);
if (!params.has('check')) {
  params.set('check', crypto.randomUUID());
  history.replaceState(null, '', `${location.pathname}?${params}`);
}
const name = `unpermitted-foundation-check:${params.get('check')}`;
const context = { ownerId: 'local-foundation-check', now: new Date().toISOString() };
let repo = await IndexedDbProjectRepository.open({ name, ownerId: context.ownerId });
function check(message: string, pass: boolean) {
  const li = document.createElement('li');
  li.className = pass ? 'pass' : 'fail';
  li.textContent = `${pass ? 'PASS' : 'FAIL'} · ${message}`;
  $('checks').append(li);
  if (!pass) throw Error(message);
}
async function display() {
  const state = await repo.read();
  $('snapshot').textContent = JSON.stringify(state, null, 2);
  const projects = Object.keys(state.projects).length;
  $('restore-status').textContent = projects
    ? `Restored ${projects} projects · ${state.events.length} audit events · width revision ${state.facts['fixture-width']?.at(-1)?.revision || 'not recorded'}`
    : 'Empty isolated database. Ready to run.';
  $('run').toggleAttribute('disabled', projects > 0);
  return state;
}
const restored = await display();
if (restored.facts['fixture-width']?.at(-1)?.revision === 2) {
  check(
    'Page reload restored both fixture projects, accepted history, and stale dependents',
    Boolean(
      restored.projects['fixture-half-bath'] &&
        restored.projects['fixture-flooring'] &&
        restored.artifacts['fixture-layout']?.[0].lifecycle === 'accepted' &&
        restored.artifacts['fixture-layout']?.[0].freshness === 'stale',
    ),
  );
  check(
    'Page reload restored original and derived attachment bytes',
    (await (await repo.readBlob('fixture-original-blob'))?.text()) === 'synthetic original bytes' &&
      (await (await repo.readBlob('fixture-derived-blob'))?.text()) === 'synthetic derived bytes',
  );
}
$('run').addEventListener('click', async () => {
  $('run').setAttribute('disabled', '');
  try {
    const fixture = foundationScenario(context);
    await repo.executeBatch(fixture.commands, context);
    check(
      'Two projects persist against one property',
      Object.keys((await repo.read()).projects).length === 2,
    );
    const before = await repo.read(),
      base = before.projects['fixture-half-bath'].revision;
    const blobs = [
      {
        id: 'fixture-original-blob',
        blob: new Blob(['synthetic original bytes'], { type: 'text/plain' }),
      },
      {
        id: 'fixture-derived-blob',
        blob: new Blob(['synthetic derived bytes'], { type: 'text/plain' }),
      },
    ];
    const media: Command[] = [];
    for (const [i, b] of blobs.entries())
      media.push({
        commandId: `browser-media:${i}`,
        projectId: 'fixture-half-bath',
        baseRevision: base + i,
        type: 'AttachEvidence',
        payload: {
          scope: 'project',
          evidence: {
            id: `fixture-media:${i}`,
            kind: 'attachment',
            description: 'Synthetic media persistence check',
            attachment: {
              blobId: b.id,
              sha256: await blobDigest(b.blob),
              name: `test-${i}.txt`,
              mediaType: b.blob.type,
              role: i ? 'derived' : 'original',
              ...(i ? { originalEvidenceId: 'fixture-media:0' } : {}),
            },
          },
        },
      });
    await repo.executeBatch(media, context, blobs);
    fixture.correction.baseRevision = (await repo.read()).projects['fixture-half-bath'].revision;
    const result = await repo.execute(fixture.correction, context);
    check(
      'Fact correction invalidates all five dependent artifacts across both projects',
      result.staleArtifactIds.length === 5,
    );
    const corrected = await repo.read();
    check(
      'Unrelated artifact stays current; accepted content is preserved',
      corrected.artifacts['fixture-unrelated'][0].freshness === 'current' &&
        corrected.artifacts['fixture-layout'][0].lifecycle === 'accepted',
    );
    check(
      'Retry returns its original result',
      JSON.stringify(await repo.execute(fixture.correction, context)) === JSON.stringify(result),
    );
    try {
      await repo.execute({ ...fixture.correction, commandId: 'browser-conflict' }, context);
      check('Revision conflict rejects stale write', false);
    } catch (e) {
      check(
        'Revision conflict rejects stale write',
        e instanceof DomainError && e.code === 'CONFLICT',
      );
    }
    repo.close();
    repo = await IndexedDbProjectRepository.open({ name, ownerId: context.ownerId });
    check(
      'Database close/reopen preserves snapshot and command results',
      JSON.stringify(await repo.read()) === JSON.stringify(corrected),
    );
    check(
      'Original and derived media bytes survive reopen',
      (await (await repo.readBlob(blobs[0].id))?.text()) === 'synthetic original bytes' &&
        (await (await repo.readBlob(blobs[1].id))?.text()) === 'synthetic derived bytes',
    );
    check(
      'Derived media retains original reference',
      (await repo.read()).evidence['fixture-media:1'].source.attachment?.originalEvidenceId ===
        'fixture-media:0',
    );
    await display();
  } catch (e) {
    $('restore-status').textContent =
      `Verification failed: ${e instanceof Error ? e.message : String(e)}`;
  }
});
$('reload').addEventListener('click', () => location.reload());
let preview: LegacyImportPreview | undefined;
$('preview-import').addEventListener('click', () => {
  try {
    preview = previewLegacyImport(localStorage.getItem(LEGACY_STORAGE_KEY));
    $('import-summary').textContent =
      `${preview.facts.length} reported text facts · ${preview.photoCount} images · ${preview.messageCount} messages retained in source\n\n${preview.warnings.join('\n')}`;
    $('confirm-import').hidden = false;
  } catch (e) {
    $('import-summary').textContent = String(e);
  }
});
$('confirm-import').addEventListener('click', async () => {
  if (!preview) return;
  try {
    const unique = crypto.randomUUID();
    const prepared = await prepareLegacyImport(preview, {
      importId: `import:${unique}`,
      projectId: `project:${unique}`,
      propertyId: `property:${unique}`,
      projectName: 'Imported opening project',
      propertyName: 'Imported property (unverified)',
      basePropertyRevision: 0,
    });
    await repo.executeBatch(prepared.commands, context, prepared.blobs);
    $('import-summary').textContent =
      'Imported a separate project. Original localStorage was preserved.';
    $('confirm-import').hidden = true;
    await display();
  } catch (e) {
    $('import-summary').textContent = `Import failed without partial writes: ${String(e)}`;
  }
});
