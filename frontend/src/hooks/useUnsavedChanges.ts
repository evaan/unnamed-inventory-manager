import { useEffect } from 'react';

export function useUnsavedChanges(dirty: boolean, saving = false) {
  const canLeave = () => !saving && (!dirty || window.confirm('Discard your unsaved changes?'));

  useEffect(() => {
    if (!dirty && !saving) return;

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const onLinkClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === '_blank' || link.hasAttribute('download')) return;
      const destination = new URL(link.href);
      if (destination.href === window.location.href) return;
      if (saving || !window.confirm('Discard your unsaved changes?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', onLinkClick, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', onLinkClick, true);
    };
  }, [dirty, saving]);

  return canLeave;
}
