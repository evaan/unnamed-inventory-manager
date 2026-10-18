// App.tsx
import { useAuth } from './features/auth/useAuth';
import { LoginPage } from './pages/LoginPage';
import { MainPage } from './pages/MainPage';

function App() {
  const { auth, loading, login, logout } = useAuth();

  if (loading) return <p>Loading...</p>;

  if (!auth?.loggedIn) {
    return <LoginPage onLogin={login} />;
  }

  return <MainPage user={auth} onLogout={logout} />;
}

export default App;