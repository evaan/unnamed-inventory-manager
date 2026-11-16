import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, UserRound, X } from 'lucide-react';
import { ListSkeleton } from '../../components/ListSkeleton';
import { DetailPanel } from '../../components/Workspace';
import { SearchInput } from '../../components/SearchInput';
import { authQueryKey } from '../auth/auth';
import { PERMISSIONS } from '../auth/permissions';
import {
  getUsers, putUserPermissions, setUserDisabled, usersQueryKey, type ManagedUser,
} from './settingsapi';
import { BUTTON, CARD } from '../../components/styles';
import { useConfirm } from '../../hooks/useConfirm';

const UserEditor = ({ user, currentEmail, onClose }: { user: ManagedUser; currentEmail: string; onClose: () => void }) => {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [permissions, setPermissions] = useState(user.permissions);
  const [saved, setSaved] = useState(false);
  const isSelf = user.email === currentEmail;
  const updateUser = (changes: Partial<ManagedUser>) => {
    queryClient.setQueryData<ManagedUser[]>(usersQueryKey, (users) =>
      users?.map((entry) => entry.id === user.id ? { ...entry, ...changes } : entry)
    );
    void queryClient.invalidateQueries({ queryKey: authQueryKey });
  };
  const save = useMutation({
    mutationFn: () => putUserPermissions(user.id, permissions),
    onSuccess: () => { updateUser({ permissions }); setSaved(true); },
  });
  const toggleDisabled = useMutation({
    mutationFn: () => setUserDisabled(user.id, !user.disabled),
    onSuccess: () => updateUser({ disabled: !user.disabled }),
  });
  const busy = save.isPending || toggleDisabled.isPending;
  const choices = [...new Set([...PERMISSIONS.map((p) => p.name), ...user.permissions, ...permissions])];
  const changed = [...permissions].sort().join('\n') !== [...user.permissions].sort().join('\n');
  const error = save.error ?? toggleDisabled.error;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !busy) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  const toggle = (permission: string) => {
    if (isSelf && permission === 'Administrator') return;
    setSaved(false);
    save.reset();
    setPermissions((previous) => previous.includes(permission)
      ? previous.filter((value) => value !== permission)
      : [...previous, permission]);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
        <h2 className="text-base font-semibold">Manage user</h2>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Close user details" className="ui-icon-button -mr-1.5">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <section aria-label={`Manage ${user.email}`} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="break-words font-semibold">{user.name || user.email}{isSelf && ' (you)'}</h3>
            <p className="mt-1 text-sm text-slate-400 break-all">{user.email}</p>
            <p className={`mt-2 text-xs ${user.disabled ? 'text-rose-300' : 'text-emerald-300'}`}>
              {user.disabled ? 'Disabled' : 'Active'}
            </p>
          </div>
          <button
            type="button"
            disabled={busy || isSelf}
            title={isSelf ? "You can't disable your own account." : undefined}
            className="ui-button-secondary"
            onClick={() => {
              if (isSelf) return;
              save.reset();
              toggleDisabled.mutate();
            }}
          >
            {toggleDisabled.isPending ? 'Saving…' : user.disabled ? 'Enable user' : 'Disable user'}
          </button>
        </div>
        <form
          className="mt-6"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!changed || busy || (isSelf && !permissions.includes('Administrator'))) return;
            if (user.permissions.includes('Administrator') && !permissions.includes('Administrator') &&
                !await confirm({
                  title: 'Remove Administrator?',
                  message: `Remove Administrator from ${user.email}?`,
                  confirmLabel: 'Remove Administrator',
                  destructive: true,
                })) return;
            toggleDisabled.reset();
            setSaved(false);
            save.mutate();
          }}
        >
          <fieldset disabled={busy}>
            <legend className="text-sm font-medium">Permissions</legend>
            <p id="user-permissions-help" className="mt-1 text-xs text-slate-500">Administrator overrides all other permissions. {isSelf ? "You can't remove your own Administrator permission." : 'Uncheck everything to clear access permissions.'}</p>
            <div className="mt-4 grid gap-3">
              {choices.map((permission) => (
                <label key={permission} className="flex items-start gap-3 rounded-lg border border-slate-800 p-3">
                  <input
                    type="checkbox"
                    disabled={isSelf && permission === 'Administrator'}
                    aria-describedby={isSelf && permission === 'Administrator' ? 'user-permissions-help' : undefined}
                    checked={permissions.includes(permission)}
                    onChange={() => toggle(permission)}
                    className="mt-0.5 accent-white"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm break-all">{permission}</span>
                    <span className="block mt-1 text-xs text-slate-500">
                      {PERMISSIONS.find((p) => p.name === permission)?.purpose ?? 'Custom permission'}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <button type="submit" disabled={!changed || busy} className={`${BUTTON} mt-5`}>
              {save.isPending ? 'Saving…' : 'Save permissions'}
            </button>
          </fieldset>
        </form>
        {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error.message}</p>}
        {saved && !changed && <p role="status" className="mt-4 text-sm text-emerald-300">Permissions saved.</p>}
      </section>
    </div>
  );
};

export const UsersSettings = ({ currentEmail }: { currentEmail: string }) => {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeUser = useCallback(() => {
    setSelectedId(null);
    triggerRef.current?.focus();
  }, []);
  const users = useQuery({
    queryKey: usersQueryKey,
    queryFn: ({ signal }) => getUsers(signal),
    retry: false,
  });
  if (users.isPending) return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8"><ListSkeleton label="Loading users" /></div>
  );
  if (users.isError) return (
    <div role="alert" className={`${CARD} m-4 self-start sm:m-6`}>
      <p className="text-sm text-rose-300">{users.error.message}</p>
      <button className={`${BUTTON} mt-3`} onClick={() => void users.refetch()}>Try again</button>
    </div>
  );
  const filtered = users.data.filter((user) =>
    `${user.name} ${user.email}`.toLowerCase().includes(search.trim().toLowerCase())
  );
  const selected = users.data.find((user) => user.id === selectedId);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <section className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-base font-semibold">Users</h2>
          <p className="mt-1 text-sm text-slate-400">Manage permissions and account access.</p>
          <div className="mt-5 max-w-sm">
            <SearchInput value={search} onChange={setSearch} placeholder="Search users by name or email" label="Search users" />
          </div>
          <ul aria-label="Users" className="mt-5 overflow-hidden rounded-xl border border-slate-800 divide-y divide-slate-800">
            {filtered.map((user) => (
              <li key={user.id}>
                <button
                  aria-label={`${user.name || 'User'} ${user.email}${user.disabled ? ' (disabled)' : ''}`}
                  aria-expanded={user.id === selectedId}
                  onClick={(event) => {
                    triggerRef.current = event.currentTarget;
                    setSelectedId(user.id);
                  }}
                  className={`flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white ${user.id === selectedId ? 'bg-slate-900' : ''}`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-400">
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {user.name || user.email}{user.email === currentEmail && ' (you)'}
                    </span>
                    <span className="mt-1 block truncate text-xs text-slate-500">{user.email}</span>
                  </span>
                  <span className={user.disabled ? 'ui-badge-danger' : 'ui-badge-success'}>
                    {user.disabled ? 'Disabled' : 'Active'}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="p-4 text-sm text-slate-500">{users.data.length ? 'No matching users.' : 'No users yet.'}</li>}
          </ul>
        </div>
      </section>
      <DetailPanel label="User details" open={!!selected}>
        {selected && <UserEditor key={selected.id} user={selected} currentEmail={currentEmail} onClose={closeUser} />}
      </DetailPanel>
    </div>
  );
};
