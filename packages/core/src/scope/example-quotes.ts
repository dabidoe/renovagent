// Example contractor quotes for the labelled example project only. Contractors,
// ratings and reviews are fictional demo fixtures, not real businesses or
// reviews, and are never shown for a real project. Each quote is itemized per
// work package as materials plus labour, the way contractors usually quote.
// Materials are the step's template allowance with the contractor's markup;
// labour scales with the same measured base area the DIY estimate uses, so the
// two columns describe the same work.

export type ExampleContractor = {
  id: string;
  name: string;
  trade: string;
  rating: number;
  reviews: number;
  review: { author: string; text: string };
};

// Labour per measured sq ft, or a flat amount for work without an area.
// Supplies cover consumables billed for work with no material allowance.
type Rate = { perSqFtMinor?: number; flatMinor?: number; suppliesMinor?: number; basis: string };

type QuoteSpec = {
  contractor: ExampleContractor;
  markup: number;
  rates: Record<string, Rate>;
};

const SPECS: QuoteSpec[] = [
  {
    contractor: {
      id: 'halden-street',
      name: 'Halden Street Renovation',
      trade: 'General contractor',
      rating: 4.8,
      reviews: 112,
      review: {
        author: 'Maria T.',
        text: 'Itemized everything up front and finished a day early.',
      },
    },
    markup: 1.2,
    rates: {
      'carpet-removal': {
        perSqFtMinor: 85,
        suppliesMinor: 4000,
        basis: 'move furniture, pull carpet and pad, haul away',
      },
      'wall-paint': {
        perSqFtMinor: 165,
        suppliesMinor: 4000,
        basis: 'cover floors, patch, two coats',
      },
      paint: { perSqFtMinor: 165, suppliesMinor: 4000, basis: 'cover floors, patch, two coats' },
      'lvp-floor': { perSqFtMinor: 300, basis: 'install click-lock plank' },
      'floor-tile': { perSqFtMinor: 900, basis: 'set and grout tile' },
      'hardwood-floor': { perSqFtMinor: 550, basis: 'install and finish' },
      'exhaust-fan': { flatMinor: 38000, basis: 'replace fan on existing duct and circuit' },
      vanity: { flatMinor: 52000, basis: 'set vanity, connect supply and drain' },
      toilet: { flatMinor: 32000, basis: 'remove old, set new' },
    },
  },
  {
    contractor: {
      id: 'juniper-row',
      name: 'Juniper Row Contractors',
      trade: 'Painting and flooring',
      rating: 4.6,
      reviews: 64,
      review: {
        author: 'Dev P.',
        text: 'Fair price, clean job site. Scheduling took a couple of weeks.',
      },
    },
    markup: 1.15,
    rates: {
      'carpet-removal': {
        perSqFtMinor: 70,
        suppliesMinor: 3500,
        basis: 'move furniture, pull carpet and pad, haul away',
      },
      'wall-paint': { perSqFtMinor: 130, suppliesMinor: 3000, basis: 'cover floors, two coats' },
      paint: { perSqFtMinor: 130, suppliesMinor: 3000, basis: 'cover floors, two coats' },
      'lvp-floor': { perSqFtMinor: 250, basis: 'install click-lock plank' },
    },
  },
  {
    contractor: {
      id: 'ferro-floor',
      name: 'Ferro Floor Co.',
      trade: 'Flooring specialist',
      rating: 4.9,
      reviews: 31,
      review: {
        author: 'Sam K.',
        text: 'Floors only, but the seams are perfect.',
      },
    },
    markup: 1.1,
    rates: {
      'carpet-removal': {
        perSqFtMinor: 50,
        suppliesMinor: 3000,
        basis: 'pull carpet and pad, haul away',
      },
      'lvp-floor': { perSqFtMinor: 225, basis: 'install click-lock plank, transitions' },
      'floor-tile': { perSqFtMinor: 800, basis: 'set and grout tile' },
      'hardwood-floor': { perSqFtMinor: 500, basis: 'install and finish' },
    },
  },
];

export type QuoteLine = {
  packageId: string;
  title: string;
  materialsMinor: number;
  labourMinor: number;
  basis: string;
  areaSqFt: number | null;
};
export type ExampleQuote = {
  contractor: ExampleContractor;
  lines: QuoteLine[];
  materialsMinor: number;
  labourMinor: number;
  totalMinor: number;
  // Planned steps this contractor does not quote (the owner covers them).
  notQuoted: string[];
  // Steps that need a measurement before labour by area can be quoted.
  needsArea: string[];
};

export type QuoteStep = {
  id: string;
  title: string;
  estimate: { materialMinor: number; areaSqFt: number | null } | null;
};

export const EXAMPLE_TAG = '[Example fixture]';

// Quotes for the planned steps, cheapest full-coverage first, then partial ones.
export function exampleQuotes(steps: QuoteStep[]): ExampleQuote[] {
  return SPECS.map(({ contractor, markup, rates }) => {
    const lines: QuoteLine[] = [];
    const notQuoted: string[] = [];
    const needsArea: string[] = [];
    for (const step of steps) {
      const rate = rates[step.id];
      if (!rate) {
        notQuoted.push(step.title);
        continue;
      }
      const area = step.estimate?.areaSqFt ?? null;
      if (rate.perSqFtMinor !== undefined && area === null) {
        needsArea.push(step.title);
        continue;
      }
      lines.push({
        packageId: step.id,
        title: step.title,
        materialsMinor:
          Math.round((step.estimate?.materialMinor ?? 0) * markup) + (rate.suppliesMinor ?? 0),
        labourMinor: (rate.flatMinor ?? 0) + Math.round((rate.perSqFtMinor ?? 0) * (area ?? 0)),
        basis: rate.basis,
        areaSqFt: rate.perSqFtMinor !== undefined ? area : null,
      });
    }
    const materialsMinor = lines.reduce((n, l) => n + l.materialsMinor, 0);
    const labourMinor = lines.reduce((n, l) => n + l.labourMinor, 0);
    return {
      contractor,
      lines,
      materialsMinor,
      labourMinor,
      totalMinor: materialsMinor + labourMinor,
      notQuoted,
      needsArea,
    };
  })
    .filter((q) => q.lines.length)
    .sort(
      (a, b) =>
        Number(a.notQuoted.length > 0) - Number(b.notQuoted.length > 0) ||
        a.totalMinor - b.totalMinor,
    );
}
