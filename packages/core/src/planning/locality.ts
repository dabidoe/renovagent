import { type PlanningInputs, type LocalContext } from '@unpermitted/contracts';
export const localProfileVersion = 'local-context/1.0';
export function resolveLocalContext(context: PlanningInputs['context']): LocalContext {
  const l = context.locality,
    unresolved: string[] = [];
  if (l.boundaryBasis === 'unknown')
    unresolved.push(
      'Report the property municipal boundary; postal city / ZIP does not establish the enforcing authority.',
    );
  if (!l.countryCode || !l.regionCode || !l.municipality)
    unresolved.push('Country, state/region and municipality');
  const conflict =
    context.jurisdiction === 'philadelphia' &&
    ((l.countryCode && l.countryCode !== 'US') ||
      (l.regionCode && !['PA', 'US-PA'].includes(l.regionCode)) ||
      (l.municipality && l.municipality.trim().toLowerCase() !== 'philadelphia'));
  if (conflict)
    unresolved.push('Reported location conflicts with selected Philadelphia jurisdiction.');
  if (context.jurisdiction === 'unknown')
    unresolved.push('Select the reported jurisdiction; location text is never silently geocoded.');
  if (context.jurisdiction === 'other')
    unresolved.push('No authority profile is loaded for this jurisdiction.');
  const candidate = context.jurisdiction === 'philadelphia' && !unresolved.length;
  return {
    profileVersion: localProfileVersion,
    jurisdictionId: candidate ? 'us-pa-philadelphia' : null,
    status: candidate ? 'candidate' : conflict ? 'needs_review' : 'needs_input',
    reported: l,
    authority: candidate ? 'Philadelphia Department of Licenses and Inspections' : null,
    sourceIds:
      context.jurisdiction === 'philadelphia'
        ? ['phila-adoption', 'phila-contractor-directory']
        : [],
    unresolved,
    uses: [
      {
        purpose: 'code',
        status: 'not-verified',
        requiredEvidence: [
          'Property boundary / authority evidence',
          'Filing, building and work classification',
          'Exact adopted provision and amendment basis',
          'Qualified applicability review',
        ],
      },
      {
        purpose: 'pricing',
        status: 'not-verified',
        requiredEvidence: [
          'Offer or quote matched to project locality',
          'Product / scope specification',
          'Currency, tax and delivery basis',
          'Source date and freshness',
        ],
      },
      {
        purpose: 'shopping',
        status: 'not-verified',
        requiredEvidence: [
          'Actual store / delivery service area',
          'Dated stock and package coverage',
          'Compatibility with selected requirements',
        ],
      },
      {
        purpose: 'contractors',
        status: 'not-verified',
        requiredEvidence: [
          'Exact business identity and service area',
          'Correct local trade-license category / status / expiry',
          'Applicable state registration (distinct from trade license)',
          'Insurance evidence and scope-specific due diligence',
        ],
      },
    ],
  };
}
