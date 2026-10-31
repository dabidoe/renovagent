import type { LocalContext, ScopeDraft, ScopeRequirement } from '@renovagent/contracts';
import { technicalSources } from '../planning/sources.js';
import { modelCodeDigest } from '../planning/model-code-digest.js';
import { adoptedCodeDigest } from '../planning/adopted-code-digest.js';
import { codePlace, type LocalityInput } from '../planning/code-markets.js';

const CHECK_ADOPTED =
  'Check it in the edition your jurisdiction adopted (2015–2024 at codes.iccsafe.org).';
type Entry = {
  adopted: boolean;
  // Short reference, e.g. "CRC R105.2".
  ref: string;
  packageId: string;
  kind: string;
  why: string;
  label: string;
  check: { quantity: string; comparator: string; value: number; unit: string } | null;
  citation: ReviewCitation;
};
// Public-domain model-code copies posted by Public.Resource.Org.
const fromModel = (e: (typeof modelCodeDigest)[number]): Entry => ({
  adopted: false,
  ref: `${e.code} ${e.id}`,
  packageId: e.packageId,
  kind: e.kind,
  why: e.why,
  label: `${e.code} ${e.edition} ${e.id}, ${e.title}`,
  check: e.check,
  citation: {
    id: `${e.code.toLowerCase()}-${e.edition}-${e.id}`,
    title: `${e.code} ${e.edition} ${e.id} ${e.title}`,
    publisher: 'International Code Council model code (public-domain copy, Public.Resource.Org)',
    kind: 'code-provision',
    url: `https://archive.org/details/gov.law.icc.${e.code.toLowerCase()}.${e.edition}`,
    locator: `Section ${e.id}`,
    edition: `${e.edition} ${e.code} (model code, not an adopted edition)`,
    retrievedOn: '2026-10-30',
    excerpt: e.excerpt,
    reviewed: false,
  },
});
// Code text a jurisdiction enacted, from its own or Public.Resource.Org's copy.
const fromAdopted = (e: (typeof adoptedCodeDigest)[number]): Entry => ({
  adopted: true,
  ref: `${e.code} ${e.id}`,
  packageId: e.packageId,
  kind: e.kind,
  why: e.why,
  label: `${e.jurisdiction} ${e.code}${e.edition ? ` ${e.edition}` : ''} ${e.id}, ${e.title}`,
  check: e.check,
  citation: {
    id: `${e.jurisdiction}-${e.code}-${e.edition ?? ''}-${e.id}`
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, '-'),
    title: `${e.code}${e.edition ? ` ${e.edition}` : ''} ${e.id} ${e.title}`,
    publisher: e.jurisdiction,
    kind: 'code-provision',
    url: e.source,
    locator: `Section ${e.id}`,
    edition: `${e.edition ?? ''} ${e.code} (adopted, ${e.jurisdiction})`.trim(),
    retrievedOn: '2026-10-30',
    excerpt: e.excerpt,
    reviewed: false,
  },
});
const dedupe = (cs: ReviewCitation[]) => [
  ...new Map(cs.map((c) => [`${c.id}\n${c.excerpt}`, c])).values(),
];

// "Does this work?" for a scope draft, without a model. Deterministic checks
// run against rules quoted from the draft's own fetched sources; everything
// else becomes an explicit unknown with the action that resolves it. Code
// provisions are cited from the retrieved source registry only when the
// project's jurisdiction is the one they belong to, and are never reported as
// compliance: applicability and completeness stay with a contractor or the
// authority. Statuses follow docs/MODEL_INTEGRATION.md section 4.

export type FindingStatus =
  | 'verified_against_recorded_evidence'
  | 'potential_conflict'
  | 'needs_measurement'
  | 'needs_product_selection'
  | 'needs_source_verification'
  | 'not_applicable_with_reason'
  | 'contractor_review_required'
  | 'authority_confirmation_required';
export type FindingGroup = 'passes' | 'conflicts' | 'unresolved';

