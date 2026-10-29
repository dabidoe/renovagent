import { emptyPlanningInputs, type PlanningInputs } from '@renovagent/contracts';
// Synthetic measurements and user-selected specifications; never a real survey or code minimum.
export function measured(): PlanningInputs {
  const p = emptyPlanningInputs();
  p.site = {
    width: { amount: 5, unit: 'ft' },
    length: { amount: 7, unit: 'ft' },
    measurement: 'finished',
    drainRun: { amount: 8, unit: 'ft' },
    drainFall: { amount: 2, unit: 'in' },
  };
  p.layout = {
    toiletModel: 'Named toilet A',
    toiletWidth: { amount: 16, unit: 'in' },
    toiletProjection: { amount: 28, unit: 'in' },
    toiletCenterX: { amount: 18, unit: 'in' },
    basinModel: 'Named basin',
    basinWidth: { amount: 20, unit: 'in' },
    basinDepth: { amount: 16, unit: 'in' },
    basinX: { amount: 34, unit: 'in' },
    minimumSide: { amount: 15, unit: 'in' },
    minimumFront: { amount: 21, unit: 'in' },
    door: 'surveyed-clear',
  };
  p.finish = {
    specification: 'Tile product A / finish X',
    wasteBasis: 'User-selected 10% allowance',
    wasteBps: 1000,
    packageAreaM2: 1,
    inventoryAreaM2: 0,
    inventorySpecification: '',
    packagePriceMinor: 3500,
    currency: 'USD',
    priceSource: 'User quote Q1',
    priceDate: '2026-10-27',
  };
  p.context = {
    ...p.context,
    jurisdiction: 'philadelphia',
    applicationDate: '2026-10-27',
    building: 'one-two-family-townhouse',
    scope: 'new-half-bath',
    accessibility: 'unknown',
    sourceAvailability: 'available',
    locality: {
      countryCode: 'US',
      regionCode: 'PA',
      municipality: 'Philadelphia',
      postalCode: null,
      propertyReference: 'Synthetic reference property',
      boundaryBasis: 'user-reported',
    },
    filing: {
      kind: 'new',
      completeness: 'reported-complete',
      selectedEdition: '2021',
      originalEdition: 'unknown',
      withinOriginalScope: 'unknown',
      originalPermitReference: '',
    },
    stories: 2,
    dwellingUnits: 1,
    separateEgress: 'yes',
    roomUse: 'private-dwelling',
    drainageMethod: 'philadelphia-single-stack',
    drainDiameterInches: 3,
    ventMethod: 'unknown',
    unavailableSourceIds: [],
  };
  return p;
}
