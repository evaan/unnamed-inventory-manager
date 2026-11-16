import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { hasPermission } from '../features/auth/auth';
import { useAuth } from '../features/auth/useAuth';
import { AccountSettings } from '../features/settings/AccountSettings';
import { AppSettings } from '../features/settings/AppSettings';
import { UsersSettings } from '../features/settings/UsersSettings';

export const SettingsPage = () => {
  const auth = useAuth();
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
    <div className="min-h-dvh bg-slate-950">
      <PageHeader />
      <div className="ui-toolbar">
        <nav aria-label="Settings sections" className="flex flex-wrap gap-2">
          {tabs.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) => `rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >{label}</NavLink>
          ))}
        </nav>
      </div>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
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
