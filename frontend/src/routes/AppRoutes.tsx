import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { MainPage } from '../pages/MainPage';
import { SettingsPage } from '../pages/SettingsPage';
import { BookingsPage } from '../pages/BookingsPage';
import { DisabledPage } from '../pages/DisabledPage';
import AppLayout from '../layout/AppLayout';
import { useAuth } from '../features/auth/useAuth';
import { AuthPageShell } from '../components/AuthPageShell';

function SessionRoutes() {
  const auth = useAuth();

  if (auth.isPending) {
    return (
      <AuthPageShell>
        <p role="status" className="text-sm text-slate-400">Loading your account…</p>
      </AuthPageShell>
    );
  }

  if (auth.isError) {
    return (
      <AuthPageShell>
        <h1 className="text-2xl font-semibold tracking-tight">Unable to load your account</h1>
        <p role="alert" className="mt-3 text-sm text-rose-300">{auth.error.message}</p>
        <button
          onClick={() => void auth.refetch()}
          disabled={auth.isFetching}
          className="ui-button-primary mt-6"
        >
          Try again
        </button>
      </AuthPageShell>
    );
  }

  const loggedIn = auth.data.loggedIn;
  const disabled = loggedIn && auth.data.disabled;
  const destination = !loggedIn ? '/login' : disabled ? '/disabled' : '/app';

  return (
    <Routes>
      <Route path="/" element={<Navigate to={destination} replace />} />
      <Route
        path="/login"
        element={loggedIn ? <Navigate to={destination} replace /> : <LoginPage />}
      />

      <Route
        path="/disabled"
        element={disabled ? <DisabledPage /> : <Navigate to={destination} replace />}
      />

      <Route
        path="/app"
        element={loggedIn && !disabled ? <AppLayout /> : <Navigate to={destination} replace />}
      >
        <Route index element={<MainPage />} />
        <Route path="account" element={<Navigate to="/app/settings" replace />} />
        <Route path="settings/*" element={<SettingsPage />} />
        <Route path="bookings" element={<BookingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to={destination} replace />} />
    </Routes>
  );
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <SessionRoutes />
    </BrowserRouter>
  );
}
