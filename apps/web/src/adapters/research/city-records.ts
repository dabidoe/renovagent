import { type PropertyResearch } from '@renovagent/contracts';
export type CityCandidate = { parcel_number: string; location: string; [key: string]: unknown };
export function phillyQuery(address: string) {
  const suffixes: Record<string, string> = {
    STREET: 'ST',
    AVENUE: 'AVE',
    BOULEVARD: 'BLVD',
    ROAD: 'RD',
    DRIVE: 'DR',
    LANE: 'LN',
    COURT: 'CT',
    PLACE: 'PL',
    TERRACE: 'TER',
  };
  const street = address
    .split(',')[0]
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .replace(
      /\b(STREET|AVENUE|BOULEVARD|ROAD|DRIVE|LANE|COURT|PLACE|TERRACE)\.?$/,
      (suffix) => suffixes[suffix.replace(/\.$/, '')],
    );
  if (street.length < 3 || street.length > 200) throw Error('Enter a street address first.');
  const q = `SELECT parcel_number,location,total_livable_area,total_area,frontage,depth,year_built,number_stories,zoning FROM opa_properties_public WHERE UPPER(location) = '${street.replaceAll("'", "''")}' LIMIT 8`;
  return `https://phl.carto.com/api/v2/sql?${new URLSearchParams({ q })}`;
}
export async function findPhiladelphiaRecords(address: string): Promise<CityCandidate[]> {
  const response = await fetch(phillyQuery(address), {
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw Error(
      'City records are unavailable. You can still add files or use the official record viewer.',
    );
  const data = await response.json();
  if (!Array.isArray(data.rows)) throw Error('The city returned an unsupported response.');
  return data.rows.filter(
    (r: CityCandidate) => typeof r.parcel_number === 'string' && typeof r.location === 'string',
  );
}
export function cityResearch(
  row: CityCandidate,
  address: string,
  jobId: string,
  now = new Date().toISOString(),
): PropertyResearch {
  const labels: Record<string, string> = {
    parcel_number: 'Assessment parcel',
    location: 'City record address',
    total_livable_area: 'Recorded living area',
    total_area: 'Recorded lot area',
    frontage: 'Recorded lot frontage',
    depth: 'Recorded lot depth',
    year_built: 'Recorded year built',
    number_stories: 'Recorded stories',
    zoning: 'Recorded zoning',
  };
  return {
    kind: 'property-research',
    address,
    jobId,
    method: 'city-records',
    verification: 'unreviewed',
    sources: [
      {
        id: 'phila-opa',
        title: 'Philadelphia Office of Property Assessment · public record',
        url: phillyQuery(address),
        retrievedAt: now,
      },
    ],
    findings: Object.entries(labels)
      .filter(([key]) => row[key] !== null && row[key] !== undefined && row[key] !== '')
      .map(([key, label]) => ({
        label,
        value: String(row[key]),
        sourceId: 'phila-opa',
        limit: ['frontage', 'depth', 'total_area', 'total_livable_area'].includes(key)
          ? `Raw OPA ${key}; confirm dataset units. Lot/assessment data is not a measured room or building footprint.`
          : 'Assessment record; may be historic, estimated or different from current conditions.',
      })),
    images: [],
    nextQuestions: [
      'Which room or part of the house are we changing?',
      'Can you add a current photo and any measurements you already have?',
    ],
  };
}