export type ReviewCitation = {
  id: string;
  title: string;
  publisher: string;
  kind: 'manufacturer-or-guide' | 'code-provision' | 'recipe';
  url: string | null;
  locator: string | null;
  edition: string | null;
  retrievedOn: string | null;
  // Quoted or paraphrased as stored with the source; never generated here.
  excerpt: string;
  reviewed: boolean;
};
export type ReviewFinding = {
  id: string;
  packageId: string | null;
  packageTitle: string;
  status: FindingStatus;
  group: FindingGroup;
  summary: string;
  evidence: string[];
  citations: ReviewCitation[];
  action: string;
};
export type ScopeReview = {
  recipe: ScopeDraft['recipe'];
  jurisdiction: { status: string; authority: string | null; unresolved: string[] };
  findings: ReviewFinding[];
  counts: Record<FindingGroup, number>;
  method: string;
  // Which code text the provisions come from.
  codeBasis: { label: string; adopted: boolean; assumed: boolean };
  limits: string[];
};

const GROUP: Record<FindingStatus, FindingGroup> = {
  verified_against_recorded_evidence: 'passes',
  not_applicable_with_reason: 'passes',
  potential_conflict: 'conflicts',
  needs_measurement: 'unresolved',
  needs_product_selection: 'unresolved',
  needs_source_verification: 'unresolved',
  contractor_review_required: 'unresolved',
  authority_confirmation_required: 'unresolved',
};

function draftCitation(draft: ScopeDraft, id: string): ReviewCitation | null {
  const s = draft.sources.find((x) => x.id === id);
  if (!s) return null;
  return {
    id: s.id,
    title: s.title,
    publisher: s.publisher,
    kind: s.retrieval === 'internal-recipe' ? 'recipe' : 'manufacturer-or-guide',
    url: s.url ?? null,
    locator: null,
    edition: null,
    retrievedOn: s.retrievedOn ?? null,
    excerpt: s.supports,
    reviewed: false,
  };
}

function codeCitation(id: string): ReviewCitation | null {
  const s = technicalSources.find((x) => x.id === id);
  if (!s) return null;
  return {
    id: s.id,
    title: s.title,
    publisher: s.edition ?? 'Code provision',
    kind: 'code-provision',
    url: s.url ?? null,
    locator: s.locator ?? null,
    edition: s.edition ?? null,
    retrievedOn: s.retrievedAt ? s.retrievedAt.slice(0, 10) : null,
    excerpt: s.paraphrase,
    reviewed: s.review !== 'unreviewed',
  };
}

// Rules quoted in the recipes' fetched sources that can be checked against the
// planned packages alone.
const FLOOR_OVER_CARPET: Record<string, { source: string; rule: string }> = {
  'lvp-floor': {
    source: 'xulon-lvp-install',
    rule: 'Vinyl plank must not go over existing carpet.',
  },
  'hardwood-floor': {
    source: 'toh-floating-engineered',
    rule: 'Carpet comes up before a floating engineered floor goes down.',
  },
};

const label = (r: ScopeRequirement) => r.purpose.replace(/\.$/, '');

