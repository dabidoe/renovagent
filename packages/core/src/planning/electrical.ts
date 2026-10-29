import { type ArtifactPayload, type PlanningInputs } from '@renovagent/contracts';
import { coveredHalfBath, determineCodeBasis, missingSources } from './applicability.js';
type Check = Extract<ArtifactPayload, { kind: 'code-assessment' }>['checks'][number];
export const electricalPathSources = [
  'phila-residential-adoption',
  'phila-residential-amendments',
  'pa-irc-amendments',
  'irc-electrical-scope',
];
export function electricalPath(inputs: PlanningInputs) {
  const c = inputs.context,
    e = c.electrical,
    s = c.systems;
  const basis = determineCodeBasis(c),
    scope = coveredHalfBath(c);
  const missing = [
    ...basis.missing,
    ...scope.missing,
    ...missingSources(c, electricalPathSources).map(
      (id) => `Unavailable electrical path source: ${id}`,
    ),
  ];
  if (basis.generalEdition !== '2021')
    missing.push('This electrical package requires the 2021 general filing basis');
  if (e.designBasis !== 'irc-part-viii')
    missing.push('Explicit IRC Part VIII design basis; NEC alternative is not loaded');
  if (
    !(
      s.dwellingForm === 'detached' ||
      (s.dwellingForm === 'rowhouse-townhouse' && c.dwellingUnits === 1)
    )
  )
    missing.push(
      'Unambiguous qualifying detached dwelling or single-family townhouse; twin/duplex form needs classification',
    );
  if (
    e.serviceVoltage !== '120-240' ||
    e.servicePhase !== 'single' ||
    e.serviceAmps === null ||
    e.serviceAmps > 400
  )
    missing.push('Reported 120/240 V single-phase service at most 400 A, within E3401 scope');
  return {
    candidate: !scope.outside && !missing.length,
    outside: scope.outside || basis.generalEdition === '2018',
    missing,
  };
}
export function electricalReview(inputs: PlanningInputs): Check[] {
  const c = inputs.context,
    s = c.systems,
    e = c.electrical,
    path = electricalPath(inputs);
  const make = (
    id: string,
    title: string,
    locator: string,
    ids: string[],
    criteria: string[],
    rationale: string,
    missing: string[],
  ): Check => {
    const sourceIds = [
      ...electricalPathSources,
      ...ids,
      ...(e.designBasis === 'nec-alternative' ? ['nec-2020-fulltext'] : []),
    ];
    const unavailable = missingSources(c, sourceIds);
    return {
      id,
      title,
      status: 'needs_review',
      applicability:
        path.candidate && !unavailable.length
          ? 'candidate'
          : path.outside
            ? 'outside-coverage'
            : 'unresolved',
      sourceIds,
      requirementIds: [id],
      referenceCriteria: unavailable.length ? [] : criteria,
      mapping: {
        status: unavailable.length ? 'unresolved' : 'candidate-incorporation',
        locator,
        edition: '2021 IRC Part VIII / Philadelphia amendments',
        sourceIds,
        review: 'unreviewed',
        finding: unavailable.length
          ? 'Required source unavailable; mapping withheld.'
          : 'Candidate incorporation: state enumeration and certified Bill 260395 contain no displayed replacement for these selected bathroom clauses. This source comparison is unreviewed and is not a completeness certification or NEC-path determination.',
      },
      rationale: unavailable.length
        ? 'Required source unavailable; source-based comparisons are withheld. Observations remain in the saved input record.'
        : rationale,
      missing: [
        ...path.missing,
        ...unavailable.map((id) => `Unavailable source: ${id}`),
        'Qualified licensed electrician: verify adopted-path and amendment completeness, physical installation and affected existing loads',
        ...missing,
      ],
    };
  };
  const circuit = make(
    'electrical-circuit',
    'Bathroom branch circuit and exception',
    'E3703.4 → E3702.3',
    ['irc-bathroom-circuit'],
    [
      'E3703.4 requires a 20 A circuit for required basin/countertop outlets; other outlets are excluded except the single-bathroom exception subject to E3702.',
      'E3702.3 limits individual portable cord-connected loads to 80% and fixed non-lighting loads on mixed circuits to 50%. These are not a complete load calculation.',
    ],
    `Reported circuit: ${s.circuitAmps ?? 'unknown'} A; serves ${s.circuitServes}. A single-bathroom report does not establish the exception or adequate conductor/load capacity.`,
    [
      'Trace every served outlet and appliance; verify E3702 load conditions, conductors, overcurrent protection and panel capacity',
      s.electricalRecord.trim()
        ? `Unverified record: ${s.electricalRecord}`
        : 'Circuit schedule and equipment record',
    ],
  );
  const outlet = make(
    'electrical-basin',
    'Selected basin receptacle distance — limited comparison',
    'E3901.6 [210.52(D)]',
    ['irc-bathroom-outlets'],
    [
      'Selected basin outside edge to receptacle: at most 36 inches. Mounting must be on adjacent wall/partition, countertop or cabinet side/face and no more than 12 inches below the basin/countertop. Countertop assemblies must be listed.',
    ],
    `Reported distance: ${s.basinReceptacleDistanceInches ?? 'unknown'} inches; measurement basis ${e.basinMeasurement}; mounting ${e.basinMount}; below basin/countertop ${e.basinBelowTopInches ?? 'unknown'} inches. Only the distance subcheck is computed, not outlet or bathroom compliance.`,
    [
      'Verify every basin and required outlet, mounting position, vertical offset and countertop assembly listing',
      'Measured outside-edge drawing and licensed electrical inspection; a passing distance cannot release installation',
    ],
  );
  const measured = s.basinReceptacleDistanceInches;
  const evaluable =
    path.candidate &&
    !missingSources(c, outlet.sourceIds).length &&
    measured !== null &&
    e.basinMeasurement === 'outside-edge';
  outlet.evaluation = {
    method:
      'Selected basin only: reported outside-edge distance ≤ 36 inches under candidate IRC E3901.6 incorporation.',
    observed: measured,
    required: evaluable ? 36 : null,
    unit: 'in',
    outcome: !evaluable ? 'not-evaluated' : measured! <= 36 ? 'meets-threshold' : 'does-not-meet',
    limitations: [
      'User-reported measurement; no verified installation',
      'Does not evaluate other basins, required outlet count, mounting/listing, GFCI or accessibility',
      'Qualified review and all construction gates remain open',
    ],
  };
  if (evaluable && measured! > 36) outlet.status = 'not_supported';
  if (!evaluable)
    outlet.missing.push(
      'Known outside-edge measurement and complete candidate IRC path are required before numerical comparison',
    );
  const gfci = make(
    'electrical-gfci',
    'Bathroom GFCI supply scope and testing',
    'E3902.1 [210.8(A)(1)]',
    ['irc-bathroom-outlets'],
    [
      'E3902.1 covers 125–250 V bathroom receptacles supplied by single-phase branch circuits rated at most 150 V to ground. Reported service characteristics do not establish every branch/receptacle supply.',
    ],
    `Protection observation: ${s.gfci}. Exact clause retrieved; no protection pass is inferred from a device or breaker report.`,
    [
      'Identify every affected receptacle, actual branch voltage/phase/voltage-to-ground and document protection/accessibility tests',
      'Review AFCI, tamper resistance, equipment listing and grounding independently',
    ],
  );
  const lighting = make(
    'electrical-lighting',
    'Bathroom lighting and control exceptions',
    'E3903.2 [210.70(A)(1)]',
    ['irc-bathroom-outlets'],
    [
      'Bathroom lighting outlet needs a listed entrance-area wall control. The switched-receptacle substitution exception excludes bathrooms; the occupancy-sensor alternative has wall-control/location/manual-override conditions.',
    ],
    'Exact lighting/control clause and exceptions retrieved. No actual lighting plan or control evidence is established.',
    [
      'Licensed electrician: selected lighting outlet/control, sensor conditions, listing and installation evidence',
    ],
  );
  const shower = make(
    'electrical-wet-zone',
    'Residential bathtub/shower receptacle amendment',
    'R-E4002.11',
    ['phila-residential-amendments', 'pa-irc-amendments'],
    [
      'Certified local R-E4002.11 prohibits receptacles within or directly over a bathtub/shower. This residential retained/replacement text must not be exchanged for the model NEC 3-foot / 8-foot zone or its exceptions.',
    ],
    'The half-bath label does not establish absence of a nearby tub/shower. Actual wet-zone geometry and the chosen electrical path need review.',
    [
      'Survey actual tub/shower relationship; NEC alternative remains unsupported',
      'Qualified reviewer: reconcile retained state text and local R-E4002.11; no automatic exemption',
    ],
  );
  shower.mapping = {
    ...shower.mapping!,
    status: missingSources(c, ['phila-residential-amendments', 'pa-irc-amendments']).length
      ? 'unresolved'
      : 'local-replacement',
    finding:
      'State excludes the 2021 model E4002.11; certified local Bill 260395 supplies explicit R-E4002.11 text. This mapping applies only to the candidate residential path, with qualified review still required.',
  };
  return [circuit, outlet, gfci, lighting, shower];
}
