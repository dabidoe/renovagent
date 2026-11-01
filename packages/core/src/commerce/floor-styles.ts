// Floor styles: what a homeowner chooses ("honey oak"), apart from what sets
// the price (vinyl plank or hardwood, and the tier). Each style has one
// swatch image, generated once by scripts/floor-swatches.ts from the layout
// below and kept in public/finishes/: an illustration of the style, never a
// product photo. The same swatch is the card in the studio, the reference
// Muse Image lays in a room photo, and the 3D floor texture.

export type FloorStyle = {
  id: string;
  label: string;
  // Words for the model, alongside the swatch.
  description: string;
  // Swatch layout: board colour, board width in inches, straight lay.
  tone: string;
  boardWidthIn: number;
};

// The swatch image covers this much floor on each side.
export const SWATCH_FEET = 8;

export const FLOOR_STYLES: FloorStyle[] = [
  {
    id: 'light-oak',
    label: 'Light oak',
    description: 'light natural oak planks with a matte finish',
    tone: '#d6b88e',
    boardWidthIn: 7,
  },
  {
    id: 'white-oak',
    label: 'White oak',
    description: 'wide pale white oak planks with a matte, almost raw finish',
    tone: '#dcc9aa',
    boardWidthIn: 8,
  },
  {
    id: 'honey-oak',
    label: 'Honey oak',
    description: 'warm honey-toned oak strips with a satin finish',
    tone: '#c9965a',
    boardWidthIn: 5,
  },
  {
    id: 'walnut',
    label: 'Dark walnut',
    description: 'rich dark brown walnut planks with a satin finish',
    tone: '#6b4630',
    boardWidthIn: 6,
  },
  {
    id: 'gray-oak',
    label: 'Gray-washed oak',
    description: 'grey-washed oak planks, a cool greige tone with visible grain, matte',
    tone: '#a9a296',
    boardWidthIn: 7,
  },
];

export const floorStyle = (id: string) => FLOOR_STYLES.find((s) => s.id === id) ?? null;
