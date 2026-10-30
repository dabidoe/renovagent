import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BSON, MongoClient } from 'mongodb';
import { workspaceMongoConfig } from '../apps/api/src/database-config.js';
import { type Aggregate } from '../apps/api/src/repository.js';
import { photoJobFile } from '../apps/api/src/photo-job-files.js';
import {
  applyMigration,
  idKey,
  readMigrationSnapshot,
  snapshotHash,
  validateMigration,
  type MigrationSnapshot,
  type MigrationRecord,
} from '../apps/api/src/cluster-migration.js';

async function main() {
  const config = await workspaceMongoConfig();
  if (config.target !== 'cluster') throw Error('Select the configured Atlas cluster first');
  // Explicit source names: the rename left the original workspace and catalog in separate DBs.
  const local = new MongoClient('mongodb://127.0.0.1:27018/renovagent_workspace', {
    serverSelectionTimeoutMS: 5000,
  });
  const cluster = new MongoClient(config.uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await local.connect();
    await cluster.connect();
    const readSource = async (): Promise<MigrationSnapshot> => {
      const source = await readMigrationSnapshot(local.db());
      if (source.workspace_aggregates.length)
        throw Error('New-name local workspace exists; inspect before choosing a source');
      source.workspace_aggregates = await local
        .db('unpermitted_workspace')
        .collection<MigrationRecord>('workspace_aggregates')
        .find({})
        .sort({ _id: 1 })
        .toArray();
      source.photo_job_files = [];
      for (const doc of source.workspace_aggregates as unknown as Aggregate[]) {
        for (const job of doc.jobs) {
          const folder = resolve('.local/photo-jobs', job.id);
          for (const name of (await readdir(folder, { recursive: true }))
            .filter((n) => n.endsWith('.json'))
            .sort()) {
            const text = await readFile(resolve(folder, name), 'utf8');
            source.photo_job_files.push(
              photoJobFile(doc._id, job.id, name, text) as unknown as MigrationRecord,
            );
          }
        }
      }
      source.photo_job_files.sort((a, b) => a._id.localeCompare(b._id));
      return source;
    };
    const source = await readSource(),
      destination = await readMigrationSnapshot(cluster.db());
    validateMigration(source, destination);
    const sourceHash = snapshotHash(source);
    const counts = Object.fromEntries(
      Object.entries(source).map(([name, rows]) => [name, rows.length]),
    );
    console.log(
      JSON.stringify({
        mode: process.argv.includes('--apply') ? 'apply' : 'dry-run',
        sourceHash,
        counts,
        projects: source.workspace_aggregates.reduce(
          (n, d) => n + Object.keys((d as unknown as Aggregate).workspace.projects).length,
          0,
        ),
      }),
    );
    if (!process.argv.includes('--apply')) return;
    const folder = resolve(
      '.local/backups',
      `atlas-migration-${new Date().toISOString().replaceAll(':', '-')}`,
    );
    await mkdir(folder, { recursive: true, mode: 0o700 });
    await writeFile(
      resolve(folder, 'snapshot.ejson'),
      BSON.EJSON.stringify({ source, destination }, { relaxed: false }),
      { mode: 0o600, flag: 'wx' },
    );
    console.log(`Private source and destination backup saved: ${folder}`);
    if (snapshotHash(await readSource()) !== sourceHash)
      throw Error('Local source changed during backup; rerun');
    await applyMigration(cluster, source);
    const actual = await readMigrationSnapshot(cluster.db());
    validateMigration(source, actual);
    for (const [name, rows] of Object.entries(source))
      for (const row of rows) {
        const saved = actual[name].find((r) => idKey(r._id) === idKey(row._id));
        const normalize = (v: unknown) =>
          name === 'workspace_aggregates' ? { ...(v as object), version: 0 } : v;
        if (!saved || snapshotHash(normalize(saved)) !== snapshotHash(normalize(row)))
          throw Error('Post-migration comparison failed');
      }
    if (snapshotHash(await readSource()) !== sourceHash)
      throw Error('Local source changed; inspect newer edits');
    await writeFile(
      resolve(folder, 'verification.json'),
      JSON.stringify(
        {
          verifiedAt: new Date().toISOString(),
          sourceHash,
          counts,
          sourceUnchanged: true,
          targetRecordsMatch: true,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    console.log(
      'Verified: every workspace, attachment, job, catalog record and private job file matches; local originals unchanged.',
    );
  } finally {
    await local.close();
    await cluster.close();
  }
}
main().catch((error) => {
  // Driver errors may contain connection details; print only a safe classification.
  console.error(
    `Cluster migration stopped (${error?.name ?? 'Error'}); no credentials logged. Inspect source/destination and rerun dry-run.`,
  );
  process.exitCode = 1;
});
