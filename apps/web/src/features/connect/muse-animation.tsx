import { useEffect, useRef } from 'react';
import './muse-animation.css';

// Decorative, silent web copies of the owner's clips. Playback never calls a provider.
export function MuseAnimation({ variant }: { variant: 'home' | 'connect' }) {
  const video = useRef<HTMLVideoElement>(null);
  const name = variant === 'home' ? 'home-working' : 'connect-making';
  const description = `Renovagent mascot ${variant === 'home' ? 'working at a laptop' : 'holding a sparkling orb'} in a branded hard hat`;
  useEffect(() => {
    const player = video.current;
    if (!player) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    const update = () => {
      if (visible && !document.hidden && !motion.matches) {
        void player.play().catch(() => {});
      } else player.pause();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = !!entry?.isIntersecting;
        update();
      },
      { threshold: 0.25 },
    );
    observer.observe(player);
    motion.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      motion.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
      player.pause();
    };
  }, []);
  return (
    <figure className={`muse-animation muse-animation--${variant}`} aria-label={description}>
      <video
        ref={video}
        src={`./media/muse/${name}.mp4`}
        poster={`./media/muse/${name}-poster.webp`}
        width={384}
        height={384}
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
      />
    </figure>
  );
}
