import { useEffect, useRef, type ReactNode } from 'react';
import { Glyph } from './glyph.js';
export function Modal({
  title,
  children,
  onClose,
  error,
  className = '',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  error?: string | null;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    el.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      'input:not([type=hidden]):not([type=file]):not([hidden]):not([readonly]), textarea, select',
    )?.focus();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`workspace-dialog ${className}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label={title}
    >
      <header>
        <div>
          <h2>{title}</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close dialog">
          <Glyph name="close" />
        </button>
      </header>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {children}
    </dialog>
  );
}
