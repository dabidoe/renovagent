// Renovagent mark: the house as it stands (ink outline, open base) and the
// measured plan inside it (blueprint-blue corner brackets on the floor line).
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M5 28V13.2L16 5l11 8.2V28"
        stroke="var(--brand-ink)"
        strokeWidth="3.4"
        strokeLinejoin="miter"
      />
      <path
        d="M11 18.5v6h4.5M21 18.5v6h-4.5"
        stroke="var(--brand-blue)"
        strokeWidth="2.6"
        strokeLinecap="square"
      />
    </svg>
  );
}
