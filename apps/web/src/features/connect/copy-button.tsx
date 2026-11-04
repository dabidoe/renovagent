import { useEffect, useRef, useState } from 'react';

export function Copy({
  value,
  label = 'Copy',
  className = 'ca-copy',
  iconOnly = false,
}: {
  value: string;
  label?: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setStatus('idle');
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value]);
  return (
    <button
      type="button"
      className={className}
      aria-label={iconOnly ? (status === 'copied' ? 'Copied' : label) : undefined}
      title={
        status === 'failed' ? 'Select the text and copy it manually.' : iconOnly ? label : undefined
      }
      onClick={async () => {
        if (timer.current) clearTimeout(timer.current);
        try {
          await navigator.clipboard.writeText(value);
          setStatus('copied');
          timer.current = setTimeout(() => setStatus('idle'), 2000);
        } catch {
          setStatus('failed');
        }
      }}
    >
      {status === 'copied' ? (
        'Copied'
      ) : status === 'failed' ? (
        'Select text to copy'
      ) : iconOnly ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <rect x="8" y="8" width="13" height="13" rx="2" />
          <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
        </svg>
      ) : (
        label
      )}
    </button>
  );
}
