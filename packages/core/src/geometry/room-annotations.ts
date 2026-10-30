import type { PlanLine, PurchasePlanPayload, ScopeDraft } from '@renovagent/contracts';
import type { RoomModel } from './room-model.js';
import {
  PHASES,
  templateEstimate,
  workGuide,
  type TemplateEstimate,
  type WorkGuide,
} from '../scope/work-guide.js';

// One callout per included work package, pinned to the surfaces it acts on.
// Pins name surfaces, never invented positions: the views place them on those
// surfaces' measured geometry. A package without a recorded location (no
// scanned fixture of its kind, or whole-room work) is listed, not pinned.
// Costs come only from purchase-plan lines; nothing is derived from geometry.

export type AnnotationLine = {
  requirementId: string;
  purpose: string;
  quantity: number | null;
  unit: string;
  status: ScopeDraft['requirements'][number]['status'];
  product: Pick<
    PlanLine,
    'productName' | 'retailer' | 'sku' | 'lineTotalMinor' | 'currency' | 'freshness'
  > | null;
};
export type RoomAnnotation = {
  id: string;
  number: number;
  title: string;
  summary: string;
  // Surfaces the pin belongs to (ids from roomSurfaces); empty when unplaced.
  surfaceIds: string[];
  unplacedReason: string | null;
  lines: AnnotationLine[];
  priced: number;
  needsInput: number;
  costMinor: number | null;
  currency: string | null;
  // Order of operations, DIY difficulty, kit and template price (null if unknown).
  guide: WorkGuide | null;
  estimate: TemplateEstimate | null;
};
export type RoomAnnotations = {
  pins: RoomAnnotation[];
  unplaced: RoomAnnotation[];
  // Every package in order of operations (numbers follow this order).
  steps: RoomAnnotation[];
  // Moving furniture and covering what stays, folded into the steps it serves
  // rather than shown as a step of its own (its lines still count in totals).
  prep: RoomAnnotation | null;
  // Template totals (USD): materials only, and materials plus DIY tools.
  template: { materialsMinor: number; toolsMinor: number; needsArea: number } | null;
  tier: PurchasePlanPayload['tier'] | null;
  totalMinor: number | null;
  currency: string | null;
  priced: number;
  items: number;
  notes: string[];
};

const PREP = 'removal-protection';
const WALLS = new Set(['paint', 'wall-paint']);
const FLOOR = new Set(['floor-tile', 'hardwood-floor', 'lvp-floor', 'carpet-removal']);
const CEILING = new Set(['exhaust-fan']);
const FIXTURE: Record<string, string> = { toilet: 'toilet', vanity: 'sink' };

function placement(packageId: string, model: RoomModel): { ids: string[]; reason: string | null } {
  if (WALLS.has(packageId)) return { ids: model.walls.map((w) => `wall:${w.id}`), reason: null };
  if (FLOOR.has(packageId)) return { ids: ['floor'], reason: null };
  if (CEILING.has(packageId)) return { ids: ['ceiling'], reason: null };
  const category = FIXTURE[packageId];
  if (category) {
    const found = model.fixtures.filter((f) => f.category === category);
    return found.length
      ? { ids: found.map((f) => `fixture:${f.id}`), reason: null }
      : { ids: [], reason: `No ${category} location recorded in this room` };
  }
  return { ids: [], reason: 'Whole-room work' };
}

export function roomAnnotations(
  model: RoomModel,
  draft: ScopeDraft | null,
  plan: PurchasePlanPayload | null,
): RoomAnnotations {
  const empty: RoomAnnotations = {
    pins: [],
    unplaced: [],
    steps: [],
    prep: null,
    template: null,
    tier: null,
    totalMinor: null,
    currency: null,
    priced: 0,
    items: 0,
    notes: [],
  };
  if (!draft) return empty;
  const byItem = new Map(plan?.lines.map((l) => [l.bomItemId, l]));
  const all = draft.packages
    .filter((p) => p.included)
    .map((p, i): RoomAnnotation => {
      const requirements = draft.requirements.filter((r) => r.packageId === p.id);
      const lines = requirements.map((r): AnnotationLine => {
        const l = byItem.get(r.id);
        return {
          requirementId: r.id,
          purpose: r.purpose,
          quantity: r.quantity,
          unit: r.unit,
          status: r.status,
          product: l
            ? {
                productName: l.productName,
                retailer: l.retailer,
                sku: l.sku,
                lineTotalMinor: l.lineTotalMinor,
                currency: l.currency,
                freshness: l.freshness,
              }
            : null,
        };
      });
      const priced = lines.filter((l) => l.product);
      const where = placement(p.id, model);
      const guide = workGuide(p.id);
      return {
        guide,
        estimate: guide ? templateEstimate(guide, lines) : null,
        id: p.id,
        number: i + 1,
        title: p.title,
        summary: p.summary,
        surfaceIds: where.ids,
        unplacedReason: where.reason,
        lines,
        priced: priced.length,
        needsInput: requirements.filter((r) => r.status !== 'quantified').length,
        costMinor: priced.length ? priced.reduce((n, l) => n + l.product!.lineTotalMinor, 0) : null,
        currency: priced[0]?.product!.currency ?? null,
      };
    });
  // Numbered in order of operations: prep, demo, rough-in, paint, flooring, fixtures.
  const phase = (a: RoomAnnotation) => (a.guide ? PHASES.indexOf(a.guide.phase) : PHASES.length);
  const every = [...all].sort((a, b) => phase(a) - phase(b));
  const prep = every.length > 1 ? (every.find((a) => a.id === PREP) ?? null) : null;
  all.splice(0, all.length, ...every.filter((a) => a !== prep));
  all.forEach((a, i) => (a.number = i + 1));
  const guided = all.filter((a) => a.estimate);
  const pins = all.filter((a) => a.surfaceIds.length);
  const priced = every.reduce((n, a) => n + a.priced, 0);
  const items = every.reduce((n, a) => n + a.lines.length, 0);
  const costed = every.filter((a) => a.costMinor !== null);
  return {
    pins,
    unplaced: all.filter((a) => !a.surfaceIds.length),
    steps: all,
    prep,
    template: guided.length
      ? {
          materialsMinor: guided.reduce((n, a) => n + a.estimate!.materialMinor, 0),
          toolsMinor: guided.reduce((n, a) => n + a.estimate!.kitMinor, 0),
          needsArea: guided.filter((a) => a.estimate!.needsArea).length,
        }
      : null,
    tier: plan?.tier ?? null,
    totalMinor: costed.length ? costed.reduce((n, a) => n + a.costMinor!, 0) : null,
    currency: costed[0]?.currency ?? null,
    priced,
    items,
    notes: [
      ...(model.spaces.length > 1
        ? [
            `This plan covers ${model.spaces.length} spaces; its geometry is not this room's quantity.`,
          ]
        : []),
      ...(plan && priced < items
        ? [`${items - priced} of ${items} items are not priced yet.`]
        : []),
      ...(plan ? ['Prices exclude tax and labour; quantities are package totals.'] : []),
    ],
  };
}
