const darkLogoUrl = new URL('../assets/brand/renovagent-logo.png', import.meta.url).href;
// The owner's light lockup for dark backgrounds (the landing hero); same canvas and layout.
const lightLogoUrl = new URL('../assets/brand/renovagent-logo-light.webp', import.meta.url).href;

// The owner's original artwork: full stacked lockup, or a viewport on its symbol.
export function BrandMark({
  size = 30,
  lockup = false,
  compact = false,
  tone = 'dark',
}: {
  size?: number;
  lockup?: boolean;
  compact?: boolean;
  tone?: 'dark' | 'light';
}) {
  const logoUrl = tone === 'light' ? lightLogoUrl : darkLogoUrl;
  if (lockup && compact)
    return (
      <svg
        className="brand-lockup"
        width={size}
        height={(size * 780) / 1200}
        viewBox="170 130 1200 780"
        aria-hidden="true"
        focusable="false"
      >
        <image href={logoUrl} width="1536" height="1024" />
      </svg>
    );
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
