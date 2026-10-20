import { useAuth, useLogout } from '../features/auth/useAuth';

export const MainPage = () => {
  const auth = useAuth();
  const logout = useLogout();

  if (!auth.data?.loggedIn || auth.data.disabled) {
    return null;
  }
  else return (
    <div className="min-h-screen bg-gray-50 p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Inventory Dashboard</h1>
        <button
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
        >
          {logout.isPending ? 'Logging out…' : 'Log Out'}
        </button>
      </header>
      <main>
        {/* debug data remove this */}
        {<p>Name: {auth.data.name}</p>}
        {<p>Email: {auth.data.email}</p>}
        {<p>Permissions: {auth.data.permissions.join(", ")}</p>}
      </main>
    </div>
  );
};
