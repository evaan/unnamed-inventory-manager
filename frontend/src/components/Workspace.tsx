import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PageHeader } from './PageHeader';

export const Workspace = ({ children, onBeforeLeave }: { children: ReactNode; onBeforeLeave?: () => boolean }) => (
  <div className="flex h-dvh flex-col overflow-hidden bg-slate-950">
    <PageHeader onBeforeLogout={onBeforeLeave} />
    <div className="relative flex min-h-0 flex-1 overflow-hidden">{children}</div>
  </div>
);

export const DetailPanel = ({ label, open, children }: {
  label: string;
  open: boolean;
  children: ReactNode;
}) => {
  const panelRef = useRef<HTMLElement>(null);
  const [overlay, setOverlay] = useState(() => window.innerWidth < 1024);

  useEffect(() => {
    const onResize = () => setOverlay(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !overlay || !panel) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const siblings: { element: HTMLElement; inert: boolean; hidden: string | null }[] = [];
    // The panel stays in the workspace; isolate siblings at each ancestor level.
    let branch: HTMLElement = panel;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (!(sibling instanceof HTMLElement) || sibling === branch) continue;
        siblings.push({ element: sibling, inert: sibling.inert, hidden: sibling.getAttribute('aria-hidden') });
        sibling.inert = true;
        sibling.setAttribute('aria-hidden', 'true');
      }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    (panel.querySelector<HTMLElement>('[data-panel-focus], button, input, a[href]') ?? panel).focus();

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )).filter((element) => !element.matches(':disabled') && !element.hidden && !element.closest('[hidden], [inert]'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) {
        event.preventDefault();
        panel.focus();
      } else if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => {
      document.removeEventListener('keydown', trapFocus);
      document.body.style.overflow = previousOverflow;
      siblings.forEach(({ element, inert, hidden }) => {
        element.inert = inert;
        if (hidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', hidden);
      });
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open, overlay]);

  useEffect(() => {
    const panel = panelRef.current;
    // Switching between details and an edit form can remove the focused control.
    if (open && overlay && panel && !panel.contains(document.activeElement)) {
      (panel.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? panel).focus();
    }
  }, [children, open, overlay]);

  return (
    <aside
      ref={panelRef}
      role={overlay && open ? 'dialog' : undefined}
      aria-modal={overlay && open ? true : undefined}
      aria-label={label}
      aria-hidden={!open}
      tabIndex={-1}
      className={`absolute inset-y-0 right-0 z-20 shrink-0 overflow-hidden bg-slate-900 transition-[width] duration-200 lg:static ${
        open ? 'w-full border-l border-slate-800 shadow-2xl sm:w-96 lg:shadow-none' : 'w-0'
      }`}
    >
      <div className="h-full w-full sm:w-96">{open ? children : null}</div>
    </aside>
  );
};
