import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ErrorBanner } from '../components/ErrorBanner';
import { ListSkeleton } from '../components/ListSkeleton';
import { DetailPanel, Workspace } from '../components/Workspace';
import { useAuth } from '../features/auth/useAuth';
import { ChangelogDetails } from '../features/items/ChangelogDetails';
import { getLogs, type ChangelogEntry } from '../features/items/changelogapi';
import { groupChangelog } from '../features/items/groupChangelog';

const ACTION_LABELS: Record<ChangelogEntry['Action'], string> = {
  CREATE: 'Created',
  ADDED: 'Stock added',
  TAKEN: 'Stock taken',
  MODIFIED: 'Modified',
  DELETE: 'Deleted',
};

const selectChangelog = (entries: ChangelogEntry[]) =>
  groupChangelog(entries).filter((entry) =>
    entry.Action !== 'MODIFIED' || entry.Quantity !== 0 || !!entry.Changes?.length,
  );

export const ChangelogPage = () => {
  const auth = useAuth();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const session = auth.data?.loggedIn && !auth.data.disabled ? auth.data : null;
  const logs = useQuery({
    queryKey: ['inventory', session?.email, 'logs'],
    queryFn: getLogs,
    select: selectChangelog,
    enabled: !!session,
    retry: false,
  });
  const selectedEntry = logs.data?.find((entry) => entry.ID === selectedId);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!session) return null;

  return (
    <Workspace>
      <div className="flex min-w-0 flex-1 flex-col">
        {logs.error && (
          <ErrorBanner message={logs.error.message} onRetry={() => void logs.refetch()} retrying={logs.isFetching} />
        )}
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          {logs.isLoading ? (
            <ListSkeleton label="Loading changelog" />
          ) : logs.data?.length === 0 ? (
            <p className="ui-empty-state">No inventory changes yet.</p>
          ) : (
            <ol className="mx-auto max-w-5xl space-y-4">
              {logs.data?.map((entry) => (
                <li key={entry.ID}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(selectedId === entry.ID ? null : entry.ID)}
                    aria-pressed={selectedId === entry.ID}
                    className={`ui-card flex w-full flex-wrap items-start justify-between gap-3 text-left transition-colors hover:bg-slate-800/50 ${
                      selectedId === entry.ID ? 'ring-1 ring-slate-400' : ''
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block break-words font-medium">
                        {entry.Item.ItemName || entry.ItemID}
                        {entry.Item.DeletedAt && <span className="ml-2 text-xs text-slate-400">(deleted item)</span>}
                      </span>{' '}
                      <span className="mt-1 block text-sm text-slate-400">
                        {ACTION_LABELS[entry.Action]} by {entry.UserName || entry.UserID}
                      </span>{' '}
                      <time dateTime={entry.ChangeTime} className="mt-1 block text-xs text-slate-500">
                        {new Date(entry.ChangeTime).toLocaleString()}
                      </time>
                    </span>{' '}
                    {entry.Action !== 'MODIFIED' && entry.Quantity !== 0 && (
                      <span className="ui-badge bg-slate-800 text-slate-200 tabular-nums">
                        Stock change: {entry.Quantity > 0 ? '+' : ''}{entry.Quantity}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </main>
      </div>
      <DetailPanel label="Changelog details" open={!!selectedEntry}>
        {selectedEntry && (
          <ChangelogDetails
            entry={selectedEntry}
            actionLabel={ACTION_LABELS[selectedEntry.Action]}
            onClose={() => setSelectedId(null)}
          />
        )}
      </DetailPanel>
    </Workspace>
  );
};
