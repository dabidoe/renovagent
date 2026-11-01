import { createHash, randomBytes } from 'node:crypto';
import type { Collection, Db } from 'mongodb';
import { DomainError, id, projectReferenceSchema } from '@renovagent/contracts';
import type { TierKey, WallColor } from '../../web/src/features/house-example/paint-floor.js';

// Paint-and-floor plans an owner's agent saved for them to open in the studio.
// Only the choices are kept (rooms, sizes, colours, finishes, floor styles);
// quantities and demo prices are recomputed wherever the plan is shown, so the
// agent's answer and the page cannot disagree. A plan is a proposal: it changes
// nothing else in the workspace, and only its owner can open it.

export type PlanRoom = {
  name: string;
  widthFt: number;
  lengthFt: number;
  existingFloor: string;
  color: WallColor | null;
  paintLine?: TierKey;
  sheen?: 'matte' | 'eggshell' | 'satin';
  floorStyle: string | null;
  floorMaterial: 'lvp' | 'hardwood';
};

export type StudioPlan = {
  _id: string;
  ownerId: string;
  // sha256 of owner + the agent's requestId: a retried save returns the same plan.
  requestKey: string;
  title: string;
  agent: string;
  createdAt: Date;
  ceilingFt: number;
  tier: TierKey;
  rooms: PlanRoom[];
};

// An inspiration board for the studio: links and photos the owner's agent found
// or the owner saved. Leads, never checked products: no price, and the server
// never fetches a link. A photo is one the agent or owner already had.
export type InspirationFind = {
  _id: string;
  ownerId: string;
  requestKey: string;
  kind: 'inspiration' | 'product';
  title: string;
  url?: string;
  note?: string;
  imageSha256?: string;
  // The agent key's name, or null when the owner saved it.
  agent: string | null;
  createdAt: Date;
};

export const PLAN_ID = /^[A-Za-z0-9_-]{22}$/;
const PER_OWNER = 50;
const FINDS_PER_OWNER = 100;

export class StudioPlanStore {
  readonly plans: Collection<StudioPlan>;
  readonly finds: Collection<InspirationFind>;
  constructor(db: Db) {
    this.plans = db.collection<StudioPlan>('studio_plans');
    this.finds = db.collection<InspirationFind>('inspiration_finds');
  }

  async ensureIndexes() {
    await this.plans.createIndex({ ownerId: 1, requestKey: 1 }, { unique: true });
    await this.finds.createIndex({ ownerId: 1, requestKey: 1 }, { unique: true });
  }

  async saveFind(input: {
    ownerId: string;
    requestId: string;
    kind: 'inspiration' | 'product';
    title: string;
    url?: string;
    note?: string;
    imageSha256?: string;
    agent: string | null;
  }): Promise<{ find: InspirationFind; created: boolean }> {
    if (!id.safeParse(input.ownerId).success)
      throw new DomainError('VALIDATION', 'Invalid board owner');
    const { requestId, ownerId, agent, imageSha256, ...fields } = input;
    const reference = projectReferenceSchema.safeParse(fields);
    if (!reference.success)
      throw new DomainError('VALIDATION', reference.error.issues[0]?.message ?? 'Invalid find');
    if (!reference.data.url && !imageSha256)
      throw new DomainError('VALIDATION', 'A find needs a link or a photo');
    const requestKey = createHash('sha256').update(`${ownerId}\0find\0${requestId}`).digest('hex');
    const existing = await this.finds.findOne({ ownerId, requestKey });
    if (existing) return { find: existing, created: false };
    if ((await this.finds.countDocuments({ ownerId })) >= FINDS_PER_OWNER)
      throw new DomainError('VALIDATION', `Up to ${FINDS_PER_OWNER} inspiration finds per account`);
    const find: InspirationFind = {
      _id: randomBytes(16).toString('base64url'),
      ownerId,
      requestKey,
      kind: input.kind,
      title: reference.data.title ?? input.title,
      ...(reference.data.url ? { url: reference.data.url } : {}),
      ...(reference.data.note ? { note: reference.data.note } : {}),
      ...(imageSha256 ? { imageSha256 } : {}),
      agent,
      createdAt: new Date(),
    };
    try {
      await this.finds.insertOne(find);
      return { find, created: true };
    } catch (error) {
      const raced = await this.finds.findOne({ ownerId, requestKey });
      if (raced) return { find: raced, created: false };
      throw error;
    }
  }

  listFinds(ownerId: string) {
    return this.finds
      .find({ ownerId }, { projection: { requestKey: 0, ownerId: 0 } })
      .sort({ createdAt: -1 })
      .limit(FINDS_PER_OWNER)
      .toArray();
  }

  async removeFind(ownerId: string, findId: string) {
    if (!PLAN_ID.test(findId)) return false;
    return (await this.finds.deleteOne({ _id: findId, ownerId })).deletedCount === 1;
  }

  async save(
    input: Omit<StudioPlan, '_id' | 'requestKey' | 'createdAt'> & { requestId: string },
  ): Promise<{ plan: StudioPlan; created: boolean }> {
    if (!id.safeParse(input.ownerId).success)
      throw new DomainError('VALIDATION', 'Invalid plan owner');
    const { requestId, ...fields } = input;
    const requestKey = createHash('sha256').update(`${input.ownerId}\0${requestId}`).digest('hex');
    const existing = await this.plans.findOne({ ownerId: input.ownerId, requestKey });
    if (existing) return { plan: existing, created: false };
    if ((await this.plans.countDocuments({ ownerId: input.ownerId })) >= PER_OWNER)
      throw new DomainError('VALIDATION', `Up to ${PER_OWNER} saved plans per account`);
    const plan: StudioPlan = {
      _id: randomBytes(16).toString('base64url'),
      requestKey,
      createdAt: new Date(),
      ...fields,
    };
    try {
      await this.plans.insertOne(plan);
      return { plan, created: true };
    } catch (error) {
      // Two retries at once: the first insert wins and both return it.
      const raced = await this.plans.findOne({ ownerId: input.ownerId, requestKey });
      if (raced) return { plan: raced, created: false };
      throw error;
    }
  }

  // Owner-scoped: another owner's plan ID resolves to nothing.
  async get(ownerId: string, planId: string) {
    if (!PLAN_ID.test(planId)) return null;
    return this.plans.findOne({ _id: planId, ownerId });
  }
}
