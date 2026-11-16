import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, UserRound } from 'lucide-react';
import { ListSkeleton } from '../../components/ListSkeleton';
import { Modal } from '../../components/Modal';
import { authQueryKey } from '../auth/auth';
import { PERMISSIONS } from '../auth/permissions';
import {
  getUsers, putUserPermissions, setUserDisabled, usersQueryKey, type ManagedUser,
} from './settingsapi';
import { BUTTON, CARD, INPUT } from './styles';

const UserEditor = ({ user, currentEmail }: { user: ManagedUser; currentEmail: string }) => {
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

  const toggle = (permission: string) => {
    setSaved(false);
    save.reset();
    setPermissions((previous) => previous.includes(permission)
      ? previous.filter((value) => value !== permission)
      : [...previous, permission]);
  };

  return (
    <section aria-label={`Manage ${user.email}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">{user.name || user.email}{isSelf && ' (you)'}</h3>
          <p className="mt-1 text-sm text-slate-400 break-all">{user.email}</p>
          <p className={`mt-2 text-xs ${user.disabled ? 'text-rose-300' : 'text-emerald-300'}`}>
            {user.disabled ? 'Disabled' : 'Active'}
          </p>
        </div>
        <button
          type="button"
          disabled={busy || isSelf}
          title={isSelf ? "You can't disable your own account." : undefined}
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
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
        onSubmit={(event) => {
          event.preventDefault();
          if (!changed || busy) return;
          if (user.permissions.includes('Administrator') && !permissions.includes('Administrator') &&
              !window.confirm(`Remove Administrator from ${user.email}?${isSelf ? ' You will lose access to administration.' : ''}`)) return;
          toggleDisabled.reset();
          setSaved(false);
          save.mutate();
        }}
      >
        <fieldset disabled={busy}>
          <legend className="text-sm font-medium">Permissions</legend>
          <p className="mt-1 text-xs text-slate-500">Administrator overrides all other permissions. Uncheck everything to clear access permissions.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {choices.map((permission) => (
              <label key={permission} className="flex items-start gap-3 rounded-lg border border-slate-800 p-3">
                <input
                  type="checkbox"
                  checked={permissions.includes(permission)}
                  onChange={() => toggle(permission)}
                  className="mt-0.5 accent-blue-500"
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
  );
};

export const UsersSettings = ({ currentEmail }: { currentEmail: string }) => {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const users = useQuery({
    queryKey: usersQueryKey,
    queryFn: ({ signal }) => getUsers(signal),
    retry: false,
  });
  if (users.isPending) return <ListSkeleton label="Loading users" />;
  if (users.isError) return (
    <div role="alert" className={CARD}>
      <p className="text-sm text-rose-300">{users.error.message}</p>
      <button className={`${BUTTON} mt-3`} onClick={() => void users.refetch()}>Try again</button>
    </div>
  );
  const filtered = users.data.filter((user) =>
    `${user.name} ${user.email}`.toLowerCase().includes(search.trim().toLowerCase())
  );
  const selected = users.data.find((user) => user.id === selectedId);

  return (
    <section>
      <h2 className="text-base font-semibold">Users</h2>
      <p className="mt-1 text-sm text-slate-400">Manage permissions and account access.</p>
      <label className="mt-5 block max-w-sm">
        <span className="sr-only">Search users</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users by name or email" className={INPUT} />
      </label>
      <ul aria-label="Users" className="mt-5 overflow-hidden rounded-xl border border-slate-800 divide-y divide-slate-800">
        {filtered.map((user) => (
          <li key={user.id}>
            <button
              aria-label={`${user.name || 'User'} ${user.email}${user.disabled ? ' (disabled)' : ''}`}
              aria-haspopup="dialog"
              aria-expanded={user.id === selectedId}
              onClick={() => setSelectedId(user.id)}
              className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400"
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
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                user.disabled ? 'bg-rose-500/10 text-rose-300' : 'bg-emerald-500/10 text-emerald-300'
              }`}>
                {user.disabled ? 'Disabled' : 'Active'}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            </button>
          </li>
        ))}
        {filtered.length === 0 && <li className="p-4 text-sm text-slate-500">{users.data.length ? 'No matching users.' : 'No users yet.'}</li>}
      </ul>
      {selected && (
        <Modal title="Manage user" onClose={() => setSelectedId(null)}>
          <UserEditor key={selected.id} user={selected} currentEmail={currentEmail} />
        </Modal>
      )}
    </section>
  );
};
