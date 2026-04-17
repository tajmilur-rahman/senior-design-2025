import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function useEscapeKey(onClose, active = true) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, active]);
}

export function useFocusTrap(containerRef, active = true) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement;
    const focusablesSel = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const first = container.querySelector(focusablesSel);
    if (first) first.focus();
    else container.focus();

    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const focusables = container.querySelectorAll(focusablesSel);
      if (focusables.length === 0) { e.preventDefault(); return; }
      const firstEl = focusables[0];
      const lastEl  = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault(); lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault(); firstEl.focus();
      }
    };
    container.addEventListener('keydown', onKey);
    return () => {
      container.removeEventListener('keydown', onKey);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [active, containerRef]);
}

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  labelledBy,
  describedBy,
  className = '',
  showClose = true,
}) {
  const containerRef = useRef(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2, 9)}`).current;
  const descId  = useRef(`modal-desc-${Math.random().toString(36).slice(2, 9)}`).current;

  const handleClose = useCallback(() => { onClose?.(); }, [onClose]);
  useEscapeKey(handleClose, open);
  useFocusTrap(containerRef, open);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[size] || 'max-w-md';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy || (title ? titleId : undefined)}
      aria-describedby={describedBy || (description ? descId : undefined)}
    >
      <div
        onClick={handleClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
      />
      <div
        ref={containerRef}
        tabIndex={-1}
        className={`sf-modal relative w-full ${sizeClass} rounded-3xl border shadow-2xl p-6 focus:outline-none ${className}`}
      >
        {(title || showClose) && (
          <div className="flex items-start justify-between mb-4 gap-3">
            <div className="min-w-0">
              {title && (
                <h2 id={titleId} className="sf-modal-title text-base font-bold leading-snug">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="sf-modal-sub text-xs mt-1 leading-relaxed">
                  {description}
                </p>
              )}
            </div>
            {showClose && (
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close dialog"
                className="sf-modal-close flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}
