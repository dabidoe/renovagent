import type { LocalContext } from '@renovagent/contracts';

export type LocalityInput = LocalContext['reported'];

// Which adopted code text applies to a reported location. California's Title 24
// is statewide; New York City has its own Construction Codes, while the New
// York State Uniform Code applies elsewhere in the state; Austin amends the
// codes Texas cities adopt. Reported locations are not verified boundaries.

export type CodePlace = { label: string; jurisdictions: string[] };

const NYC = /^(new york( city)?|nyc|manhattan|brooklyn|queens|bronx|the bronx|staten island)$/i;

export function codePlace(locality: LocalityInput | null | undefined): CodePlace | null {
  if (!locality) return null;
  const region = (locality.regionCode ?? '').toUpperCase().replace(/^US-/, '');
  const city = (locality.municipality ?? '').trim();
  if (region === 'CA')
    return {
      label: 'California 2025 Title 24 (statewide)',
      jurisdictions: /^san francisco$/i.test(city)
        ? ['California', 'San Francisco']
        : ['California'],
    };
  if (region === 'NY')
    return NYC.test(city)
      ? { label: 'New York City 2022 Construction Codes', jurisdictions: ['New York City'] }
      : { label: 'New York State 2025 Uniform Code', jurisdictions: ['New York State'] };
  if (region === 'TX' && /^austin$/i.test(city))
    return { label: 'Austin amendments to the 2024 codes', jurisdictions: ['Austin'] };
  return null;
}

// Locations offered when the owner has not recorded one (the review labels
// any of these as assumed).
export const reviewLocations: { id: string; label: string; locality: LocalityInput }[] = [
  ['bay-area', 'Bay Area (San Francisco, CA)', 'CA', 'San Francisco'],
  ['nyc', 'New York City', 'NY', 'New York City'],
  ['austin', 'Austin, TX', 'TX', 'Austin'],
  ['philadelphia', 'Philadelphia, PA', 'PA', 'Philadelphia'],
].map(([id, label, regionCode, municipality]) => ({
  id: id!,
  label: label!,
  locality: {
    countryCode: 'US',
    regionCode: regionCode!,
    municipality: municipality!,
    postalCode: null,
    propertyReference: null,
    boundaryBasis: 'user-reported' as const,
  },
}));