export function reviewScope(
  draft: ScopeDraft,
  options: {
    local?: LocalContext | null;
    existingFloor?: 'carpet' | null;
    // A location to assume for this review only (reported, not verified).
    locality?: LocalityInput | null;
  } = {},
): ScopeReview {
  const findings: ReviewFinding[] = [];
  const included = draft.packages.filter((p) => p.included);
  const ids = new Set(included.map((p) => p.id));
  const title = (id: string) => draft.packages.find((p) => p.id === id)?.title ?? id;
  const add = (f: Omit<ReviewFinding, 'group' | 'id'>) =>
    findings.push({ ...f, id: `f${findings.length + 1}`, group: GROUP[f.status] });
  const cite = (sourceIds: string[]) =>
    sourceIds.map((id) => draftCitation(draft, id)).filter((c): c is ReviewCitation => !!c);

  // 1. Rules from fetched installation sources, checked against the plan.
  const recipeHasCarpetRemoval = draft.packages.some((p) => p.id === 'carpet-removal');
  for (const [floorId, { source, rule }] of Object.entries(FLOOR_OVER_CARPET)) {
    if (!ids.has(floorId) || !draft.sources.some((s) => s.id === source)) continue;
    const removes = ids.has('carpet-removal');
    if (!recipeHasCarpetRemoval && options.existingFloor !== 'carpet') continue;
    add({
      packageId: floorId,
      packageTitle: title(floorId),
      status: removes ? 'verified_against_recorded_evidence' : 'potential_conflict',
      summary: removes
        ? `${rule} The plan removes the carpet and pad first.`
        : `${rule} The plan installs it without removing the carpet.`,
      evidence: [`Planned work: ${included.map((p) => p.title).join(', ')}`],
      citations: cite([source]),
      action: removes ? 'None.' : 'Add carpet removal to the plan.',
    });
  }

  // 2. Quantities that rest on recorded measurements.
  const measured = draft.inputs.filter((i) => i.amount !== null && i.source !== 'not-provided');
  const quantified = draft.requirements.filter(
    (r) => r.status === 'quantified' && r.kind === 'measured',
  );
  if (measured.length && quantified.length) {
    const relayed = measured.some((i) => i.source === 'agent-relayed');
    add({
      packageId: null,
      packageTitle: 'Quantities',
      status: 'verified_against_recorded_evidence',
      summary: `${quantified.length} measured quantit${quantified.length === 1 ? 'y follows' : 'ies follow'} the recorded measurements${relayed ? ' (some relayed by an agent, unverified)' : ''}.`,
      evidence: measured.map((i) => `${i.label}: ${i.amount} ${i.unit}`),
      citations: [],
      action: 'A site measurement confirms them before ordering.',
    });
  }

  // 3. What the plan cannot settle yet.
  for (const r of draft.requirements) {
    const pkg = title(r.packageId);
    if (r.status === 'needs-input')
      add({
        packageId: r.packageId,
        packageTitle: pkg,
        status: 'needs_measurement',
        summary: `${label(r)}: quantity waits for ${r.blockedBy.join(', ') || 'a measurement'}.`,
        evidence: [r.quantityBasis],
        citations: cite(r.sourceIds),
        action: 'Measure and record it.',
      });
    else if (r.status === 'needs-product-spec')
      add({
        packageId: r.packageId,
        packageTitle: pkg,
        status: 'needs_product_selection',
        summary: `${label(r)}: depends on the product chosen.`,
        evidence: [r.specification],
        citations: cite(r.sourceIds),
        action: "Choose the product; its maker's instructions set the quantity.",
      });
    else if (r.status === 'conditional')
      add({
        packageId: r.packageId,
        packageTitle: pkg,
        status: 'contractor_review_required',
        summary: `${label(r)}: ${r.condition ?? 'depends on conditions found on site'}`,
        evidence: [r.specification],
        citations: cite(r.sourceIds),
        action: 'Contractor confirms on site.',
      });
    else if (r.status === 'needs-source')
      add({
        packageId: r.packageId,
        packageTitle: pkg,
        status: 'needs_source_verification',
        summary: `${label(r)}: no source on file supports this yet.`,
        evidence: [r.specification],
        citations: [],
        action: 'Find a primary source (maker instructions or code).',
      });
  }

  // 4. Code and permit questions. Retrieved provisions are cited only for the
  // jurisdiction they belong to; elsewhere the question stays open.
  const local = options.local ?? null;
  const philadelphia = local?.jurisdictionId === 'us-pa-philadelphia';
  const topics = new Map<string, Set<string>>();
  for (const r of draft.requirements)
    for (const t of r.codeTopics)
      (topics.get(t) ?? topics.set(t, new Set()).get(t)!).add(r.packageId);
  for (const [topic, packages] of topics) {
    const c = codeCitation(topic);
    add({
      packageId: [...packages][0] ?? null,
      packageTitle: [...packages].map(title).join(', '),
      status: 'authority_confirmation_required',
      summary: c
        ? philadelphia
          ? `${c.title} (${c.locator}) may apply. Retrieved and cited; applicability not reviewed.`
          : `${c.title} is on file for Philadelphia only; this project's jurisdiction is not confirmed.`
        : `Code topic "${topic}" has no retrieved source.`,
      evidence: local?.unresolved.length ? local.unresolved : [],
      citations: c && philadelphia ? [c] : [],
      action: philadelphia
        ? 'Licensed contractor or the authority confirms applicability and permits.'
        : 'Record the property location and jurisdiction, then re-run the review.',
    });
  }
  // 5. Code provisions for the planned work. With a reported location in one of
  // our markets, the adopted local text is cited; any package it does not cover
  // falls back to the public-domain 2012 model code, labelled as such.
  const place = codePlace(options.locality ?? local?.reported);
  const wanted = (packageId: string) =>
    ids.has(packageId) || (packageId === 'permits-general' && ids.size > 0);
  const local_ = place
    ? adoptedCodeDigest
        .filter((e) => place.jurisdictions.includes(e.jurisdiction) && wanted(e.packageId))
        .map(fromAdopted)
    : [];
  const covered = new Set(local_.map((e) => e.packageId));
  const provisions = [
    ...local_,
    ...modelCodeDigest
      .filter((e) => wanted(e.packageId) && !covered.has(e.packageId))
      .map(fromModel),
  ];
  const permitRules = provisions.filter((e) => e.kind === 'permit');
  const localPermits = permitRules.some((e) => e.adopted);
  if (!topics.size)
    add({
      packageId: null,
      packageTitle: 'Permits',
      status: 'authority_confirmation_required',
      summary: localPermits
        ? `${place!.label}: which of this work needs a permit is set out in ${[...new Set(permitRules.filter((e) => e.adopted).map((e) => e.ref))].join(', ')}. The location is as reported, not verified.`
        : permitRules.length
          ? `The 2012 model code lists which work needs a permit and which finish work is exempt (${[...new Set(permitRules.map((e) => e.ref))].join(', ')}). The adopted edition and local amendments decide for this property.`
          : 'Whether this work needs a permit was not researched; no permit source is on file for it.',
      evidence: local?.authority ? [`Authority on file: ${local.authority}`] : [],
      citations: dedupe(
        (localPermits ? permitRules.filter((e) => e.adopted) : permitRules).map((e) => e.citation),
      ),
      action: localPermits
        ? 'Confirm with the local permit office; later amendments may apply.'
        : permitRules.length
          ? `Confirm with the local permit office. ${CHECK_ADOPTED}`
          : 'Ask the contractor or the local permit office.',
    });
  for (const e of provisions.filter((x) => x.kind !== 'permit'))
    add({
      packageId: e.packageId,
      packageTitle: e.packageId === 'permits-general' ? 'Permits and scope' : title(e.packageId),
      status: 'contractor_review_required',
      summary: e.check
        ? `Confirm ${e.check.quantity} ${e.check.comparator} ${e.check.value} ${e.check.unit} (${e.label}). ${e.why}`
        : `${e.label}: ${e.why}`,
      evidence: [],
      citations: [e.citation],
      action: e.adopted
        ? 'Contractor confirms on site; later local amendments may apply.'
        : `Contractor confirms on site. ${CHECK_ADOPTED}`,
    });

  const order: FindingGroup[] = ['conflicts', 'unresolved', 'passes'];
  findings.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
  return {
    recipe: draft.recipe,
    jurisdiction: {
      status: local?.status ?? 'needs_input',
      authority: local?.authority ?? null,
      unresolved: local?.unresolved ?? ['No location or jurisdiction recorded for this project.'],
    },
    findings,
    codeBasis: {
      label:
        localPermits || local_.length
          ? place!.label
          : '2012 ICC model code (no adopted text for this location)',
      adopted: local_.length > 0,
      assumed: !!options.locality,
    },
    counts: {
      passes: findings.filter((f) => f.group === 'passes').length,
      conflicts: findings.filter((f) => f.group === 'conflicts').length,
      unresolved: findings.filter((f) => f.group === 'unresolved').length,
    },
    method:
      'Deterministic: rules quoted from the cited sources, recorded measurements and the draft’s own statuses. No model interpretation.',
    limits: [
      'Not a code review, permit determination or professional approval.',
      'Cited code provisions are retrieved but unreviewed; applicability is not established.',
      ...draft.limits.slice(0, 2),
    ],
  };
}
