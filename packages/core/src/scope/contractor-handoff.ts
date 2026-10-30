import type { ScopeDraft } from '@renovagent/contracts';
import type { RoomAnnotation } from '../geometry/room-annotations.js';
import type { ReviewCitation, ReviewFinding, ScopeReview } from './scope-review.js';

// The package a contractor receives (docs/MODEL_INTEGRATION.md section 6): the
// proposed work in order, the evidence behind it, what was checked against
// which source, what remains uncertain, and fields to respond with. Markdown so
// it can be read anywhere, pasted into a message or handed to another agent.

export type HandoffInput = {
  projectName: string;
  propertyName: string | null;
  draft: ScopeDraft;
  draftRevision: number;
  steps: RoomAnnotation[];
  prep: RoomAnnotation | null;
  review: ScopeReview;
  generatedAt: string;
  example: boolean;
};

const STATUS: Record<ReviewFinding['status'], string> = {
  verified_against_recorded_evidence: 'Checked against recorded evidence',
  potential_conflict: 'Potential conflict',
  needs_measurement: 'Needs a measurement',
  needs_product_selection: 'Needs a product choice',
  needs_source_verification: 'Needs a source',
  not_applicable_with_reason: 'Not applicable',
  contractor_review_required: 'Contractor to confirm',
  authority_confirmation_required: 'Authority / permit to confirm',
};
// "Contractor must verify", highest impact first.
const IMPACT: ReviewFinding['status'][] = [
  'potential_conflict',
  'authority_confirmation_required',
  'contractor_review_required',
  'needs_measurement',
  'needs_product_selection',
  'needs_source_verification',
];
const INPUT_SOURCE: Record<string, string> = {
  'workspace-fact': 'recorded in the project',
  'agent-relayed': 'relayed by an agent, unverified',
  'reported-unknown': 'owner does not know',
  'not-provided': 'not provided',
};

const usd = (minor: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(minor / 100);
const cell = (s: string) => s.replace(/\|/g, '/').replace(/\n/g, ' ');

function citation(c: ReviewCitation) {
  const where = [c.edition, c.locator].filter(Boolean).join(', ');
  const link = c.url ? `[${c.title}](${c.url})` : c.title;
  return `${link}${where ? ` (${where})` : ''}${c.retrievedOn ? `, retrieved ${c.retrievedOn}` : ''}${c.reviewed ? '' : ', unreviewed'}`;
}

export function contractorHandoff(input: HandoffInput): string {
  const { draft, review, steps } = input;
  const request = draft.request.replace(/^\[Example fixture\]\s*/, '');
  const date = input.generatedAt.slice(0, 10);
  const out: string[] = [];
  const line = (s = '') => out.push(s);

  line(`# Contractor handoff: ${input.projectName}`);
  line();
  if (input.example)
    line(
      '> **Example project.** Dimensions, contractors and prices are synthetic demo fixtures, not a real home.',
    );
  line(
    `> Scope revision ${input.draftRevision} · generated ${date} · **Proposed, not approved.** Not a code review, permit determination or quote.`,
  );
  line();
  line('## Overview');
  line();
  if (input.propertyName) line(`- Property: ${input.propertyName}`);
  line(`- Request: ${request}`);
  if (draft.direction)
    line(`- Design: walls ${draft.direction.wallColor}; floor ${draft.direction.floorFinish}`);
  line(
    `- Jurisdiction: ${review.jurisdiction.authority ?? 'not confirmed'}${review.jurisdiction.unresolved.length ? ` (open: ${review.jurisdiction.unresolved[0]})` : ''}`,
  );
  line(`- Recipe: ${draft.recipe.id} v${draft.recipe.version}`);
  line();

  line('## Work in order');
  line();
  if (input.prep)
    line(
      `Before any step: ${input.prep.title.toLowerCase()} (${input.prep.summary.replace(/\.$/, '')}).`,
    );
  line();
  for (const s of steps) {
    line(`### ${s.number}. ${s.title}${s.guide ? ` · ${s.guide.phase}` : ''}`);
    line();
    line(s.summary);
    line();
    for (const r of draft.requirements.filter((x) => x.packageId === s.id))
      line(
        `- ${r.purpose.replace(/\.$/, '')}: ${r.quantity === null ? 'quantity open' : `${r.quantity} ${r.unit}`} (${r.quantityBasis.replace(/\.$/, '')})`,
      );
    line();
  }

  line('## Measurements and provenance');
  line();
  // Only what was recorded, or what an open quantity waits on.
  const blocking = new Set(draft.requirements.flatMap((r) => r.blockedBy));
  for (const i of draft.inputs.filter((x) => x.amount !== null || blocking.has(x.key)))
    line(
      `- ${i.label}: ${i.amount === null ? '—' : `${i.amount} ${i.unit}`} (${INPUT_SOURCE[i.source]})`,
    );
  line();

  const priced = steps.filter((s) => s.estimate && !s.estimate.needsArea);
  if (priced.length) {
    line('## Material allowances');
    line();
    line(
      `Typical US big-box planning prices as of ${date}; not quotes or live prices. Tax and labour excluded.`,
    );
    line();
    line('| Step | Materials | DIY tools |');
    line('| --- | --- | --- |');
    for (const s of priced)
      line(
        `| ${cell(s.title)} | ${s.estimate!.materialMinor ? usd(s.estimate!.materialMinor) : '—'} | ${usd(s.estimate!.kitMinor)} |`,
      );
    line();
  }

  line('## Requirements register');
  line();
  line(`Method: ${review.method}`);
  line();
  line('| Status | Work | Finding | Source |');
  line('| --- | --- | --- | --- |');
  for (const f of review.findings)
    line(
      `| ${STATUS[f.status]} | ${cell(f.packageTitle)} | ${cell(f.summary)} | ${f.citations.length ? cell(f.citations.map(citation).join('; ')) : 'none on file'} |`,
    );
  line();

  line('## Contractor must verify');
  line();
  const verify = review.findings
    .filter((f) => IMPACT.includes(f.status))
    .sort((a, b) => IMPACT.indexOf(a.status) - IMPACT.indexOf(b.status));
  for (const f of verify) line(`- [ ] **${STATUS[f.status]}:** ${f.summary} _${f.action}_`);
  line();

  const questions = [...draft.questions.map((q) => q.question), ...review.jurisdiction.unresolved];
  if (questions.length) {
    line('## Open questions');
    line();
    for (const q of questions) line(`- ${q}`);
    line();
  }

  line('## Not included');
  line();
  for (const n of draft.notPriced) line(`- ${n}`);
  for (const l of review.limits) line(`- ${l}`);
  line();

  line('## Contractor response');
  line();
  for (const field of [
    'Scope confirmed as written',
    'Corrections',
    'Substitutions',
    'Price (materials / labour)',
    'Site measurement needed',
    'Conflicts or code concerns',
  ])
    line(`- ${field}: ______________________`);
  line();
  return out.join('\n');
}
