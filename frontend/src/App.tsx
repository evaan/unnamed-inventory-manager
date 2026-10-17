import { useState } from 'react';
import { LoginPage } from './pages/LoginPage';
import { MainPage } from './pages/MainPage';

function App() {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('google_token');
  });

  const handleLogin = (accessToken: string) => {
    localStorage.setItem('google_token', accessToken);
    setToken(accessToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('google_token');
    setToken(null);
  };

  //if (!token) {
  //  return <LoginPage onLoginSuccess={handleLogin} />;
  //}

  return <MainPage token={token} onLogout={handleLogout} />;
}

export default App;