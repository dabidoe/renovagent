import { useEffect, useRef, type ReactNode } from 'react';
import { Glyph } from './glyph.js';
export function Modal({
  title,
  children,
  onClose,
  error,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  error?: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    el.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      'input:not([type=hidden]):not([readonly]), textarea',
    )?.focus();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="workspace-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label={title}
    >
      <header>
        <div>
          <p className="eyebrow">YOUR LOCAL WORKSPACE</p>
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
