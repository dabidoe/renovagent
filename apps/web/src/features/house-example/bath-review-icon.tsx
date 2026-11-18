// Tabler Icons (MIT), commit 85e870dbe8680c2d6deefd062122d30ef1544a41.
const icons = {
  mirror: ['M5 3h14v17H5z M9 3v17 M15 3v17'],
  photo: [
    'M15 8h.01',
    'M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12',
    'M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5',
    'M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3',
  ],
  concept: [
    'M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6',
  ],
  plan: [
    'M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12',
    'M4 9h8',
    'M12 15h8',
    'M12 4v16',
  ],
  scan: [
    'M5 12h14',
    'M3 7v-2a2 2 0 0 1 2 -2h2',
    'M3 17v2a2 2 0 0 0 2 2h2',
    'M17 3h2a2 2 0 0 1 2 2v2',
    'M17 21h2a2 2 0 0 0 2 -2v-2',
  ],
  floor: [
    'M8 6a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2l0 -8',
    'M4 10a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2l0 -8',
  ],
  vanity: [
    'M4 12h16a1 1 0 0 1 1 1v3a4 4 0 0 1 -4 4h-10a4 4 0 0 1 -4 -4v-3a1 1 0 0 1 1 -1',
    'M6 12v-7a2 2 0 0 1 2 -2h3v2.25',
    'M4 21l1 -1.5',
    'M20 21l-1 -1.5',
  ],
  paint: [
    'M5 5a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2l0 -2',
    'M19 6h1a2 2 0 0 1 2 2a5 5 0 0 1 -5 5l-5 0v2',
    'M10 16a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -4',
  ],
  window: [
    'M12 3c-3.866 0 -7 3.272 -7 7v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1 -1v-10c0 -3.728 -3.134 -7 -7 -7',
    'M5 13l14 0',
    'M12 3l0 18',
  ],
  scope: [
    'M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2',
    'M9 5a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2',
    'M9 12l.01 0',
    'M13 12l2 0',
    'M9 16l.01 0',
    'M13 16l2 0',
  ],
  share: [
    'M8 9h-1a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-8a2 2 0 0 0 -2 -2h-1',
    'M12 14v-11',
    'M9 6l3 -3l3 3',
  ],
} as const;

export function BathReviewIcon({ name }: { name: keyof typeof icons }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icons[name].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}
