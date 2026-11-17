import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export const Modal = ({ title, children, onClose, role = 'dialog', describedBy, compact = false }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  role?: 'dialog' | 'alertdialog';
  describedBy?: string;
  compact?: boolean;
}) => {
  const titleId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const siblings = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== overlayRef.current)
      .map((element) => ({ element, inert: element.inert, hidden: element.getAttribute('aria-hidden') }));
    siblings.forEach(({ element }) => {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });
    document.body.style.overflow = 'hidden';
    (panelRef.current?.querySelector<HTMLElement>('[data-modal-focus]') ?? panelRef.current?.querySelector<HTMLButtonElement>('button'))?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (overlayRef.current?.inert) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      event.stopPropagation();
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )).filter((element) => !element.matches(':disabled') && !element.hidden);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) {
        event.preventDefault();
        panelRef.current.focus();
      } else if (event.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panelRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      siblings.forEach(({ element, inert, hidden }) => {
        element.inert = inert;
        if (hidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', hidden);
      });
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={`max-h-[calc(100dvh-2rem)] w-full ${compact ? 'max-w-md' : 'max-w-2xl'} overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 font-sans text-slate-100 shadow-2xl`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            aria-label="Close modal"
            onClick={onClose}
            className="ui-icon-button"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
};
