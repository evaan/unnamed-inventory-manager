import { useLogout } from '../features/auth/useAuth';
import { AuthPageShell } from '../components/AuthPageShell';
import { ThemeToggle } from '../components/ThemeToggle';

export const DisabledPage = () => {
  const logout = useLogout();

  return (
    <AuthPageShell>
      <h1 className="text-2xl font-semibold tracking-tight">Account disabled</h1>
      <p className="mt-3 text-sm text-slate-400">
        Your account has been disabled. Please contact an administrator.
      </p>
      {logout.error && <p role="alert" className="mt-3 text-sm text-rose-300">{logout.error.message}</p>}
      <div className="mt-6 flex items-center justify-center gap-2">
        <ThemeToggle />
        <button
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="ui-button-secondary"
        >
          {logout.isPending ? 'Logging out…' : 'Log out'}
        </button>
      </div>
    </AuthPageShell>
  );
};
