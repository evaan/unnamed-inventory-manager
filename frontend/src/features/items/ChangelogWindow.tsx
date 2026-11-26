import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ListSkeleton } from '../../components/ListSkeleton';
import { useAuth } from '../auth/useAuth';
import { getLogs, type ChangelogEntry } from './changelogapi';

const ACTION_LABELS: Record<ChangelogEntry['Action'], string> = {
  CREATE: 'Created',
  ADDED: 'Stock added',
  TAKEN: 'Stock taken',
  MODIFIED: 'Modified',
  DELETE: 'Deleted',
};

export const ChangelogWindow = ({ onClose }: { onClose: () => void }) => {
  const auth = useAuth();
  const session = auth.data?.loggedIn && !auth.data.disabled ? auth.data : null;
  const logs = useQuery({
    queryKey: ['inventory', session?.email, 'logs'],
    queryFn: getLogs,
    enabled: !!session,
    retry: false,
  });

  if (!session) return null;

  return (
    <Modal title="Inventory changelog" onClose={onClose}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-400">Inventory changes, newest first.</p>
        <button
          type="button"
          onClick={() => void logs.refetch()}
          disabled={logs.isFetching}
          className="ui-button-secondary"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </button>
      </div>
      {logs.error && (
        <ErrorBanner message={logs.error.message} onRetry={() => void logs.refetch()} retrying={logs.isFetching} />
      )}
      {logs.isLoading ? (
        <ListSkeleton label="Loading changelog" />
      ) : logs.data?.length === 0 ? (
        <p className="ui-empty-state">No inventory changes yet.</p>
      ) : (
        <ol className="divide-y divide-slate-800">
          {logs.data?.map((entry) => (
            <li key={entry.ID} className="space-y-2 py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium">
                    {entry.Item.ItemName || entry.ItemID}
                    {entry.Item.DeletedAt && <span className="ml-2 text-xs text-slate-400">(deleted item)</span>}
                  </p>
                  <p className="text-xs text-slate-400">
                    {entry.UserName || entry.UserID} · {ACTION_LABELS[entry.Action]}
                  </p>
                </div>
                <span className="ui-badge bg-slate-800 text-slate-200 tabular-nums" aria-label={`Quantity change: ${entry.Quantity > 0 ? '+' : ''}${entry.Quantity}`}>
                  {entry.Quantity > 0 ? '+' : ''}{entry.Quantity}
                </span>
              </div>
              {entry.Description && <p className="whitespace-pre-wrap break-words text-sm text-slate-300">{entry.Description}</p>}
              <time dateTime={entry.ChangeTime} className="block text-xs text-slate-500">
                {new Date(entry.ChangeTime).toLocaleString()}
              </time>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
};
