import type { StudioAssetId } from '@renovagent/contracts';

export type StudioDirection = {
  id: string;
  title: string;
  mood: string;
  description: string;
  request: string;
  ownBrief: string;
  brief: string;
  palette: string[];
  image: string;
  pieces: { asset: StudioAssetId; name: string; count: number }[];
};

// Curated examples of the same Oakland room, rendered with Muse Image.
// These are proposals, not retail products or a reconstruction of the photograph.
export const STUDIO_DIRECTIONS: readonly StudioDirection[] = [
  {
    id: 'studio-lounge',
    title: 'Slow Sunday',
    request: 'Make it a warm lounge. Cream sofa, striped rug, walnut table. Keep the bay windows.',
    ownBrief:
      'Furnish my room as a warm lounge: cream sofa, tan chair, striped rug, walnut coffee table, brass lamp and plant. Keep my room’s architecture and access clear.',
    mood: 'A room to unwind',
    description:
      'A soft sofa, warm walnut and a bold striped rug. Keep the bay windows doing their thing.',
    brief:
      'Keep the bay windows, doorway, trim and pendant. Add a cream sofa along the left wall, a tan lounge chair, a low walnut coffee table, a cream-and-black striped rug, a brass floor lamp and a small plant. Light oak floors and warm white walls. Keep the doorway clear.',
    palette: ['#edeae0', '#b98c67', '#78513b', '#242424'],
    image: './examples/studio-story/furnished-room.jpg',
    pieces: [
      { asset: 'sofa', name: 'Cream sofa', count: 1 },
      { asset: 'chair', name: 'Tan lounge chair', count: 1 },
      { asset: 'coffee-table', name: 'Walnut coffee table', count: 1 },
      { asset: 'rug', name: 'Striped area rug', count: 1 },
      { asset: 'floor-lamp', name: 'Brass floor lamp', count: 1 },
      { asset: 'plant', name: 'Small potted plant', count: 1 },
    ],
  },
  {
    id: 'studio-office',
    title: 'Good Work',
    request: 'Make this a calm home office. Oak desk, blue chair. Keep the bay windows.',
    ownBrief:
      'Furnish my room as a calm home office with an oak desk, blue upholstered chair, bookcase, blue-gray rug, brass floor lamp and plant. Keep my room’s architecture and access clear.',
    mood: 'Your window-side office',
    description:
      'A desk in the daylight, a comfortable chair and a place for the books. A better kind of commute.',
    brief:
      'Turn this room into a calm home office. Keep the bay windows, doorway, trim, pendant and light oak floor. Add a compact oak desk facing the center bay window, an upholstered blue desk chair, a low oak bookcase on the right wall, a soft blue-gray rug, a brass floor lamp and a plant. Warm white walls. Keep the doorway clear.',
    palette: ['#edeae0', '#6a8ea0', '#b29370', '#2f3e46'],
    image: './examples/studio-story/office.jpg',
    pieces: [
      { asset: 'desk', name: 'Oak writing desk', count: 1 },
      { asset: 'dining-chair', name: 'Blue upholstered desk chair', count: 1 },
      { asset: 'bookcase', name: 'Oak bookcase', count: 1 },
      { asset: 'rug', name: 'Blue-gray area rug', count: 1 },
      { asset: 'floor-lamp', name: 'Brass floor lamp', count: 1 },
      { asset: 'plant', name: 'Potted plant', count: 1 },
    ],
  },
  {
    id: 'studio-dining',
    title: 'Stay for Dinner',
    request:
      'Make it a dining nook. Round walnut table, four rust chairs. Keep the original pendant.',
    ownBrief:
      'Furnish my room as a welcoming dining nook: round walnut table, four rust upholstered chairs, sideboard, cream and terracotta rug and a plant. Keep my room’s architecture and access clear.',
    mood: 'Make room for company',
    description:
      'A round table under the original pendant, four chairs and a little colour. The good seats are all yours.',
    brief:
      'Turn this room into a welcoming dining nook. Keep the bay windows, doorway, trim, stained-glass pendant and light oak floor. Add a round walnut dining table centered under the pendant, four upholstered rust dining chairs, a low walnut sideboard on the right wall, a cream rug with muted terracotta detail and a potted plant by the bay. Warm white walls. Keep the doorway clear.',
    palette: ['#edeae0', '#a75c43', '#78513b', '#789475'],
    image: './examples/studio-story/dining.jpg',
    pieces: [
      { asset: 'dining-table', name: 'Round walnut dining table', count: 1 },
      { asset: 'dining-chair', name: 'Rust upholstered dining chair', count: 4 },
      { asset: 'media-console', name: 'Walnut sideboard', count: 1 },
      { asset: 'rug', name: 'Cream and terracotta rug', count: 1 },
      { asset: 'plant', name: 'Potted plant', count: 1 },
    ],
  },
];
export const studioDirection = (id: string) => STUDIO_DIRECTIONS.find((d) => d.id === id);
export const DIRECTION_ORIGINAL = './examples/oakland/image-01.jpg';
export const DIRECTION_INPUT = 'public/examples/oakland/image-01-lvp.jpg';
