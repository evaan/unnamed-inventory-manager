import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { MainPage } from '../pages/MainPage';
import { AccountPage } from '../pages/AccountPage';
import { SettingsPage } from '../pages/SettingsPage';
import AppLayout from '../layout/AppLayout';

interface AppRoutesProps {
  token: string;
  onLoginSuccess: (token: string) => void;
  onLogout: () => void;
}

export default function AppRoutes({ token, onLoginSuccess, onLogout }: AppRoutesProps) {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainPage token={token} onLogout={onLogout} />} />
        <Route path="/login" element={<LoginPage onLoginSuccess={onLoginSuccess} />} />

        {/* Protected layout routes */}
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<MainPage token={token} onLogout={onLogout} />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
