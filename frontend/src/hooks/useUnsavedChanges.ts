import { useCallback, useEffect, useRef } from 'react';
import { useConfirm } from './useConfirm';

export function useUnsavedChanges(dirty: boolean, saving = false) {
  const confirm = useConfirm();
  const replayingLink = useRef(false);
  const leaving = useRef(false);
  const canLeave = useCallback(async () => !saving && (!dirty || await confirm({
    title: 'Discard unsaved changes?',
    message: 'Your changes haven’t been saved. Discard them and continue?',
    confirmLabel: 'Discard changes',
    cancelLabel: 'Keep editing',
    destructive: true,
  })), [confirm, dirty, saving]);

  useEffect(() => {
    if (!dirty && !saving) return;

    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (leaving.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const onLinkClick = (event: MouseEvent) => {
      if (replayingLink.current) return;
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === '_blank' || link.hasAttribute('download')) return;
      const destination = new URL(link.href);
      if (destination.href === window.location.href) return;
      event.preventDefault();
      event.stopPropagation();
      void canLeave().then((allowed) => {
        if (!allowed || !link.isConnected) return;
        leaving.current = true;
        replayingLink.current = true;
        try {
          link.click();
        } finally {
          replayingLink.current = false;
        }
      });
    };

    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', onLinkClick, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', onLinkClick, true);
    };
  }, [dirty, saving, canLeave]);

  return canLeave;
}
