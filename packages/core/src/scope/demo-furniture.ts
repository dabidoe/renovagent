import { studioItemAsset } from '../geometry/studio-furniture.js';
import type { StudioAssetId, StudioItem } from '@renovagent/contracts';
// Deliberately chosen USD demo planning allowances per piece. No retailer,
// current-market, product-quality or savings claim is attached to these values.
export const DEMO_FURNITURE_ALLOWANCES: Readonly<Record<StudioAssetId, number | null>> = {
  toilet: null,
  vanity: null,
  shower: null,
  tub: null,
  sink: null,
  mirror: null,
  sofa: 60000,
  chair: 20000,
  'coffee-table': 12000,
  rug: 10000,
  'floor-lamp': 6000,
  plant: 3500,
  bed: 35000,
  desk: 15000,
  bookcase: 10000,
  'dining-table': 25000,
  'dining-chair': 7500,
  'media-console': 18000,
};

export function withDemoFurnitureAllowances(items: StudioItem[]): StudioItem[] {
  return items.map((item) => {
    const asset = studioItemAsset(item.name);
    return item.action !== 'keep' &&
      item.unitAllowanceMinor === null &&
      asset &&
      DEMO_FURNITURE_ALLOWANCES[asset] !== null
      ? { ...item, unitAllowanceMinor: DEMO_FURNITURE_ALLOWANCES[asset], allowanceSource: 'demo' }
      : item;
  });
}
