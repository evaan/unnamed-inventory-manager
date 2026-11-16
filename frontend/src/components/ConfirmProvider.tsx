import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { ConfirmContext, type ConfirmOptions } from '../hooks/useConfirm';
import { Modal } from './Modal';

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const pending = useRef<{ resolve: (confirmed: boolean) => void } | null>(null);
  const descriptionId = useId();

  const confirm = useCallback((next: ConfirmOptions) => {
    // Repeated clicks must not open multiple dialogs or run an action twice.
    if (pending.current) return Promise.resolve(false);
    let resolve!: (confirmed: boolean) => void;
    const promise = new Promise<boolean>((done) => { resolve = done; });
    pending.current = { resolve };
    setOptions(next);
    return promise;
  }, []);

  const finish = (confirmed: boolean) => {
    const request = pending.current;
    pending.current = null;
    setOptions(null);
    request?.resolve(confirmed);
  };

  useEffect(() => () => {
    pending.current?.resolve(false);
    pending.current = null;
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <Modal title={options.title} role="alertdialog" describedBy={descriptionId} compact onClose={() => finish(false)}>
          <div className="flex items-start gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${options.destructive ? 'bg-rose-500/15 text-rose-300' : 'bg-amber-500/15 text-amber-300'}`}>
              <TriangleAlert className="h-5 w-5" aria-hidden="true" />
            </span>
            <p id={descriptionId} className="min-w-0 break-words pt-1 text-sm leading-relaxed text-slate-300">{options.message}</p>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" data-modal-focus className="ui-button-secondary" onClick={() => finish(false)}>{options.cancelLabel ?? 'Cancel'}</button>
            <button type="button" className={options.destructive ? 'ui-button border border-rose-500/40 bg-rose-500/15 text-rose-300 enabled:hover:bg-rose-500/25' : 'ui-button-primary'} onClick={() => finish(true)}>{options.confirmLabel ?? 'Confirm'}</button>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}
