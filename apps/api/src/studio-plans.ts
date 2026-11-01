import { createHash, randomBytes } from 'node:crypto';
import type { Collection, Db } from 'mongodb';
import { DomainError, id } from '@renovagent/contracts';
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

export const PLAN_ID = /^[A-Za-z0-9_-]{22}$/;
const PER_OWNER = 50;

export class StudioPlanStore {
  readonly plans: Collection<StudioPlan>;
  constructor(db: Db) {
    this.plans = db.collection<StudioPlan>('studio_plans');
  }

  async ensureIndexes() {
    await this.plans.createIndex({ ownerId: 1, requestKey: 1 }, { unique: true });
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
