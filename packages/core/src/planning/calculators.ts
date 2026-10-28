import { canonicalValue } from '../domain/quantities.js';
import {
  DomainError,
  lengthSchema,
  planningTaskSchema,
  type PlanningInputs,
  type PlanningTask,
  type ArtifactPayload,
} from '@unpermitted/contracts';
type Payload<K extends ArtifactPayload['kind']> = Extract<ArtifactPayload, { kind: K }>;
export function mm(input: NonNullable<PlanningInputs['site']['width']>): number {
  const q = lengthSchema.parse(input);
  const normalized = canonicalValue({ kind: 'quantity', dimension: 'length', ...q });
  if (normalized.kind !== 'quantity') throw new DomainError('VALIDATION', 'Expected length');
  const value = normalized.amount;
  if (value > 1e7)
    throw new DomainError('VALIDATION', 'Length exceeds supported calculation range (10 km)');
  return Math.round(value * 1e6) / 1e6;
}
const val = (q: PlanningInputs['site']['width']) => (q === null ? null : mm(q));
// Calculations keep full precision; display rounding never feeds package arithmetic.
export function geometry(inputs: PlanningInputs): Payload<'measured-layout'> {
  const s = inputs.site,
    l = inputs.layout,
    issues: string[] = [];
  const w = val(s.width),
    d = val(s.length),
    tw = val(l.toiletWidth),
    tp = val(l.toiletProjection),
    cx = val(l.toiletCenterX),
    bw = val(l.basinWidth),
    bd = val(l.basinDepth),
    bx = val(l.basinX);
  const positive = (v: number | null): v is number => v !== null && v > 0;
  let status: Payload<'measured-layout'>['status'] = 'supported';
  if (!positive(w) || !positive(d))
    issues.push('Positive finished room width and length are required.');
  if (s.measurement !== 'finished')
    issues.push(
      'Finished-wall geometry is not established; rough or conflicting dimensions cannot release work.',
    );
  if (
    ![tw, tp, bw, bd].every(positive) ||
    cx === null ||
    bx === null ||
    !l.toiletModel.trim() ||
    !l.basinModel.trim()
  )
    issues.push('Both fixture specifications, dimensions, and placement offsets are required.');
  let side: number | null = null,
    front: number | null = null;
  if (
    positive(w) &&
    positive(d) &&
    positive(tw) &&
    positive(tp) &&
    cx !== null &&
    positive(bw) &&
    positive(bd) &&
    bx !== null
  ) {
    side = Math.min(cx, w - cx);
    const overlapX = cx + tw / 2 > bx && cx - tw / 2 < bx + bw;
    front = d - tp - (overlapX ? bd : 0);
    if (
      cx - tw / 2 < 0 ||
      cx + tw / 2 > w ||
      tp > d ||
      bx < 0 ||
      bx + bw > w ||
      bd > d ||
      (overlapX && tp > d - bd)
    ) {
      status = 'not_supported';
      issues.push('A fixture lies outside the room or fixture footprints overlap.');
    }
    if (bd > d - tp) side = Math.min(side, Math.max(0, bx > cx ? bx - cx : cx - (bx + bw)));
  }
  const ms = val(l.minimumSide),
    mf = val(l.minimumFront);
  if (side !== null && ms !== null && side < ms) {
    status = 'not_supported';
    issues.push('Measured centerline clearance is below the supplied manufacturer requirement.');
  }
  if (front !== null && mf !== null && front < mf) {
    status = 'not_supported';
    issues.push('Measured front clearance is below the supplied manufacturer requirement.');
  }
  if (ms === null || mf === null)
    issues.push(
      'Manufacturer side/front clearance requirements are unknown; no code minimum is substituted.',
    );
  if (l.door !== 'surveyed-clear')
    issues.push(
      l.door === 'conflict'
        ? 'Reported door conflict requires layout revision.'
        : 'Door swing and other obstructions need a measured survey.',
    );
  if (l.door === 'conflict') status = 'not_supported';
  if (status !== 'not_supported' && issues.length)
    status = s.measurement === 'conflicting' ? 'needs_review' : 'needs_input';
  const run = val(s.drainRun),
    fall = val(s.drainFall);
  return {
    kind: 'measured-layout',
    algorithm: 'rectangular-half-bath/1.0',
    status,
    traces: [
      {
        label: 'Floor area',
        formula: 'finished width × finished length ÷ 1,000,000',
        value: positive(w) && positive(d) ? (w * d) / 1e6 : null,
        unit: 'm²',
      },
      {
        label: 'Room perimeter',
        formula: '2 × (finished width + finished length) ÷ 1,000',
        value: positive(w) && positive(d) ? (2 * (w + d)) / 1000 : null,
        unit: 'm',
      },
      {
        label: 'Toilet side clearance',
        formula: 'minimum centerline distance to side walls / overlapping basin',
        value: side,
        unit: 'mm',
      },
      {
        label: 'Toilet front clearance',
        formula: 'room length − toilet projection − opposing basin depth when footprints align',
        value: front,
        unit: 'mm',
      },
      {
        label: 'Observed drain gradient',
        formula: 'available fall ÷ measured horizontal run × 100 (not a sizing check)',
        value: positive(run) && fall !== null ? (fall / run) * 100 : null,
        unit: '%',
      },
    ],
    issues,
    limitations: [
      'Rectangular finished room only. Toilet faces +Y from the back wall; basin sits against the opposite wall. No automatic layout optimization.',
      'Manufacturer clearances are user-supplied constraints, not code minima. Door status is reported evidence, not calculated swept geometry.',
      'Drain gradient excludes fittings, connection elevations, diameter sizing and venting. A geometric fit is not a compliance or feasibility approval.',
    ],
  };
}
export function takeoff(inputs: PlanningInputs): Payload<'quantity-takeoff'> {
  const f = inputs.finish,
    missing: string[] = [],
    w = val(inputs.site.width),
    d = val(inputs.site.length);
  if (w === null || d === null || w <= 0 || d <= 0 || inputs.site.measurement !== 'finished')
    missing.push('Positive, consistent finished floor dimensions');
  if (!f.specification.trim()) missing.push('Exact floor finish specification');
  if (f.wasteBps === null || !f.wasteBasis.trim())
    missing.push('Explicit waste allowance and rationale');
  if (f.packageAreaM2 === null) missing.push('Package coverage from the selected product');
  if (f.inventoryAreaM2 === null)
    missing.push('Compatible usable inventory quantity, including explicit zero');
  const need = w !== null && d !== null && w > 0 && d > 0 ? (w * d) / 1e6 : null;
  const gross = need !== null && f.wasteBps !== null ? (need * (10000 + f.wasteBps)) / 10000 : null;
  const net =
    gross !== null && f.inventoryAreaM2 !== null ? Math.max(0, gross - f.inventoryAreaM2) : null;
  const ratio = net !== null && f.packageAreaM2 !== null ? net / f.packageAreaM2 : null;
  // Tolerance handles only binary floating-point noise at an exact integer boundary.
  const packs =
    ratio === null ? null : Math.max(0, Math.ceil(ratio - Number.EPSILON * Math.max(1, ratio) * 8));
  if (packs !== null && !Number.isSafeInteger(packs))
    throw new DomainError('VALIDATION', 'Package quantity exceeds safe precision');
  return {
    kind: 'quantity-takeoff',
    algorithm: 'area-packages/1.0',
    status: missing.length ? 'needs_input' : 'calculated',
    specification: f.specification,
    taskIds: ['floor-finish'],
    missing,
    traces: [
      {
        label: 'Net finish area',
        formula: 'finished width × length (no unmeasured deductions)',
        value: need,
        unit: 'm²',
      },
      {
        label: 'Waste allowance',
        formula: 'net area × allowance basis points ÷ 10,000',
        value: gross !== null && need !== null ? gross - need : null,
        unit: 'm²',
      },
      {
        label: 'Required with allowance',
        formula: 'net area + allowance',
        value: gross,
        unit: 'm²',
      },
      {
        label: 'Compatible inventory',
        formula: 'usable inventory with matching specification',
        value: f.inventoryAreaM2,
        unit: 'm²',
      },
      {
        label: 'Packages to purchase',
        formula: 'ceil(max(0, required − inventory) ÷ package coverage)',
        value: missing.length ? null : packs,
        unit: 'packages',
      },
      {
        label: 'Purchase surplus',
        formula: 'packages × package coverage − max(0, required − inventory)',
        value:
          !missing.length && packs !== null && net !== null ? packs * f.packageAreaM2! - net : null,
        unit: 'm²',
      },
    ],
  };
}
export function estimate(
  inputs: PlanningInputs,
  quantity: Payload<'quantity-takeoff'>,
): Payload<'cost-plan'> {
  const f = inputs.finish,
    packs = quantity.traces.find((t) => t.label === 'Packages to purchase')!.value;
  const total = packs !== null && f.packagePriceMinor !== null ? packs * f.packagePriceMinor : null;
  if (total !== null && !Number.isSafeInteger(total))
    throw new DomainError('VALIDATION', 'Cost exceeds safe minor-unit precision');
  return {
    kind: 'cost-plan',
    currency: f.currency,
    totalMinor: total,
    packagePriceMinor: f.packagePriceMinor,
    priceSource: f.priceSource,
    priceDate: f.priceDate,
    status: total === null ? 'needs_input' : 'partial',
    exclusions: [
      'Labor',
      'Other materials and fixtures',
      'Tax',
      'Delivery',
      'Permits',
      'Waste disposal',
      'Contingency',
    ],
  };
}
export function validateTaskGraph(tasks: PlanningTask[]) {
  const checked = tasks.map((t) => planningTaskSchema.parse(t));
  if (new Set(checked.map((t) => t.id)).size !== checked.length)
    throw new DomainError('VALIDATION', 'Duplicate task ID');
  const done = new Set<string>(),
    visiting = new Set<string>();
  const walk = (id: string): void => {
    if (visiting.has(id)) throw new DomainError('VALIDATION', 'Cyclic task dependency');
    if (done.has(id)) return;
    const t = checked.find((t) => t.id === id);
    if (!t) throw new DomainError('VALIDATION', 'Missing task dependency');
    visiting.add(id);
    t.deps.forEach(walk);
    visiting.delete(id);
    done.add(id);
  };
  checked.forEach((t) => walk(t.id));
}
export type GateEvidence = {
  gate: PlanningTask['gates'][number];
  status: 'scheduled' | 'passed' | 'approved' | 'failed';
  evidenceIds: string[];
};
export function taskReadiness(
  tasks: PlanningTask[],
  current: boolean,
  completed: string[] = [],
  evidence: GateEvidence[] = [],
) {
  validateTaskGraph(tasks);
  return tasks.map((t) => {
    const reasons: string[] = [];
    if (!current) reasons.push('Plan or its inputs are stale');
    t.deps
      .filter((id) => !completed.includes(id))
      .forEach((id) => reasons.push(`Completion evidence required: ${id}`));
    t.gates.forEach((g) => {
      if (
        !evidence.some(
          (e) =>
            e.gate === g &&
            e.evidenceIds.length > 0 &&
            e.status === (g.includes('inspection') ? 'passed' : 'approved'),
        )
      )
        reasons.push(`Unresolved gate: ${g}`);
    });
    return { ...t, readiness: reasons.length ? ('blocked' as const) : ('ready' as const), reasons };
  });
}
