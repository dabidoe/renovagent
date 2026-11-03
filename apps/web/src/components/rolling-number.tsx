import { useEffect, useRef, useState } from 'react';

// A total that eases from its previous value to the new one when it changes.
// Screen readers get only the final value; reduced motion shows it at once.
export function RollingNumber({
  value,
  format,
  duration = 450,
}: {
  value: number;
  format: (value: number) => string;
  duration?: number;
}) {
  const [shown, setShown] = useState(value);
  // What is on screen now, so an interrupted roll continues from there.
  const current = useRef(value);
  useEffect(() => {
    const start = current.current;
    if (start === value) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      current.current = value;
      setShown(value);
      return;
    }
    let frame = 0;
    const began = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / duration);
      const eased = 1 - (1 - t) ** 3;
      current.current = Math.round(start + (value - start) * eased);
      setShown(current.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return (
    <>
      <span className="rolling-number" aria-hidden="true">
        {format(shown)}
      </span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
