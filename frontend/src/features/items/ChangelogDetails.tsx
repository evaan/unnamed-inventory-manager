import { X } from 'lucide-react';
import type { ChangelogEntry } from './changelogapi';

export const ChangelogDetails = ({ entry, actionLabel, onClose }: {
  entry: ChangelogEntry;
  actionLabel: string;
  onClose: () => void;
}) => (
  <div className="flex h-full flex-col">
    <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
      <div className="min-w-0">
        <h2 className="break-words text-base font-semibold">{entry.Item.ItemName || entry.ItemID}</h2>
        {entry.Item.DeletedAt && <p className="mt-1 text-xs text-slate-400">Deleted item</p>}
      </div>
      <button type="button" onClick={onClose} aria-label="Close changelog details" title="Close (Esc)" className="ui-icon-button -mr-1.5">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
      <dl className="space-y-3 text-sm">
        <div><dt className="text-xs text-slate-400">Action</dt><dd className="mt-1">{actionLabel}</dd></div>
        <div><dt className="text-xs text-slate-400">Changed by</dt><dd className="mt-1 break-words">{entry.UserName || entry.UserID}</dd></div>
        <div>
          <dt className="text-xs text-slate-400">Time</dt>
          <dd className="mt-1"><time dateTime={entry.ChangeTime}>{new Date(entry.ChangeTime).toLocaleString()}</time></dd>
        </div>
        {entry.Quantity !== 0 && (
          <div><dt className="text-xs text-slate-400">Stock change</dt><dd className="mt-1 tabular-nums">{entry.Quantity > 0 ? '+' : ''}{entry.Quantity}</dd></div>
        )}
      </dl>
      {entry.Changes?.map((change) => (
        <section key={change.Field} aria-label={change.Field} className="border-t border-slate-800 pt-4">
          <h3 className="text-sm font-medium">{change.Field}</h3>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-400">Before</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-slate-400">{change.Before || <span className="italic">Empty</span>}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">After</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words">{change.After || <span className="italic text-slate-400">Empty</span>}</dd>
            </div>
          </dl>
        </section>
      ))}
      {entry.Description && (
        <section aria-label="Note" className="border-t border-slate-800 pt-4">
          <h3 className="text-sm font-medium">Note</h3>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-300">{entry.Description}</p>
        </section>
      )}
    </div>
  </div>
);
