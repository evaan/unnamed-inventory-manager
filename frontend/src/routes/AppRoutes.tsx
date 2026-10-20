import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { MainPage } from '../pages/MainPage';
import { AccountPage } from '../pages/AccountPage';
import { SettingsPage } from '../pages/SettingsPage';
import { DisabledPage } from '../pages/DisabledPage';
import AppLayout from '../layout/AppLayout';
import { useAuth } from '../features/auth/useAuth';

function SessionRoutes() {
  const auth = useAuth();

  if (auth.isPending) {
    return (<>{/* maybe add placeholder stuff here? */}</>);
  }

  if (auth.isError) {
    return (
      <div className="p-6">
        <p role="alert">{auth.error.message}</p>
        <button
          onClick={() => void auth.refetch()}
          disabled={auth.isFetching}
          className="mt-3 rounded bg-slate-800 px-4 py-2 text-white disabled:opacity-50"
        >
          Try again
        </button>
      </div>
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
        <Route path="account" element={<AccountPage />} />
        <Route path="settings" element={<SettingsPage />} />
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
