// Background grid drifts at a fraction of scroll speed. Listens in the capture
// phase so scrolling inside panes (not only the window) moves it too. Off when
// the person prefers reduced motion.
const RATE = 0.3;

export function startGridParallax(root: HTMLElement = document.documentElement) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  let frame = 0;
  let offset = 0;
  const onScroll = (event: Event) => {
    const target = event.target;
    offset =
      target instanceof HTMLElement && target !== document.documentElement
        ? target.scrollTop
        : window.scrollY;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      root.style.setProperty('--grid-shift', `${-Math.round(offset * RATE)}px`);
    });
  };
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });
  return () => {
    document.removeEventListener('scroll', onScroll, { capture: true });
    if (frame) cancelAnimationFrame(frame);
  };
}
