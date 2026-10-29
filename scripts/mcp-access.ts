import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MongoClient } from 'mongodb';
import { McpAccessStore } from '../apps/api/src/mcp-access.js';
import { MongoWorkspaceRepository, type Aggregate } from '../apps/api/src/repository.js';
import { workspaceMongoConfig } from '../apps/api/src/database-config.js';

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const database = await workspaceMongoConfig();
  const client = new MongoClient(database.uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  try {
    const store = new McpAccessStore(client.db());
    await store.ensureIndexes();
    const revoked = argument('--revoke');
    if (revoked) {
      if (!/^[a-f0-9]{64}$/.test(revoked)) throw new Error('Invalid grant ID');
      const result = await store.revoke(revoked);
      console.log(result.modifiedCount ? 'Connector access revoked.' : 'No active grant found.');
      return;
    }
    const ownerId = argument('--owner');
    if (!ownerId) throw new Error('Specify --owner <workspace-owner-id>');
    const repository = new MongoWorkspaceRepository(
      client.db().collection<Aggregate>('workspace_aggregates'),
      ownerId,
    );
    await repository.read();
    if (process.argv.includes('--list')) {
      const grants = await store.grants.find({ ownerId }).toArray();
      console.log(
        JSON.stringify(
          grants.map(({ _id, name, access, createdAt, expiresAt, revokedAt }) => ({
            grantId: _id,
            name,
            access,
            createdAt,
            expiresAt,
            revokedAt,
          })),
          null,
          2,
        ),
      );
      return;
    }
    const name = argument('--name');
    if (!name) throw new Error('Specify --name <connection-label>');
    const { grant, token } = await store.issue({
      ownerId,
      name,
      access: process.argv.includes('--read-only') ? 'read' : 'propose',
      hours: Number(argument('--hours') ?? 24),
    });
    const folder = resolve('.local/mcp');
    const file = resolve(folder, `${grant._id.slice(0, 16)}.json`);
    try {
      await mkdir(folder, { recursive: true, mode: 0o700 });
      await writeFile(
        file,
        JSON.stringify(
          {
            grantId: grant._id,
            name: grant.name,
            access: grant.access,
            expiresAt: grant.expiresAt,
            authorization: { type: 'bearer', token },
            usage:
              'Enter the credential only in the client secure credential flow. Never paste it in a chat, URL, issue or log. The endpoint is configured separately.',
          },
          null,
          2,
        ) + '\n',
        { mode: 0o600, flag: 'wx' },
      );
    } catch (error) {
      await store.revoke(grant._id);
      throw error;
    }
    console.log(`Connector credential saved privately to ${file}`);
    console.log(`Access: ${grant.access}; expires ${grant.expiresAt.toISOString()}.`);
    console.log(
      'The credential is never printed. Use mcp:access -- --list --owner <owner> to inspect or --revoke <grantId> to revoke.',
    );
  } finally {
    await client.close();
  }
}

main().catch(() => {
  console.error(
    'Connector access command failed. Check the workspace URI, existing --owner, --name and --hours (1–168). No credential was printed.',
  );
  process.exitCode = 1;
});
