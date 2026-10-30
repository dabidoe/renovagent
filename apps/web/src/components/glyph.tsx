import { type ReactNode } from 'react';
export function Glyph({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    code: (
      <>
        <path d="m8 6-6 6 6 6m8-12 6 6-6 6m-2-15-4 18" />
      </>
    ),
    photo: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8" cy="8" r="1.5" />
        <path d="m3 17 5-5 4 4 4-6 5 7" />
      </>
    ),
    paint: (
      <>
        <rect x="3" y="3" width="14" height="6" rx="1" />
        <path d="M17 6h4v7h-9v3m-2 0h4v6h-4z" />
      </>
    ),
    layers: (
      <>
        <path d="m3 7 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 17l9 5 9-5" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M12 19V5m-6 6 6-6 6 6" />,
    right: <path d="M5 12h14m-6-6 6 6-6 6" />,
    pipe: (
      <>
        <path d="M4 3h6v7h10v6H4ZM2 3h10M20 8v10" />
      </>
    ),
    screw: (
      <>
        <path d="m5 4 4-2 13 13-2 4L5 4ZM7 6l-4 4 2 2 4-4M13 10l-3 3m6 0-3 3m6 0-3 3" />
      </>
    ),
    tile: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 12h18M12 3v18" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    home: <path d="m3 10 9-7 9 7v10H3Zm6 10v-7h6v7" />,
    file: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 8h6m-6 4h6m-6 4h4" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    chat: <path d="M21 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 19 0Z" />,
    activity: <path d="M3 12h4l3-7 4 14 3-7h4" />,
    source: (
      <>
        <path d="M4 6h16v14H4zM8 3h8v6H8z" />
      </>
    ),
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    chevron: <path d="m8 10 4 4 4-4" />,
    history: (
      <>
        <path d="M3 11a9 9 0 1 1 2.6 7M3 4v7h7" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    plan: (
      <>
        <path d="m3 4 6-1 6 2 6-1v16l-6 1-6-2-6 1ZM9 3v16M15 5v16" />
      </>
    ),
    materials: (
      <>
        <path d="m3 7 9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10M7.5 5 16 9" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5" />
      </>
    ),
    connection: (
      <>
        <path d="m10 13 4-4M8 15l-1 1a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0m2 2 1-1a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0" />
      </>
    ),
  };
  return (
    <svg
      className="glyph"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.file}
    </svg>
  );
}
