import { type PlanningInputs, type ArtifactPayload } from '@unpermitted/contracts';
import { technicalSources, sourceCaptureDate } from './sources.js';
import { resolveLocalContext } from './locality.js';
type Basis = NonNullable<Extract<ArtifactPayload, { kind: 'code-assessment' }>['codeBasis']>;
export function missingSources(c: PlanningInputs['context'], ids: string[]) {
  return ids.filter(
    (id) =>
      c.sourceAvailability === 'unavailable' ||
      c.unavailableSourceIds.includes(id) ||
      !technicalSources.some(
        (s) =>
          s.id === id &&
          s.access === 'retrieved' &&
          s.interpretation === 'usable-paraphrase' &&
          (!s.coverageWindow ||
            (c.applicationDate !== null &&
              c.applicationDate >= s.coverageWindow.from &&
              c.applicationDate <= s.coverageWindow.through)),
      ),
  );
}
export function determineCodeBasis(c: PlanningInputs['context']): Basis {
  const sourceIds = ['phila-transition', 'phila-adoption', 'pa-ucc'];
  const missing = [
    ...resolveLocalContext(c).unresolved,
    ...missingSources(c, sourceIds).map((id) => `Required source unavailable: ${id}`),
  ];
  const f = c.filing,
    date = c.applicationDate;
  if (!date) missing.push('Complete application received date');
  if (f.kind === 'unknown')
    missing.push('New filing, issued-permit amendment, or expired resubmission');
  if (f.completeness !== 'reported-complete')
    missing.push('Complete filing basis (not just an application started date)');
  if (date && (date < '2026-01-01' || date > sourceCaptureDate))
    missing.push('Filing date outside captured transition coverage; refresh source basis');
  let generalEdition: Basis['generalEdition'] = null,
    decision = 'No code edition selected.';
  if (!missing.length) {
    if (f.kind === 'issued-permit-amendment') {
      if (f.originalEdition === 'unknown' || !f.originalPermitReference.trim())
        missing.push('Original issued permit edition and reference');
      if (f.withinOriginalScope !== 'yes')
        missing.push(
          'Qualified confirmation that amendment remains within permitted original scope',
        );
      if (!missing.length) {
        generalEdition = f.originalEdition as '2018' | '2021';
        decision =
          'Reported in-scope issued-permit amendment retains its original edition (B-2501).';
      }
    } else if (f.kind === 'expired-resubmission') {
      generalEdition = '2021';
      decision =
        'Expired permit resubmission uses 2021 per B-2501; earlier approvals do not establish current authorization.';
    } else if (date! >= '2026-07-01') {
      if (f.selectedEdition === '2018')
        missing.push(
          'Reported 2018 election conflicts with mandatory 2021 basis for a new complete filing',
        );
      else {
        generalEdition = '2021';
        decision =
          'New complete filing on/after July 1, 2026 uses 2021; accessibility retains its separate basis.';
      }
    } else if (f.selectedEdition === 'unknown')
      missing.push('Edition election on the complete transition-period filing');
    else {
      generalEdition = f.selectedEdition === 'not-specified' ? '2018' : f.selectedEdition;
      decision =
        f.selectedEdition === 'not-specified'
          ? 'B-2501 explicitly defaults an unspecified transition-period election to 2018; this is an authority rule, not an invented project default.'
          : 'Reported transition-period edition election under B-2501.';
    }
  }
  return { generalEdition, accessibilityEdition: '2018', decision, sourceIds, missing };
}
export function coveredHalfBath(c: PlanningInputs['context']) {
  const missing: string[] = [];
  if (c.building === 'unknown') missing.push('Building classification');
  if (c.stories === null) missing.push('Stories');
  if (c.dwellingUnits === null) missing.push('Dwelling-unit count');
  if (c.separateEgress === 'unknown') missing.push('Separate means of egress');
  if (c.roomUse === 'unknown') missing.push('Private versus common/public fixture use');
  if (c.scope === 'unknown') missing.push('Exact work scope');
  const outside =
    c.jurisdiction === 'other' ||
    c.building === 'other' ||
    (c.stories !== null && c.stories > 3) ||
    (c.dwellingUnits !== null && c.dwellingUnits > 2) ||
    c.separateEgress === 'no' ||
    ['public-or-employee', 'common-area'].includes(c.roomUse) ||
    ['replacement-only', 'other'].includes(c.scope);
  return { missing, outside };
}
