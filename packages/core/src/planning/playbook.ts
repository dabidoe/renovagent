import { type PlanningInputs, type ArtifactPayload } from '@unpermitted/contracts';
import { resolveLocalContext } from './locality.js';
import { technicalRequirements } from './requirements.js';
import { determineCodeBasis, coveredHalfBath, missingSources } from './applicability.js';
import { clearanceMapping } from './clearance-mapping.js';
import { systemsReview } from './systems-review.js';
export const halfBathPlaybookVersion = 'half-bath/1.3';
export function assessCode(
  inputs: PlanningInputs,
): Extract<ArtifactPayload, { kind: 'code-assessment' }> {
  const c = inputs.context,
    locality = resolveLocalContext(c),
    codeBasis = determineCodeBasis(c),
    scope = coveredHalfBath(c);
  const required = missingSources(c, ['phila-plumbing-scope']);
  const missing = [
    ...codeBasis.missing,
    ...scope.missing,
    ...required.map((id) => `Unavailable provision: ${id}`),
  ];
  const candidate = codeBasis.generalEdition === '2021' && !scope.outside && !missing.length;
  const outside = scope.outside || codeBasis.generalEdition === '2018';
  const status = missing.length ? ('needs_input' as const) : ('needs_review' as const);
  return {
    kind: 'code-assessment',
    assessmentArea: 'basis',
    playbook: halfBathPlaybookVersion,
    reviewComplete: false,
    locality,
    codeBasis,
    requirements: technicalRequirements,
    checks: [
      {
        id: 'plumbing-basis',
        title: 'Adopted edition and project applicability',
        status,
        applicability: candidate ? 'candidate' : outside ? 'outside-coverage' : 'unresolved',
        requirementIds: ['adopted-path'],
        sourceIds: ['pa-ucc', 'phila-adoption', 'phila-plumbing-scope', 'phila-transition'],
        rationale: outside
          ? 'The reported project or selected 2018 general basis is outside this 2021 half-bath method package. No 2021 technical rule is substituted.'
          : candidate
            ? 'Reported location, complete-filing basis and narrow dwelling scope select a candidate 2021 local plumbing path. Qualified classification and amendment reconciliation remain required.'
            : 'The local path is unresolved; missing facts or source access prevent technical rule execution.',
        missing: [...missing, 'Qualified classification / amendment review'],
      },
      ...clearanceMapping(inputs),
      ...systemsReview(inputs),
      {
        id: 'permit-path',
        title: 'Local plumbing permit and exceptions',
        status,
        applicability: candidate ? 'candidate' : 'unresolved',
        requirementIds: ['permit-rule'],
        sourceIds: ['phila-permits', 'phila-permit-exceptions'],
        rationale:
          'A new half-bath is not treated as the narrow minor-repair exemption. P-103.2 and A-301.2.4 are separate rule and exception records; other permits remain a separate review.',
        missing: [
          ...missingSources(c, ['phila-permits', 'phila-permit-exceptions']).map(
            (id) => `Unavailable source: ${id}`,
          ),
          'Qualified exception / filing-scope review',
          'Actual permit and inspection evidence',
        ],
      },
    ],
    coverage: [
      {
        topic: 'Classification / adopted basis',
        status: 'partial',
        reason:
          'State adoption, local scope and complete-filing transition retrieved; qualified applicability review pending.',
      },
      {
        topic: 'Fixture geometry / accessibility',
        status: 'partial',
        reason:
          'Candidate general 2021 incorporation mapped against local Section 405; retained accessibility and full clearance geometry remain blocked.',
      },
      {
        topic: 'Drainage / venting',
        status: 'partial',
        reason:
          'Local P-919 slope and P-918 AAV restrictions captured; general table formatting, sizing and complete vent design unresolved.',
      },
      {
        topic: 'Electrical',
        status: 'unavailable',
        reason:
          'Exact selected IRC bathroom clauses, cross-references and certified local amendments retrieved; limited basin-distance comparison has strict path gates. NEC alternative, full design and licensed review remain blocked.',
      },
      {
        topic: 'Exhaust',
        status: 'partial',
        reason:
          'Local residential routing and publisher rate/pressure/ventilation criteria loaded; adopted amendment reconciliation, equipment and termination review blocked.',
      },
      {
        topic: 'Permits / inspections',
        status: 'partial',
        reason:
          'Local permit rule and administrative exceptions retrieved; professional and authority outcomes absent.',
      },
    ],
  };
}
export function halfBathTasks(): Extract<ArtifactPayload, { kind: 'gated-plan' }> {
  return {
    kind: 'gated-plan',
    playbook: halfBathPlaybookVersion,
    tasks: [
      {
        id: 'survey',
        title: 'Document finished geometry, services and selected fixtures',
        deps: [],
        gates: [],
        completionEvidence: 'Measured drawing, fixture cut sheets and route observations',
      },
      {
        id: 'resolve-design',
        title: 'Resolve technical design and code applicability',
        deps: ['survey'],
        gates: ['technical-review'],
        completionEvidence: 'Qualified scope-specific review with resolved checks',
      },
      {
        id: 'rough-work',
        title: 'Carry out authorized rough plumbing / electrical / ventilation scope',
        deps: ['resolve-design'],
        gates: ['technical-review', 'permit'],
        completionEvidence: 'Trade records, test evidence and as-built routes',
      },
      {
        id: 'close-up',
        title: 'Close concealed work only after required inspection',
        deps: ['rough-work'],
        gates: ['rough-inspection'],
        completionEvidence: 'Authority inspection result and concealment record',
      },
      {
        id: 'floor-finish',
        title: 'Prepare substrate and install the specified floor finish',
        deps: ['close-up'],
        gates: ['technical-review'],
        completionEvidence: 'Product-compatible substrate / installation records',
      },
      {
        id: 'set-fixtures',
        title: 'Set selected fixtures and test completed systems',
        deps: ['floor-finish'],
        gates: ['technical-review'],
        completionEvidence: 'Installation and test records for named fixtures',
      },
      {
        id: 'handover',
        title: 'Resolve final inspection and hand over records',
        deps: ['set-fixtures'],
        gates: ['final-inspection'],
        completionEvidence: 'Authority final outcome, manuals and unresolved-items register',
      },
    ],
  };
}
