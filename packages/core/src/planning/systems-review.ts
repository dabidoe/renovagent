import { type PlanningInputs, type ArtifactPayload } from '@renovagent/contracts';
import { electricalReview } from './electrical.js';
import { missingSources, coveredHalfBath, determineCodeBasis } from './applicability.js';
type Check = Extract<ArtifactPayload, { kind: 'code-assessment' }>['checks'][number];
// This register deliberately has no compliance evaluator. Publisher criteria and city
// training are not a reconciled adopted rule package; observations cannot unlock it.
export function systemsReview(inputs: PlanningInputs): Check[] {
  const c = inputs.context,
    s = c.systems,
    scope = coveredHalfBath(c);
  const basis = determineCodeBasis(c);
  const candidate =
    basis.generalEdition === '2021' &&
    !basis.missing.length &&
    !scope.missing.length &&
    !scope.outside;
  const show = (ids: string[], criteria: string[]) =>
    missingSources(c, ids).length ? [] : criteria;
  const shared = [
    'Qualified section-level state/local amendment reconciliation',
    'Qualified existing-building / new-work applicability review',
  ];
  const make = (
    id: string,
    title: string,
    sourceIds: string[],
    referenceCriteria: string[],
    rationale: string,
    missing: string[],
  ): Check => ({
    id,
    title,
    sourceIds,
    requirementIds: [id],
    status: 'needs_review',
    applicability:
      candidate &&
      s.dwellingForm !== 'unknown' &&
      s.dwellingForm !== 'other' &&
      !missingSources(c, sourceIds).length
        ? 'candidate'
        : scope.outside || basis.generalEdition === '2018'
          ? 'outside-coverage'
          : 'unresolved',
    referenceCriteria: show(sourceIds, referenceCriteria),
    rationale: missingSources(c, sourceIds).length
      ? 'Required source unavailable for this work. Reported observations remain in the saved context; source-based comparisons and local compliance evaluation are withheld.'
      : rationale,
    missing: [
      ...missingSources(c, sourceIds).map((id) => `Unavailable source: ${id}`),
      ...basis.missing,
      ...scope.missing,
      ...(s.dwellingForm === 'unknown'
        ? [
            'Actual dwelling form; combined dwelling/townhouse category does not establish a governing systems path',
          ]
        : []),
      ...shared,
      ...missing,
    ],
  });
  return [
    ...electricalReview(inputs),
    make(
      'exhaust-capacity',
      'Local exhaust rate and equipment rating — blocked',
      ['phila-mechanical-scope', 'phila-residential-adoption', 'irc-exhaust-rates'],
      [
        'M-101.2 routes qualifying dwellings to the Residential Code; do not borrow the IMC private-bathroom rate.',
        'Model 2021 IRC Table M1505.4.4: bathroom/toilet-room capacity 50 cfm intermittent or 20 cfm continuous.',
        'Footnote a requires that bathroom rate at a minimum static pressure of 0.25 inch water column under M1505.3. An unspecified nameplate cfm is insufficient.',
      ],
      `Reported strategy: ${s.exhaustStrategy}; operation: ${s.exhaustOperation}; rating: ${s.exhaustRatedCfm ?? 'unknown'} cfm at ${s.exhaustRatingPressureInWg ?? 'unknown'} inch water column. Model criteria are shown for research; local amendment reconciliation is incomplete, so no required rate or compliance result is calculated.`,
      [
        'Qualified mechanical reviewer: reconcile adopted R303.3, M1505.3 and Table M1505.4.4 with state/local amendments',
        'Fan listing / performance curve, selected speed, control strategy and complete duct design; no assumed duct diameter or length',
        ...(s.exhaustRecord.trim()
          ? [`Unverified exhaust record: ${s.exhaustRecord}`]
          : ['Equipment cut sheet and surveyed route evidence']),
      ],
    ),
    make(
      'exhaust-discharge',
      'Ventilation alternative and outdoor termination — blocked',
      ['phila-mechanical-scope', 'phila-residential-adoption', 'irc-bathroom-ventilation'],
      [
        'Model R303.3: window glazing at least 3 square feet, half openable; exception uses artificial light and local exhaust under M1505, directly outdoors.',
        'A window claim does not resolve whole-house ventilation, local amendments or the mechanical exception conditions.',
      ],
      `Reported discharge: ${s.exhaustDischarge}. ${['attic', 'crawlspace', 'interior'].includes(s.exhaustDischarge) ? 'This conflicts with the retrieved model outdoor-discharge criterion and needs redesign/review; it is not an applied local-code determination.' : 'An outdoor report still needs an actual surveyed termination and opening-clearance review.'}`,
      [
        'Qualified reviewer: determine applicable window/mechanical alternative and artificial-light conditions',
        'Survey discharge location, exterior openings, property boundaries, dampers, duct construction and termination clearances under adopted provisions',
        'Resolve whole-house ventilation and energy-code obligations independently',
      ],
    ),
  ];
}
