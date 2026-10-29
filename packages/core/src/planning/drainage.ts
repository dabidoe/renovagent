import { type PlanningInputs, type ArtifactPayload } from '@renovagent/contracts';
import { assessCode } from './playbook.js';
import { missingSources } from './applicability.js';
import { mm } from './calculators.js';
export function assessDrainage(
  inputs: PlanningInputs,
): Extract<ArtifactPayload, { kind: 'code-assessment' }> {
  const base = assessCode(inputs),
    c = inputs.context,
    s = inputs.site;
  const candidate = base.checks[0].applicability === 'candidate';
  const sourceMissing = missingSources(c, ['phila-single-stack']);
  const size = c.drainDiameterInches,
    run = s.drainRun ? mm(s.drainRun) : null,
    fall = s.drainFall ? mm(s.drainFall) : null;
  const canEvaluate =
    candidate &&
    !sourceMissing.length &&
    c.drainageMethod === 'philadelphia-single-stack' &&
    size !== null &&
    run !== null &&
    run > 0 &&
    fall !== null;
  const slope = size === null ? null : size <= 3 ? 1 / 4 : size <= 6 ? 1 / 8 : 1 / 16;
  const required = canEvaluate ? Math.round(((run! * slope!) / 12) * 1e6) / 1e6 : null;
  const fails = canEvaluate && fall! + 1e-6 < required!;
  const mixed =
    candidate &&
    c.drainageMethod === 'philadelphia-single-stack' &&
    c.ventMethod === 'mixed-methods' &&
    !sourceMissing.length;
  const aavMissing = missingSources(c, ['phila-aav']);
  const aavConflict = candidate && !aavMissing.length && c.ventMethod === 'aav-for-water-closet';
  return {
    ...base,
    assessmentArea: 'drainage',
    checks: [
      {
        id: 'local-drain-slope',
        title: 'Local single-stack method: observed fall',
        status: fails ? 'not_supported' : canEvaluate ? 'needs_review' : 'needs_input',
        applicability: candidate ? 'candidate' : 'unresolved',
        requirementIds: ['single-stack-slope', 'general-drainage'],
        sourceIds: ['phila-single-stack', 'phila-drainage-table'],
        rationale: fails
          ? 'Supplied available fall is below the selected local method threshold. Work stays blocked.'
          : canEvaluate
            ? 'The supplied fall meets this arithmetic threshold only. Uniform installed slope, capacity and system design still need review.'
            : 'No numerical code check runs without the covered local basis, explicit method, size, route measurements and usable source.',
        missing: [
          ...sourceMissing.map((id) => `Unavailable source: ${id}`),
          ...(!candidate ? ['Resolve locality / adopted basis and covered project scope'] : []),
          ...(c.drainageMethod !== 'philadelphia-single-stack'
            ? [
                'General-method Table P-704.1 remains formatting-ambiguous; do not import P-919 into another method',
              ]
            : []),
          ...(size === null ? ['Nominal drain diameter'] : []),
          ...(run === null || run <= 0 ? ['Positive measured horizontal run'] : []),
          ...(fall === null ? ['Available fall'] : []),
          'Qualified method, uniform alignment, sizing, load and vent review',
        ],
        evaluation: {
          method: 'P-919.2.8–9: run × selected inch-per-foot threshold ÷ 12',
          observed: fall,
          required,
          unit: 'mm fall',
          outcome: !canEvaluate ? 'not-evaluated' : fails ? 'does-not-meet' : 'meets-threshold',
          limitations: [
            'Selected local single-stack method only',
            'Not pipe sizing, load capacity or construction approval',
          ],
        },
      },
      {
        id: 'local-vent-method',
        title: 'Local vent method and AAV restriction',
        status: aavConflict || mixed ? 'not_supported' : 'needs_review',
        applicability: candidate ? 'candidate' : 'unresolved',
        requirementIds: ['aav-exclusion', 'single-stack-slope'],
        sourceIds: ['phila-aav', 'phila-single-stack'],
        rationale: aavConflict
          ? 'Proposed individual AAV for a water closet conflicts with the captured local exclusion.'
          : mixed
            ? 'The selected local single-stack method cannot mix design methods.'
            : 'No proposed vent arrangement is approved; source coverage and qualified system review remain necessary.',
        missing: [
          ...aavMissing.map((id) => `Unavailable source: ${id}`),
          'Qualified complete vent-system review',
          'Exact selected fixture / connection evidence',
        ],
      },
    ],
  };
}
