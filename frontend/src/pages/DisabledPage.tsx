import { useLogout } from '../features/auth/useAuth';

export const DisabledPage = () => {
  const logout = useLogout();

  return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-200 p-8 text-center shadow-2xl">
        <h1 className="text-2xl font-bold text-slate-900">Account disabled</h1>
        <p className="mt-3 text-slate-600">
          Your account has been disabled. Please contact an administrator.
        </p>
        {logout.error && <p role="alert" className="mt-3 text-red-700">{logout.error.message}</p>}
        <button
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="mt-6 rounded bg-slate-800 px-4 py-2 text-white disabled:opacity-50"
        >
          {logout.isPending ? 'Logging out…' : 'Log Out'}
        </button>
      </div>
    </div>
  );
};
