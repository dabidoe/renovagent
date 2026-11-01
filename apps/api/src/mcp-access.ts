import { createHash, randomBytes } from 'node:crypto';
import type { Collection, Db } from 'mongodb';
import { DomainError, id } from '@renovagent/contracts';

export type McpAccess = 'read' | 'propose';
export type McpGrant = {
  _id: string;
  ownerId: string;
  name: string;
  access: McpAccess;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};

// Remote agent credentials are distinct from browser sessions. Only their
// hashes are stored; neither callers nor tool arguments select the owner.
export class McpAccessStore {
  readonly grants: Collection<McpGrant>;
  constructor(db: Db) {
    this.grants = db.collection<McpGrant>('mcp_access_grants');
  }

  async ensureIndexes() {
    await this.grants.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  }

  async issue(input: {
    ownerId: string;
    name: string;
    access: McpAccess;
    hours?: number;
  }): Promise<{ token: string; grant: McpGrant }> {
    const hours = input.hours ?? 24;
    if (
      !id.safeParse(input.ownerId).success ||
      !input.name.trim() ||
      input.name.length > 120 ||
      !['read', 'propose'].includes(input.access) ||
      !Number.isFinite(hours) ||
      hours < 1 ||
      hours > 168
    )
      throw new DomainError('VALIDATION', 'Invalid MCP access grant (lifetime: 1–168 hours)');
    const token = `reno_${randomBytes(32).toString('base64url')}`;
    const grant: McpGrant = {
      _id: hash(token),
      ownerId: input.ownerId,
      name: input.name.trim(),
      access: input.access,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + hours * 3600_000),
      revokedAt: null,
    };
    await this.grants.insertOne(grant);
    return { token, grant };
  }

  async authenticate(token: string): Promise<McpGrant | null> {
    if (!/^reno_[A-Za-z0-9_-]{43}$/.test(token)) return null;
    return this.grants.findOne({
      _id: hash(token),
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });
  }

  // With an owner, only that owner's grant can be revoked (the website); the
  // operator CLI revokes by ID alone.
  async revoke(grantId: string, ownerId?: string) {
    return this.grants.updateOne(
      { _id: grantId, revokedAt: null, ...(ownerId ? { ownerId } : {}) },
      { $set: { revokedAt: new Date() } },
    );
  }

  // An owner's unexpired, unrevoked grants, newest first. The ID is the
  // credential's hash, safe to show; the credential itself is never stored.
  async active(ownerId: string) {
    return this.grants
      .find({ ownerId, revokedAt: null, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .toArray();
  }
}

function hash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
