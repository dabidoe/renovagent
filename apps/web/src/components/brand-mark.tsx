const logoUrl = new URL('../assets/brand/renovagent-logo.png', import.meta.url).href;

// The owner's original artwork: full stacked lockup, or a viewport on its symbol.
export function BrandMark({ size = 30, lockup = false }: { size?: number; lockup?: boolean }) {
  if (lockup)
    return (
      <img
        className="brand-lockup"
        src={logoUrl}
        alt=""
        width={size}
        height={(size * 2) / 3}
        aria-hidden="true"
        draggable={false}
      />
    );
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="430 120 670 600"
      aria-hidden="true"
      focusable="false"
    >
      <image href={logoUrl} width="1536" height="1024" />
    </svg>
  );
}
