import { useEffect, useRef, useState } from 'react';

export function Copy({
  value,
  label = 'Copy',
  className = 'ca-copy',
}: {
  value: string;
  label?: string;
  className?: string;
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
      title={status === 'failed' ? 'Select the text and copy it manually.' : undefined}
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
      {status === 'copied' ? 'Copied' : status === 'failed' ? 'Select text to copy' : label}
    </button>
  );
}
