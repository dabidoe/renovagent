import { type ArtifactPayload, type PlanningInputs } from '@renovagent/contracts';
import { missingSources, determineCodeBasis, coveredHalfBath } from './applicability.js';
type Check = Extract<ArtifactPayload, { kind: 'code-assessment' }>['checks'][number];
export function clearanceMapping(inputs: PlanningInputs): Check[] {
  const c = inputs.context,
    basis = determineCodeBasis(c),
    scope = coveredHalfBath(c);
  const sourceIds = [
    'pa-ucc',
    'phila-plumbing-scope',
    'phila-clearance-amendment',
    'ipc-2021-clearance',
  ];
  const missing = missingSources(c, sourceIds);
  const candidate =
    basis.generalEdition === '2021' &&
    !basis.missing.length &&
    !scope.missing.length &&
    !scope.outside &&
    !missing.length;
  return [
    {
      id: 'fixture-clearances',
      title: 'General fixture clearance — local section map',
      status: 'needs_review',
      applicability: candidate
        ? 'candidate'
        : scope.outside || basis.generalEdition === '2018'
          ? 'outside-coverage'
          : 'unresolved',
      sourceIds: [...sourceIds, 'ipc-fixture-clearance', 'phila-transition'],
      requirementIds: ['clearance-basis'],
      mapping: {
        status: !missing.length ? 'candidate-incorporation' : 'unresolved',
        locator: 'P-1.1 / P-101.2 → 2021 IPC 405.3.1, 405.3.3; local Section 405',
        edition: '2021 general plumbing; separate retained accessibility basis',
        sourceIds,
        review: 'unreviewed',
        finding: missing.length
          ? 'Required source unavailable; no section mapping applied.'
          : 'Candidate 2021 incorporation: local Section 405 displays setting and public/employee privacy amendments, not a replacement numeric 405.3.1. This is an unreviewed comparison of captured sources, not a certified absence of other amendments.',
      },
      referenceCriteria: missing.length
        ? []
        : [
            '2021 IPC 405.3.1 contains 15 inches center-to-side obstruction, 21 inches in front to wall/fixture/door, compartment dimensions and an accessible children’s exception. Adjacent-fixture wording must be read from 2021; the 2018 excerpt is not substituted.',
            'Local 405.3.4 / P-405.3.4.1 concern public/employee compartment privacy, including all-gender partitions; they do not automatically create a private-dwelling partition requirement.',
          ],
      rationale:
        'General geometry maps to the candidate 2021 local plumbing path. Retained 2018 accessibility is a separate determination, not a blanket replacement of 405.3.1. The current footprint sketch does not establish all clearance envelopes, compartment conditions or door/egress interference, so numerical clearance compliance remains blocked.',
      missing: [
        ...missing.map((id) => `Unavailable source: ${id}`),
        ...basis.missing,
        ...scope.missing,
        'Qualified review of incorporation, complete local amendments, fixture use and exceptions',
        'Survey all fixture/obstruction clearance envelopes, compartments and door/egress sweep; manufacturer constraints remain separate',
      ],
    },
    {
      id: 'fixture-accessibility',
      title: 'Retained accessibility scope — blocked',
      status: 'needs_review',
      applicability: 'unresolved',
      sourceIds: ['phila-transition', 'ipc-fixture-clearance', 'ipc-2021-clearance'],
      requirementIds: ['clearance-basis'],
      mapping: {
        status: 'unresolved',
        locator:
          'Retained IBC 2018 accessibility / ICC A117.1-2009 versus general IPC 2021 Section 405',
        edition: 'Separate 2018 accessibility basis',
        sourceIds: ['phila-transition'],
        review: 'unreviewed',
        finding:
          'B-2501 identifies the retained accessibility basis. Property classification, required accessible features and full retained provisions/exceptions are not established.',
      },
      rationale: `Reported accessibility status: ${c.accessibility}. No accessibility exemption or accessible children’s exception is inferred from private use or the general clearance dimensions.`,
      missing: [
        'Qualified accessibility reviewer: determine scoping, required facilities/routes and exact retained sections',
        'Complete permitted retained provisions and exceptions, dimensioned accessible layout and applicable alteration obligations',
      ],
    },
  ];
}
