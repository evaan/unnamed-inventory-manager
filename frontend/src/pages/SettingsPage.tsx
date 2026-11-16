import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { PageNavigation } from '../components/PageNavigation';
import { hasPermission } from '../features/auth/auth';
import { useAuth, useLogout } from '../features/auth/useAuth';
import { AccountSettings } from '../features/settings/AccountSettings';
import { AppSettings } from '../features/settings/AppSettings';
import { UsersSettings } from '../features/settings/UsersSettings';

export const SettingsPage = () => {
  const auth = useAuth();
  const logout = useLogout();
  if (!auth.data?.loggedIn || auth.data.disabled) return null;
  const admin = hasPermission(auth.data, 'Administrator');
  const tabs = [
    { to: '/app/settings', label: 'Account' },
    ...(admin ? [
      { to: '/app/settings/users', label: 'Users' },
      { to: '/app/settings/app', label: 'App settings' },
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 selection:bg-indigo-500 selection:text-white">
      <header className="flex flex-wrap items-center gap-4 border-b border-slate-800 bg-slate-900/50 px-6 py-3">
        <nav aria-label="Settings sections" className="mr-auto flex flex-wrap gap-2">
          {tabs.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) => `rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
              }`}
            >{label}</NavLink>
          ))}
        </nav>
        <PageNavigation />
        <button
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="shrink-0 rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-400 disabled:opacity-40"
        >
          {logout.isPending ? 'Logging out…' : 'Log out'}
        </button>
      </header>
      {logout.error && <p role="alert" className="px-6 py-3 text-sm text-rose-300">{logout.error.message}</p>}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Routes>
          <Route index element={<AccountSettings />} />
          <Route path="users" element={admin ? <UsersSettings currentEmail={auth.data.email} /> : <Navigate to="/app/settings" replace />} />
          <Route path="app" element={admin ? <AppSettings /> : <Navigate to="/app/settings" replace />} />
          <Route path="*" element={<Navigate to="/app/settings" replace />} />
        </Routes>
      </main>
    </div>
  );
};
