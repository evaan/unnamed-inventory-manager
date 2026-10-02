import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import MainPage from '../pages/MainPage';
import AccountPage from '../pages/AccountPage';
import SettingsPage from '../pages/SettingsPage';
import SplashPage from '../pages/SplashPage';
import AppLayout from '../layout/AppLayout';

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SplashPage />} />
        <Route path="/login" element={<LoginPage />} />
        
        {/* Protected layout routes */}
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<MainPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}